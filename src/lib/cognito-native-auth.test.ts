import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ fetchAuthSession: vi.fn(), getCurrentUser: vi.fn() }));
vi.mock('aws-amplify/auth', () => auth);
const fetchMock = vi.fn();
const issuer = 'https://cognito-idp.test-region.amazonaws.com/test-pool';
const nativeSession = 'test-native-session-123456';
beforeEach(() => {
  vi.resetModules(); vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset();
  for (const region of ['US', 'EU']) {
    vi.stubEnv(`VITE_AWS_REGION_${region}`, region === 'EU' ? 'test-eu-region' : 'test-region');
    vi.stubEnv(`VITE_COGNITO_USER_POOL_ID_${region}`, 'test-pool');
    for (const role of ['PATIENT', 'DOCTOR', 'ADMIN']) vi.stubEnv(`VITE_COGNITO_CLIENT_${role}_${region}`, `test-client-${role}`);
  }
  vi.stubEnv('VITE_API_PRIMARY_TIMEOUT_MS', '5000');
  auth.fetchAuthSession.mockResolvedValue({ tokens: { idToken: { payload: { iss: issuer, aud: 'test-client-PATIENT', 'cognito:username': 'test-user' } } } });
  auth.getCurrentUser.mockResolvedValue({ username: 'test-user' });
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ ChallengeName: 'SOFTWARE_TOKEN_MFA', Session: nativeSession })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it('sends password only to the current configured issuer without credentials, redirect or token replacement', async () => {
  const storage = vi.spyOn(Storage.prototype, 'setItem');
  const { beginNativeMfa } = await import('./cognito-native-auth');
  expect(await beginNativeMfa('test-password', new AbortController().signal)).toBe(nativeSession);
  expect(fetchMock).toHaveBeenCalledOnce();
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe('https://cognito-idp.test-region.amazonaws.com');
  expect(options).toMatchObject({ method: 'POST', credentials: 'omit', redirect: 'error' });
  expect(options.headers['X-Amz-Target']).toBe('AWSCognitoIdentityProviderService.InitiateAuth');
  expect(JSON.parse(options.body)).toEqual({ AuthFlow: 'USER_PASSWORD_AUTH', ClientId: 'test-client-PATIENT', AuthParameters: { USERNAME: 'test-user', PASSWORD: 'test-password' } });
  expect(storage).not.toHaveBeenCalled();
});

it.each([
  { AuthenticationResult: { IdToken: 'test-token' } },
  { ChallengeName: 'SMS_MFA', Session: nativeSession },
  { ChallengeName: 'SOFTWARE_TOKEN_MFA', Session: 'short' },
  { ChallengeName: 'SOFTWARE_TOKEN_MFA', Session: 'x'.repeat(2049) },
  { ChallengeName: 'SOFTWARE_TOKEN_MFA', Session: nativeSession, AuthenticationResult: { IdToken: 'test-token' } },
])('refuses password-only, other-factor or malformed challenge %#', async value => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(value)));
  const { beginNativeMfa } = await import('./cognito-native-auth');
  await expect(beginNativeMfa('test-password', new AbortController().signal)).rejects.toThrow();
});

it.each([{ iss: 'https://attacker.example.invalid' }, { aud: 'test-unknown-client' }, { 'cognito:username': 'test-other' }])('refuses a mismatched configured identity before password leaves the app %#', async changes => {
  const original = (await auth.fetchAuthSession()).tokens.idToken.payload;
  auth.fetchAuthSession.mockResolvedValue({ tokens: { idToken: { payload: { ...original, ...changes } } } });
  const { beginNativeMfa } = await import('./cognito-native-auth');
  await expect(beginNativeMfa('test-password', new AbortController().signal)).rejects.toThrow();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('does not send a password after the dialog is cancelled during session loading', async () => {
  const signal = new AbortController(); let resolve!: (value: unknown) => void;
  auth.getCurrentUser.mockReturnValue(new Promise(value => { resolve = value; }));
  const { beginNativeMfa } = await import('./cognito-native-auth');
  const pending = beginNativeMfa('test-password', signal.signal); signal.abort(); resolve({ username: 'test-user' });
  await expect(pending).rejects.toThrow(); expect(fetchMock).not.toHaveBeenCalled();
});

it('recognizes only the explicit sensitive-operation MFA refusal', async () => {
  const { isMfaStepUpRequired } = await import('./cognito-native-auth');
  const { HttpResponseError } = await import('./api');
  expect(isMfaStepUpRequired(new HttpResponseError('refused', 403, 'MFA_STEP_UP_REQUIRED'))).toBe(true);
  for (const value of [new Error('MFA_STEP_UP_REQUIRED'), new HttpResponseError('refused', 403, 'ACCESS_DENIED'), new HttpResponseError('failure', 503, 'MFA_STEP_UP_REQUIRED')]) expect(isMfaStepUpRequired(value)).toBe(false);
});
