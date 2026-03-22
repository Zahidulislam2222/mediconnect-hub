/**
 * API Layer Unit Tests
 * ====================
 * Tests the service URL routing logic that directs requests to the correct
 * backend microservice based on URL prefix. Also verifies region header inclusion.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mock AWS Amplify ───────────────────────────────────────────────────
vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({
    tokens: {
      idToken: { toString: () => 'mock-cognito-id-token' },
    },
  }),
}));

// ─── Mock secure-storage ────────────────────────────────────────────────
vi.mock('../secure-storage', () => ({
  getUser: vi.fn().mockReturnValue({ role: 'patient' }),
}));

// ─── Stub VITE env vars for service URLs ────────────────────────────────
const SERVICE_URLS = {
  VITE_PATIENT_SERVICE_URL_US: 'https://patient.us.example.com',
  VITE_PATIENT_SERVICE_URL_EU: 'https://patient.eu.example.com',
  VITE_PATIENT_SERVICE_URL_US_BACKUP: 'https://patient.us.backup.example.com',
  VITE_PATIENT_SERVICE_URL_EU_BACKUP: 'https://patient.eu.backup.example.com',
  VITE_DOCTOR_SERVICE_URL_US: 'https://doctor.us.example.com',
  VITE_DOCTOR_SERVICE_URL_EU: 'https://doctor.eu.example.com',
  VITE_DOCTOR_SERVICE_URL_US_BACKUP: 'https://doctor.us.backup.example.com',
  VITE_DOCTOR_SERVICE_URL_EU_BACKUP: 'https://doctor.eu.backup.example.com',
  VITE_BOOKING_SERVICE_URL_US: 'https://booking.us.example.com',
  VITE_BOOKING_SERVICE_URL_EU: 'https://booking.eu.example.com',
  VITE_BOOKING_SERVICE_URL_US_BACKUP: 'https://booking.us.backup.example.com',
  VITE_BOOKING_SERVICE_URL_EU_BACKUP: 'https://booking.eu.backup.example.com',
  VITE_COMMUNICATION_SERVICE_URL_US: 'https://comm.us.example.com',
  VITE_COMMUNICATION_SERVICE_URL_EU: 'https://comm.eu.example.com',
  VITE_COMMUNICATION_SERVICE_URL_US_BACKUP: 'https://comm.us.backup.example.com',
  VITE_COMMUNICATION_SERVICE_URL_EU_BACKUP: 'https://comm.eu.backup.example.com',
  VITE_ADMIN_SERVICE_URL_US: 'https://admin.us.example.com',
  VITE_ADMIN_SERVICE_URL_EU: 'https://admin.eu.example.com',
  VITE_ADMIN_SERVICE_URL_US_BACKUP: 'https://admin.us.backup.example.com',
  VITE_ADMIN_SERVICE_URL_EU_BACKUP: 'https://admin.eu.backup.example.com',
  VITE_STAFF_SERVICE_URL_US: 'https://staff.us.example.com',
  VITE_STAFF_SERVICE_URL_EU: 'https://staff.eu.example.com',
  VITE_STAFF_SERVICE_URL_US_BACKUP: 'https://staff.us.backup.example.com',
  VITE_STAFF_SERVICE_URL_EU_BACKUP: 'https://staff.eu.backup.example.com',
  VITE_STORAGE_CIPHER_KEY: 'test-cipher-key-for-api-tests-32char',
};

for (const [key, value] of Object.entries(SERVICE_URLS)) {
  vi.stubEnv(key, value);
}

// ─── Mock global fetch ──────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import AFTER mocking
const { api } = await import('../api');

describe('API Service URL Routing', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });
    localStorage.setItem('userRegion', 'US');
  });

  // ─── Patient Service Routes ─────────────────────────────────────────
  it('routes /patients to patient-service', async () => {
    await api.get('/patients/123');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://patient.us.example.com/patients/123',
      expect.any(Object)
    );
  });

  it('routes /register-patient to patient-service', async () => {
    await api.post('/register-patient', { email: 'test@test.com' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://patient.us.example.com/register-patient',
      expect.any(Object)
    );
  });

  it('routes /allergies to patient-service', async () => {
    await api.get('/allergies');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://patient.us.example.com/allergies',
      expect.any(Object)
    );
  });

  it('routes /fhir to patient-service', async () => {
    await api.get('/fhir/metadata');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://patient.us.example.com/fhir/metadata',
      expect.any(Object)
    );
  });

  it('routes /care-plans to patient-service', async () => {
    await api.get('/care-plans');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://patient.us.example.com/care-plans',
      expect.any(Object)
    );
  });

  // ─── Doctor Service Routes ──────────────────────────────────────────
  it('routes /doctors to doctor-service', async () => {
    await api.get('/doctors/456');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://doctor.us.example.com/doctors/456',
      expect.any(Object)
    );
  });

  it('routes /prescriptions to doctor-service', async () => {
    await api.get('/prescriptions');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://doctor.us.example.com/prescriptions',
      expect.any(Object)
    );
  });

  it('routes /drugs to doctor-service', async () => {
    await api.get('/drugs/rxnorm/search?term=aspirin');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://doctor.us.example.com/drugs/rxnorm/search?term=aspirin',
      expect.any(Object)
    );
  });

  it('routes /cds-hooks to doctor-service', async () => {
    await api.get('/cds-hooks/services');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://doctor.us.example.com/cds-hooks/services',
      expect.any(Object)
    );
  });

  it('routes /referrals to doctor-service', async () => {
    await api.post('/referrals', { patientId: 'p-123' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://doctor.us.example.com/referrals',
      expect.any(Object)
    );
  });

  it('routes /public-health/elr to doctor-service (not patient-service)', async () => {
    await api.get('/public-health/elr');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://doctor.us.example.com/public-health/elr',
      expect.any(Object)
    );
  });

  // ─── Booking Service Routes ─────────────────────────────────────────
  it('routes /appointments to booking-service', async () => {
    await api.get('/appointments?patientId=p-123');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://booking.us.example.com/appointments?patientId=p-123',
      expect.any(Object)
    );
  });

  it('routes /billing to booking-service', async () => {
    await api.get('/billing?patientId=p-123');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://booking.us.example.com/billing?patientId=p-123',
      expect.any(Object)
    );
  });

  it('routes /prior-auth to booking-service', async () => {
    await api.post('/prior-auth', { patientId: 'p-123' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://booking.us.example.com/prior-auth',
      expect.any(Object)
    );
  });

  // ─── Communication Service Routes ───────────────────────────────────
  it('routes /chat to communication-service', async () => {
    await api.get('/chat/history');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://comm.us.example.com/chat/history',
      expect.any(Object)
    );
  });

  it('routes /video to communication-service', async () => {
    await api.post('/video/session', { appointmentId: 'apt-123' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://comm.us.example.com/video/session',
      expect.any(Object)
    );
  });

  it('routes /ai to communication-service', async () => {
    await api.post('/ai/symptom-check', { text: 'headache' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://comm.us.example.com/ai/symptom-check',
      expect.any(Object)
    );
  });

  // ─── Admin Service Routes ──────────────────────────────────────────
  it('routes /api/v1/admin to admin-service', async () => {
    await api.get('/api/v1/admin/users');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://admin.us.example.com/api/v1/admin/users',
      expect.any(Object)
    );
  });

  // ─── Staff Service Routes ──────────────────────────────────────────
  it('routes /shifts to staff-service', async () => {
    await api.get('/shifts');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://staff.us.example.com/shifts',
      expect.any(Object)
    );
  });

  it('routes /tasks to staff-service', async () => {
    await api.get('/tasks');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://staff.us.example.com/tasks',
      expect.any(Object)
    );
  });

  it('routes /announcements to staff-service', async () => {
    await api.get('/announcements');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://staff.us.example.com/announcements',
      expect.any(Object)
    );
  });
});

describe('API Region Header', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });
  });

  it('includes x-user-region header set to US', async () => {
    localStorage.setItem('userRegion', 'US');
    await api.get('/patients/123');
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[1].headers['x-user-region']).toBe('US');
  });

  it('includes x-user-region header set to EU', async () => {
    localStorage.setItem('userRegion', 'EU');
    await api.get('/patients/123');
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[1].headers['x-user-region']).toBe('EU');
  });

  it('includes Authorization Bearer token from Cognito', async () => {
    localStorage.setItem('userRegion', 'US');
    await api.get('/patients/123');
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[1].headers['Authorization']).toBe('Bearer mock-cognito-id-token');
  });
});

describe('API EU Region Routing', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });
    localStorage.setItem('userRegion', 'EU');
  });

  it('routes to EU patient-service URL when region is EU', async () => {
    await api.get('/patients/123');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://patient.eu.example.com/patients/123',
      expect.any(Object)
    );
  });

  it('routes to EU doctor-service URL when region is EU', async () => {
    await api.get('/doctors/456');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://doctor.eu.example.com/doctors/456',
      expect.any(Object)
    );
  });

  it('routes to EU booking-service URL when region is EU', async () => {
    await api.get('/appointments?patientId=p-123');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://booking.eu.example.com/appointments?patientId=p-123',
      expect.any(Object)
    );
  });
});

describe('API Failover', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorage.setItem('userRegion', 'US');
  });

  it('fails over to backup on 5xx response', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal Server Error' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, source: 'backup' }),
      });

    const result = await api.get('/patients/123');
    expect(result).toEqual({ success: true, source: 'backup' });
    // Should have made 2 calls: primary (failed) + backup
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toBe('https://patient.us.backup.example.com/patients/123');
  });
});
