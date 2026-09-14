import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Subscription from '@/pages/Subscription';
import paymentCopy from '@/content/payment';
import { SESSION_CLEARED_EVENT } from '@/lib/secure-storage';

const mocks = vi.hoisted(() => ({ cancel: vi.fn(), portal: vi.fn(), refresh: vi.fn(), toast: vi.fn(),
  auth: null as null | ((event: { payload: { event: string } }) => void) }));
vi.mock('aws-amplify/utils', () => ({ Hub: { listen: (_channel: string, callback: typeof mocks.auth) => {
  mocks.auth = callback; return () => { mocks.auth = null; };
} } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/context/SubscriptionContext', () => ({ useSubscription: () => ({
  isLoading: false, isSubscribed: true, planName: 'Test plan', refresh: mocks.refresh,
  subscription: { discountPercent: 0, cancelAtPeriodEnd: false },
}) }));
vi.mock('@/lib/subscription', () => ({ PLAN_DISPLAY: [], subscriptionApi: { cancel: mocks.cancel, getPortalUrl: mocks.portal } }));
vi.mock('@/lib/payment-client', () => ({ getPaymentClient: vi.fn() }));
vi.mock('@/components/subscription/SubscriptionCheckout', () => ({ SubscriptionCheckout: () => null }));

describe('Subscription management lifetime', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.refresh.mockResolvedValue(true); vi.stubGlobal('confirm', vi.fn().mockReturnValue(true)); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it('does not notify or refresh when cancellation returns after unmount', async () => {
    let finish!: (result: { accessUntil: string }) => void;
    mocks.cancel.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const view = render(<MemoryRouter><Subscription /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    view.unmount();
    await act(async () => finish({ accessUntil: '2030-01-01T00:00:00Z' }));
    expect(mocks.toast).not.toHaveBeenCalled(); expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it('does not open billing when the response arrives after unmount', async () => {
    let finish!: (result: { url: string }) => void;
    mocks.portal.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const view = render(<MemoryRouter><Subscription /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /manage billing/i }));
    view.unmount();
    await act(async () => finish({ url: 'https://billing.example.test/session' }));
    expect(open).not.toHaveBeenCalled(); expect(mocks.toast).not.toHaveBeenCalled();
  });
  it('does not expose provider failure text', async () => {
    mocks.cancel.mockRejectedValue(new Error('test-provider-private-diagnostic'));
    render(<MemoryRouter><Subscription /></MemoryRouter>);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /cancel/i })));
    expect(JSON.stringify(mocks.toast.mock.calls)).not.toContain('test-provider-private-diagnostic');
  });
  it('blocks duplicate and overlapping requests then confirms current cancellation', async () => {
    let finish!: (result: { accessUntil: string }) => void;
    mocks.cancel.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(<MemoryRouter><Subscription /></MemoryRouter>);
    const cancel = screen.getByRole('button', { name: /cancel/i });
    const portal = screen.getByRole('button', { name: /manage billing/i });
    act(() => { cancel.click(); cancel.click(); portal.click(); });
    expect(mocks.cancel).toHaveBeenCalledTimes(1); expect(mocks.portal).not.toHaveBeenCalled();
    expect(portal).toBeDisabled();
    await act(async () => finish({ accessUntil: '2030-01-01T00:00:00Z' }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: paymentCopy.cancellationScheduledTitle }));
  });
  it.each(['signedOut', 'tokenRefresh_failure', 'signedIn'])('rejects late portal completion and new work after %s', async event => {
    let finish!: (result: { url: string }) => void;
    mocks.portal.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<MemoryRouter><Subscription /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /manage billing/i }));
    act(() => mocks.auth?.({ payload: { event } }));
    await act(async () => finish({ url: 'https://billing.example.test/session' }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(open).not.toHaveBeenCalled(); expect(mocks.cancel).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });
  it('opens the current HTTPS portal without access to its opener', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    mocks.portal.mockResolvedValue({ url: 'https://billing.example.test/session' });
    render(<MemoryRouter><Subscription /></MemoryRouter>);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /manage billing/i })));
    expect(open).toHaveBeenCalledWith('https://billing.example.test/session', '_blank', 'noopener,noreferrer');
  });
  it.each(['http://billing.example.test/session', 'https://test-user:test-key@billing.example.test', 'not-a-url'])('rejects unsafe portal response %s', async url => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    mocks.portal.mockResolvedValue({ url });
    render(<MemoryRouter><Subscription /></MemoryRouter>);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /manage billing/i })));
    expect(open).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: paymentCopy.portalUnavailableTitle }));
  });
});

it('ignores a late portal after session clearing without a Hub event', async () => {
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  let finish!: (result: { url: string }) => void;
  mocks.portal.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const open = vi.spyOn(window, 'open').mockReturnValue(null);
  const view = render(<MemoryRouter><Subscription /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /manage billing/i }));
  act(() => window.dispatchEvent(new Event(SESSION_CLEARED_EVENT)));
  await act(async () => finish({ url: 'https://billing.example.test/session' }));
  expect(open).not.toHaveBeenCalled();
  view.unmount(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});
