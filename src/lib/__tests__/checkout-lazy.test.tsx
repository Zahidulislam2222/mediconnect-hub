import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render as renderUi, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { CheckoutProvider, useCheckout } from '../../context/CheckoutContext';

const mocks = vi.hoisted(() => ({ load: vi.fn(), create: vi.fn(), toast: vi.fn(), auth: null as null | ((event: { payload: { event: string } }) => void) }));
vi.mock('aws-amplify/utils', () => ({ Hub: { listen: (_channel: string, callback: typeof mocks.auth) => { mocks.auth = callback; return () => {}; } } }));
vi.mock('../payment-client', () => ({ getPaymentClient: mocks.load }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: ReactNode }) => <>{children}</>,
  CardElement: () => <div>Test card element — not a real payment form</div>,
  useStripe: () => ({ createPaymentMethod: mocks.create }),
  useElements: () => ({ getElement: () => ({}) }),
}));

function render(children: ReactNode) { return renderUi(<MemoryRouter>{children}</MemoryRouter>); }

function Consumer({ onResult }: { onResult?: (result: string) => void }) {
  const { requestPayment } = useCheckout();
  const [result, setResult] = useState('idle');
  return <><button onClick={() => {
    requestPayment({ amount: 1, title: 'Synthetic checkout', description: 'No real charge' })
      .then(method => { setResult(method.id); onResult?.(method.id); })
      .catch(error => { setResult(error.message); onResult?.(error.message); });
  }}>Open test payment</button><output>{result}</output></>;
}

describe('Payment SDK isolation from clinical pages', () => {
  beforeEach(() => { cleanup(); vi.clearAllMocks(); });
  it('does not initialize payment services when clinical children render', () => {
    render(<CheckoutProvider><p>Clinical page</p></CheckoutProvider>);
    expect(screen.getByText('Clinical page')).toBeVisible();
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it('opens payment only after an explicit request and resolves the test payment method', async () => {
    mocks.load.mockResolvedValue({});
    mocks.create.mockResolvedValue({ paymentMethod: { id: 'test-method' } });
    render(<CheckoutProvider><Consumer /></CheckoutProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Open test payment' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Pay $1.00' }));
    await screen.findByText('test-method');
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('preserves the listed-fee disclosure through the real checkout modal', async () => {
    mocks.load.mockResolvedValue({});
    mocks.create.mockResolvedValue({ paymentMethod: { id: 'test-method' } });
    function EstimateConsumer() {
      const { requestPayment } = useCheckout();
      return <button onClick={() => void requestPayment({ amount: 1, title: 'Test appointment', description: 'Synthetic booking',
        presentation: { amount: '$1.00', label: 'Listed fee', disclosure: 'Final charge not yet verified.', confirmLabel: 'Use this payment method' } })}>Open test estimate</button>;
    }
    render(<CheckoutProvider><EstimateConsumer /></CheckoutProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Open test estimate' }));
    expect(await screen.findByText('Listed fee')).toBeVisible();
    expect(screen.getByText('Final charge not yet verified.')).toBeVisible();
    expect(screen.queryByText('Total Amount')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pay $1.00' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use this payment method' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
  });
  it('reports loading failure without opening a broken payment dialog', async () => {
    mocks.load.mockRejectedValue(new Error('PAYMENT_SERVICE_UNAVAILABLE'));
    render(<CheckoutProvider><Consumer /></CheckoutProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Open test payment' }));
    await screen.findByText('PAYMENT_SERVICE_UNAVAILABLE');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('releases checkout after a synchronous loader configuration error', async () => {
    mocks.load.mockImplementationOnce(() => { throw new Error('test-invalid-config'); }).mockResolvedValue({});
    render(<CheckoutProvider><Consumer /></CheckoutProvider>);
    fireEvent.click(screen.getByText('Open test payment'));
    await screen.findByText('PAYMENT_SERVICE_UNAVAILABLE');
    fireEvent.click(screen.getByText('Open test payment'));
    expect(await screen.findByRole('dialog')).toBeVisible();
  });
  it('cancels cleanly without creating a payment method', async () => {
    mocks.load.mockResolvedValue({});
    render(<CheckoutProvider><Consumer /></CheckoutProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Open test payment' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Close' }));
    await screen.findByText('User cancelled payment');
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('rejects a duplicate request while initialization is pending', async () => {
    let complete!: (value: unknown) => void;
    mocks.load.mockReturnValue(new Promise(resolve => { complete = resolve; }));
    const rendered = render(<CheckoutProvider><Consumer /></CheckoutProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Open test payment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open test payment' }));
    await screen.findByText('PAYMENT_UI_UNAVAILABLE');
    expect(mocks.load).toHaveBeenCalledTimes(1);
    rendered.unmount();
    complete({});
    await waitFor(() => expect(mocks.create).not.toHaveBeenCalled());
  });

  it('settles a pending request when its consumer disappears while provider stays mounted', async () => {
    let complete!: (value: unknown) => void;
    mocks.load.mockReturnValue(new Promise(resolve => { complete = resolve; }));
    const result = vi.fn();
    function Shell() {
      const [visible, setVisible] = useState(true);
      return <CheckoutProvider><button onClick={() => setVisible(false)}>Leave billing</button>
        {visible && <Consumer onResult={result} />}</CheckoutProvider>;
    }
    render(<Shell />);
    fireEvent.click(screen.getByText('Open test payment'));
    fireEvent.click(screen.getByText('Leave billing'));
    await waitFor(() => expect(result).toHaveBeenCalledWith('PAYMENT_UI_CLOSED'));
    await act(async () => complete({}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('cancels on route change even when the consumer and provider both stay mounted', async () => {
    let complete!: (value: unknown) => void;
    mocks.load.mockReturnValue(new Promise(resolve => { complete = resolve; }));
    const result = vi.fn();
    function Shell() {
      const navigate = useNavigate();
      return <CheckoutProvider><button onClick={() => navigate('/another-route')}>Navigate</button>
        <Consumer onResult={result} /></CheckoutProvider>;
    }
    render(<Shell />);
    fireEvent.click(screen.getByText('Open test payment'));
    fireEvent.click(screen.getByText('Navigate'));
    await act(async () => complete({}));
    expect(result).toHaveBeenCalledWith('PAYMENT_UI_CLOSED');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('discards a deferred card result after sign-out', async () => {
    mocks.load.mockResolvedValue({});
    let complete!: (value: unknown) => void;
    mocks.create.mockReturnValue(new Promise(resolve => { complete = resolve; }));
    const result = vi.fn();
    render(<CheckoutProvider><Consumer onResult={result} /></CheckoutProvider>);
    fireEvent.click(screen.getByText('Open test payment'));
    fireEvent.click(await screen.findByRole('button', { name: 'Pay $1.00' }));
    await act(async () => { mocks.auth?.({ payload: { event: 'signedOut' } }); });
    await act(async () => complete({ paymentMethod: { id: 'test-stale-method' } }));
    expect(result).toHaveBeenCalledWith('PAYMENT_UI_CLOSED');
    expect(result).not.toHaveBeenCalledWith('test-stale-method');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
