import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SubscriptionCheckout } from '@/components/subscription/SubscriptionCheckout';
import { SubscriptionProvider, useSubscription } from '@/context/SubscriptionContext';
import type { SubscriptionInfo } from '@/lib/subscription';
import type * as SubscriptionNamespace from '@/lib/subscription';
type SubscriptionModule = typeof SubscriptionNamespace;

const mocks = vi.hoisted(() => ({ status: vi.fn(), create: vi.fn(), confirm: vi.fn(), toast: vi.fn(),
  identity: { id: 'test-user', role: 'patient', expires: 2000000000 } }));
vi.mock('@/context/VerifiedSession', () => ({ useVerifiedSession: () => mocks.identity }));
vi.mock('aws-amplify/utils', () => ({ Hub: { listen: () => () => {} } }));
vi.mock('@/lib/subscription', async importOriginal => ({
  ...await importOriginal<SubscriptionModule>(),
  subscriptionApi: { getStatus: mocks.status, create: mocks.create },
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@stripe/react-stripe-js', () => ({ CardElement: () => <p>Test payment field</p>,
  useStripe: () => ({ confirmCardPayment: mocks.confirm }), useElements: () => ({ getElement: () => ({}) }),
}));
const initial: SubscriptionInfo = { planId: 'free', status: 'none', discountPercent: 0,
  freeGpVisitsRemaining: 0, familyMembers: [], cycleStart: '', cycleEnd: '', cancelAtPeriodEnd: false };
function Observer() {
  const { subscription } = useSubscription();
  return <output data-testid="shared-subscription">{JSON.stringify(subscription)}</output>;
}
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear();
  mocks.create.mockResolvedValue({ clientSecret: 'test-key' });
  mocks.confirm.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });
});
afterEach(cleanup);
it.each(['incomplete', 'cancelled'] as const)('announces the same status applied by the real provider when a later response is %s', async status => {
  mocks.status.mockResolvedValueOnce(initial)
    .mockResolvedValueOnce({ ...initial, planId: 'plus', status: 'active' })
    .mockResolvedValue({ ...initial, planId: 'plus', status });
  render(<MemoryRouter><SubscriptionProvider><Observer />
    <SubscriptionCheckout planId="plus" isOpen onClose={() => {}} />
  </SubscriptionProvider></MemoryRouter>);
  await waitFor(() => expect(screen.getByTestId('shared-subscription')).toHaveTextContent('"status":"none"'));
  for (const checkbox of screen.getAllByRole('checkbox')) fireEvent.click(checkbox);
  fireEvent.click(screen.getByRole('button', { name: /Subscribe -/ }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
  const shared = JSON.parse(screen.getByTestId('shared-subscription').textContent!);
  const announcedActive = mocks.toast.mock.calls.some(([value]) => value.title === 'Subscription active');
  expect(announcedActive).toBe(shared.status === 'active' && shared.planId === 'plus');
  expect(mocks.status).toHaveBeenCalledTimes(2); // Initial load plus one authoritative confirmation.
});
