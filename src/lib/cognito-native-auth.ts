import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';
import { configuredNativeMfaProvider, requestTimeout } from '@/config/env';
import rawContent from '@/content/native-mfa.json';
import { z } from 'zod';
import { HttpResponseError } from './api';

const text = z.string().min(1);
export const nativeMfaContent = z.object({ completeEndpoint: z.string().regex(/^\/[A-Za-z0-9/_-]+$/),
  title: text, description: text, passwordLabel: text, codeLabel: text, continueLabel: text,
  verifyLabel: text, cancelLabel: text, error: text, verifiedTitle: text, verifiedDescription: text, stepUpCode: text,
}).strict().parse(rawContent);
// Fixed Cognito JSON protocol, not deployment configuration.
const COGNITO_INITIATE_AUTH = 'AWSCognitoIdentityProviderService.InitiateAuth';
const COGNITO_PASSWORD_FLOW = 'USER_PASSWORD_AUTH';
const COGNITO_TOTP_CHALLENGE = 'SOFTWARE_TOKEN_MFA';
const challenge = z.object({ ChallengeName: z.literal(COGNITO_TOTP_CHALLENGE), Session: z.string().min(20).max(2048),
  AuthenticationResult: z.undefined(),
});
export function isMfaStepUpRequired(error: unknown): boolean {
  return error instanceof HttpResponseError && error.status === 403 &&
    (error.code === nativeMfaContent.stepUpCode || error.serverReason === nativeMfaContent.stepUpCode);
}

/** Password is sent only to the configured native provider; login/token state stays unchanged. */
export async function beginNativeMfa(password: string, signal: AbortSignal): Promise<string> {
  if (!password || signal.aborted) throw new Error('NATIVE_MFA_NOT_STARTED');
  const [session, user] = await Promise.all([fetchAuthSession(), getCurrentUser()]);
  signal.throwIfAborted();
  const claims = session.tokens?.idToken?.payload;
  const provider = configuredNativeMfaProvider(claims?.iss, claims?.aud);
  if (!user.username || claims?.['cognito:username'] !== user.username) throw new Error('NATIVE_MFA_NOT_STARTED');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, requestTimeout('VITE_API_PRIMARY_TIMEOUT_MS'));
  try {
    const response = await fetch(provider.origin, { method: 'POST', credentials: 'omit', redirect: 'error',
      headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': COGNITO_INITIATE_AUTH },
      body: JSON.stringify({ AuthFlow: COGNITO_PASSWORD_FLOW, ClientId: provider.clientId,
        AuthParameters: { USERNAME: user.username, PASSWORD: password } }), signal: controller.signal,
    });
    if (!response.ok) throw new Error('NATIVE_MFA_CHALLENGE_UNAVAILABLE');
    const result = challenge.parse(await response.json());
    signal.throwIfAborted();
    return result.Session;
  } finally {
    clearTimeout(timer); signal.removeEventListener('abort', abort);
  }
}
