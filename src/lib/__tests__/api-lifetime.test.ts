import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, MutationOutcomeUnknownError } from '@/lib/api';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), fetch: vi.fn() }));
vi.mock('aws-amplify/auth', () => ({ fetchAuthSession: mocks.auth }));
vi.mock('@/lib/secure-storage', () => ({ getUser: () => ({ role: 'patient' }) }));
vi.mock('@/config/env', () => ({
  publicEnv: (name: string) => name.endsWith('_BACKUP') ? 'https://backup.example.test' : 'https://primary.example.test',
  optionalBackupUrl: () => 'https://backup.example.test',
  requestTimeout: () => 100,
}));
const session = { tokens: { idToken: { toString: () => 'test-token' } } };
beforeEach(() => {
  mocks.auth.mockReset().mockResolvedValue(session);
  mocks.fetch.mockReset().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'test-appointment' }) });
  vi.stubGlobal('fetch', mocks.fetch); localStorage.setItem('userRegion', 'US');
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('caller lifetime at the actual authenticated transport', () => {
  it('does not fetch auth or dispatch for an already-aborted caller', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(api.post('/appointments', {}, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('does not dispatch when signout or navigation occurs during authentication retrieval', async () => {
    let complete!: (value: typeof session) => void;
    mocks.auth.mockImplementation(() => new Promise(done => { complete = done; }));
    const controller = new AbortController();
    const result = api.post('/appointments', {}, { signal: controller.signal }).catch(error => error);
    controller.abort(); complete(session);
    expect(await result).toMatchObject({ name: 'AbortError' }); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('does not become a guest write when authentication fails after cancellation', async () => {
    let reject!: (error: Error) => void;
    mocks.auth.mockImplementation(() => new Promise((_, failed) => { reject = failed; }));
    const controller = new AbortController();
    const result = api.post('/appointments', {}, { signal: controller.signal }).catch(error => error);
    controller.abort(); reject(new Error('test-session-ended'));
    expect(await result).toMatchObject({ name: 'AbortError' }); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('aborts dispatched writes with an uncertain outcome and never retries them', async () => {
    const controller = new AbortController(); let dispatched!: () => void;
    const started = new Promise<void>(done => { dispatched = done; });
    mocks.fetch.mockImplementation((_url, options: RequestInit) => {
      dispatched();
      return new Promise((_, reject) => options.signal!.addEventListener('abort', () => reject(new DOMException('test-abort', 'AbortError'))));
    });
    const result = api.post('/appointments', {}, { signal: controller.signal }).catch(error => error);
    await started; controller.abort();
    expect(mocks.fetch.mock.calls[0][1].signal.aborted).toBe(true);
    expect(await result).toBeInstanceOf(MutationOutcomeUnknownError); expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.fetch.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it('cancels body consumption for reads without contacting the backup', async () => {
    const controller = new AbortController(); let reading!: () => void;
    const started = new Promise<void>(done => { reading = done; });
    mocks.fetch.mockResolvedValue({ ok: true, status: 200, json: () => { reading(); return new Promise(() => {}); } });
    const result = api.get('/appointments', { signal: controller.signal }).catch(error => error);
    await started; controller.abort();
    expect(await result).toMatchObject({ name: 'AbortError' }); expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
});
