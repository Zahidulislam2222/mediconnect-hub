import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import SymptomChecker from '../../pages/SymptomChecker';
import safety from '../../content/symptom-safety.json';

const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn(), currentUser: vi.fn(), store: vi.fn(), signOut: vi.fn(), clear: vi.fn(), navigate: vi.fn(), toast: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('aws-amplify/auth', () => ({ getCurrentUser: mocks.currentUser, signOut: mocks.signOut }));
vi.mock('../api', () => ({ api: { post: mocks.post, get: mocks.get } }));
vi.mock('../secure-storage', () => ({ getUser: () => ({ name: 'Synthetic Patient', role: 'patient' }), setUser: mocks.store, clearAllSensitive: mocks.clear }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children, onLogout }: { children: ReactNode; onLogout: () => void }) => <main><button onClick={onLogout}>Test sign out</button>{children}</main> }));

describe('Real symptom-checker component with isolated test dependencies', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.currentUser.mockRejectedValue(new Error('test no session'));
    Element.prototype.scrollIntoView = vi.fn();
  });

  it.each(['timeout', '401', '429', '500', 'malformed'])('shows no fabricated risk after %s', async (failure) => {
    if (failure === 'malformed') mocks.post.mockResolvedValue({ success: true, status: 'available', analysis: { risk: 'Low' } });
    else mocks.post.mockRejectedValue(new Error(`test ${failure}`));
    render(<SymptomChecker />);
    fireEvent.change(screen.getByRole('textbox', { name: safety.inputLabel }), { target: { value: 'Synthetic test: severe chest pain and difficulty breathing' } });
    fireEvent.click(screen.getByRole('button', { name: safety.sendLabel }));
    await screen.findByText(safety.unavailable);
    expect(screen.queryByText(/Risk Assessment: Low|Risk: Low|rest and hydration|AWS Daily Limit/)).not.toBeInTheDocument();
    expect(mocks.post).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole('textbox')).not.toBeDisabled());
  });

  it('clears the local session and confirms provider sign-out before navigating', async () => {
    mocks.signOut.mockResolvedValue(undefined);
    render(<SymptomChecker />);
    fireEvent.click(screen.getByRole('button', { name: 'Test sign out' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/auth', { replace: true }));
    expect(mocks.clear).toHaveBeenCalledTimes(1);
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it('does not claim sign-out succeeded when provider sign-out fails', async () => {
    mocks.signOut.mockRejectedValue(new Error('test logout failure'));
    render(<SymptomChecker />);
    fireEvent.click(screen.getByRole('button', { name: 'Test sign out' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ title: safety.logoutFailed, variant: 'destructive' }));
    expect(mocks.clear).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(screen.queryByText(safety.loadingLabel)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it('ignores late profile and assessment results once logout starts', async () => {
    let finishProfile!: (value: unknown) => void;
    let finishAssessment!: (value: unknown) => void;
    mocks.currentUser.mockResolvedValue({ userId: 'test-patient' });
    mocks.get.mockReturnValue(new Promise(resolve => { finishProfile = resolve; }));
    mocks.post.mockReturnValue(new Promise(resolve => { finishAssessment = resolve; }));
    mocks.signOut.mockRejectedValue(new Error('test sign-out failure'));
    render(<SymptomChecker />);
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByRole('textbox', { name: safety.inputLabel }), { target: { value: 'Synthetic question' } });
    fireEvent.click(screen.getByRole('button', { name: safety.sendLabel }));
    fireEvent.click(screen.getByRole('button', { name: 'Test sign out' }));
    finishProfile({ name: 'Previous account profile' });
    finishAssessment({ success: true, status: 'available', analysis: { risk: 'Low', reason: 'Late response must not appear' } });
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ title: safety.logoutFailed, variant: 'destructive' }));
    expect(mocks.store).not.toHaveBeenCalled();
    expect(screen.queryByText(/Late response must not appear/)).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
