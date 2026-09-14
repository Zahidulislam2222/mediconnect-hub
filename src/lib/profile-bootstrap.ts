import { HttpResponseError } from '@/lib/api';

export function isProfileMissing(error: unknown): boolean {
  return error instanceof HttpResponseError && error.status === 404;
}

export function verifyOwnProfile(value: unknown, subject: string, role: 'patient' | 'doctor'): void {
  const field = role === 'patient' ? 'patientId' : 'doctorId';
  if (!subject || !value || typeof value !== 'object' || Array.isArray(value)
    || (value as Record<string, unknown>)[field] !== subject
    || 'error' in value) {
    throw new Error('INVALID_PROFILE_RESPONSE');
  }
}
