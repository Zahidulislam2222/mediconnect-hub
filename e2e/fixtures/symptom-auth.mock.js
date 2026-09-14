export async function getCurrentUser() { return { userId: 'test-patient' }; }
export async function signOut() {
  if (window.__failSymptomLogout) throw new Error('Synthetic sign-out failure');
}
export async function fetchAuthSession() {
  const session = { tokens: { idToken: { toString: () => 'test-key' } } };
  if (window.__holdSymptomAuth) {
    return new Promise(resolve => { window.__releaseSymptomAuth = () => resolve(session); });
  }
  return session;
}
