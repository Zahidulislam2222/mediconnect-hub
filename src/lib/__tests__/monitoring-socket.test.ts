import { beforeEach, describe, expect, it, vi } from 'vitest';
const { fetchSession, values } = vi.hoisted(() => ({ fetchSession: vi.fn(), values: {} as Record<string, string> }));
vi.mock('aws-amplify/auth', () => ({ fetchAuthSession: fetchSession }));
vi.mock('@/config/env', () => ({
  configuredCognitoIssuer: (region: string) => `https://identity-${region.toLowerCase()}.example.invalid/test-pool`,
  publicEnv: (name: string) => values[name],
}));
import { monitoringConnection } from '../monitoring-socket';

beforeEach(() => {
  values.VITE_MONITORING_SOCKET_URL_EU = 'https://monitoring-eu.example.invalid';
  values.VITE_MONITORING_SOCKET_URL_US = 'https://monitoring-us.example.invalid';
  fetchSession.mockResolvedValue({ tokens: { idToken: { payload: { iss: 'https://identity-eu.example.invalid/test-pool' }, toString: () => 'test-token' } } });
});

describe('monitoring connection boundary', () => {
  it.each(['EU', 'US'])('selects %s from the known issuer and keeps credentials out of the URL', async region => {
    fetchSession.mockResolvedValue({ tokens: { idToken: { payload: { iss: `https://identity-${region.toLowerCase()}.example.invalid/test-pool` }, toString: () => 'test-token' } } });
    const result = await monitoringConnection();
    expect(result.auth).toEqual({ token: 'test-token', region });
    expect(result.url).toBe(`https://monitoring-${region.toLowerCase()}.example.invalid`);
    expect(result.url).not.toContain('test-token');
  });
  it('rejects missing authentication and unknown issuers', async () => {
    fetchSession.mockResolvedValue({}); await expect(monitoringConnection()).rejects.toThrow();
    fetchSession.mockResolvedValue({ tokens: { idToken: { payload: { iss: 'https://untrusted.example.invalid' } } } });
    await expect(monitoringConnection()).rejects.toThrow('jurisdiction');
  });
  it.each(['http://monitoring.example.invalid', 'https://monitoring.example.invalid?token=test-key',
    'https://test-user:test-key@monitoring.example.invalid', 'https://monitoring.example.invalid/proxy'])('rejects unsafe endpoint %s', async endpoint => {
    values.VITE_MONITORING_SOCKET_URL_EU = endpoint;
    await expect(monitoringConnection()).rejects.toThrow();
  });
});
