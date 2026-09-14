import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StrictMode, type ReactNode } from 'react';
import SymptomChecker from '@/pages/SymptomChecker';

const mocks = vi.hoisted(() => ({ session: vi.fn(), current: vi.fn(), fetch: vi.fn(), navigate: vi.fn(), toast: vi.fn(), store: vi.fn(), logout: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('aws-amplify/auth', () => ({ fetchAuthSession: mocks.session, getCurrentUser: mocks.current, signOut: mocks.logout }));
vi.mock('@/config/env', async importOriginal => {
  const original = await importOriginal<Record<string, unknown>>();
  return { ...original, publicEnv: () => 'https://symptoms.example.test', optionalBackupUrl: () => '' };
});
vi.mock('@/lib/secure-storage', () => ({ getUser: () => ({ name: 'Test patient', role: 'patient' }), setUser: mocks.store, clearAllSensitive: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children, onLogout }: { children: ReactNode; onLogout: () => void }) => <main><button onClick={onLogout}>Sign out test</button>{children}</main> }));
const session = { tokens: { idToken: { toString: () => 'test-key' } } };
const assessment = { success: true, status: 'available', analysis: { risk: 'Unknown', reason: 'Synthetic response' } };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
  vi.resetAllMocks(); mocks.session.mockResolvedValue(session);
  mocks.current.mockResolvedValue({ userId: 'test-patient' }); mocks.logout.mockResolvedValue(undefined);
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ name: 'Test patient' }) });
  vi.stubGlobal('fetch', mocks.fetch); Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function open() { const view = render(<SymptomChecker />); await waitFor(() => expect(mocks.store).toHaveBeenCalledTimes(1)); return view; }
function send() { fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Synthetic question' } }); fireEvent.click(screen.getByRole('button', { name: 'Send symptoms' })); }

it.each(['leave', 'sign out'])('prevents assessment dispatch after %s while authentication is pending', async action => {
  const view = await open(); const auth = deferred<typeof session>(); mocks.session.mockReturnValueOnce(auth.promise);
  send(); expect(mocks.session).toHaveBeenCalledTimes(2);
  if (action === 'leave') view.unmount(); else fireEvent.click(screen.getByText('Sign out test'));
  await act(async () => { auth.resolve(session); });
  expect(mocks.fetch).toHaveBeenCalledTimes(1); expect(mocks.toast).not.toHaveBeenCalled();
});

it.each(['leave', 'sign out'])('aborts the assessment transport after %s and ignores late rejection', async action => {
  const view = await open(); const pending = deferred<{ ok: boolean; json: () => Promise<unknown> }>(); mocks.fetch.mockReturnValueOnce(pending.promise);
  send(); await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
  const signal = mocks.fetch.mock.calls[1][1].signal as AbortSignal;
  if (action === 'leave') view.unmount(); else fireEvent.click(screen.getByText('Sign out test'));
  await act(async () => { pending.resolve({ ok: false, json: async () => ({}) }); });
  expect(signal.aborted).toBe(true); expect(mocks.toast).not.toHaveBeenCalled();
});

it.each(['leave', 'sign out'])('does not start profile transport when user lookup outlives %s', async action => {
  const lookup = deferred<{ userId: string }>(); mocks.current.mockReturnValueOnce(lookup.promise);
  const view = render(<SymptomChecker />);
  if (action === 'leave') view.unmount(); else fireEvent.click(screen.getByText('Sign out test'));
  await act(async () => { lookup.resolve({ userId: 'test-patient' }); });
  expect(mocks.fetch).not.toHaveBeenCalled(); expect(mocks.store).not.toHaveBeenCalled();
});

it('aborts profile authentication before it can dispatch after unmount', async () => {
  const auth = deferred<typeof session>(); mocks.session.mockReturnValueOnce(auth.promise);
  const view = render(<SymptomChecker />); await waitFor(() => expect(mocks.session).toHaveBeenCalled()); view.unmount();
  await act(async () => { auth.resolve(session); }); expect(mocks.fetch).not.toHaveBeenCalled();
});

it('does not navigate when provider sign-out resolves after unmount', async () => {
  const view = await open(); const logout = deferred<void>(); mocks.logout.mockReturnValueOnce(logout.promise);
  fireEvent.click(screen.getByText('Sign out test')); view.unmount();
  await act(async () => { logout.resolve(); }); expect(mocks.navigate).not.toHaveBeenCalled();
});

it('survives strict effect cleanup and renders only an explicit available response', async () => {
  render(<StrictMode><SymptomChecker /></StrictMode>); await waitFor(() => expect(mocks.store).toHaveBeenCalledTimes(1));
  mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => assessment }); send();
  expect(await screen.findByText(/Synthetic response/)).toBeVisible();
});

it('dispatches only one assessment during repeated submissions', async () => {
  await open(); const auth = deferred<typeof session>(); mocks.session.mockReturnValueOnce(auth.promise);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Synthetic question' } });
  act(() => {
    screen.getByRole('button', { name: 'Send symptoms' }).click();
    screen.getByRole('button', { name: 'Send symptoms' }).click();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
  });
  mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => assessment });
  await act(async () => { auth.resolve(session); });
  expect(mocks.session).toHaveBeenCalledTimes(2); expect(mocks.fetch).toHaveBeenCalledTimes(2);
});

it('deduplicates pending sign-out but allows a retry after provider failure', async () => {
  await open(); let reject!: (reason: Error) => void;
  mocks.logout.mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
  act(() => { screen.getByText('Sign out test').click(); screen.getByText('Sign out test').click(); });
  expect(mocks.logout).toHaveBeenCalledTimes(1);
  await act(async () => { reject(new Error('Synthetic failure')); });
  fireEvent.click(screen.getByText('Sign out test'));
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1));
  expect(mocks.logout).toHaveBeenCalledTimes(2);
});
