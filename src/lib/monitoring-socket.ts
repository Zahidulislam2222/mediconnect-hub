import { fetchAuthSession } from 'aws-amplify/auth';
import { configuredCognitoIssuer, publicEnv } from '@/config/env';

export async function monitoringConnection() {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken;
  if (!idToken) throw new Error('Monitoring authentication unavailable');
  const region = (['US', 'EU'] as const).find(value => idToken.payload.iss === configuredCognitoIssuer(value));
  if (!region) throw new Error('Unknown monitoring jurisdiction');
  const url = new URL(publicEnv(region === 'EU' ? 'VITE_MONITORING_SOCKET_URL_EU' : 'VITE_MONITORING_SOCKET_URL_US'));
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Invalid monitoring endpoint');
  }
  return { url: url.origin, auth: { token: idToken.toString(), region } };
}
