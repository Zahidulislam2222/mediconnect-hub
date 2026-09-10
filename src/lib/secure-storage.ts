/**
 * Presentation-state boundary. Profiles stay in memory and are rehydrated only
 * from the current identity-provider session. This is not an authorization API.
 * Legacy public-key/XOR storage has been retired; no token is read or written here.
 */
export const SESSION_CLEARED_EVENT = 'mediconnect:session-cleared';
const LEGACY_KEYS = ['_mc_user', '_mc_auth', 'user', 'access_token'] as const;
let authenticatedHint = false;
let userJson: string | null = null;

function discardLegacyPersistence(): void {
  for (const key of LEGACY_KEYS) {
    try { localStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
    try { sessionStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
  }
}

discardLegacyPersistence();

/** Compatibility hint for rendering only; routes verify an Amplify session. */
export function markAuthenticated(): void {
  discardLegacyPersistence();
  authenticatedHint = true;
}
export function isAuthenticated(): boolean { return authenticatedHint; }
export function clearAuth(): void {
  authenticatedHint = false;
  discardLegacyPersistence();
}
export function setUser(data: unknown): void {
  discardLegacyPersistence();
  userJson = data == null ? null : JSON.stringify(data);
}
export function getUser<T = any>(): T | null {
  discardLegacyPersistence();
  return userJson === null ? null : JSON.parse(userJson) as T;
}
export function clearUser(): void {
  userJson = null;
  discardLegacyPersistence();
}
export function clearAllSensitive(): void {
  clearAuth();
  clearUser();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_CLEARED_EVENT));
}
