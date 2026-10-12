import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), navigate: vi.fn(), api: vi.fn(), fetch: vi.fn(), media: vi.fn(), slug: 'cms:test-editorial' }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate, useParams: () => ({ slug: mocks.slug }) }));
vi.mock('@/components/PublicHeader', () => ({ PublicHeader: () => <nav>Fixture navigation</nav> }));
vi.mock('@/lib/cms-content', () => ({ fetchCmsArticles: mocks.list, fetchCmsArticle: mocks.detail }));
vi.mock('@/lib/api', () => ({ api: { get: mocks.api }, cmsApi: { media: mocks.media } }));
vi.mock('aws-amplify/auth', () => ({ fetchAuthSession: async () => ({ tokens: undefined }) }));
vi.mock('@/config/env', () => ({ publicEnv: () => 'https://clinical.example.test', optionalBackupUrl: () => '', requestTimeout: () => 100 }));
import KnowledgeBase from './KnowledgeBase';
import KnowledgeBasePost from './KnowledgeBasePost';
import { cmsContent } from '@/config/cms';
const content = [{ type: 'paragraph', children: [{ type: 'text', text: '<script>Editorial fixture text</script>' }] }];
const editorial = { id: 'cms:test-editorial', title: 'Published editorial fixture', description: 'Published editorial fixture', category: 'Wellness', content,
  legacyData: { content, category: 'Wellness' }, date: '2025-01-01T00:00:00.000Z', coverImage: null, _sourceCms: true };
beforeEach(() => {
  vi.clearAllMocks(); mocks.slug = 'cms:test-editorial'; mocks.list.mockResolvedValue([editorial]); mocks.detail.mockResolvedValue(editorial);
  mocks.media.mockResolvedValue(new Blob(['test-image'], { type: 'image/png' }));
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ Items: [{ id: 'test-clinical', title: 'Clinician fixture', category: 'Wellness' }] }) });
  vi.stubGlobal('fetch', mocks.fetch);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('preserves CMS article text and explains unavailable covers without fetching them', async () => {
  mocks.detail.mockResolvedValue({ ...editorial, unavailableCoverCount: 2 });
  render(<KnowledgeBasePost />);
  expect(await screen.findByText('<script>Editorial fixture text</script>')).toBeVisible();
  expect(screen.getByText(cmsContent.unavailableMediaLabel)).toBeVisible();
  expect(mocks.media).not.toHaveBeenCalled();
});
it('renders clinician and CMS articles together and namespaces editorial navigation', async () => {
  render(<KnowledgeBase />);
  expect(await screen.findByText('Published editorial fixture')).toBeInTheDocument(); expect(screen.getByText('Clinician fixture')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Published editorial fixture')); expect(mocks.navigate).toHaveBeenCalledWith('/knowledge/cms%3Atest-editorial');
});
it('keeps clinician content available when the optional CMS fails', async () => {
  mocks.list.mockRejectedValue(new Error('test CMS unavailable')); render(<KnowledgeBase />);
  expect(await screen.findByText('Clinician fixture')).toBeInTheDocument(); expect(screen.queryByText('Published editorial fixture')).not.toBeInTheDocument();
});
it('detail uses only CMS adapter, escapes text and labels editorial provenance truthfully', async () => {
  const view = render(<KnowledgeBasePost />);
  expect(await screen.findByText('<script>Editorial fixture text</script>')).toBeInTheDocument();
  expect(screen.getByText('MediConnect editorial team')).toBeInTheDocument(); expect(screen.getByText('Educational content')).toBeInTheDocument();
  expect(screen.queryByText('Clinical Compliance Reviewer')).not.toBeInTheDocument(); expect(view.container.querySelector('script')).toBeNull();
  expect(mocks.api).not.toHaveBeenCalled(); expect(mocks.detail).toHaveBeenCalledWith('cms:test-editorial', expect.any(AbortSignal));
  const signal = mocks.detail.mock.calls[0][1] as AbortSignal; view.unmount(); expect(signal.aborted).toBe(true);
});
it('renders inherited-property category names safely in library and detail', async () => {
  const hostileCategory = { ...editorial, category: '__proto__', legacyData: { ...editorial.legacyData, category: '__proto__' } };
  mocks.list.mockResolvedValue([hostileCategory]); mocks.detail.mockResolvedValue(hostileCategory);
  const library = render(<KnowledgeBase />); expect(await screen.findByText('Published editorial fixture')).toBeInTheDocument(); library.unmount();
  render(<KnowledgeBasePost />); expect(await screen.findByText('<script>Editorial fixture text</script>')).toBeInTheDocument();
});
it('recovers from a failed slug when navigating to a valid CMS article in the same component', async () => {
  mocks.detail.mockRejectedValueOnce(new Error('test unavailable')); const view = render(<KnowledgeBasePost />);
  expect(await screen.findByText('Unable to load article')).toBeInTheDocument();
  mocks.slug = 'cms:test-valid'; mocks.detail.mockResolvedValue({ ...editorial, id: 'cms:test-valid' }); view.rerender(<KnowledgeBasePost />);
  expect(await screen.findByText('<script>Editorial fixture text</script>')).toBeInTheDocument(); expect(screen.queryByText('Unable to load article')).toBeNull();
});
it('keeps CMS cover precedence over unexpected attachment metadata and renders all covers', async () => {
  const first = 'https://cms.example.test/uploads/first.png', second = 'https://cms.example.test/uploads/second.png';
  const withCovers = { ...editorial, coverImage: first, coverImages: [first, second], content: [{ ...content[0], attachment: { url: 'https://foreign.example.test/override.png' } }] };
  mocks.list.mockResolvedValue([withCovers]); mocks.detail.mockResolvedValue(withCovers);
  const library = render(<KnowledgeBase />); await screen.findByText(editorial.title);
  await vi.waitFor(() => expect(mocks.media).toHaveBeenCalledWith(first, expect.anything())); library.unmount(); mocks.media.mockClear();
  render(<KnowledgeBasePost />); await screen.findByText('<script>Editorial fixture text</script>');
  await vi.waitFor(() => { expect(mocks.media).toHaveBeenCalledWith(first, expect.anything()); expect(mocks.media).toHaveBeenCalledWith(second, expect.anything()); });
  expect(mocks.media.mock.calls.some(([url]) => url.includes('foreign.example.test'))).toBe(false);
});
it('keeps colliding clinician and CMS identities on distinct routes', async () => {
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ Items: [{ id: 'cms:test-editorial', title: 'Colliding clinician fixture', category: 'Wellness' }] }) });
  const library=render(<KnowledgeBase />); await screen.findByText(editorial.title);
  fireEvent.click(screen.getByText('Colliding clinician fixture')); expect(mocks.navigate).toHaveBeenCalledWith('/knowledge/clinical%3Acms%3Atest-editorial'); library.unmount();
  mocks.slug='clinical:cms:test-editorial'; mocks.api.mockResolvedValue({ ...editorial, id:'cms:test-editorial', _sourceCms:false }); render(<KnowledgeBasePost />);
  await screen.findByText('MediConnect Medical Board'); expect(mocks.api).toHaveBeenCalledWith('/public/knowledge/cms%3Atest-editorial'); expect(mocks.detail).not.toHaveBeenCalled();
});
