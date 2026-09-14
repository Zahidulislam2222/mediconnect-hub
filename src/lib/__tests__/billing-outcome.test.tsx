import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import Billing from '@/pages/Billing';
import type * as StorageNamespace from '@/lib/secure-storage';
type StorageModule = typeof StorageNamespace;

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), payment: vi.fn(), toast: vi.fn(), setUser: vi.fn() }));
vi.mock('@/context/CheckoutContext', () => ({ useCheckout: () => ({ requestPayment: mocks.payment }) }));
vi.mock('@/lib/api', () => ({ api: { get: mocks.get, post: mocks.post } }));
vi.mock('@/lib/secure-storage', async importOriginal => ({ ...await importOriginal<StorageModule>(), getUser: () => ({ id: 'test-patient', name: 'Test Patient' }), setUser: mocks.setUser, clearAllSensitive: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('aws-amplify/auth', () => ({ fetchAuthSession: async () => ({}), fetchUserAttributes: async () => ({ sub: 'test-patient' }), signOut: async () => {} }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children, onLogout }: { children: ReactNode; onLogout: () => void }) => <><button onClick={onLogout}>Test logout</button>{children}</> }));

describe('Billing settlement evidence', () => {
  beforeEach(() => {
    cleanup(); vi.clearAllMocks();
    mocks.get.mockImplementation(async (path: string) => path.startsWith('/billing')
      ? { outstandingBalance: 10, transactions: [{ billId: 'test-invoice', patientId: 'test-patient', amount: 10, status: 'DUE' }] }
      : { name: 'Test Patient' });
    mocks.payment.mockResolvedValue({ id: 'test-method' });
  });
  async function pay() {
    render(<MemoryRouter><Billing /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /pay/i }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalled());
    await act(async () => {});
  }
  it.each([{}, { success: true }, { success: true, status: 'processing' }, { success: true, status: 'requires_action' }])(
    'does not claim settlement from %j', async response => {
      mocks.post.mockResolvedValue(response);
      await pay();
      expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Payment Successful' }));
      expect(mocks.toast).toHaveBeenCalled();
    });
  it('reports an explicit succeeded status', async () => {
    mocks.post.mockResolvedValue({ success: true, status: 'succeeded' });
    await pay();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Payment Successful' }));
  });
  it('does not submit payment after logout while card collection is pending', async () => {
    let complete!: (method: { id: string }) => void;
    mocks.payment.mockReturnValue(new Promise(resolve => { complete = resolve; }));
    render(<MemoryRouter><Billing /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /pay/i }));
    fireEvent.click(screen.getByText('Test logout'));
    await act(async () => complete({ id: 'test-stale-method' }));
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
