import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionCheckout } from '@/components/subscription/SubscriptionCheckout';

const mocks = vi.hoisted(() => ({ create: vi.fn(), confirm: vi.fn(), status: vi.fn(), toast: vi.fn(), refresh: vi.fn() }));
import type * as SubscriptionNamespace from '@/lib/subscription';
type SubscriptionModule = typeof SubscriptionNamespace;
vi.mock('@/lib/subscription', async importOriginal => ({ ...await importOriginal<SubscriptionModule>(),
  subscriptionApi: { create: mocks.create, getStatus: mocks.status },
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/context/SubscriptionContext', () => ({ useSubscription: () => ({ refresh: mocks.refresh }) }));
vi.mock('@stripe/react-stripe-js', () => ({ CardElement: () => <p>Test payment field</p>,
  useStripe: () => ({ confirmCardPayment: mocks.confirm }), useElements: () => ({ getElement: () => ({}) }),
}));
function open() {
  const view = render(<MemoryRouter><SubscriptionCheckout planId="plus" isOpen onClose={() => {}} /></MemoryRouter>);
  for (const input of screen.getAllByRole('checkbox')) fireEvent.click(input);
  return view;
}
describe('Subscription provider status and activation', () => {
  beforeEach(() => {
    cleanup(); localStorage.clear(); vi.clearAllMocks();
    mocks.create.mockResolvedValue({ clientSecret: 'test-key' });
    mocks.confirm.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });
    mocks.status.mockResolvedValue({ status: 'active', planId: 'plus' });
    mocks.refresh.mockImplementation(() => mocks.status());
  });
  it('does not claim activation before the server confirms entitlement', async () => {
    mocks.status.mockResolvedValue({ status: 'incomplete', planId: 'plus' });
    open(); fireEvent.click(screen.getByRole('button', { name: /Subscribe -/ }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Subscription activation pending' })));
  });
  it('only announces activation for the selected server-confirmed plan', async () => {
    mocks.status.mockResolvedValue({ status: 'active', planId: 'plus' });
    open(); fireEvent.click(screen.getByRole('button', { name: /Subscribe -/ }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Subscription active' })));
  });
  it('does not confirm a payment if checkout closes during subscription creation', async () => {
    let complete!: (value: unknown) => void;
    mocks.create.mockReturnValue(new Promise(resolve => { complete = resolve; }));
    const view = open();
    fireEvent.click(screen.getByRole('button', { name: /Subscribe -/ }));
    view.unmount();
    await act(async () => complete({ clientSecret: 'test-key' }));
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });
  it('does not treat an absent error as a successful payment', async () => {
    mocks.confirm.mockResolvedValue({});
    open(); fireEvent.click(screen.getByRole('button', { name: /Subscribe -/ }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Subscription activation pending' })));
    expect(mocks.status).not.toHaveBeenCalled();
  });
  it.each(['processing', 'requires_capture', undefined])('does not create another subscription after uncertain confirmation %s', async status => {
    mocks.confirm.mockResolvedValue(status ? { paymentIntent: { status } } : {});
    open(); const submit = screen.getByRole('button', { name: /Subscribe -/ });
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Subscription activation pending' })));
    await act(async () => fireEvent.click(submit));
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(submit).toBeDisabled();
  });
  it('does not announce activation if shared status confirmation fails', async () => {
    mocks.status.mockResolvedValue({ status: 'active', planId: 'plus' });
    mocks.refresh.mockResolvedValue(false);
    open(); fireEvent.click(screen.getByRole('button', { name: /Subscribe -/ }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Subscription activation pending' })));
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Subscription active' }));
  });

  it.each(['create', 'confirm'] as const)('does not initiate again after an ambiguous %s exception', async stage => {
    mocks[stage].mockRejectedValueOnce(new Error('test-provider-unavailable'));
    open(); const submit = screen.getByRole('button', { name: /Subscribe -/ });
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    await act(async () => fireEvent.click(submit));
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.confirm).toHaveBeenCalledTimes(stage === 'create' ? 0 : 1);
    expect(submit).toBeDisabled();
  });

  it('reuses the same server payment attempt after an explicit card decline', async () => {
    mocks.confirm.mockResolvedValueOnce({ error: { type: 'card_error',
      payment_intent: { status: 'requires_payment_method' } } });
    mocks.status.mockResolvedValue({ status: 'active', planId: 'plus' });
    open(); const submit = screen.getByRole('button', { name: /Subscribe -/ });
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(submit).toBeEnabled();
    await act(async () => fireEvent.click(submit));
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.confirm).toHaveBeenCalledTimes(2);
    expect(mocks.confirm.mock.calls.map(call => call[0])).toEqual(['test-key', 'test-key']);
  });
  it('passes an abortable lifetime and ignores refresh completion after checkout unmount', async () => {
    mocks.status.mockResolvedValue({ status: 'active', planId: 'plus' });
    let finish!: (value: boolean) => void;
    mocks.refresh.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const view = open(); fireEvent.click(screen.getByRole('button', { name: /Subscribe -/ }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    const signal = mocks.refresh.mock.calls[0][0] as AbortSignal;
    expect(signal.aborted).toBe(false);
    view.unmount(); expect(signal.aborted).toBe(true);
    await act(async () => finish(true)); expect(mocks.toast).not.toHaveBeenCalled();
  });

  it('prevents another payment attempt when successful payment has unconfirmed shared status', async () => {
    mocks.status.mockResolvedValue({ status: 'active', planId: 'plus' });
    mocks.refresh.mockResolvedValue(false);
    open(); const submit = screen.getByRole('button', { name: /Subscribe -/ });
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    await act(async () => fireEvent.click(submit));
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(submit).toBeDisabled();
  });

});
