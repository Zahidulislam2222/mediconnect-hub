/**
 * Secure Storage Unit Tests
 * =========================
 * Tests the auth session flag, encrypted user storage, and cleanup functions.
 * Uses Vitest with jsdom environment to provide localStorage.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock import.meta.env before importing the module
vi.stubEnv('VITE_STORAGE_CIPHER_KEY', 'test-cipher-key-for-unit-tests-32ch');

// Dynamic import so the module reads the stubbed env var
const {
  markAuthenticated,
  isAuthenticated,
  clearAuth,
  setUser,
  getUser,
  clearUser,
  clearAllSensitive,
} = await import('../secure-storage');

describe('Auth Session Flag', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('markAuthenticated stores only a boolean flag, not a token', () => {
    markAuthenticated();
    // The stored value should be the string 'true', not a JWT or token
    const raw = localStorage.getItem('_mc_auth');
    expect(raw).toBe('true');
    // Verify no access_token key is set
    expect(localStorage.getItem('access_token')).toBeNull();
  });

  it('isAuthenticated returns true after markAuthenticated', () => {
    expect(isAuthenticated()).toBe(false);
    markAuthenticated();
    expect(isAuthenticated()).toBe(true);
  });

  it('isAuthenticated returns false when no flag is set', () => {
    expect(isAuthenticated()).toBe(false);
  });

  it('clearAuth removes the auth flag', () => {
    markAuthenticated();
    expect(isAuthenticated()).toBe(true);
    clearAuth();
    expect(isAuthenticated()).toBe(false);
    expect(localStorage.getItem('_mc_auth')).toBeNull();
  });

  it('clearAuth also removes legacy access_token key', () => {
    localStorage.setItem('access_token', 'some-legacy-token');
    clearAuth();
    expect(localStorage.getItem('access_token')).toBeNull();
  });
});

describe('Encrypted User Storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('setUser stores encrypted data (not plaintext JSON)', () => {
    const userData = { name: 'John', email: 'john@example.com', role: 'patient' };
    setUser(userData);
    const raw = localStorage.getItem('_mc_user');
    expect(raw).not.toBeNull();
    // The stored value should be encrypted (enc: or aes: prefix), not plain JSON
    expect(raw!.startsWith('enc:') || raw!.startsWith('aes:')).toBe(true);
  });

  it('getUser retrieves stored user data', () => {
    const userData = { name: 'Jane', email: 'jane@example.com', role: 'doctor' };
    setUser(userData);
    const result = getUser();
    expect(result).not.toBeNull();
    expect(result.name).toBe('Jane');
    expect(result.email).toBe('jane@example.com');
    expect(result.role).toBe('doctor');
  });

  it('getUser returns null when no user is stored', () => {
    const result = getUser();
    expect(result).toBeNull();
  });

  it('setUser(null) removes user data', () => {
    setUser({ name: 'Test' });
    expect(getUser()).not.toBeNull();
    setUser(null);
    expect(getUser()).toBeNull();
  });

  it('clearUser removes user data from all storage locations', () => {
    setUser({ name: 'Test' });
    // Also set legacy key
    localStorage.setItem('user', JSON.stringify({ name: 'Legacy' }));
    clearUser();
    expect(getUser()).toBeNull();
    expect(localStorage.getItem('_mc_user')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('getUser migrates legacy plaintext user data', () => {
    // Simulate legacy storage (plain JSON in old key)
    localStorage.setItem('user', JSON.stringify({ name: 'Legacy', role: 'patient' }));
    const result = getUser();
    expect(result).not.toBeNull();
    expect(result.name).toBe('Legacy');
    // After migration, legacy key should be removed
    expect(localStorage.getItem('user')).toBeNull();
    // And new key should be set
    expect(localStorage.getItem('_mc_user')).not.toBeNull();
  });
});

describe('clearAllSensitive', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('clears auth and user data', () => {
    markAuthenticated();
    setUser({ name: 'Test', role: 'patient' });
    localStorage.setItem('access_token', 'legacy-token');
    localStorage.setItem('user', JSON.stringify({ name: 'Old' }));

    clearAllSensitive();

    expect(isAuthenticated()).toBe(false);
    expect(getUser()).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('preserves gdpr_consent', () => {
    markAuthenticated();
    setUser({ name: 'Test' });
    localStorage.setItem('gdpr_consent', JSON.stringify({ essential: true, analytics: false }));

    clearAllSensitive();

    const consent = localStorage.getItem('gdpr_consent');
    expect(consent).not.toBeNull();
    expect(JSON.parse(consent!)).toEqual({ essential: true, analytics: false });
  });

  it('preserves userRegion', () => {
    markAuthenticated();
    setUser({ name: 'Test' });
    localStorage.setItem('userRegion', 'EU');

    clearAllSensitive();

    expect(localStorage.getItem('userRegion')).toBe('EU');
  });

  it('preserves both gdpr_consent and userRegion simultaneously', () => {
    markAuthenticated();
    setUser({ name: 'Test' });
    localStorage.setItem('gdpr_consent', '{"essential":true}');
    localStorage.setItem('userRegion', 'US');

    clearAllSensitive();

    expect(localStorage.getItem('gdpr_consent')).toBe('{"essential":true}');
    expect(localStorage.getItem('userRegion')).toBe('US');
    expect(isAuthenticated()).toBe(false);
    expect(getUser()).toBeNull();
  });
});
