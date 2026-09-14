import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppointmentBookingForm } from '@/components/appointments/AppointmentBookingForm';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), payment: vi.fn(), toast: vi.fn(),
  success: vi.fn(), cancel: vi.fn(), lifetime: { current: new AbortController() } }));
vi.mock('@/lib/api', () => ({ api: { get: mocks.get, post: mocks.post } }));
vi.mock('@/context/CheckoutContext', () => ({ useCheckout: () => ({ requestPayment: mocks.payment }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/hooks/use-payment-lifetime', () => ({ usePaymentLifetime: () => mocks.lifetime }));
const doctor = { doctorId: 'test-doctor', name: 'Test Doctor', specialization: 'Test Specialty', consultationFee: 75.5 };

beforeEach(() => {
  vi.clearAllMocks(); mocks.get.mockReset(); mocks.post.mockReset(); mocks.payment.mockReset();
  mocks.lifetime.current = new AbortController();
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-10T00:00:00Z'));
  mocks.get.mockImplementation(async (path: string) => path.includes('/schedule')
    ? { timezone: 'UTC', schedule: { Monday: '09:00-10:00' } } : { existingBookings: [] });
  mocks.payment.mockResolvedValue({ id: 'test-payment-method' });
  mocks.post.mockResolvedValue({ id: 'test-appointment' });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

async function open(fee: unknown = 75.5) {
  const view = render(<AppointmentBookingForm doctors={[{ ...doctor, consultationFee: fee }]} onCancel={mocks.cancel} onSuccess={mocks.success} />);
  fireEvent.change(screen.getByLabelText('1. Select Specialty'), { target: { value: doctor.specialization } });
  fireEvent.change(screen.getByLabelText('2. Select Doctor'), { target: { value: doctor.doctorId } });
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-14' } });
  await screen.findByRole('option', { name: '09:00' });
  return view;
}
function choose() { fireEvent.change(screen.getByLabelText(/Time Slot/), { target: { value: '2026-09-14T09:00:00.000Z' } }); }
function submit() { fireEvent.submit(screen.getByRole('button', { name: 'Proceed to Payment' }).closest('form')!); }

describe('booking form payment and lifecycle safety', () => {
  it('requires explicit slot selection and sends the verified UTC slot with the exact published fee', async () => {
    await open(); expect(screen.getByText('$75.50')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Proceed to Payment' })).toBeDisabled();
    choose(); submit(); await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    expect(mocks.payment).toHaveBeenCalledWith(expect.objectContaining({ amount: 75.5 }));
    expect(mocks.post).toHaveBeenCalledWith('/appointments', expect.objectContaining({
      doctorId: 'test-doctor', timeSlot: '2026-09-14T09:00:00.000Z', paymentToken: 'test-payment-method',
    }), { signal: mocks.lifetime.current.signal });
    expect(mocks.success).toHaveBeenCalledTimes(1);
  });
  it.each([null, '', 0, -2, 'invalid'])('does not open payment for an unavailable fee %s', async fee => {
    await open(fee); choose(); submit();
    expect(mocks.payment).not.toHaveBeenCalled(); expect(mocks.post).not.toHaveBeenCalled();
    expect(screen.queryByText('$50.00')).not.toBeInTheDocument();
  });
  it('rejects duplicate submissions while payment selection is pending', async () => {
    mocks.payment.mockImplementation(() => new Promise(() => {})); await open(); choose(); submit(); submit();
    expect(mocks.payment).toHaveBeenCalledTimes(1); expect(screen.getByLabelText('Date')).toBeDisabled();
  });
  it('does not book after unmount while payment selection is pending', async () => {
    let resolve!: (value: { id: string }) => void;
    mocks.payment.mockImplementation(() => new Promise(done => { resolve = done; }));
    const view = await open(); choose(); submit(); view.unmount();
    await act(async () => { resolve({ id: 'test-payment-method' }); });
    expect(mocks.post).not.toHaveBeenCalled(); expect(mocks.success).not.toHaveBeenCalled(); expect(mocks.toast).not.toHaveBeenCalled();
  });
  it('does not book after session invalidation while payment selection is pending', async () => {
    let resolve!: (value: { id: string }) => void;
    mocks.payment.mockImplementation(() => new Promise(done => { resolve = done; }));
    await open(); choose(); submit(); mocks.lifetime.current.abort();
    await act(async () => { resolve({ id: 'test-payment-method' }); });
    expect(mocks.post).not.toHaveBeenCalled(); expect(mocks.success).not.toHaveBeenCalled();
  });
  it('does not replay a booking after an unknown server outcome or expose its raw error', async () => {
    mocks.post.mockRejectedValue(new Error('TEST_PRIVATE_SERVER_ERROR'));
    await open(); choose(); submit(); await waitFor(() => expect(mocks.toast).toHaveBeenCalled()); submit();
    expect(mocks.post).toHaveBeenCalledTimes(1); expect(mocks.payment).toHaveBeenCalledTimes(1);
    expect(mocks.success).not.toHaveBeenCalled(); expect(JSON.stringify(mocks.toast.mock.calls)).not.toContain('TEST_PRIVATE_SERVER_ERROR');
    expect(screen.getByText(/Check your appointments and payment status/)).toBeInTheDocument();
  });
  it('ignores success after the requester has left', async () => {
    let resolve!: (value: unknown) => void;
    mocks.post.mockImplementation(() => new Promise(done => { resolve = done; }));
    const view = await open(); choose(); submit(); await waitFor(() => expect(mocks.post).toHaveBeenCalled()); view.unmount();
    await act(async () => { resolve({ id: 'test-appointment' }); });
    expect(mocks.success).not.toHaveBeenCalled(); expect(mocks.toast).not.toHaveBeenCalled();
  });
  it('rejects a selected time that is no longer available after date change', async () => {
    await open(); choose();
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-21' } }); submit();
    expect(mocks.payment).not.toHaveBeenCalled();
    await screen.findByRole('option', { name: '09:00' });
    expect(screen.getByRole('button', { name: 'Proceed to Payment' })).toBeDisabled();
  });
  it('ignores an older schedule response after the selected date changes', async () => {
    let complete!: (value: unknown) => void; let scheduleRequests = 0;
    mocks.get.mockImplementation(async (path: string) => {
      if (!path.includes('/schedule')) return { existingBookings: [] };
      if (++scheduleRequests === 1) return new Promise(done => { complete = done; });
      return { timezone: 'UTC', schedule: { Monday: '10:00-11:00' } };
    });
    render(<AppointmentBookingForm doctors={[doctor]} onCancel={mocks.cancel} onSuccess={mocks.success} />);
    fireEvent.change(screen.getByLabelText('1. Select Specialty'), { target: { value: doctor.specialization } });
    fireEvent.change(screen.getByLabelText('2. Select Doctor'), { target: { value: doctor.doctorId } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-14' } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-21' } });
    await screen.findByRole('option', { name: '10:00' });
    await act(async () => { complete({ timezone: 'UTC', schedule: { Monday: '09:00-10:00' } }); });
    expect(screen.getByRole('option', { name: '10:00' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '09:00' })).not.toBeInTheDocument();
  });
  it('requires a new review if the listed fee changes while choosing payment details', async () => {
    let complete!: (value: { id: string }) => void;
    mocks.payment.mockImplementation(() => new Promise(done => { complete = done; }));
    const view = await open(); choose(); submit();
    view.rerender(<AppointmentBookingForm doctors={[{ ...doctor, consultationFee: 90 }]} onCancel={mocks.cancel} onSuccess={mocks.success} />);
    await act(async () => { complete({ id: 'test-payment-method' }); });
    expect(mocks.post).not.toHaveBeenCalled(); expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringMatching(/fee changed/) }));
  });
  it('does not call a malformed acknowledgement a successful booking', async () => {
    mocks.post.mockResolvedValue({}); await open(); choose(); submit();
    await screen.findByText(/Check your appointments and payment status/);
    expect(mocks.success).not.toHaveBeenCalled(); submit(); expect(mocks.post).toHaveBeenCalledTimes(1);
  });
  it('does not post a missing payment method identifier', async () => {
    mocks.payment.mockResolvedValue({ id: '' }); await open(); choose(); submit();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.post).not.toHaveBeenCalled(); expect(mocks.success).not.toHaveBeenCalled();
  });
});
