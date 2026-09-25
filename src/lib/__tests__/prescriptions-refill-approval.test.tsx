import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import Prescriptions from '@/pages/Prescriptions';
import { pharmacyRoutes } from '@/lib/pharmacy-contract';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), toast: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: { get: mocks.get, post: mocks.post, put: mocks.put } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('aws-amplify/auth', () => ({ getCurrentUser: async () => ({ userId: 'test-doctor' }), fetchAuthSession: async () => ({}), signOut: async () => {} }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: ReactNode }) => <>{children}</> }));

const legacyRequest = { prescriptionId: 'test-rx', patientId: 'test-patient', medication: 'test-med', dosage: '5ml', status: 'REFILL_REQUESTED', timestamp: '2026-01-01T00:00:00Z' };

function serve() {
  mocks.get.mockImplementation(async (path: string) => {
    if (path.startsWith('/register-doctor')) return { name: 'Test Doctor' };
    if (path.startsWith('/appointments')) return { existingBookings: [{ patientId: 'test-patient', patientName: 'Test Patient', date: '2026-01-01' }] };
    if (path.startsWith('/prescription')) return { prescriptions: [legacyRequest] };
    return null;
  });
}

async function openRefillRequests() {
  render(<MemoryRouter><Prescriptions /></MemoryRouter>);
  fireEvent.click(await screen.findByText('Test Patient'));
  const refillsTab = screen.getByRole('tab', { name: /refill/i });
  fireEvent.mouseDown(refillsTab); fireEvent.click(refillsTab);
  return screen.findByRole('button', { name: /approve/i });
}

describe('doctor approval of a legacy refill request', () => {
  beforeEach(() => { vi.clearAllMocks(); serve(); });
  afterEach(cleanup);

  it.each([
    ['PENDING', 'Refill Approved'],
    ['ISSUED', 'Previous Fill Restored'],
  ])('asks the pharmacy service and shows the %s outcome it returns', async (status, title) => {
    let answer!: (value: unknown) => void;
    mocks.post.mockReturnValue(new Promise(resolve => { answer = resolve; }));
    const approve = await openRefillRequests();
    fireEvent.click(approve);

    expect(mocks.post).toHaveBeenCalledWith(pharmacyRoutes.refill, { prescriptionId: 'test-rx' });
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(approve).toBeDisabled();
    expect(screen.getByText('Refill Requested')).toBeInTheDocument();

    answer({ message: 'ignored', status });
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title })));
    expect(screen.queryByText('Refill Requested')).not.toBeInTheDocument();
  });

  it('keeps the request and reports the failure when the service rejects it', async () => {
    mocks.post.mockRejectedValue(new Error('409'));
    fireEvent.click(await openRefillRequests());
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })));
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Refill Requested')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve/i })).toBeEnabled();
  });

  it('does not trust a response without a recognised status', async () => {
    mocks.post.mockResolvedValue({ message: 'Refill authorized' });
    fireEvent.click(await openRefillRequests());
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })));
    expect(screen.getByText('Refill Requested')).toBeInTheDocument();
  });
});
