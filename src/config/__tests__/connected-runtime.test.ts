// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { PUBLIC_ENV_NAMES } from '../env';
import httpDefaults from '../http-defaults.json';
import { resolveConfig } from 'vite';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validatePublicSettings, parsePublicSettingsJson, connectedContentSecurityPolicy, connectedViteEnvironment } from '../../../deploy/connected/runtime-settings.mjs';

function fixture(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of PUBLIC_ENV_NAMES) {
    if (name.includes('_URL')) result[name] = `${name.includes('_WS_URL') ? 'wss' : 'https'}://service.example.invalid`;
    else if (name.includes('_TIMEOUT_MS')) result[name] = '1000';
    else result[name] = name.includes('_CLIENT_') ? 'testClient' : 'test-value';
  }
  for (const [label, region] of [['US', 'us-east-1'], ['EU', 'eu-central-1']]) {
    result[`VITE_AWS_REGION_${label}`] = region;
    result[`VITE_COGNITO_USER_POOL_ID_${label}`] = `${region}_testpool`;
    result[`VITE_COGNITO_IDENTITY_POOL_ID_${label}`] = `${region}:00000000-0000-0000-0000-000000000001`;
  }
  result.VITE_STRIPE_PUBLISHABLE_KEY = 'pk_test_testKey';
  return result;
}

