import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VerifiedSession, VerifiedRole } from '@/context/VerifiedSession';
import { clearAllSensitive, getUser, setUser } from '@/lib/secure-storage';

const mocks = vi.hoisted(() => ({ session: vi.fn(), auth: null as null | ((event: { payload: { event: string } }) => void) }));
vi.mock('aws-amplify/auth', () => ({ fetchAuthSession: mocks.session }));
vi.mock('aws-amplify/utils', () => ({ Hub: { listen: (_channel: string, callback: typeof mocks.auth) => { mocks.auth = callback; return () => {}; } } }));
function view() {
  return render(<MemoryRouter initialEntries={['/private']}><Routes>
    <Route path="/auth" element={<p>Authentication required</p>} />
    <Route path="/patient-dashboard" element={<p>Patient route</p>} />
    <Route path="/private" element={<VerifiedSession><VerifiedRole allowedRoles={['admin']}><p>Private administration</p></VerifiedRole></VerifiedSession>} />
  </Routes></MemoryRouter>);
}
function session(groups: string[], expires = Math.floor(Date.now() / 1000) + 60) {
  return { tokens: { idToken: { payload: { sub: 'test-user', exp: expires, 'cognito:groups': groups } } } };
}
describe('Identity-provider session boundary', () => {
  beforeEach(() => { cleanup(); clearAllSensitive(); localStorage.clear(); vi.clearAllMocks(); });
  it.each(['toString', 'constructor', '__proto__'])('rejects unconfigured inherited group %s', async group => {
    mocks.session.mockResolvedValue(session([group]));
    view();
    await screen.findByText('Authentication required');
    expect(getUser()).toBeNull();
    expect(screen.queryByText('Private administration')).not.toBeInTheDocument();
  });
  it('rejects forged persistent auth and admin role data without a provider session', async () => {
    localStorage.setItem('_mc_auth', 'true');
    localStorage.setItem('user', JSON.stringify({ role: 'admin' }));
    mocks.session.mockResolvedValue({});
    view();
    await screen.findByText('Authentication required');
    expect(screen.queryByText('Private administration')).not.toBeInTheDocument();
  });
  it('does not trust the cached role over a current patient identity', async () => {
    setUser({ id: 'test-user', role: 'admin' });
    mocks.session.mockResolvedValue(session(['patient']));
    view();
    await screen.findByText('Patient route');
    expect(getUser().role).toBe('patient');
  });
  it('admits the expected provider role and removes private content on local logout', async () => {
    mocks.session.mockResolvedValue(session(['admin']));
    view();
    await screen.findByText('Private administration');
    act(() => clearAllSensitive());
    await screen.findByText('Authentication required');
  });
  it('rejects an expired identity', async () => {
    mocks.session.mockResolvedValue(session(['admin'], 1));
    view();
    await screen.findByText('Authentication required');
  });
  it('discards a deferred session result after sign-out', async () => {
    let complete!: (result: unknown) => void;
    mocks.session.mockReturnValue(new Promise(resolve => { complete = resolve; }));
    view();
    act(() => { mocks.auth?.({ payload: { event: 'signedOut' } }); });
    await act(async () => complete(session(['admin'])));
    await screen.findByText('Authentication required');
    expect(getUser()).toBeNull();
  });
});
