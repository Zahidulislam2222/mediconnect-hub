import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import Pharmacy from '@/pages/Pharmacy';
import { SESSION_CLEARED_EVENT } from '@/lib/secure-storage';
import type * as StorageNamespace from '@/lib/secure-storage';
import paymentCopy from '@/content/payment';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), payment: vi.fn(), toast: vi.fn(), setUser: vi.fn() }));
vi.mock('@/context/CheckoutContext', () => ({ useCheckout: () => ({ requestPayment: mocks.payment }) }));
vi.mock('@/lib/api', () => ({ api: { get: mocks.get, post: mocks.post } }));
vi.mock('@/lib/secure-storage', async original => ({ ...await original<typeof StorageNamespace>(), getUser: () => ({ id: 'test-patient', name: 'Test Patient' }), setUser: mocks.setUser }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('aws-amplify/auth', () => ({ getCurrentUser: async () => ({ userId: 'test-patient' }), fetchAuthSession: async () => ({}), signOut: async () => {} }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children, onLogout }: { children: ReactNode; onLogout: () => void }) => <><button onClick={onLogout}>Test logout</button>{children}</> }));
vi.mock('react-qr-code', () => ({ default: ({ value }: { value: string }) => <div data-testid="pickup-qr">{value}</div> }));

const prescription = (id: string, changes = {}) => ({ prescriptionId: id, medication: id, dosage: 'Test dosage', instructions: 'Test instructions', timestamp: '2026-01-01T00:00:00Z', status: 'ISSUED', paymentStatus: 'PAID', livePrice: 12, price: 99, liveStock: 5, refillsRemaining: 2, ...changes });
let rows = [prescription('test-alpha')];
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
async function open() { render(<MemoryRouter><Pharmacy /></MemoryRouter>); await screen.findByText(rows[0].medication); }

