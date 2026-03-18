/**
 * Secure Storage Utility
 * ======================
 * Security Fix: User profile data and tokens were stored as plaintext
 * in localStorage, making them trivially extractable via XSS attacks.
 *
 * This utility provides:
 * 1. REMOVAL of raw access_token from localStorage (highest security win)
 * 2. AES-GCM encrypted storage for user profile data via Web Crypto API
 * 3. Migration safety: reads legacy XOR-encrypted or plaintext data and
 *    upgrades to AES-GCM in the background
 * 4. Synchronous API: compatible with React useState initializers
 *
 * Encryption approach:
 *   - On module load, an AES-GCM 256-bit key is derived asynchronously
 *     from CIPHER_KEY via PBKDF2 (100k iterations, SHA-256).
 *   - `setUser()` writes XOR-encrypted data synchronously (immediate),
 *     then fires an async task to re-encrypt with AES-GCM.
 *   - `getUser()` reads synchronously — decodes AES-GCM (from cache) or
 *     XOR (legacy), transparently.
 *   - A background migration task upgrades any XOR data to AES-GCM once
 *     the key is ready.
 *
 * The real security win is removing the token entirely — user profile data
 * (name, email, role) is lower-sensitivity than an auth token.
 */

// Cipher key — can be overridden via env var for rotation
const CIPHER_KEY = import.meta.env.VITE_STORAGE_CIPHER_KEY;
if (!CIPHER_KEY) {
  throw new Error('VITE_STORAGE_CIPHER_KEY environment variable is required');
}

// Prefix to distinguish encrypted values from legacy plaintext
const ENCRYPTED_PREFIX = 'enc:';

// Prefix for AES-GCM encrypted values
const AES_PREFIX = 'aes:';

// Storage key prefix to avoid collision with other apps
const KEY_PREFIX = '_mc_';

// Fixed salt for PBKDF2 key derivation (deterministic per app)
const PBKDF2_SALT = new TextEncoder().encode('mediconnect-secure-storage-v1');

// PBKDF2 iteration count
const PBKDF2_ITERATIONS = 100_000;

// AES-GCM IV size in bytes
const IV_LENGTH = 12;

// ─── AES-GCM Crypto State ────────────────────────────────────────────────

/** Module-level cached AES-GCM key. Null until derivation completes. */
let aesKey: CryptoKey | null = null;

/**
 * Module-level promise for key derivation. Resolves when the key is ready.
 * Other async operations await this before encrypting/decrypting.
 */
let keyReady: Promise<void>;

/**
 * In-memory cache of the last decrypted user JSON string.
 * Used so that getUser() can return synchronously even for AES-GCM data
 * by reading from this cache when the stored value has `aes:` prefix.
 */
let cachedUserJson: string | null = null;

/**
 * Derive an AES-GCM 256-bit key from CIPHER_KEY using PBKDF2.
 * Called once at module load time.
 */
async function initCrypto(): Promise<void> {
  try {
    // Import the raw cipher key as PBKDF2 key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(CIPHER_KEY),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Derive AES-GCM 256-bit key
    aesKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: PBKDF2_SALT,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    // Once the key is ready, attempt background migration of XOR data to AES-GCM
    migrateToAesGcm();
  } catch (e) {
    // SubtleCrypto not available (e.g., non-secure context). AES stays null,
    // and the system falls back to XOR cipher permanently.
    console.warn('[secure-storage] AES-GCM key derivation failed, using XOR fallback:', e);
  }
}

// Kick off key derivation immediately at module load
keyReady = initCrypto();

// ─── AES-GCM Async Encrypt / Decrypt ─────────────────────────────────────

/**
 * Encrypt plaintext with AES-GCM. Returns base64 string with IV prepended.
 * Requires aesKey to be available.
 */
async function encryptAesGcm(plaintext: string): Promise<string> {
  if (!aesKey) throw new Error('AES key not available');

  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoded
  );

  // Prepend IV to ciphertext: [12 bytes IV][ciphertext + auth tag]
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return uint8ToBase64(combined);
}

/**
 * Decrypt AES-GCM ciphertext. Input is base64 string with IV prepended.
 * Requires aesKey to be available.
 */
