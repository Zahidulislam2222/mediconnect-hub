import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), fetch: vi.fn(), base: vi.fn(() => 'https://cms.example.test') }));
vi.mock('aws-amplify/auth', () => ({ fetchAuthSession: mocks.auth }));
vi.mock('@/config/env', () => ({ optionalCmsUrl: mocks.base, requestTimeout: () => 100, publicEnv: vi.fn(), optionalBackupUrl: vi.fn() }));
import { cmsApi } from '@/lib/api';
beforeEach(() => { vi.clearAllMocks(); mocks.base.mockReturnValue('https://cms.example.test'); mocks.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [] }) }); vi.stubGlobal('fetch', mocks.fetch); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it('CMS reads omit the app token and cookies, and refuse credential-bearing redirects', async () => {
  await cmsApi.get('/api/articles?status=published'); expect(mocks.auth).not.toHaveBeenCalled();
  expect(mocks.fetch).toHaveBeenCalledWith('https://cms.example.test/api/articles?status=published', expect.objectContaining({ credentials: 'omit', redirect: 'error' }));
  expect(mocks.fetch.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
});
it('refuses absolute, protocol-relative and traversal request paths before network', async () => {
  for (const path of ['https://foreign.example.test', '//foreign.example.test', '/api/../admin', '/api/%2e%2e/admin']) await expect(cmsApi.get(path)).rejects.toThrow();
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it('does not authenticate or dispatch for a cancelled caller', async () => {
  const controller = new AbortController(); controller.abort();
  await expect(cmsApi.get('/api/articles', { signal: controller.signal })).rejects.toThrow(); expect(mocks.fetch).not.toHaveBeenCalled(); expect(mocks.auth).not.toHaveBeenCalled();
});
it('fetches media as validated blobs without cookies or redirects', async () => {
  const blob = new Blob(['test-image'], { type: 'image/png' }); mocks.fetch.mockResolvedValue({ ok: true, status: 200, redirected: false, blob: async () => blob });
  expect(await cmsApi.media('https://cms.example.test/uploads/test.png')).toBe(blob);
  expect(mocks.fetch).toHaveBeenCalledWith('https://cms.example.test/uploads/test.png', expect.objectContaining({ credentials: 'omit', redirect: 'error' }));
  expect(mocks.auth).not.toHaveBeenCalled();
  mocks.fetch.mockRejectedValueOnce(new TypeError('test redirect refused')); await expect(cmsApi.media('/uploads/redirect.png')).rejects.toThrow();
  await expect(cmsApi.media('https://foreign.example.test/a.png')).rejects.toThrow();
});
it('cancels in-flight media and bounds stalled JSON/media bodies', async () => {
  const controller = new AbortController(); mocks.fetch.mockImplementation((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))));
  const pending = cmsApi.media('/uploads/test.png', { signal: controller.signal }); const aborted = expect(pending).rejects.toThrow(); controller.abort(); await aborted;
  vi.useFakeTimers();
  for (const method of ['get', 'media'] as const) {
    mocks.fetch.mockResolvedValue({ ok: true, status: 200, json: () => new Promise(() => {}), blob: () => new Promise(() => {}) });
    const request = method === 'get' ? cmsApi.get('/api/articles') : cmsApi.media('/uploads/stalled.png');
    const failure = expect(request).rejects.toThrow(); await vi.advanceTimersByTimeAsync(101); await failure;
  }
  expect(mocks.auth).not.toHaveBeenCalled();
});
