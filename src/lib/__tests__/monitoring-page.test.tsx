import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import LiveMonitoring from '@/pages/LiveMonitoring';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mocks }));
vi.mock('aws-amplify/auth', () => ({ getCurrentUser: async () => ({ userId: 'test-doctor' }), fetchAuthSession: async () => ({}), signOut: vi.fn() }));
vi.mock('@/lib/monitoring-socket', () => ({ monitoringConnection: async () => { throw new Error('test offline'); } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('recharts', () => {
  const Panel = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { ResponsiveContainer: Panel, AreaChart: Panel, Area: () => null, XAxis: () => null,
    YAxis: () => null, CartesianGrid: () => null, Tooltip: () => null };
});
afterEach(cleanup);

it('shows actual zero measurements and labels recent data without claiming a live socket', async () => {
  mocks.get.mockImplementation(async (path: string) => path.startsWith('/vitals')
    ? { history: [{ timestamp: new Date().toISOString(), heartRate: 0, temperature: 0 }] }
    : { name: 'Synthetic patient', patientId: 'test-b' });
  render(<MemoryRouter initialEntries={['/monitoring?patientId=test-b']}><LiveMonitoring /></MemoryRouter>);
  await screen.findByText('Recent data');
  expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2);
  expect(screen.getByText('No device assessment')).toBeInTheDocument();
  expect(screen.queryByText('LIVE SIGNAL')).not.toBeInTheDocument();
});

it('a delayed previous patient response cannot replace the selected monitoring patient or invent a normal assessment', async () => {
  const delayed: Array<(value: unknown) => void> = [];
  mocks.get.mockImplementation(async (path: string) => {
    if (path.includes('test-a')) return new Promise(resolve => { delayed.push(resolve); });
    if (path.startsWith('/register-patient')) return { name: 'Patient B', patientId: 'test-b' };
    if (path.startsWith('/vitals')) return { history: [{ timestamp: new Date().toISOString(), heartRate: 72 }] };
    return { existingBookings: [] };
  });
  function Screen() {
    const navigate = useNavigate();
    return <><button onClick={() => navigate('/monitoring?patientId=test-b')}>Switch test patient</button><LiveMonitoring /></>;
  }
  render(<MemoryRouter initialEntries={['/monitoring?patientId=test-a']}><Screen /></MemoryRouter>);
  await waitFor(() => expect(delayed).toHaveLength(2));
  fireEvent.click(screen.getByText('Switch test patient'));
  await waitFor(() => expect(screen.getAllByText('Patient B').length).toBeGreaterThan(0));
  expect(screen.getByText('No device assessment')).toBeInTheDocument();
  await act(async () => { for (const resolve of delayed) resolve({ name: 'Patient A', history: [{ timestamp: new Date().toISOString(), heartRate: 199 }] }); });
  expect(screen.queryByText('Patient A')).not.toBeInTheDocument();
  expect(screen.queryByText('199')).not.toBeInTheDocument();
  expect(screen.getAllByText('72').length).toBeGreaterThan(0);
  expect(screen.queryByText('✅ Normal Range')).not.toBeInTheDocument();
});