async function decryptAesGcm(encoded: string): Promise<string> {
  if (!aesKey) throw new Error('AES key not available');

  const combined = base64ToUint8(encoded);

  // Extract IV (first 12 bytes) and ciphertext (rest)
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

// ─── Background Migration ─────────────────────────────────────────────────

/**
 * If the stored user data is XOR-encrypted (enc: prefix), read it,
 * decrypt via XOR, re-encrypt via AES-GCM, and write back with aes: prefix.
 * This runs once after key derivation completes.
 */
async function migrateToAesGcm(): Promise<void> {
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}user`);
    if (!raw) return;

    // Only migrate XOR-encrypted data
    if (raw.startsWith(ENCRYPTED_PREFIX)) {
      const xorPayload = raw.slice(ENCRYPTED_PREFIX.length);
      const json = xorDecode(xorPayload);

      // Validate it's real JSON before migrating
      JSON.parse(json);

      // Re-encrypt with AES-GCM
      const aesPayload = await encryptAesGcm(json);
      localStorage.setItem(`${KEY_PREFIX}user`, `${AES_PREFIX}${aesPayload}`);

      // Update cache
      cachedUserJson = json;
    } else if (!raw.startsWith(AES_PREFIX)) {
      // Plaintext JSON in the new key — encrypt it
      JSON.parse(raw); // validate
      const aesPayload = await encryptAesGcm(raw);
      localStorage.setItem(`${KEY_PREFIX}user`, `${AES_PREFIX}${aesPayload}`);
      cachedUserJson = raw;
    }
  } catch {
    // Migration failed silently — data remains in current format
  }
}

/**
 * Fire-and-forget: re-encrypt data with AES-GCM after a synchronous XOR write.
 */
function scheduleAesReEncrypt(json: string): void {
  keyReady.then(async () => {
    if (!aesKey) return; // AES not available, XOR stays

    try {
      const aesPayload = await encryptAesGcm(json);
      // Only overwrite if the key still holds our data (user hasn't been cleared)
      const current = localStorage.getItem(`${KEY_PREFIX}user`);
      if (current) {
        localStorage.setItem(`${KEY_PREFIX}user`, `${AES_PREFIX}${aesPayload}`);
        cachedUserJson = json;
      }
    } catch {
      // AES re-encrypt failed silently; XOR data remains intact
    }
  });
}

// ─── Auth Session Flag (replaces raw access_token storage) ───────────────

/**
 * Mark the user as authenticated. Does NOT store the actual token.
 * The real token is always fetched fresh from AWS Amplify's fetchAuthSession().
 */
export function markAuthenticated(): void {
  localStorage.setItem(`${KEY_PREFIX}auth`, 'true');
}

/**
 * Check if user has an active auth session.
 * This is a lightweight sync check for route protection.
 * Actual token validation still happens via Amplify on API calls.
 */
export function isAuthenticated(): boolean {
  return localStorage.getItem(`${KEY_PREFIX}auth`) === 'true';
}

/**
 * Clear the auth session flag.
 */
export function clearAuth(): void {
  localStorage.removeItem(`${KEY_PREFIX}auth`);
  // Also clear legacy key for migration
  localStorage.removeItem('access_token');
}

// ─── Encrypted User Profile Storage ──────────────────────────────────────

/**
 * Store user profile data with encryption.
 * Replaces: localStorage.setItem('user', JSON.stringify(data))
 *
 * Writes XOR-encrypted data synchronously for immediate availability,
 * then fires an async task to upgrade to AES-GCM encryption.
 */
export function setUser(data: any): void {
  if (!data) {
    localStorage.removeItem(`${KEY_PREFIX}user`);
    cachedUserJson = null;
    return;
  }

  const json = JSON.stringify(data);

  // If AES key is already available, try sync path with cached key
  // (AES encrypt is async, so we still write XOR first as a sync guarantee)
  const xorEncrypted = xorEncode(json);
  localStorage.setItem(`${KEY_PREFIX}user`, `${ENCRYPTED_PREFIX}${xorEncrypted}`);

  // Update the in-memory cache immediately
  cachedUserJson = json;

  // Fire-and-forget: re-encrypt with AES-GCM in the background
  scheduleAesReEncrypt(json);
}

/**
 * Retrieve and decrypt user profile data.
 * Replaces: JSON.parse(localStorage.getItem('user'))
 *
 * Handles three storage formats:
 *   - `aes:` prefix  → AES-GCM encrypted (preferred, read from cache)
 *   - `enc:` prefix  → XOR encrypted (legacy, decoded synchronously)
 *   - no prefix       → plaintext JSON (legacy migration)
 *
 * Migration safety: if the value is legacy plaintext or XOR-encrypted,
 * it will be returned and the background migrator will upgrade it.
 */
export function getUser<T = any>(): T | null {
  // Try new encrypted storage first
  const raw = localStorage.getItem(`${KEY_PREFIX}user`);
  if (raw) {
    // AES-GCM encrypted data
    if (raw.startsWith(AES_PREFIX)) {
      // AES-GCM decryption is async, so we rely on the in-memory cache.
      // The cache is populated by: setUser(), migrateToAesGcm(), and
      // the warm-up block below.
      if (cachedUserJson) {
        try {
          return JSON.parse(cachedUserJson);
        } catch {
          // Cache corrupted, fall through
        }
      }

      // Cache miss for AES data — kick off async decryption to populate cache
      // and try a synchronous XOR fallback or return null this one time.
      // This can only happen on a fresh page load before initCrypto completes.
      warmAesCache(raw.slice(AES_PREFIX.length));

      // While waiting, we cannot decode AES synchronously. Return null once;
      // the next call (after cache warms) will succeed.
      return null;
    }

    // XOR encrypted data (legacy)
    if (raw.startsWith(ENCRYPTED_PREFIX)) {
      try {
        const json = xorDecode(raw.slice(ENCRYPTED_PREFIX.length));
        const data = JSON.parse(json);
        cachedUserJson = json;
        return data;
      } catch {
        // Corrupted — fall through to legacy check
      }
    }

    // Non-prefixed value in new key — try as plain JSON
    try {
      const data = JSON.parse(raw);
      cachedUserJson = raw;
      return data;
    } catch { /* ignore */ }
  }

  // Migration: check legacy 'user' key (plaintext)
  const legacy = localStorage.getItem('user');
  if (legacy) {
    try {
      const data = JSON.parse(legacy);
      // Auto-migrate: write to encrypted storage and clear legacy
      setUser(data);
      localStorage.removeItem('user');
      return data;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Async helper: decrypt AES-GCM data and populate the cache.
 * Called when getUser() encounters AES data but the cache is cold.
 */
function warmAesCache(aesPayload: string): void {
  keyReady.then(async () => {
    if (!aesKey) return;
    try {
      const json = await decryptAesGcm(aesPayload);
      JSON.parse(json); // validate
      cachedUserJson = json;
    } catch {
      // Decryption failed — data may be corrupt
    }
  });
}

/**
 * Clear user profile data from all storage locations.
 */
export function clearUser(): void {
  localStorage.removeItem(`${KEY_PREFIX}user`);
  // Also clear legacy key for migration
  localStorage.removeItem('user');
  cachedUserJson = null;
}

// ─── Full Cleanup ────────────────────────────────────────────────────────

/**
 * Clear all sensitive data (auth + user + legacy keys).
 * Replaces: localStorage.clear() or manual removeItem calls on logout.
 * Preserves non-sensitive keys like gdpr_consent and userRegion.
 */
export function clearAllSensitive(): void {
  clearAuth();
  clearUser();
  // Legacy keys that may still exist
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
}

// ─── Legacy XOR Cipher Functions (kept for migration compatibility) ───────

/**
 * Multi-round XOR cipher with key stretching.
 * Produces base64 output. Used as synchronous fallback and for
 * reading legacy `enc:` prefixed data during migration to AES-GCM.
 */
function xorEncode(plaintext: string): string {
  const stretchedKey = stretchKey(CIPHER_KEY, plaintext.length);
  const bytes = new TextEncoder().encode(plaintext);
  const encoded = new Uint8Array(bytes.length);

  for (let i = 0; i < bytes.length; i++) {
    // XOR with stretched key + position-dependent rotation
    encoded[i] = bytes[i] ^ stretchedKey.charCodeAt(i % stretchedKey.length) ^ ((i * 7 + 13) & 0xFF);
  }

  return uint8ToBase64(encoded);
}

function xorDecode(encoded: string): string {
  const bytes = base64ToUint8(encoded);
  const key = stretchKey(CIPHER_KEY, bytes.length);
  const decoded = new Uint8Array(bytes.length);

  for (let i = 0; i < bytes.length; i++) {
    decoded[i] = bytes[i] ^ key.charCodeAt(i % key.length) ^ ((i * 7 + 13) & 0xFF);
  }

  return new TextDecoder().decode(decoded);
}

/**
 * Stretch a short key to cover the data length via repeated hashing.
 */
function stretchKey(key: string, minLength: number): string {
  let stretched = key;
  let round = 0;
  while (stretched.length < Math.max(minLength, 256)) {
    // Simple hash mixing
    let hash = 0;
    const input = key + round.toString();
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
    }
    stretched += String.fromCharCode(
      ((hash >>> 0) % 94) + 33,
      ((hash >>> 8) % 94) + 33,
      ((hash >>> 16) % 94) + 33,
      ((hash >>> 24) % 94) + 33
    );
    round++;
  }
  return stretched;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
