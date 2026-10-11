import { readFileSync } from 'node:fs';
import { validateCognitoIdentifiers } from './provider-protocol.mjs';

const policy = JSON.parse(readFileSync(new URL('./provider-policy.json', import.meta.url), 'utf8'));
const httpDefaults = JSON.parse(readFileSync(new URL('../../src/config/http-defaults.json', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../../src/config/env.ts', import.meta.url), 'utf8');
const block = source.split('export const PUBLIC_ENV_NAMES = [')[1]?.split('] as const')[0];
if (!block) throw new Error('Public configuration boundary is unavailable');
const names = [...block.matchAll(/"(VITE_[A-Z0-9_]+)"/g)].map(match => match[1]);
if (!names.length || new Set(names).size !== names.length) throw new Error('Invalid public configuration boundary');

/** @param {string} raw @param {boolean} websocket */
function origin(raw, websocket = false) {
  let value;
  try { value = new URL(raw); } catch { throw new Error('Invalid public endpoint'); }
  if (raw !== raw.trim() || /[\s\x00-\x1f\x7f]/u.test(raw)
      || value.protocol !== (websocket ? 'wss:' : 'https:') || value.username || value.password
      || value.search || value.hash || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u.test(value.hostname)) throw new Error('Invalid public endpoint');
  return value.origin;
}

if (!Array.isArray(policy.optionalNames) || policy.optionalNames.some((/** @type {unknown} */ name) => typeof name !== 'string' || !names.includes(name))
    || typeof policy.awsDnsSuffix !== 'string' || !/^[a-z0-9.-]+$/u.test(policy.awsDnsSuffix)
    || !Array.isArray(policy.awsBrowserServices) || !policy.awsBrowserServices.length
    || policy.awsBrowserServices.some((/** @type {unknown} */ value) => typeof value !== 'string' || !/^[a-z0-9-]+$/u.test(value))) {
  throw new Error('Invalid maintained provider policy');
}
for (const purpose of ['connect', 'frame', 'script']) {
  const entries = policy.stripe?.[purpose];
  if (!Array.isArray(entries) || !entries.length || entries.some((/** @type {unknown} */ value) => typeof value !== 'string' || origin(value) !== value)) {
    throw new Error('Invalid maintained Stripe origin policy');
  }
}

/** Public configuration only. Never merge an arbitrary process environment.
 * @param {unknown} input @returns {Readonly<Record<string, string>>} */
export function validatePublicSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Public configuration must be an object');
  const values = /** @type {Record<string, unknown>} */ (input);
  for (const key of Object.keys(values)) {
    if (!names.includes(key)) throw new Error('Unrecognized public configuration key');
    if (typeof values[key] !== 'string') throw new Error(`Invalid public configuration: ${key}`);
  }
  /** @type {Record<string, string>} */
  const result = {};
  for (const name of names) {
    const raw = values[name] ?? (name in httpDefaults ? String(httpDefaults[name]) : undefined);
    const optional = policy.optionalNames.includes(name) || name.endsWith('_BACKUP');
    if (raw === undefined || raw === '') {
      if (!optional || name in httpDefaults) throw new Error(`Missing public configuration: ${name}`);
      continue;
    }
    if (typeof raw !== 'string' || raw !== raw.trim() || /[\s\x00-\x1f\x7f]/u.test(raw)) {
      throw new Error(`Invalid public configuration: ${name}`);
    }
    if (/sk_(?:test|live)_|-----BEGIN [A-Z ]*PRIVATE KEY-----/u.test(raw)) throw new Error('Secret material is forbidden in public configuration');
    if (name.includes('_URL')) origin(raw, name.includes('_WS_URL'));
    if (name.includes('_TIMEOUT_MS') && (!Number.isSafeInteger(Number(raw)) || Number(raw) <= 0 || Number(raw) > 2 ** 31 - 1)) throw new Error(`Invalid public timeout: ${name}`);
    result[name] = raw;
  }
  for (const label of ['US', 'EU']) {
    validateCognitoIdentifiers(result, /** @type {'US' | 'EU'} */ (label));
    for (const bucket of ['DOCTOR_DATA', 'EHR_RECORDS', 'PATIENT_DATA']) {
      if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/u.test(result[`VITE_S3_${bucket}_BUCKET_${label}`])) throw new Error('Invalid public storage configuration');
    }
  }
  if (!/^pk_test_[A-Za-z0-9]+$/u.test(result.VITE_STRIPE_PUBLISHABLE_KEY)
      || /showcase|placeholder|example/iu.test(result.VITE_STRIPE_PUBLISHABLE_KEY)) throw new Error('Connected verification requires a public Stripe test key');
  return Object.freeze(result);
}

/** @param {string} text */
export function parsePublicSettingsJson(text) {
  let input;
  try { input = JSON.parse(text); } catch { throw new Error('Invalid public configuration JSON'); }
  return validatePublicSettings(input);
}

/** @param {Readonly<Record<string, string>>} settings */
export function connectedContentSecurityPolicy(settings) {
  const validated = validatePublicSettings(settings);
  const connections = new Set(["'self'", ...policy.stripe.connect]);
  for (const [key, value] of Object.entries(validated)) if (key.includes('_URL')) connections.add(origin(value, key.includes('_WS_URL')));
  for (const label of ['US', 'EU']) {
    const region = validated[`VITE_AWS_REGION_${label}`];
    for (const service of policy.awsBrowserServices) connections.add(`https://${service}.${region}.${policy.awsDnsSuffix}`);
    for (const bucket of ['DOCTOR_DATA', 'EHR_RECORDS', 'PATIENT_DATA']) connections.add(`https://${validated[`VITE_S3_${bucket}_BUCKET_${label}`]}.s3.${region}.${policy.awsDnsSuffix}`);
  }
  return `connect-src ${[...connections].sort().join(' ')}; frame-src ${policy.stripe.frame.join(' ')}; script-src 'self' ${policy.stripe.script.join(' ')}; form-action 'self'; object-src 'none'; base-uri 'self'`;
}

/** Vite 5 disables environment discovery through its InlineConfig API.
 * @param {Readonly<Record<string, string>>} settings
 * @returns {Pick<import('vite').InlineConfig, 'envFile' | 'define'>} */
export function connectedViteEnvironment(settings) {
  const validated = validatePublicSettings(settings);
  return { envFile: false, define: Object.fromEntries(names.map(name => [
    `import.meta.env.${name}`, JSON.stringify(validated[name] ?? ''),
  ])) };
}
