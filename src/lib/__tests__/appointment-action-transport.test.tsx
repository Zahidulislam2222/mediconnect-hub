import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Appointments from '@/pages/Appointments';

const mocks = vi.hoisted(() => ({ session: vi.fn(), fetch: vi.fn(), navigate: vi.fn(), toast: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: mocks.session,
  fetchUserAttributes: async () => ({ sub: 'test-patient', name: 'Test person' }),
}));
vi.mock('@/config/env', async importOriginal => {
  const original = await importOriginal<Record<string, unknown>>();
  return { ...original, publicEnv: () => 'https://service.example.test', optionalBackupUrl: () => '' };
});
vi.mock('@/lib/secure-storage', () => ({ getUser: () => ({ role: 'patient' }), clearAllSensitive: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/components/appointments/AppointmentBookingForm', () => ({ AppointmentBookingForm: () => null }));
vi.mock('@/components/appointments/PastAppointments', () => ({ PastAppointments: () => null }));
vi.mock('@/components/appointments/UpcomingAppointments', () => ({ UpcomingAppointments: (props: {
  onJoin: (value: unknown) => void; onCancel: (value: string) => void;
}) => <><button onClick={() => props.onJoin({ appointmentId: 'test-appointment' })}>Check in</button>
  <button onClick={() => props.onCancel('test-appointment')}>Cancel appointment</button></> }));

const session = { tokens: { idToken: { toString: () => 'test-key' } } };
const response = { ok: true, json: async () => ({}) };
beforeEach(() => {
  vi.clearAllMocks(); mocks.session.mockReset(); mocks.fetch.mockReset();
  mocks.session.mockResolvedValue(session);
  mocks.fetch.mockImplementation(async (url: string) => ({ ok: true, json: async () =>
    url.includes('/doctors') || url.includes('/appointments?') ? [] : { patientId: 'test-patient' } }));
  vi.stubGlobal('fetch', mocks.fetch); vi.stubGlobal('confirm', () => true);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function open() {
  const view = render(<Appointments />);
  await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(3));
  return view;
}

it.each(['Check in', 'Cancel appointment'])('does not dispatch %s after deferred authentication outlives the page', async label => {
  const view = await open();
  let resolve!: (value: typeof session) => void;
  mocks.session.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  fireEvent.click(screen.getByText(label));
  expect(mocks.session).toHaveBeenCalledTimes(4);
  view.unmount();
  await act(async () => { resolve(session); });
  expect(mocks.fetch).toHaveBeenCalledTimes(3);
  expect(mocks.navigate).not.toHaveBeenCalled(); expect(mocks.toast).not.toHaveBeenCalled();
});

it.each(['Check in', 'Cancel appointment'])('aborts dispatched %s transport and ignores non-cooperative success', async label => {
  const view = await open();
  let resolve!: (value: typeof response) => void;
  mocks.fetch.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  fireEvent.click(screen.getByText(label));
  await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(4));
  const signal = mocks.fetch.mock.calls[3][1].signal as AbortSignal;
  view.unmount();
  await act(async () => { resolve(response); });
  expect(signal.aborted).toBe(true);
  expect(mocks.navigate).not.toHaveBeenCalled(); expect(mocks.toast).not.toHaveBeenCalled();
});

it('cancels post-cancellation refresh while its authentication is pending', async () => {
  const view = await open();
  let resolve!: (value: typeof session) => void;
  mocks.session.mockResolvedValueOnce(session).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  fireEvent.click(screen.getByText('Cancel appointment'));
  await waitFor(() => expect(mocks.session).toHaveBeenCalledTimes(5));
  const toasts = mocks.toast.mock.calls.length;
  view.unmount();
  await act(async () => { resolve(session); });
  expect(mocks.fetch).toHaveBeenCalledTimes(4);
  expect(mocks.toast).toHaveBeenCalledTimes(toasts);
});
