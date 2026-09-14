import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SubscriptionProvider, useSubscription } from '@/context/SubscriptionContext';
import Subscription from '@/pages/Subscription';
import paymentCopy from '@/content/payment';

const mocks = vi.hoisted(() => ({ status: vi.fn(), cancel: vi.fn(), toast: vi.fn(),
  identity: { id: 'test-user', role: 'patient', expires: 2000000000 },
  listeners: new Set<(event: { payload: { event: string } }) => void>() }));
vi.mock('aws-amplify/utils', () => ({ Hub: { listen: (_: string, callback: (event: { payload: { event: string } }) => void) => {
  mocks.listeners.add(callback); return () => mocks.listeners.delete(callback);
} } }));
vi.mock('@/context/VerifiedSession', () => ({ useVerifiedSession: () => mocks.identity }));
vi.mock('@/lib/secure-storage', () => ({ isAuthenticated: () => true, SESSION_CLEARED_EVENT: 'test-session-cleared' }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/lib/subscription', () => ({ PLAN_DISPLAY: [], subscriptionApi: { getStatus: mocks.status, cancel: mocks.cancel } }));
vi.mock('@/lib/payment-client', () => ({ getPaymentClient: vi.fn() }));
vi.mock('@/components/subscription/SubscriptionCheckout', () => ({ SubscriptionCheckout: () => null }));
const initial = { planId: 'plus', status: 'active', discountPercent: 20, freeGpVisitsRemaining: 0,
  familyMembers: [], cycleStart: '', cycleEnd: '', cancelAtPeriodEnd: false };
function Observer() {
  const { subscription, isLoading } = useSubscription(); const navigate = useNavigate();
  return <><output data-testid="state">{JSON.stringify({ subscription, isLoading })}</output>
    <button onClick={() => navigate('/next')}>Navigate</button></>;
}
async function mount() {
  render(<MemoryRouter><SubscriptionProvider><Observer /><Subscription /></SubscriptionProvider></MemoryRouter>);
  await waitFor(() => expect(screen.getByRole('button', { name: /cancel/i })).toBeEnabled());
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.listeners.clear(); mocks.status.mockResolvedValue(initial);
  mocks.cancel.mockResolvedValue({ accessUntil: '2030-01-01T00:00:00Z' });
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('does not apply cancellation refresh after navigation', async () => {
  await mount(); let finish!: (value: typeof initial) => void;
  mocks.status.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /cancel/i })));
  fireEvent.click(screen.getByRole('button', { name: 'Navigate' }));
  await act(async () => finish({ ...initial, cancelAtPeriodEnd: true }));
  expect(screen.getByTestId('state')).toHaveTextContent('"cancelAtPeriodEnd":false');
  expect(screen.getByTestId('state')).toHaveTextContent('"isLoading":false');
  expect(mocks.toast).not.toHaveBeenCalled();
});
it.each(['signedOut', 'tokenRefresh_failure', 'signedIn'])('clears shared state and ignores refresh after %s', async event => {
  await mount(); let finish!: (value: typeof initial) => void;
  mocks.status.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /cancel/i })));
  act(() => mocks.listeners.forEach(listener => listener({ payload: { event } })));
  await act(async () => finish({ ...initial, cancelAtPeriodEnd: true }));
  expect(screen.getByTestId('state')).toHaveTextContent('"subscription":null');
  expect(mocks.toast).not.toHaveBeenCalled();
});
it('reports unconfirmed cancellation when the actual provider refresh fails', async () => {
  await mount(); mocks.status.mockRejectedValue(new Error('test-private-provider-diagnostic'));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /cancel/i })));
  expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: paymentCopy.cancellationUnconfirmedTitle }));
  expect(JSON.stringify(mocks.toast.mock.calls)).not.toContain('test-private-provider-diagnostic');
});

it('confirms cancellation only after the real provider refresh succeeds', async () => {
  await mount(); mocks.status.mockResolvedValue({ ...initial, cancelAtPeriodEnd: true });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /cancel/i })));
  expect(screen.getByTestId('state')).toHaveTextContent('"cancelAtPeriodEnd":true');
  expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: paymentCopy.cancellationScheduledTitle }));
});
it('clears shared state when the session boundary invalidates without a Hub event', async () => {
  await mount(); let finish!: (value: typeof initial) => void;
  mocks.status.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /cancel/i })));
  act(() => window.dispatchEvent(new Event('test-session-cleared')));
  await act(async () => finish({ ...initial, cancelAtPeriodEnd: true }));
  expect(screen.getByTestId('state')).toHaveTextContent('"subscription":null');
  expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: paymentCopy.cancellationScheduledTitle }));
});
