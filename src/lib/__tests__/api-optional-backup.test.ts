import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('aws-amplify/auth', () => ({ fetchAuthSession: vi.fn().mockResolvedValue({}) }));
vi.mock('../secure-storage', () => ({ getUser: () => ({ role: 'patient' }) }));
const primary = 'https://patient.example.invalid';
const backup = 'https://backup.example.invalid';
const fetchMock = vi.fn();
beforeEach(() => {
  vi.resetModules(); vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset();
  localStorage.setItem('userRegion', 'US');
  vi.stubEnv('VITE_PATIENT_SERVICE_URL_US', primary);
  vi.stubEnv('VITE_PATIENT_SERVICE_URL_US_BACKUP', undefined);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const success = () => new Response(JSON.stringify({ ok: true }), { status: 200 });

describe('optional regional API backup configuration', () => {
  it.each([undefined, '', '   '])('uses primary when backup is %s', async value => {
    vi.stubEnv('VITE_PATIENT_SERVICE_URL_US_BACKUP', value);
    fetchMock.mockResolvedValue(success());
    const { api } = await import('../api');
    await expect(api.get('/patients')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${primary}/patients`);
  });
  it('makes no second attempt after primary transport failure without a backup', async () => {
    fetchMock.mockRejectedValue(new TypeError('test transport failure'));
    const { api } = await import('../api');
    await expect(api.get('/patients')).rejects.toThrow('REQUEST_TRANSPORT_FAILED');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('uses a configured backup for an eligible failed read', async () => {
    vi.stubEnv('VITE_PATIENT_SERVICE_URL_US_BACKUP', backup);
    fetchMock.mockRejectedValueOnce(new TypeError('test transport failure')).mockResolvedValueOnce(success());
    const { api } = await import('../api');
    await expect(api.get('/patients')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(`${backup}/patients`);
  });
  it('rejects a malformed configured backup before dispatch', async () => {
    vi.stubEnv('VITE_PATIENT_SERVICE_URL_US_BACKUP', 'not-a-url');
    const { api } = await import('../api');
    await expect(api.get('/patients')).rejects.toThrow('configuration');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('does not retry a write even with a valid backup', async () => {
    vi.stubEnv('VITE_PATIENT_SERVICE_URL_US_BACKUP', backup);
    fetchMock.mockRejectedValue(new TypeError('test transport failure'));
    const { api, MutationOutcomeUnknownError } = await import('../api');
    await expect(api.post('/patients', {})).rejects.toBeInstanceOf(MutationOutcomeUnknownError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
