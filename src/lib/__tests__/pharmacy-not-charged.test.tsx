// S4 (memory/safe-followups-acceptance-20260925.md): Pharmacy tells the patient a payment refused before any charge
// charged nothing and unlocks the row; a refusal that can follow a provider call stays unconfirmed and locked.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import Pharmacy from '@/pages/Pharmacy';
import type * as StorageNamespace from '@/lib/secure-storage';
import paymentCopy from '@/content/payment';
import copy from '@/content/pharmacy';
import { HttpResponseError } from '@/lib/api';
import type * as ApiNamespace from '@/lib/api';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), payment: vi.fn(), toast: vi.fn(), setUser: vi.fn() }));
vi.mock('@/context/CheckoutContext', () => ({ useCheckout: () => ({ requestPayment: mocks.payment }) }));
vi.mock('@/lib/api', async importOriginal => ({ ...await importOriginal<typeof ApiNamespace>(), api: { get: mocks.get, post: mocks.post } }));
vi.mock('@/lib/secure-storage', async original => ({ ...await original<typeof StorageNamespace>(), getUser: () => ({ id: 'test-patient', name: 'Test Patient' }), setUser: mocks.setUser }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('aws-amplify/auth', () => ({ getCurrentUser: async () => ({ userId: 'test-patient' }), fetchAuthSession: async () => ({}), signOut: async () => {} }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('react-qr-code', () => ({ default: ({ value }: { value: string }) => <div data-testid="pickup-qr">{value}</div> }));

const unpaid = { prescriptionId: 'test-alpha', medication: 'test-alpha', dosage: 'Test dosage', instructions: 'Test instructions', timestamp: '2026-01-01T00:00:00Z',
  status: 'ISSUED', paymentStatus: 'UNPAID', livePrice: 12, price: 99, liveStock: 5, refillsRemaining: 2 };
// Built without relying on constructor argument order, which differs between hub branches.
const refusal = (code: string) => Object.assign(new HttpResponseError('API Error: 409', 409), { code });

async function payAndRead(error: Error) {
  mocks.post.mockRejectedValue(error);
  render(<MemoryRouter><Pharmacy /></MemoryRouter>);
  await screen.findByText(unpaid.medication);
  fireEvent.click(screen.getByRole('button', { name: /Pay/ }));
  await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
  await act(async () => {});
  return mocks.toast.mock.calls.map(([notice]) => notice as { title?: string; description?: string });
}

describe('Pharmacy payment refused before any charge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockImplementation(async (path: string) => path.startsWith('/prescription') ? { prescriptions: [unpaid] }
      : path.startsWith('/billing') ? { currency: 'USD', transactions: [{ billId: 'test-bill', referenceId: 'test-alpha', patientId: 'test-patient', amount: 12, status: 'PENDING' }] }
      : { name: 'Test Patient' });
    mocks.payment.mockResolvedValue({ id: 'test-method' });
  });
  afterEach(cleanup);

  it.each(['BILL_NOT_PAYABLE', 'BILL_ALREADY_PAID', 'BILL_AMOUNT_REQUIRES_REVIEW'])('a 409 %s is shown as not charged and unlocks the row', async code => {
    const notices = await payAndRead(refusal(code));
    expect(notices).toContainEqual(expect.objectContaining({ title: paymentCopy.notChargedTitle, description: paymentCopy.notChargedDescription }));
    expect(notices.some(n => n.title === paymentCopy.unknownTitle)).toBe(false);
    await waitFor(() => expect(screen.getByRole('button', { name: /Pay/ })).toBeEnabled());
    expect(screen.queryByText(copy.paymentReview)).not.toBeInTheDocument();
    const prescriptionLoads = mocks.get.mock.calls.filter(([path]) => String(path).startsWith('/prescription')).length;
    expect(prescriptionLoads, 'prescriptions reloaded after the refusal').toBeGreaterThanOrEqual(2);
  });

  it('a reconciliation 409 stays unconfirmed and locked', async () => {
    const notices = await payAndRead(refusal('PAYMENT_RECONCILIATION_REQUIRED'));
    expect(notices).toContainEqual(expect.objectContaining({ title: paymentCopy.unknownTitle }));
    expect(notices.some(n => /not (been )?charged/i.test(`${n.title} ${n.description}`))).toBe(false);
    expect(screen.getByRole('button', { name: /Pay/ })).toBeDisabled();
    expect(screen.getByText(copy.paymentReview)).toBeInTheDocument();
  });
});