describe('connected public configuration boundary', () => {
  it('accepts only documented public values and produces immutable validated settings', () => {
    const input = fixture();
    const values = validatePublicSettings(input);
    expect(Object.keys(values)).toHaveLength(PUBLIC_ENV_NAMES.length);
    expect(Object.isFrozen(values)).toBe(true);
    input.VITE_AWS_REGION_US = 'test-changed';
    expect(values.VITE_AWS_REGION_US).toBe('us-east-1');
  });
  it('rejects unknown, non-string and secret material without disclosing input', () => {
    for (const input of [null, [], { ...fixture(), OPENAI_API_KEY: 'test-key' },
      { ...fixture(), VITE_UNKNOWN: 'test-value' }, { ...fixture(), VITE_AWS_REGION_US: 1 },
      { ...fixture(), VITE_COGNITO_CLIENT_PATIENT_US: 'sk_test_' }]) {
      expect(() => validatePublicSettings(input)).toThrow();
    }
    expect(() => validatePublicSettings({ ...fixture(), VITE_UNKNOWN: 'test-private-value' })).toThrow('Unrecognized public configuration key');
  });
  it('rejects missing required settings, unsafe endpoints and mismatched regions', () => {
    for (const value of ['', 'https://*.example.invalid', 'http://service.example.invalid', 'https://user:pass@service.example.invalid',
      'https://service.example.invalid/?secret=test-key', 'https://service.example.invalid/#fragment',
      ' https://service.example.invalid', "https://service.example.invalid/\nscript-src *"]) {
      expect(() => validatePublicSettings({ ...fixture(), VITE_BOOKING_SERVICE_URL_US: value })).toThrow();
    }
    expect(() => validatePublicSettings({ ...fixture(), VITE_COGNITO_USER_POOL_ID_US: 'eu-central-1_testpool' })).toThrow('Inconsistent regional');
    expect(() => validatePublicSettings({ ...fixture(), VITE_S3_PATIENT_DATA_BUCKET_US: 'test/bucket' })).toThrow('storage');
  });
  it('refuses live or showcase payment keys and invalid timeout values', () => {
    for (const value of ['pk_live_testOnlyValue', 'pk_test_showcase', 'pk_test_placeholder']) {
      expect(() => validatePublicSettings({ ...fixture(), VITE_STRIPE_PUBLISHABLE_KEY: value })).toThrow('public Stripe test key');
    }
    for (const value of ['0', '-1', '1.5', '2147483648']) {
      expect(() => validatePublicSettings({ ...fixture(), VITE_API_PRIMARY_TIMEOUT_MS: value })).toThrow('timeout');
    }
  });
  it('uses the existing central timeout defaults when omitted and refuses explicit blanks', () => {
    const input = fixture();
    for (const name of Object.keys(httpDefaults)) delete input[name];
    const settings = validatePublicSettings(input);
    for (const [name, value] of Object.entries(httpDefaults)) expect(settings[name]).toBe(String(value));
    expect(() => validatePublicSettings({ ...input, VITE_API_PRIMARY_TIMEOUT_MS: '' })).toThrow();
  });
  it('rejects parser diagnostics that could disclose a malformed private value', () => {
    expect(() => validatePublicSettings({ ...fixture(), VITE_BOOKING_SERVICE_URL_US: 'test-private-malformed-url' }))
      .toThrow('Invalid public endpoint');
    expect(() => parsePublicSettingsJson('{"test-key": test-private-value}')).toThrow('Invalid public configuration JSON');
  });
  it('the real CLI refuses malformed private input without echoing it or creating output', () => {
    const root = fileURLToPath(new URL('../../..', import.meta.url));
    expect(existsSync(path.join(root, 'package.json'))).toBe(true);
    const directory = path.join(root, 'local-tests', 'connected-cli-fixtures');
    mkdirSync(directory, { recursive: true });
    const input = path.join(directory, 'malformed-input.json');
    const destination = path.join(directory, 'never-created-' + randomUUID());
    const raw = '{"test-key": test-private-value}';
    writeFileSync(input, raw);
    const result = spawnSync('node', [path.join(root, 'deploy/connected/build-connected.mjs'), input, destination], { cwd: root, encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Invalid public configuration JSON');
    expect(result.stdout + result.stderr).not.toContain('test-private-value');
    expect(existsSync(destination)).toBe(false);
    expect(readFileSync(input, 'utf8')).toBe(raw);
  });
  it('rejects empty or malformed pool, identity and client identifiers', () => {
    for (const [name, value] of [
      ['VITE_COGNITO_USER_POOL_ID_US', 'us-east-1_'],
      ['VITE_COGNITO_USER_POOL_ID_US', 'us-east-1_test-pool'],
      ['VITE_COGNITO_IDENTITY_POOL_ID_US', 'us-east-1:'],
      ['VITE_COGNITO_IDENTITY_POOL_ID_US', 'us-east-1:not-a-guid'],
      ['VITE_COGNITO_CLIENT_PATIENT_US', 'test-client-with-dash'],
    ]) expect(() => validatePublicSettings({ ...fixture(), [name]: value })).toThrow();
  });
  it('derives explicit AWS, storage, HTTP and websocket origins without wildcards', () => {
    const csp = connectedContentSecurityPolicy(validatePublicSettings(fixture()));
    expect(csp).toContain('https://cognito-idp.us-east-1.amazonaws.com');
    expect(csp).toContain('https://cognito-identity.eu-central-1.amazonaws.com');
    expect(csp).toContain('https://test-value.s3.eu-central-1.amazonaws.com');
    expect(csp).toContain('wss://service.example.invalid');
    expect(csp).toContain('https://api.stripe.com');
    expect(csp).toContain("script-src 'self' https://js.stripe.com");
    expect(csp).not.toContain('*');
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).toContain("form-action 'self'; object-src 'none'; base-uri 'self'");
  });
  it('disables installed Vite environment discovery and defines only the public allowlist', async () => {
    vi.stubEnv('VITE_CONNECTED_UNEXPECTED', 'test-value');
    try {
      const settings = connectedViteEnvironment(fixture());
      const config = await resolveConfig({ ...settings, configFile: false }, 'build');
      expect(Object.keys(config.env).filter(key => key.startsWith('VITE_'))).toEqual([]);
      expect(Object.keys(settings.define ?? {})).toHaveLength(PUBLIC_ENV_NAMES.length);
      expect(settings.define?.['import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY']).toBe('"pk_test_testKey"');
      expect(settings.define?.['import.meta.env.VITE_CONNECTED_UNEXPECTED']).toBeUndefined();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
