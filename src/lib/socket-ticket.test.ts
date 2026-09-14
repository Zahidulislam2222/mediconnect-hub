import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authorizedSocketUrl } from './socket-ticket';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({ api: { post: vi.fn() } }));
vi.mock('@/config/env', () => ({ publicEnv: (key: string) => key.endsWith('_EU') ? 'wss://eu.example.invalid/chat' : 'wss://us.example.invalid/chat' }));

describe('WebSocket connection tickets', () => {
  beforeEach(() => vi.clearAllMocks());
  it('uses the server-authenticated region and sends only the single-use ticket in the URL', async () => {
    const ticket = 'a'.repeat(43);
    vi.mocked(api.post).mockResolvedValue({ ticket, region: 'EU' });
    const url = new URL(await authorizedSocketUrl());
    expect(api.post).toHaveBeenCalledWith('/chat/socket-ticket', {});
    expect(url.host).toBe('eu.example.invalid');
    expect([...url.searchParams.keys()]).toEqual(['ticket']);
    expect(url.searchParams.get('ticket')).toBe(ticket);
    expect(url.searchParams.has('token')).toBe(false);
  });
  it.each([{ ticket: 'test.header.signature', region: 'EU' }, { ticket: 'a'.repeat(43), region: 'unknown' }])('rejects invalid server data', async response => {
    vi.mocked(api.post).mockResolvedValue(response);
    await expect(authorizedSocketUrl()).rejects.toThrow('authorization unavailable');
  });
});
