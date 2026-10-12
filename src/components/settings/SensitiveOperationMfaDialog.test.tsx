import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const native = vi.hoisted(() => ({ begin: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: { post: native.post } }));
vi.mock('@/lib/cognito-native-auth', async () => ({ beginNativeMfa: native.begin, nativeMfaContent: (await import('@/content/native-mfa.json')).default }));
import { SensitiveOperationMfaDialog } from './SensitiveOperationMfaDialog';
const callbacks = { onOpenChange: vi.fn(), onVerified: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); native.begin.mockResolvedValue('test-native-session-123456'); native.post.mockResolvedValue({ verified: true }); });
afterEach(cleanup);
async function password() {
  fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'test-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByLabelText('Authenticator code');
}
it('uses two distinct steps, submits only code/session to backend and never retries the sensitive action', async () => {
  render(<SensitiveOperationMfaDialog open {...callbacks} />); await password();
  expect(native.begin).toHaveBeenCalledWith('test-password', expect.any(AbortSignal));
  expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Authenticator code'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify session' }));
  await waitFor(() => expect(callbacks.onVerified).toHaveBeenCalledOnce());
  expect(native.post.mock.calls).toEqual([['/me/mfa/complete', { session: 'test-native-session-123456', code: '123456' }, { signal: expect.any(AbortSignal) }]]);
  expect(callbacks.onOpenChange).toHaveBeenCalledWith(false);
});
it('ignores a challenge that resolves after closing and clears secrets on reopening', async () => {
  let resolve!: (value: string) => void; native.begin.mockReturnValue(new Promise(value => { resolve = value; }));
  const view = render(<SensitiveOperationMfaDialog open {...callbacks} />);
  fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'test-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(native.begin.mock.calls[0][1].aborted).toBe(true);
  view.rerender(<SensitiveOperationMfaDialog open={false} {...callbacks} />); resolve('test-native-session-123456');
  view.rerender(<SensitiveOperationMfaDialog open {...callbacks} />);
  expect(screen.getByLabelText('Current password')).toHaveValue('');
  expect(native.post).not.toHaveBeenCalled(); expect(callbacks.onVerified).not.toHaveBeenCalled();
});
it('refuses malformed codes and duplicate submit while proof completion is pending', async () => {
  let resolve!: (value: unknown) => void; native.post.mockReturnValue(new Promise(value => { resolve = value; }));
  render(<SensitiveOperationMfaDialog open {...callbacks} />); await password();
  const input = screen.getByLabelText('Authenticator code');
  fireEvent.change(input, { target: { value: '12ab56' } }); expect(screen.getByRole('button', { name: 'Verify session' })).toBeDisabled();
  fireEvent.change(input, { target: { value: '123456' } });
  const button = screen.getByRole('button', { name: 'Verify session' });
  fireEvent.click(button); fireEvent.submit(button.closest('form')!); expect(native.post).toHaveBeenCalledOnce();
  resolve({ verified: true }); await waitFor(() => expect(callbacks.onVerified).toHaveBeenCalledOnce());
});
it('failed completion clears challenge and code, requiring a fresh password step', async () => {
  native.post.mockRejectedValue(new Error('test challenge denied'));
  render(<SensitiveOperationMfaDialog open {...callbacks} />); await password();
  fireEvent.change(screen.getByLabelText('Authenticator code'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify session' }));
  await screen.findByRole('alert'); expect(screen.getByLabelText('Current password')).toHaveValue('');
  expect(screen.queryByLabelText('Authenticator code')).not.toBeInTheDocument(); expect(callbacks.onVerified).not.toHaveBeenCalled();
});

for (const exit of ['close', 'unmount'] as const) it(`aborts pending completion on ${exit} and ignores stale acknowledgement`, async () => {
  let resolve!: (value: unknown) => void;
  native.post.mockReturnValue(new Promise(value => { resolve = value; }));
  const view = render(<SensitiveOperationMfaDialog open {...callbacks} />); await password();
  fireEvent.change(screen.getByLabelText('Authenticator code'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify session' }));
  const signal = native.post.mock.calls[0][2].signal as AbortSignal;
  expect(signal.aborted).toBe(false);
  if (exit === 'close') fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); else view.unmount();
  expect(signal.aborted).toBe(true);
  resolve({ verified: true }); await Promise.resolve();
  expect(callbacks.onVerified).not.toHaveBeenCalled();
});
