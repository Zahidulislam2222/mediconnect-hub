import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/components/PublicHeader', () => ({ PublicHeader: () => null }));
vi.mock('aws-amplify/auth', () => ({ fetchAuthSession: vi.fn().mockResolvedValue({}) }));
vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/api', () => ({ api: { get: vi.fn().mockRejectedValue(new Error('test missing article')) } }));
const fetchMock = vi.fn();
const article = { id: 'test-article', title: 'Primary configuration article', category: 'Wellness', legacyData: { content: [{ type: 'paragraph', children: [{ text: 'Synthetic article body' }] }] } };

beforeEach(() => {
  vi.resetModules(); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock);
  localStorage.setItem('userRegion', 'US');
  for (const region of ['US', 'EU']) {
    vi.stubEnv(`VITE_PATIENT_SERVICE_URL_${region}`, `https://${region.toLowerCase()}.example.invalid`);
    vi.stubEnv(`VITE_PATIENT_SERVICE_URL_${region}_BACKUP`, undefined);
    vi.stubEnv(`VITE_COGNITO_USER_POOL_ID_${region}`, 'test-pool');
    vi.stubEnv(`VITE_COGNITO_CLIENT_PATIENT_${region}`, 'test-client');
    vi.stubEnv(`VITE_COGNITO_IDENTITY_POOL_ID_${region}`, 'test-identity');
    vi.stubEnv(`VITE_S3_PATIENT_DATA_BUCKET_${region}`, 'test-bucket');
    vi.stubEnv(`VITE_AWS_REGION_${region}`, 'test-region');
  }
  vi.stubEnv('VITE_STRAPI_API_URL', undefined);
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it.each([undefined, '', '   '])('boots AWS configuration without optional CMS value %s', async value => {
  vi.stubEnv('VITE_STRAPI_API_URL', value);
  const config = await import('../aws-config');
  expect(config.getAwsConfig().Auth?.Cognito?.userPoolId).toBe('test-pool');
  expect(config.STRAPI_URL).toBeUndefined();
});

it('validates a configured CMS URL and rejects malformed values', async () => {
  vi.stubEnv('VITE_STRAPI_API_URL', 'https://cms.example.invalid');
  const configured = await import('../aws-config');
  expect(configured.STRAPI_URL).toBe('https://cms.example.invalid');
  vi.resetModules(); vi.stubEnv('VITE_STRAPI_API_URL', 'not-a-url');
  await expect(import('../aws-config')).rejects.toThrow('configuration');
});

it.each([undefined, '', '   '])('imports the unused subscription page without optional Stripe key %s', async value => {
  vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', value);
  const { loadStripe } = await import('@stripe/stripe-js');
  vi.mocked(loadStripe).mockClear();
  const page = await import('../pages/Subscription');
  expect(page.default).toBeTypeOf('function');
  expect(loadStripe).not.toHaveBeenCalled();
});

it.each([undefined, '', '   '])('loads the actual knowledge list with optional backup %s', async value => {
  for (const region of ['US', 'EU']) vi.stubEnv(`VITE_PATIENT_SERVICE_URL_${region}_BACKUP`, value);
  fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify([article]), { status: 200 })));
  const { default: Page } = await import('../pages/KnowledgeBase');
  render(<MemoryRouter><Page /></MemoryRouter>);
  expect(await screen.findByText(article.title)).toBeInTheDocument();
  expect(fetchMock.mock.calls.map(call => call[0]).sort()).toEqual([
    'https://eu.example.invalid/public/knowledge', 'https://us.example.invalid/public/knowledge',
  ]);
});

it.each([undefined, '', '   '])('loads the actual detail page with optional backup %s', async value => {
  for (const region of ['US', 'EU']) vi.stubEnv(`VITE_PATIENT_SERVICE_URL_${region}_BACKUP`, value);
  fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(article), { status: 200 })));
  const { default: Page } = await import('../pages/KnowledgeBasePost');
  render(<MemoryRouter initialEntries={['/knowledge/test-article']}><Routes><Route path="/knowledge/:slug" element={<Page />} /></Routes></MemoryRouter>);
  expect(await screen.findByText(article.title)).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe('https://eu.example.invalid/public/knowledge/test-article');
});
