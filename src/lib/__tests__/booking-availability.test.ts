import { describe, expect, it, vi } from 'vitest';
import { bookingSlots, loadBookingAvailability, parseBookingFee } from '@/lib/booking-availability';

const now = Date.parse('2026-01-01T00:00:00Z');
describe('doctor-local booking availability', () => {
  it('preserves half-hour offsets and shift minutes in canonical UTC', () => {
    const slots = bookingSlots('2026-09-14', 'Asia/Kolkata', '09:15-10:15', [], now);
    expect(slots.map(slot => slot.start)).toEqual(['2026-09-14T03:45:00.000Z', '2026-09-14T04:15:00.000Z']);
    expect(slots.map(slot => slot.label)).toEqual(['09:15', '09:45']);
  });
  it('does not invent times skipped by daylight saving', () => {
    const slots = bookingSlots('2026-03-08', 'America/New_York', '01:00-04:00', [], now);
    expect(slots.map(slot => slot.label)).toEqual(['01:00', '01:30', '03:00', '03:30']);
    expect(slots.map(slot => slot.start)).toEqual(['2026-03-08T06:00:00.000Z', '2026-03-08T06:30:00.000Z', '2026-03-08T07:00:00.000Z', '2026-03-08T07:30:00.000Z']);
  });
  it('withholds repeated wall-clock times instead of silently choosing an offset', () => {
    const slots = bookingSlots('2026-11-01', 'America/New_York', '00:00-03:00', [], now);
    expect(slots.map(slot => slot.label)).toEqual(['00:00', '00:30', '02:00', '02:30']);
  });
  it('removes overlapping active bookings, retains cancelled availability and filters past slots', () => {
    const slots = bookingSlots('2026-09-14', 'UTC', '09:00-11:00', [
      { timeSlot: '2026-09-14T09:45:00Z', status: 'CONFIRMED' },
      { resource: { start: '2026-09-14T10:30:00Z' }, status: 'CANCELLED' },
    ], Date.parse('2026-09-14T09:00:00Z'));
    expect(slots.map(slot => slot.label)).toEqual(['10:30']);
  });
  it.each([
    ['2026-02-30', 'UTC', '09:00-10:00'],
    ['2026-09-14', '', '09:00-10:00'],
    ['2026-09-14', 'Test/Invalid', '09:00-10:00'],
    ['2026-09-14', 'UTC', '09:61-10:00'],
    ['2026-09-14', 'UTC', '23:00-01:00'],
  ])('fails closed for invalid date, timezone or unsupported shift', (date, zone, shift) => {
    expect(() => bookingSlots(date, zone, shift, [], now)).toThrow();
  });
  it('rejects malformed occupied times rather than offering a potentially occupied slot', () => {
    expect(() => bookingSlots('2026-09-14', 'UTC', '09:00-10:00', [{ timeSlot: 'invalid', status: 'CONFIRMED' }], now)).toThrow();
  });
  it('rejects impossible occupied calendar dates that Date.parse would normalize', () => {
    expect(() => bookingSlots('2026-03-02', 'UTC', '09:00-10:00', [{ timeSlot: '2026-02-30T09:00:00Z', status: 'CONFIRMED' }], now)).toThrow();
  });
  it('returns no slots on a verified day off', () => {
    expect(bookingSlots('2026-09-14', 'UTC', 'OFF', [], now)).toEqual([]);
  });
});

describe('published fee validation', () => {
  it.each([undefined, null, '', ' ', true, 0, -1, NaN, Infinity, 'test-fee', 10.005])('does not invent a payable fee for %s', fee => {
    expect(parseBookingFee(fee)).toBeNull();
  });
  it.each([75.5, '75.50'])('accepts a published currency amount %s', fee => {
    expect(parseBookingFee(fee)).toBe(75.5);
  });
});

describe('availability transport', () => {
  it('loads and combines every page with an encoded doctor and cursor', async () => {
    const get = vi.fn().mockImplementation(async (path: string) => {
      if (path.includes('/schedule')) return { timezone: 'UTC', schedule: { Monday: '09:00-10:00' } };
      if (path.includes('startKey=')) return { existingBookings: [{ timeSlot: '2026-09-14T09:30:00Z', status: 'CONFIRMED' }] };
      return { existingBookings: [], lastEvaluatedKey: { appointmentId: 'test cursor' } };
    });
    const result = await loadBookingAvailability('test/doctor', '2026-09-14', get, new AbortController().signal, now);
    expect(result.slots.map(slot => slot.label)).toEqual(['09:00']);
    expect(get).toHaveBeenCalledWith(expect.stringContaining('doctorId=test%2Fdoctor'));
    expect(get).toHaveBeenCalledWith(expect.stringContaining('startKey=%7B%22appointmentId%22%3A%22test+cursor%22%7D'));
  });
  it('refuses repeated pagination cursors', async () => {
    const get = vi.fn().mockImplementation(async (path: string) => path.includes('/schedule')
      ? { timezone: 'UTC', schedule: { Monday: '09:00-10:00' } }
      : { existingBookings: [], lastEvaluatedKey: { appointmentId: 'test-loop' } });
    await expect(loadBookingAvailability('test-doctor', '2026-09-14', get, new AbortController().signal, now)).rejects.toThrow();
    expect(get.mock.calls.length).toBeLessThan(5);
  });
  it('stops pagination after the requesting view is cancelled', async () => {
    const controller = new AbortController();
    const get = vi.fn().mockImplementation(async (path: string) => {
      if (path.includes('/schedule')) return { timezone: 'UTC', schedule: { Monday: '09:00-10:00' } };
      controller.abort(); return { existingBookings: [], lastEvaluatedKey: { appointmentId: 'test-next' } };
    });
    await expect(loadBookingAvailability('test-doctor', '2026-09-14', get, controller.signal, now)).rejects.toThrow();
    expect(get).toHaveBeenCalledTimes(2);
  });
  it('does not interpret an invalid response as an empty calendar', async () => {
    const get = vi.fn().mockResolvedValue({});
    await expect(loadBookingAvailability('test-doctor', '2026-09-14', get, new AbortController().signal, now)).rejects.toThrow();
  });
});
