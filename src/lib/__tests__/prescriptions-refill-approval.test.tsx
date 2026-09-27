import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import Prescriptions from '@/pages/Prescriptions';
import { pharmacyRoutes } from '@/lib/pharmacy-contract';
import { HttpResponseError, MutationOutcomeUnknownError } from '@/lib/api';
import copy from '@/content/pharmacy';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), toast: vi.fn() }));
vi.mock('@/lib/api', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api')>(), api: { get: mocks.get, post: mocks.post, put: mocks.put } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('aws-amplify/auth', () => ({ getCurrentUser: async () => ({ userId: 'test-doctor' }), fetchAuthSession: async () => ({}), signOut: async () => {} }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: ReactNode }) => <>{children}</> }));

const legacyRequest = (prescriptionId: string, medication: string) =>
  ({ prescriptionId, patientId: 'test-patient', medication, dosage: '5ml', status: 'REFILL_REQUESTED', timestamp: '2026-01-01T00:00:00Z' });
let rows = [legacyRequest('test-rx', 'test-med')];

function serve() {
  mocks.get.mockImplementation(async (path: string) => {
    if (path.startsWith('/register-doctor')) return { name: 'Test Doctor' };
    if (path.startsWith('/appointments')) return { existingBookings: [{ patientId: 'test-patient', patientName: 'Test Patient', date: '2026-01-01' }] };
    if (path.startsWith('/prescription')) return { prescriptions: rows };
    return null;
  });
}

async function openRefillRequests() {
  render(<MemoryRouter><Prescriptions /></MemoryRouter>);
  fireEvent.click(await screen.findByText('Test Patient'));
  const refillsTab = screen.getByRole('tab', { name: /refill/i });
  fireEvent.mouseDown(refillsTab); fireEvent.click(refillsTab);
  return screen.findAllByRole('button', { name: /approve/i });
}
const deferred = () => { let resolve!: (value: unknown) => void; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

describe('doctor approval of a legacy refill request', () => {
  beforeEach(() => { vi.clearAllMocks(); rows = [legacyRequest('test-rx', 'test-med')]; serve(); });
  afterEach(cleanup);

  it.each([
    ['a billed refill', { status: 'PENDING' }, copy.approvedTitle, copy.approvedTemplate],
    ['a restored paid fill', { status: 'ISSUED', paymentStatus: 'PAID' }, copy.restoredTitle, copy.restoredTemplate],
    ['a restored fill that still needs its bill paid', { status: 'ISSUED', paymentStatus: 'UNPAID' }, copy.restoredTitle, copy.restoredUnpaidTemplate],
  ])('asks the pharmacy service and shows %s', async (_name, outcome, title, template) => {
    const answer = deferred();
    mocks.post.mockReturnValue(answer.promise);
    const [approve] = await openRefillRequests();
    expect(screen.getByRole('tab', { name: /active/i })).toHaveTextContent('Active (0)');
    fireEvent.click(approve);

    expect(mocks.post).toHaveBeenCalledWith(pharmacyRoutes.refill, { prescriptionId: 'test-rx' });
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(approve).toBeDisabled();
    expect(screen.getByText('Refill Requested')).toBeInTheDocument();

    answer.resolve({ message: 'ignored', ...outcome });
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ title, description: template.replace('{medication}', 'test-med') }));
    expect(screen.queryByText('Refill Requested')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /active/i })).toHaveTextContent('Active (1)');
  });

  it.each([400, 403, 409])('shows the service reason for a %i rejection, and keeps the request', async code => {
    const reason = 'This prescription was cancelled. Issue a new prescription instead.';
    mocks.post.mockRejectedValue(new HttpResponseError(reason, code, reason));
    fireEvent.click((await openRefillRequests())[0]);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({
      variant: 'destructive', title: copy.approveRejectedTitle, description: 'This prescription was cancelled. Issue a new prescription instead.' }));
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Refill Requested')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve/i })).toBeEnabled();
  });

  it.each([[404, '404_NOT_FOUND'], [401, '401 Unauthorized'], [409, 'API Error: 409'], [400, 'API Error: 400']])('never shows a raw %i code to the doctor', async (code, message) => {
    mocks.post.mockRejectedValue(new HttpResponseError(message, code));
    fireEvent.click((await openRefillRequests())[0]);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({
      variant: 'destructive', title: copy.approveRejectedTitle, description: copy.approveRejectedDescription }));
  });

  it.each([
    ['an outcome the client could not confirm', new MutationOutcomeUnknownError()],
    ['a restore reply without its payment state', { status: 'ISSUED' }],
    ['a server failure', new Error('API Error: 500')],
    ['a response without a recognised status (an older pharmacy service)', null],
  ])('never invites a blind retry after %s', async (_name, error) => {
    if (error instanceof Error) mocks.post.mockRejectedValue(error); else mocks.post.mockResolvedValue(error ?? { message: 'Refill authorized' });
    fireEvent.click((await openRefillRequests())[0]);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({
      variant: 'destructive', title: copy.approveUnconfirmedTitle, description: copy.approveUnconfirmedDescription }));
    expect(screen.getByText('Refill Requested')).toBeInTheDocument();
  });

  it('keeps each row disabled until its own approval has answered', async () => {
    rows = [legacyRequest('rx-a', 'med-a'), legacyRequest('rx-b', 'med-b')];
    const first = deferred(), second = deferred();
    mocks.post.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const [approveA, approveB] = await openRefillRequests();
    fireEvent.click(approveA); fireEvent.click(approveB);
    second.resolve({ status: 'PENDING' });
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    const rowA = screen.getByText('med-a').closest('div.flex-col, [class*="flex-col"]') as HTMLElement;
    expect(within(rowA).getByRole('button', { name: /approve/i })).toBeDisabled();
    first.resolve({ status: 'ISSUED', paymentStatus: 'PAID' });
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Refill Requested')).not.toBeInTheDocument();
  });
});
