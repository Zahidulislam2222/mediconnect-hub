import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import Prescriptions from '@/pages/Prescriptions';
import { HttpResponseError, MutationOutcomeUnknownError } from '@/lib/api';
import type * as ApiNamespace from '@/lib/api';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), toast: vi.fn() }));
vi.mock('@/lib/api', async original => ({ ...await original<typeof ApiNamespace>(), api: { get: mocks.get, post: mocks.post, put: mocks.put } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('aws-amplify/auth', () => ({ getCurrentUser: async () => ({ userId: 'test-doctor' }), fetchAuthSession: async () => ({}), signOut: async () => {} }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: ReactNode }) => <>{children}</> }));

const response = { prescriptionId: 'test-rx', status: 'CANCELLED' };
async function openRequest() {
  render(<MemoryRouter><Prescriptions /></MemoryRouter>);
  fireEvent.click(await screen.findByText('Test Patient'));
  const tab = screen.getByRole('tab', { name: /refill/i });
  fireEvent.mouseDown(tab); fireEvent.click(tab);
  return screen.findByRole('button', { name: 'Cancel prescription' });
}
async function confirmCancellation() {
  fireEvent.click(await openRequest());
  await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Confirm cancellation' })); });
}

describe('doctor cancellation of a legacy refill request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockImplementation(async (path: string) => {
      if (path.startsWith('/register-doctor')) return { name: 'Test Doctor' };
      if (path.startsWith('/appointments')) return { existingBookings: [{ patientId: 'test-patient', patientName: 'Test Patient' }] };
      if (path.startsWith('/prescription')) return { prescriptions: [{ prescriptionId: 'test-rx', patientId: 'test-patient', medication: 'test-med', dosage: '5ml', status: 'REFILL_REQUESTED', timestamp: '2026-01-01T00:00:00Z' }] };
      return null;
    });
  });
  afterEach(cleanup);

  it('explains the full prescription cancellation and permits dismissal without a request', async () => {
    fireEvent.click(await openRequest());
    expect(screen.getByRole('dialog')).toHaveTextContent(/unpaid bills/i);
    expect(mocks.put).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep prescription' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Refill Requested')).toBeInTheDocument();
  });

  it('removes only a server-confirmed cancellation and never treats it as an approval', async () => {
    mocks.put.mockResolvedValue(response);
    await confirmCancellation();
    await waitFor(() => expect(screen.queryByText('Refill Requested')).not.toBeInTheDocument());
    expect(mocks.put).toHaveBeenCalledExactlyOnceWith('/prescriptions/test-rx/cancel', {});
    expect(mocks.post).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: /active/i })).toHaveTextContent('Active (0)');
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Prescription cancelled' }));
  });

  it.each([403, 409])('retains the request after a %i refusal and shows its safe reason', async status => {
    const reason = 'The prescription changed. Refresh before updating it.';
    mocks.put.mockRejectedValue(new HttpResponseError(reason, status, reason));
    await confirmCancellation();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: reason })));
    expect(screen.getByText('Refill Requested')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel prescription' })).toBeEnabled();
  });

  it.each([new MutationOutcomeUnknownError(), { status: 'CANCELLED', prescriptionId: 'test-other' }, { message: 'ok' }])('keeps an unconfirmed outcome visible and blocks another action', async outcome => {
    if (outcome instanceof Error) mocks.put.mockRejectedValue(outcome); else mocks.put.mockResolvedValue(outcome);
    await confirmCancellation();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Cancellation outcome unconfirmed' })));
    expect(screen.getByText('Refill Requested')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel prescription' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(mocks.put).toHaveBeenCalledTimes(1);
  });

  it('locks cancellation and approval together while one request is in flight', async () => {
    let resolve!: (value: unknown) => void;
    mocks.put.mockReturnValue(new Promise(done => { resolve = done; }));
    await confirmCancellation();
    // The modal intentionally hides the page from accessibility queries while pending.
    const approve = screen.getByText('Approve', { exact: true }).closest('button')!;
    expect(approve).toBeDisabled();
    fireEvent.click(approve);
    expect(mocks.post).not.toHaveBeenCalled();
    await act(async () => { resolve(response); });
    await waitFor(() => expect(screen.queryByText('Refill Requested')).not.toBeInTheDocument());
  });

  it('blocks cancellation while approval is pending and after an uncertain approval', async () => {
    let reject!: (error: Error) => void;
    mocks.post.mockReturnValue(new Promise((_resolve, fail) => { reject = fail; }));
    const cancel = await openRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(cancel).toBeDisabled();
    fireEvent.click(cancel);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await act(async () => { reject(new MutationOutcomeUnknownError()); });
    expect(cancel).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(mocks.put).not.toHaveBeenCalled();
  });
});
