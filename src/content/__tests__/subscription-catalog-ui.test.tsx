import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type * as CatalogNamespace from '@/content/subscription-plans.json';
import { SubscriptionProvider, useSubscription } from '@/context/SubscriptionContext';
import Subscription from '@/pages/Subscription';

const mocks = vi.hoisted(() => ({ planId: 'plus' as string | null | undefined }));
type CatalogModule = { default: typeof CatalogNamespace };
vi.mock('@/content/subscription-plans.json', async importOriginal => {
  const actual = await importOriginal<CatalogModule>();
  const changed = structuredClone(actual.default);
  changed.plans[1].name = 'Test Plus Updated'; changed.plans[1].price = 23.5; changed.plans[1].discountPercent = 27;
  return { default: changed };
});
vi.mock('@/context/VerifiedSession', () => {
  const identity = { id: 'test-user', role: 'patient', expires: 2000000000 };
  return { useVerifiedSession: () => identity };
});
vi.mock('@/lib/api', () => ({ api: { get: async () => ({ planId: mocks.planId, status: 'active', discountPercent: 11,
  freeGpVisitsRemaining: 0, familyMembers: [], cycleStart: '', cycleEnd: '', cancelAtPeriodEnd: false }) } }));
vi.mock('@/lib/payment-client', () => ({ getPaymentClient: vi.fn() }));
vi.mock('@/components/subscription/SubscriptionCheckout', () => ({ SubscriptionCheckout: () => null }));
beforeEach(() => { mocks.planId = 'plus'; });
afterEach(cleanup);
it('catalog-only edits update actual plan cards and shared current-plan labels', async () => {
  render(<MemoryRouter><SubscriptionProvider><Subscription /></SubscriptionProvider></MemoryRouter>);
  expect(await screen.findAllByText('Test Plus Updated')).toHaveLength(2);
  expect(screen.getByText('$23.5')).toBeVisible();
  expect(screen.getByText('27% off every visit')).toBeVisible();
  expect(screen.getByText('27% discount on all visits')).toBeVisible();
  expect(screen.getByText('11% discount on all visits')).toBeVisible();
  expect(screen.queryByText('MediConnect Plus')).not.toBeInTheDocument();
});

function CurrentPlanLabel() { return <output aria-label="Current plan">{useSubscription().planName}</output>; }
it.each(['', 'test-unknown', null, undefined])('does not label malformed server plan %s as free', async planId => {
  mocks.planId = planId;
  render(<SubscriptionProvider><CurrentPlanLabel /></SubscriptionProvider>);
  expect(await screen.findByText('Unknown plan')).toBeVisible();
  expect(screen.getByLabelText('Current plan')).not.toHaveTextContent('Free');
});
