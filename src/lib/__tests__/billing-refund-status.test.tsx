import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import Billing from '@/pages/Billing';
import paymentCopy from '@/content/payment';
import type * as StorageNamespace from '@/lib/secure-storage';
type StorageModule = typeof StorageNamespace;

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/context/CheckoutContext', () => ({ useCheckout: () => ({ requestPayment: vi.fn() }) }));
vi.mock('@/lib/api', () => ({ api: { get: mocks.get, post: vi.fn() } }));
vi.mock('@/lib/secure-storage', async importOriginal => ({ ...await importOriginal<StorageModule>(), getUser: () => ({ id: 'test-patient', name: 'Test Patient' }), setUser: vi.fn(), clearAllSensitive: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('aws-amplify/auth', () => ({ fetchAuthSession: async () => ({}), fetchUserAttributes: async () => ({ sub: 'test-patient' }), signOut: async () => {} }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: ReactNode }) => <>{children}</> }));

const refund = (billId: string, amount: number, status: string, extra: Record<string, unknown> = {}) =>
  ({ billId, patientId: 'test-patient', doctorId: 'test-doctor', type: 'REFUND', amount, status, createdAt: '2026-09-20T10:00:00Z', ...extra });

// C12: a refund row may say "Refunded" and show money coming back only when the refund actually went through.
describe('Billing refund rows', () => {
  beforeEach(() => {
    cleanup(); vi.clearAllMocks();
    mocks.get.mockImplementation(async (path: string) => path.startsWith('/billing')
      ? { outstandingBalance: 0, transactions: [
        refund('aaaaaaaa-issued', -50, 'PROCESSED', { description: 'User requested cancellation' }),
        refund('bbbbbbbb-manual', -40, 'FAILED_REQUIRES_MANUAL_REFUND', { description: 'Refund Failed - Contact Support' }),
        refund('cccccccc-pending', -30, 'PROCESSED', { refundStatus: 'PENDING', description: 'User requested cancellation' }),
        refund('dddddddd-unknown', -20, 'SOMETHING_ELSE', { description: 'System cancellation' }),
      ] }
      : { name: 'Test Patient' });
  });
  const row = async (id: string) => within((await screen.findByText(`#${id}`)).closest('.rounded-2xl') as HTMLElement);

  it('shows an issued refund as refunded money coming back', async () => {
    render(<MemoryRouter><Billing /></MemoryRouter>);
    const issued = await row('aaaaaaaa');
    expect(issued.getByText(paymentCopy.refundedBadge)).toBeTruthy();
    expect(issued.getByText('+$50.00').className).toContain('text-green-600');
  });

  it.each([
    ['bbbbbbbb', paymentCopy.refundReviewBadge, '$40.00'],
    ['cccccccc', paymentCopy.refundPendingBadge, '$30.00'],
    ['dddddddd', paymentCopy.refundReviewBadge, '$20.00'],
  ])('never shows refund %s as refunded', async (id, badge, amount) => {
    render(<MemoryRouter><Billing /></MemoryRouter>);
    const pending = await row(id);
    expect(pending.getByText(badge)).toBeTruthy();
    expect(pending.queryByText(paymentCopy.refundedBadge)).toBeNull();
    const shown = pending.getByText(amount);
    expect(shown.className).not.toContain('text-green');
    expect(pending.queryByText(`+${amount}`)).toBeNull();
  });
});
