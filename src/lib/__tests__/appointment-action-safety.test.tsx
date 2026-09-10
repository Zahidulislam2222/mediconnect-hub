import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Appointments from '@/pages/Appointments';

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn(), navigate: vi.fn(), toast: vi.fn(), confirm: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('aws-amplify/auth', () => ({ fetchUserAttributes: async () => ({ sub: 'test-patient', name: 'Test person' }) }));
vi.mock('@/lib/api', () => ({ api: { get: mocks.get, put: mocks.put, post: mocks.post } }));
vi.mock('@/lib/secure-storage', () => ({ getUser: () => null, clearAllSensitive: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/components/appointments/AppointmentBookingForm', () => ({ AppointmentBookingForm: () => null }));
vi.mock('@/components/appointments/PastAppointments', () => ({ PastAppointments: () => null }));
vi.mock('@/components/appointments/UpcomingAppointments', () => ({ UpcomingAppointments: (props: {
  onJoin: (value: unknown) => void; onCancel: (value: string) => void;
}) => <><button onClick={() => props.onJoin({ appointmentId: 'test-appointment', status: 'CONFIRMED' })}>Test check in</button>
    <button onClick={() => props.onCancel('test-appointment')}>Test cancel appointment</button></> }));

async function open() {
  const view = render(<Appointments />);
  await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/appointments?patientId=test-patient', { signal: undefined }));
  return view;
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.get.mockReset(); mocks.put.mockReset(); mocks.post.mockReset();
  mocks.get.mockImplementation(async (path: string) => path === '/doctors' ? [] : path.startsWith('/appointments') ? [] : { patientId: 'test-patient' });
  mocks.put.mockResolvedValue({}); mocks.post.mockResolvedValue({ message: 'Appointment cancelled and refunded' });
  mocks.confirm.mockReturnValue(true); vi.stubGlobal('confirm', mocks.confirm); vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('patient appointment action boundaries', () => {
  it('does not cancel while check-in is still pending', async () => {
    let resolve!: (value: unknown) => void;
    mocks.put.mockImplementation(() => new Promise(done => { resolve = done; }));
    await open(); fireEvent.click(screen.getByText('Test check in'));
    fireEvent.click(screen.getByText('Test cancel appointment'));
    await act(async () => { resolve({}); });
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it('does not check in while cancellation outcome is unknown', async () => {
    mocks.post.mockRejectedValue(new Error('TEST_OUTCOME_UNKNOWN'));
    await open(); fireEvent.click(screen.getByText('Test cancel appointment'));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Test check in'));
    expect(mocks.put).not.toHaveBeenCalled();
  });
  it('checks in without sending doctor-only status or putting names in the URL', async () => {
    await open(); fireEvent.click(screen.getByText('Test check in'));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
    expect(mocks.put).toHaveBeenCalledWith('/appointments', { appointmentId: 'test-appointment', patientArrived: true }, { signal: expect.any(AbortSignal) });
    expect(mocks.navigate).toHaveBeenCalledWith('/consultation?appointmentId=test-appointment');
  });
  it('does not navigate after failed check-in', async () => {
    mocks.put.mockRejectedValue(new Error('TEST_REQUEST_FAILURE')); await open(); fireEvent.click(screen.getByText('Test check in'));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled()); expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it('blocks duplicate in-flight check-in and ignores completion after unmount', async () => {
    let resolve!: (value: unknown) => void; mocks.put.mockImplementation(() => new Promise(done => { resolve = done; }));
    const view = await open(); fireEvent.click(screen.getByText('Test check in')); fireEvent.click(screen.getByText('Test check in'));
    expect(mocks.put).toHaveBeenCalledTimes(1); view.unmount(); await act(async () => { resolve({}); });
    expect(mocks.navigate).not.toHaveBeenCalled(); expect(mocks.toast).not.toHaveBeenCalled();
  });
  it('does not guarantee a refund from an unverified cancellation acknowledgement', async () => {
    await open(); fireEvent.click(screen.getByText('Test cancel appointment'));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.confirm).not.toHaveBeenCalledWith(expect.stringMatching(/will refund/i));
    expect(mocks.toast.mock.calls.at(-1)?.[0].description).not.toMatch(/cancelled and refunded/i);
  });
  it('does not cancel when the user declines', async () => {
    mocks.confirm.mockReturnValue(false); await open(); fireEvent.click(screen.getByText('Test cancel appointment'));
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it('blocks duplicate cancellation and ignores late success after unmount', async () => {
    let resolve!: (value: unknown) => void; mocks.post.mockImplementation(() => new Promise(done => { resolve = done; }));
    const view = await open(); fireEvent.click(screen.getByText('Test cancel appointment')); fireEvent.click(screen.getByText('Test cancel appointment'));
    expect(mocks.post).toHaveBeenCalledTimes(1); view.unmount(); await act(async () => { resolve({}); });
    expect(mocks.toast).not.toHaveBeenCalled();
  });
  it('never replays a cancellation with an uncertain outcome', async () => {
    mocks.post.mockRejectedValue(new Error('TEST_OUTCOME_UNKNOWN')); await open();
    fireEvent.click(screen.getByText('Test cancel appointment'));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Test cancel appointment'));
    expect(mocks.post).toHaveBeenCalledTimes(1); expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it('ignores a rejected check-in after unmount', async () => {
    let reject!: (reason: Error) => void; mocks.put.mockImplementation(() => new Promise((_, failed) => { reject = failed; }));
    const view = await open(); fireEvent.click(screen.getByText('Test check in')); view.unmount();
    await act(async () => { reject(new Error('TEST_LATE_FAILURE')); });
    expect(mocks.toast).not.toHaveBeenCalled(); expect(mocks.navigate).not.toHaveBeenCalled();
  });

});