describe('Pharmacy response and action safety', () => {
  beforeEach(() => {
    vi.clearAllMocks(); rows = [prescription('test-alpha')];
    mocks.get.mockImplementation(async (path: string) => path.startsWith('/prescription') ? { prescriptions: rows } : path.startsWith('/billing') ? { currency: 'USD', transactions: [{ billId: 'test-bill', referenceId: 'test-alpha', patientId: 'test-patient', amount: 12, status: 'PENDING' }] } : { name: 'Test Patient' });
    mocks.payment.mockResolvedValue({ id: 'test-method' });
    mocks.post.mockResolvedValue({ message: 'Refill authorized' });
  });
  afterEach(cleanup);

  it.each([{}, { qrPayload: '' }, { qrPayload: '   ' }, { qrPayload: 'PICKUP-test-other' }])('does not invent or display a pickup code from %j', async response => {
    mocks.post.mockResolvedValue(response); await open(); fireEvent.click(screen.getByRole('button', { name: 'Pickup Code' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalled()); await act(async () => {});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('submits the exact clicked refill on its first click', async () => {
    rows = [prescription('test-alpha', { status: 'PICKED_UP' }), prescription('test-beta', { status: 'PICKED_UP' })];
    await open(); fireEvent.click(screen.getAllByRole('button', { name: /Refill/ })[1]);
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/pharmacy/request-refill', { prescriptionId: 'test-beta' }));
    expect(mocks.toast.mock.calls.flat().some(item => String(item.description).includes('Doctor notified'))).toBe(false);
    expect(screen.getAllByText('Pending')[0].parentElement).toHaveTextContent('1');
  });

  it('ignores a pickup result after session invalidation', async () => {
    const result = deferred<{ qrPayload: string }>(); mocks.post.mockReturnValue(result.promise);
    await open(); fireEvent.click(screen.getByRole('button', { name: 'Pickup Code' }));
    act(() => window.dispatchEvent(new Event(SESSION_CLEARED_EVENT)));
    await act(async () => result.resolve({ qrPayload: 'PICKUP-test-alpha' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('reports an unknown payment outcome without optimistic settlement', async () => {
    rows = [prescription('test-alpha', { paymentStatus: 'UNPAID' })]; mocks.post.mockResolvedValue({});
    await open(); fireEvent.click(screen.getByRole('button', { name: /Pay/ }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalled()); await act(async () => {});
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: paymentCopy.unknownTitle }));
    expect(screen.queryByRole('button', { name: 'Pickup Code' })).not.toBeInTheDocument();
    expect(mocks.payment).toHaveBeenCalledWith(expect.objectContaining({ amount: 12 }));
  });

  it('renders the exact valid server pickup code and matching ready state', async () => {
    mocks.post.mockResolvedValue({ qrPayload: 'PICKUP-test-alpha' }); await open();
    fireEvent.click(screen.getByRole('button', { name: 'Pickup Code' }));
    expect(await screen.findByTestId('pickup-qr')).toHaveTextContent('PICKUP-test-alpha');
  });

  it('serializes actions so another prescription cannot replace an in-flight pickup', async () => {
    rows = [prescription('test-alpha'), prescription('test-beta')];
    const result = deferred<{ qrPayload: string }>(); mocks.post.mockReturnValue(result.promise);
    await open(); const buttons = screen.getAllByRole('button', { name: 'Pickup Code' });
    fireEvent.click(buttons[0]); fireEvent.click(buttons[1]);
    expect(mocks.post).toHaveBeenCalledTimes(1);
    await act(async () => result.resolve({ qrPayload: 'PICKUP-test-alpha' }));
    expect(screen.getByTestId('pickup-qr')).toHaveTextContent('PICKUP-test-alpha');
  });

  it('ignores late profile and prescription reads after logout', async () => {
    const result = deferred<{ prescriptions: typeof rows }>();
    mocks.get.mockImplementation(async (path: string) => path.startsWith('/prescription') ? result.promise : { name: 'Stale Patient' });
    render(<MemoryRouter><Pharmacy /></MemoryRouter>);
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'Test logout' }));
    await act(async () => result.resolve({ prescriptions: rows }));
    expect(mocks.setUser).not.toHaveBeenCalled(); expect(screen.queryByText('test-alpha')).not.toBeInTheDocument();
  });

  it('does not restart profile reads after an authentication rejection', async () => {
    mocks.get.mockRejectedValue(Object.assign(new Error('test-auth-rejected'), { status: 401 }));
    render(<MemoryRouter><Pharmacy /></MemoryRouter>);
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2)); await act(async () => {});
    expect(mocks.get).toHaveBeenCalledTimes(2); expect(mocks.setUser).not.toHaveBeenCalled();
  });

  it('does not submit a payment when logout occurs during card collection', async () => {
    rows = [prescription('test-alpha', { paymentStatus: 'UNPAID' })];
    const result = deferred<{ id: string }>(); mocks.payment.mockReturnValue(result.promise);
    await open(); fireEvent.click(screen.getByRole('button', { name: /Pay/ }));
    await waitFor(() => expect(mocks.payment).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Test logout' }));
    await act(async () => result.resolve({ id: 'test-method' }));
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each([
    ['processing', paymentCopy.processingTitle], ['requires_capture', paymentCopy.processingTitle],
    ['requires_action', paymentCopy.actionTitle], ['requires_confirmation', paymentCopy.actionTitle],
    ['requires_payment_method', paymentCopy.failedTitle], ['canceled', paymentCopy.failedTitle],
    ['succeeded', paymentCopy.succeededTitle], ['unrecognized', paymentCopy.unknownTitle],
  ])('reports %s and never retries without reconciliation', async (status, title) => {
    rows = [prescription('test-alpha', { paymentStatus: 'UNPAID' })]; mocks.post.mockResolvedValue({ status });
    await open(); fireEvent.click(screen.getByRole('button', { name: /Pay/ }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title })));
    const button = await screen.findByRole('button', { name: /Pay/ });
    expect(button).toBeDisabled(); fireEvent.click(button); expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Pickup Code' })).not.toBeInTheDocument();
  });

  it('keeps an ambiguous payment blocked after a manual prescription sync', async () => {
    rows = [prescription('test-alpha', { paymentStatus: 'UNPAID' })]; mocks.post.mockRejectedValue(new Error('test-lost-response'));
    await open(); fireEvent.click(screen.getByRole('button', { name: /Pay/ }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: paymentCopy.unknownTitle })));
    fireEvent.click(screen.getByRole('button', { name: 'Sync' }));
    expect(await screen.findByRole('button', { name: /Pay/ })).toBeDisabled();
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it.each([{}, { message: 'Doctor notified' }])('does not claim a refill from %j or submit it twice', async response => {
    rows = [prescription('test-alpha', { status: 'PICKED_UP' })]; mocks.post.mockResolvedValue(response);
    await open(); fireEvent.click(screen.getByRole('button', { name: /Refill/ }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })));
    expect(screen.getByRole('button', { name: /Refill/ })).toBeDisabled(); expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it('cancelling payment collection allows another deliberate attempt without charging', async () => {
    rows = [prescription('test-alpha', { paymentStatus: 'UNPAID' })]; mocks.payment.mockRejectedValue(new Error('User cancelled payment'));
    await open(); fireEvent.click(screen.getByRole('button', { name: /Pay/ }));
    await waitFor(() => expect(mocks.payment).toHaveBeenCalled()); await act(async () => {});
    expect(mocks.post).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: /Pay/ })).toBeEnabled();
  });
});
