export async function fetchUserAttributes() { return { sub: 'test-patient', name: 'Test Patient Name' }; }
export async function fetchAuthSession() {
  const session = { tokens: { idToken: { toString: () => 'test-key' } } };
  if (window.__holdAppointmentAuth) {
    return new Promise(resolve => { window.__releaseAppointmentAuth = () => resolve(session); });
  }
  return session;
}
