import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PushInitializer } from '@/components/app/PushInitializer';
import appSource from '@/App.tsx?raw';

const mocks = vi.hoisted(() => ({ permission: vi.fn(), request: vi.fn(), register: vi.fn(), add: vi.fn(), native: vi.fn(), session: vi.fn(), fetch: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mocks.native } }));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: { checkPermissions: mocks.permission, requestPermissions: mocks.request, register: mocks.register, addListener: mocks.add } }));
vi.mock('aws-amplify/auth', () => ({ fetchAuthSession: mocks.session }));
vi.mock('@/config/env', async importOriginal => {
  const original = await importOriginal<Record<string, unknown>>();
  return { ...original, publicEnv: () => 'https://push.example.test', optionalBackupUrl: () => '' };
});
vi.mock('@/lib/secure-storage', () => ({ getUser: () => ({ id: 'test-patient', role: 'patient' }), SESSION_CLEARED_EVENT: 'test-session-cleared' }));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
type Handle = { remove: ReturnType<typeof vi.fn> };
let handles: Handle[];
let registration: ((token: { value: string }) => Promise<void>) | undefined;
beforeEach(() => {
  vi.resetAllMocks(); handles = []; registration = undefined;
  mocks.native.mockReturnValue(true); mocks.permission.mockResolvedValue({ receive: 'granted' });
  mocks.request.mockResolvedValue({ receive: 'granted' }); mocks.register.mockResolvedValue(undefined);
  mocks.add.mockImplementation(async (name, callback) => { if (name === 'registration') registration = callback;
    const handle = { remove: vi.fn().mockResolvedValue(undefined) }; handles.push(handle); return handle; });
  vi.stubGlobal('fetch', mocks.fetch);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('owns native push registration inside the verified session lifecycle', () => {
  const protectedRoute = appSource.slice(
    appSource.indexOf('const ProtectedRoute'),
    appSource.indexOf('const AppContent'),
  );
  const runtimeServices = appSource.slice(
    appSource.indexOf('const RuntimeServices'),
    appSource.indexOf('const App ='),
  );
  expect(protectedRoute).toContain('<PushInitializer');
  expect(runtimeServices).not.toContain('<PushInitializer');
});

it('does not start native setup without consent or on the web', async () => {
  const view = render(<PushInitializer enabled={false} />); expect(mocks.permission).not.toHaveBeenCalled();
  mocks.native.mockReturnValue(false); view.rerender(<PushInitializer enabled />); expect(mocks.permission).not.toHaveBeenCalled();
});

it.each(['permission', 'request'])('stops setup when a pending %s check outlives the route', async stage => {
  const pending = deferred<{ receive: string }>();
  if (stage === 'permission') mocks.permission.mockReturnValueOnce(pending.promise);
  else { mocks.permission.mockResolvedValueOnce({ receive: 'prompt' }); mocks.request.mockReturnValueOnce(pending.promise); }
  const view = render(<PushInitializer enabled />);
  await waitFor(() => expect(stage === 'permission' ? mocks.permission : mocks.request).toHaveBeenCalled());
  view.unmount(); await act(async () => { pending.resolve({ receive: 'granted' }); });
  expect(mocks.register).not.toHaveBeenCalled(); expect(mocks.add).not.toHaveBeenCalled();
});

it('removes owned listeners on every unmount instead of accumulating them', async () => {
  for (let index = 0; index < 2; index++) {
    const view = render(<PushInitializer enabled />); await waitFor(() => expect(handles.length).toBe((index + 1) * 2)); view.unmount();
  }
  await waitFor(() => handles.forEach(handle => expect(handle.remove).toHaveBeenCalledTimes(1)));
});

it('removes a listener handle that resolves after the route has left', async () => {
  const pending = deferred<Handle>(); mocks.add.mockReturnValueOnce(pending.promise);
  const view = render(<PushInitializer enabled />); await waitFor(() => expect(mocks.add).toHaveBeenCalledTimes(1)); view.unmount();
  const handle = { remove: vi.fn().mockResolvedValue(undefined) };
  await act(async () => { pending.resolve(handle); });
  expect(handle.remove).toHaveBeenCalledTimes(1); expect(mocks.add).toHaveBeenCalledTimes(1);
});

it('aborts a registration write before delayed authentication can dispatch it', async () => {
  const pending = deferred<unknown>(); mocks.session.mockReturnValueOnce(pending.promise);
  const view = render(<PushInitializer enabled />); await waitFor(() => expect(registration).toBeTypeOf('function'));
  const sending = registration!({ value: 'test-key' });
  await waitFor(() => expect(mocks.session).toHaveBeenCalledTimes(1)); view.unmount();
  await act(async () => { pending.resolve({ tokens: { idToken: { toString: () => 'test-key' } } }); await sending; });
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it('receives registration emitted during register and writes through the real API boundary', async () => {
  mocks.session.mockResolvedValue({ tokens: { idToken: { toString: () => 'test-key' } } });
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });
  mocks.register.mockImplementation(async () => { await registration!({ value: 'test-key' }); });
  render(<PushInitializer enabled />);
  await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
  expect(mocks.fetch.mock.calls[0][0]).toBe('https://push.example.test/patients/test-patient');
  expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toEqual({ fcmToken: 'test-key' });
});

it('ends owned callbacks when the account session is cleared', async () => {
  render(<PushInitializer enabled />); await waitFor(() => expect(handles).toHaveLength(2));
  act(() => { window.dispatchEvent(new Event('test-session-cleared')); });
  await registration!({ value: 'test-key' });
  expect(mocks.session).not.toHaveBeenCalled();
  handles.forEach(handle => expect(handle.remove).toHaveBeenCalledTimes(1));
});
