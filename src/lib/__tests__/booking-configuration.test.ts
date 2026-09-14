import { describe, expect, it } from 'vitest';
import form from '@/components/appointments/AppointmentBookingForm.tsx?raw';
import availability from '@/lib/booking-availability.ts?raw';
import { bookingPolicy } from '@/lib/booking-content';
import { appointmentRouting } from '@/config/env';

describe('booking configuration boundary', () => {
  it('keeps provider coordinates, secrets, pricing defaults and maintained copy out of booking logic', () => {
    for (const source of [form, availability]) {
      expect(source).not.toMatch(/https?:\/\//);
      expect(source).not.toMatch(/(?:api[_-]?key|client[_-]?secret|password)\s*[:=]\s*['"][^'"]+/i);
      expect(source).not.toMatch(/consultationFee\s*\|\|/);
      expect(source).not.toMatch(/import\.meta\.env/);
    }
    expect(form).not.toContain('Consultation with');
    expect(form).not.toContain('Could not load availability');
    expect(availability).not.toContain('30 *');
    expect(availability).toContain('bookingPolicy.slotMinutes');
    expect(availability).toContain('bookingPolicy.maxAvailabilityPages');
  });
  it('validates the shared policy and routes used by scheduling and submission', () => {
    expect(bookingPolicy.slotMinutes).toBeGreaterThan(0);
    expect(bookingPolicy.maxAvailabilityPages).toBeGreaterThan(0);
    expect(bookingPolicy.currency).toMatch(/^[A-Z]{3}$/);
    for (const route of [appointmentRouting.book, appointmentRouting.availability, appointmentRouting.doctors, appointmentRouting.schedule]) {
      expect(route).toMatch(/^\/[A-Za-z0-9/_-]+$/);
    }
  });
});
