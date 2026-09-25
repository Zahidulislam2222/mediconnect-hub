// S4 (memory/safe-followups-acceptance-20260925.md): Billing tells the patient a refused payment charged nothing, and
// never blames the provider for a payment the booking service refused before calling it.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import Billing from '@/pages/Billing';
import paymentCopy from '@/content/payment';
import { HttpResponseError } from '@/lib/api';
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
    expect(paymentCopy.notChargedDescription).toMatch(/not (been )?charged/i);
  });

  it.each(['BILL_NOT_PAYABLE', 'BILL_ALREADY_PAID', 'BILL_AMOUNT_REQUIRES_REVIEW'])('a 409 %s is shown as not charged', async code => {
    mocks.post.mockRejectedValue(new HttpResponseError('API Error: 409', 409, code));
    const notices = await payAndRead();
    expect(notices).toContainEqual(expect.objectContaining({ title: paymentCopy.notChargedTitle, description: paymentCopy.notChargedDescription }));
    expect(notices.some(n => n.title === paymentCopy.failedTitle || n.description === paymentCopy.failedDescription)).toBe(false);
    expect(notices.some(n => n.title === paymentCopy.unknownTitle)).toBe(false);
  });

  it('a reconciliation 409 is never shown as not charged', async () => {
    mocks.post.mockRejectedValue(new HttpResponseError('API Error: 409', 409, 'PAYMENT_RECONCILIATION_REQUIRED'));
    const notices = await payAndRead();
    expect(notices.length).toBeGreaterThan(0);
    expect(notices.some(n => /not (been )?charged/i.test(`${n.title} ${n.description}`))).toBe(false);
  });
});
