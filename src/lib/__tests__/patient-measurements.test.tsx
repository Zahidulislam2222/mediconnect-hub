import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import PatientRecords from '@/pages/PatientRecords';
import { VitalCard } from '@/components/dashboard/VitalCard';
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mocks }));
vi.mock('aws-amplify/auth', () => ({ getCurrentUser: async () => ({ userId: 'test-doctor' }), fetchAuthSession: async () => ({}), signOut: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: ReactNode }) => <>{children}</> }));
// Keep all panel contents mounted to inspect clinical state independently of tab animations.
vi.mock('@/components/ui/tabs', () => {
  const Panel = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { Tabs: Panel, TabsContent: Panel, TabsList: Panel, TabsTrigger: Panel };
});

describe('patient measurement presentation and switching', () => {
  beforeEach(() => { cleanup(); vi.clearAllMocks(); });
  it('shows unknown without a fabricated trend or normal badge', () => {
    render(<VitalCard title="Blood pressure" value="--" unit="mmHg" status="unassessed" change="" trend={[]} color="blue" icon={null} />);
    expect(screen.getByText('Not assessed')).toBeInTheDocument();
    expect(screen.queryByText('Normal')).not.toBeInTheDocument();
    expect(screen.queryByText(/last week/)).not.toBeInTheDocument();
    expect(document.querySelector('svg')).toBeNull();
  });
  it('discards delayed measurements from the previously selected patient', async () => {
    let resolveA!: (value: unknown) => void;
    mocks.get.mockImplementation(async (path: string) => {
      if (path.startsWith('/appointments')) return ['a', 'b'].map(id => ({ patientId: id, patientName: `Patient ${id}`, timeSlot: '2026-09-09' }));
      if (path === '/vitals?patientId=a') return new Promise(resolve => { resolveA = resolve; });
      if (path === '/vitals?patientId=b') return { vitals: {} };
      return { name: 'Synthetic person', dob: '2000-01-01' };
    });
    mocks.post.mockResolvedValue([]);
    render(<MemoryRouter><PatientRecords /></MemoryRouter>);
    fireEvent.click(await screen.findByText('Patient a'));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/vitals?patientId=a'));
    fireEvent.click(screen.getByText('Patient b'));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/vitals?patientId=b'));
    await act(async () => resolveA({ vitals: { temperature: 98.6, heartRate: 72, bloodPressureSys: 120 } }));
    const fields = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    expect(fields.slice(0, 3).map(field => field.value)).toEqual(['', '', '']);
    expect(screen.getByText('Measurements incomplete')).toBeInTheDocument();
  });
});
