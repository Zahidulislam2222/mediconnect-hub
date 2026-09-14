import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type * as RouterModule from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Auth from '@/pages/Auth';
import { recordTermsAcceptance } from '@/lib/consent';

const mocks = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), currentUser: vi.fn(), signIn: vi.fn(), fetchSession: vi.fn(),
  setUser: vi.fn(), navigate: vi.fn(), toast: vi.fn(),
  HttpResponseError: class extends Error {
    constructor(message: string, readonly status: number) { super(message); }
  },
}));
vi.mock('react-router-dom', async importOriginal => ({
  ...await importOriginal<typeof RouterModule>(), useNavigate: () => mocks.navigate,
}));
vi.mock('aws-amplify', () => ({ Amplify: { configure: vi.fn() } }));
vi.mock('aws-amplify/auth', () => ({
  signIn: mocks.signIn, getCurrentUser: mocks.currentUser, fetchAuthSession: mocks.fetchSession,
  signOut: vi.fn(), signUp: vi.fn(), confirmSignUp: vi.fn(), confirmSignIn: vi.fn(),
  resetPassword: vi.fn(), confirmResetPassword: vi.fn(),
}));
vi.mock('@/lib/api', () => ({ api: { get: mocks.get, post: mocks.post }, HttpResponseError: mocks.HttpResponseError }));
vi.mock('@/lib/secure-storage', () => ({
  setUser: mocks.setUser, getUser: () => null, markAuthenticated: vi.fn(), clearAllSensitive: vi.fn(),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/config/env', () => ({ publicEnv: () => '' }));
vi.mock('@/aws-config', () => ({ getRegionalResources: () => ({}) }));
vi.mock('@/components/PublicHeader', () => ({ PublicHeader: () => null }));
vi.mock('@/components/auth/LoginCard', () => ({
  LoginCard: ({ handleLogin }: { handleLogin: React.FormEventHandler }) =>
    <form aria-label="Test sign-in" onSubmit={handleLogin}><button type="submit">Submit test sign-in</button></form>,
}));
vi.mock('@/components/auth/SignupCard', () => ({ SignupCard: () => null }));
vi.mock('@/components/auth/ConfirmSignup', () => ({ ConfirmSignup: () => null }));
vi.mock('@/components/auth/MfaManager', () => ({ MfaManager: () => null }));
vi.mock('@/components/auth/PasswordReset', () => ({ PasswordReset: () => null }));
vi.mock('@/components/auth/IdentityVerification', () => ({ IdentityVerification: () => null }));
vi.mock('@/components/auth/CredentialUpload', () => ({ CredentialUpload: () => null }));

async function login(role: 'patient' | 'doctor') {
  mocks.currentUser.mockRejectedValueOnce(new Error('TEST_NO_INITIAL_SESSION'))
    .mockResolvedValue({ userId: 'test-user' });
  mocks.fetchSession.mockResolvedValue({ tokens: { idToken: {
    payload: { sub: 'test-user', email: 'test-user@example.test', name: 'Test person', 'cognito:groups': [role] },
    toString: () => 'test-token',
  } } });
  render(<MemoryRouter><Auth /></MemoryRouter>);
  fireEvent.submit(await screen.findByRole('form', { name: 'Test sign-in' }));
  await waitFor(() => expect(mocks.get).toHaveBeenCalled());
  await waitFor(() => expect(mocks.toast.mock.calls.length + mocks.navigate.mock.calls.length).toBeGreaterThan(0));
}

describe.each(['patient', 'doctor'] as const)('Profile bootstrap for %s', role => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.get.mockReset(); mocks.post.mockReset(); mocks.currentUser.mockReset();
    localStorage.clear(); recordTermsAcceptance();
    mocks.signIn.mockResolvedValue({ isSignedIn: true, nextStep: { signInStep: 'DONE' } });
    mocks.post.mockResolvedValue({ profile: { patientId: 'test-user', doctorId: 'test-user',
      name: 'Test person', email: 'test-user@example.test', isIdentityVerified: true, verificationStatus: 'APPROVED' } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it.each([401, 403, 410, 429, 503])('does not register after HTTP %s', async status => {
    mocks.get.mockRejectedValue(new mocks.HttpResponseError('TEST_PROFILE_READ_FAILED', status));
    await login(role);
    expect(mocks.post).not.toHaveBeenCalled(); expect(mocks.setUser).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it('does not register after a transport failure', async () => {
    mocks.get.mockRejectedValue(new TypeError('TEST_NETWORK_FAILURE'));
    await login(role); expect(mocks.post).not.toHaveBeenCalled(); expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it.each([{}, { error: 'TEST_INVALID_BODY' }, { patientId: 'other-user', doctorId: 'other-user' }])(
    'rejects malformed or foreign profiles without registration', async profile => {
      mocks.get.mockResolvedValue(profile);
      await login(role); expect(mocks.post).not.toHaveBeenCalled(); expect(mocks.setUser).not.toHaveBeenCalled();
      expect(mocks.navigate).not.toHaveBeenCalled();
    });
  it('registers after explicit404 with fresh login and recorded consent', async () => {
    mocks.get.mockRejectedValue(new mocks.HttpResponseError('TEST_NOT_FOUND', 404));
    await login(role);
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.post.mock.calls[0][0]).toBe(role === 'patient' ? '/register-patient' : '/register-doctor');
    expect(mocks.navigate).toHaveBeenCalledWith(role === 'patient' ? '/patient-dashboard' : '/doctor-dashboard');
  });
  it('reads the existing own profile without registering', async () => {
    mocks.get.mockResolvedValue({ patientId: 'test-user', doctorId: 'test-user',
      name: 'Test person', email: 'test-user@example.test', isIdentityVerified: true, verificationStatus: 'APPROVED' });
    await login(role); expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith(role === 'patient' ? '/patient-dashboard' : '/doctor-dashboard');
  });
  it('does not register a missing profile without current consent', async () => {
    localStorage.removeItem('pending_consent');
    mocks.get.mockRejectedValue(new mocks.HttpResponseError('TEST_NOT_FOUND', 404));
    await login(role);
    expect(mocks.post).not.toHaveBeenCalled(); expect(mocks.setUser).not.toHaveBeenCalled();
  });
  it('re-reads the own profile after a registration conflict', async () => {
    mocks.get.mockRejectedValueOnce(new mocks.HttpResponseError('TEST_NOT_FOUND', 404))
      .mockResolvedValue({ patientId: 'test-user', doctorId: 'test-user', isIdentityVerified: true, verificationStatus: 'APPROVED' });
    mocks.post.mockRejectedValue(new mocks.HttpResponseError('TEST_CONFLICT', 409));
    await login(role);
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(mocks.navigate).toHaveBeenCalledWith(role === 'patient' ? '/patient-dashboard' : '/doctor-dashboard');
  });
  it('rejects a foreign profile after a registration conflict', async () => {
    mocks.get.mockRejectedValueOnce(new mocks.HttpResponseError('TEST_NOT_FOUND', 404))
      .mockResolvedValue({ patientId: 'other-user', doctorId: 'other-user' });
    mocks.post.mockRejectedValue(new mocks.HttpResponseError('TEST_CONFLICT', 409));
    await login(role);
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(mocks.setUser).not.toHaveBeenCalled(); expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it('rejects an invalid registration response and preserves pending consent', async () => {
    mocks.get.mockRejectedValue(new mocks.HttpResponseError('TEST_NOT_FOUND', 404));
    mocks.post.mockResolvedValue({ profile: { patientId: 'other-user', doctorId: 'other-user' } });
    await login(role);
    expect(mocks.setUser).not.toHaveBeenCalled(); expect(mocks.navigate).not.toHaveBeenCalled();
    expect(localStorage.getItem('pending_consent')).not.toBeNull();
  });
});
