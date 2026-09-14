import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import Subscription from '@/pages/Subscription';

const mocks = vi.hoisted(() => ({ load: vi.fn(), toast: vi.fn() }));
vi.mock('@/lib/payment-client', () => ({ getPaymentClient: mocks.load }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/context/SubscriptionContext', () => ({ useSubscription: () => ({ isLoading: false, isSubscribed: false }) }));
vi.mock('@stripe/react-stripe-js', () => ({ Elements: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/subscription/SubscriptionCheckout', () => ({ SubscriptionCheckout: ({ planId }: { planId: string }) => <div role="dialog">{planId}</div> }));

describe('Subscription selection lifetime', () => {
  beforeEach(() => { cleanup(); vi.clearAllMocks(); });
  it('locks other selections while the SDK loads and opens only the selected plan', async () => {
    let complete!: (value: unknown) => void;
    mocks.load.mockReturnValue(new Promise(resolve => { complete = resolve; }));
    render(<MemoryRouter><Subscription /></MemoryRouter>);
    const buttons = screen.getAllByRole('button', { name: 'Subscribe' });
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).toBeDisabled();
    expect(screen.getByRole('status')).toBeVisible();
    await act(async () => complete({}));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });
  it('does not notify or reopen checkout when initialization fails after navigation', async () => {
    let reject!: (value: Error) => void;
    mocks.load.mockReturnValue(new Promise((_resolve, fail) => { reject = fail; }));
    const view = render(<MemoryRouter><Subscription /></MemoryRouter>);
    fireEvent.click(screen.getAllByRole('button', { name: 'Subscribe' })[0]);
    view.unmount();
    await act(async () => reject(new Error('test-provider-unavailable')));
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
