// S4 (memory/safe-followups-acceptance-20260925.md): Billing tells the patient a refused payment charged nothing, and
// never blames the provider for a payment the booking service refused before calling it.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import Billing from '@/pages/Billing';
import paymentCopy from '@/content/payment';
import { HttpResponseError, MutationOutcomeUnknownError } from '@/lib/api';
import type * as ApiNamespace from '@/lib/api';
import type * as StorageNamespace from '@/lib/secure-storage';
type StorageModule = typeof StorageNamespace;

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), payment: vi.fn(), toast: vi.fn(), setUser: vi.fn() }));
vi.mock('@/context/CheckoutContext', () => ({ useCheckout: () => ({ requestPayment: mocks.payment }) }));
vi.mock('@/lib/api', async importOriginal => ({ ...await importOriginal<typeof ApiNamespace>(), api: { get: mocks.get, post: mocks.post } }));
vi.mock('@/lib/secure-storage', async importOriginal => ({ ...await importOriginal<StorageModule>(), getUser: () => ({ id: 'test-patient', name: 'Test Patient' }), setUser: mocks.setUser, clearAllSensitive: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('aws-amplify/auth', () => ({ fetchAuthSession: async () => ({}), fetchUserAttributes: async () => ({ sub: 'test-patient' }), signOut: async () => {} }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: ReactNode }) => <>{children}</> }));

// Built without relying on constructor argument order, which differs between hub branches.
const refusal = (code: string) => Object.assign(new HttpResponseError('API Error: 409', 409), { code });

describe('Billing refusal made before any charge', () => {
  beforeEach(() => {
    cleanup(); vi.clearAllMocks();
    mocks.get.mockImplementation(async (path: string) => path.startsWith('/billing')
      ? { outstandingBalance: 10, transactions: [{ billId: 'test-invoice', patientId: 'test-patient', amount: 10, status: 'DUE' }] }
      : { name: 'Test Patient' });
    mocks.payment.mockResolvedValue({ id: 'test-method' });
  });
  async function payAndRead() {
    render(<MemoryRouter><Billing /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /pay/i }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalled());
    await act(async () => {});
    return mocks.toast.mock.calls.map(([notice]) => notice as { title?: string; description?: string });
  }

  it('has not-charged copy', () => {
    expect(paymentCopy.notChargedTitle).toBeTruthy();
    // BILL_ALREADY_PAID and BILL_NOT_PAYABLE come back exactly when money was already taken: speak only of this attempt.
    expect(paymentCopy.notChargedDescription).toMatch(/no new charge/i);
    expect(`${paymentCopy.notChargedTitle} ${paymentCopy.notChargedDescription}`).not.toMatch(/you have not been charged|cannot be paid/i);
  });

  it.each(['BILL_NOT_PAYABLE', 'BILL_ALREADY_PAID', 'BILL_AMOUNT_REQUIRES_REVIEW'])('a 409 %s is shown as not charged', async code => {
    mocks.post.mockRejectedValue(refusal(code));
    const notices = await payAndRead();
    expect(notices).toContainEqual(expect.objectContaining({ title: paymentCopy.notChargedTitle, description: paymentCopy.notChargedDescription }));
    expect(notices.some(n => n.title === paymentCopy.failedTitle || n.description === paymentCopy.failedDescription)).toBe(false);
    expect(notices.some(n => n.title === paymentCopy.unknownTitle)).toBe(false);
  });

  it('a reconciliation 409 is shown as unconfirmed, never as not charged or provider-declined', async () => {
    mocks.post.mockRejectedValue(refusal('PAYMENT_RECONCILIATION_REQUIRED'));
    const notices = await payAndRead();
    expect(notices).toContainEqual(expect.objectContaining({ title: paymentCopy.unknownTitle, description: paymentCopy.unknownDescription }));
    expect(notices.some(n => n.title === paymentCopy.notChargedTitle || n.title === paymentCopy.failedTitle)).toBe(false);
    // R6: the charge may have landed, so billing is reloaded and a paid bill is not offered again.
    await waitFor(() => expect(mocks.get.mock.calls.filter(([path]) => String(path).startsWith('/billing')).length).toBeGreaterThanOrEqual(2));
  });

  // R6b: a lost response may hide a charge that landed; the reload shows the bill as paid and stops offering it.
  it('a lost payment response reloads billing and shows a bill that was paid meanwhile', async () => {
    let billingLoads = 0;
    mocks.get.mockImplementation(async (path: string) => {
      if (!path.startsWith('/billing')) return { name: 'Test Patient' };
      billingLoads++;
      return billingLoads === 1
        ? { outstandingBalance: 10, transactions: [{ billId: 'test-invoice', patientId: 'test-patient', amount: 10, status: 'DUE' }] }
        : { outstandingBalance: 0, transactions: [{ billId: 'test-invoice', patientId: 'test-patient', amount: 10, status: 'PAID' }] };
    });
    mocks.post.mockRejectedValue(new MutationOutcomeUnknownError());
    const notices = await payAndRead();
    expect(notices).toContainEqual(expect.objectContaining({ title: paymentCopy.unknownTitle }));
    await waitFor(() => expect(billingLoads).toBeGreaterThanOrEqual(2));
    await waitFor(() => expect(screen.queryByRole('button', { name: /pay/i })).toBeNull());
  });

  it('a provider-declined payment keeps the declined notice and does not reload', async () => {
    mocks.post.mockRejectedValue(new Error('Your card was declined.'));
    const notices = await payAndRead();
    expect(notices).toContainEqual(expect.objectContaining({ title: paymentCopy.failedTitle }));
    await act(async () => {});
    expect(mocks.get.mock.calls.filter(([path]) => String(path).startsWith('/billing')).length).toBe(1);
  });
});
