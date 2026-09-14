import { api } from '@/lib/api';
import { publicEnv } from '@/config/env';

export async function authorizedSocketUrl(): Promise<string> {
  const result = await api.post('/chat/socket-ticket', {});
  if (!result || !['US', 'EU'].includes(result.region) || typeof result.ticket !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(result.ticket)) {
    throw new Error('Connection authorization unavailable');
  }
  const base = publicEnv(result.region === 'EU' ? 'VITE_COMMUNICATION_WS_URL_EU' : 'VITE_COMMUNICATION_WS_URL_US');
  const url = new URL(base);
  if (url.protocol !== 'wss:' || url.username || url.password || url.search || url.hash) throw new Error('Invalid secure connection endpoint');
  url.searchParams.set('ticket', result.ticket);
  return url.toString();
}
