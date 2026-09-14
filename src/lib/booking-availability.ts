import { z } from 'zod';
import { appointmentRouting } from '@/config/env';
import { bookingPolicy } from '@/lib/booking-content';

const MINUTE_MS = 60_000;
const MINUTES_PER_DAY = 24 * 60;
const DAY_MS = MINUTES_PER_DAY * MINUTE_MS;
const calendarLocale = 'en-US-u-ca-iso8601-nu-latn';
const occupiedTimestamp = z.string().datetime({ offset: true });
const bookingSchema = z.object({
  timeSlot: z.string().optional(), status: z.string().min(1),
  resource: z.object({ start: z.string().optional() }).optional(),
});
type OccupiedBooking = z.infer<typeof bookingSchema>;
export interface BookingSlot { start: string; label: string }
export interface BookingAvailability { timezone: string; slots: BookingSlot[] }
export const bookingDoctorSchema = z.object({
  doctorId: z.string().trim().min(1), name: z.string().trim().min(1),
  specialization: z.string().trim().min(1), consultationFee: z.unknown().optional(),
});

export function parseBookingFee(value: unknown): number | null {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value))) return null;
  const amount = Number(value);
  const cents = Math.round(amount * 100);
  return amount > 0 && Number.isSafeInteger(cents) && cents / 100 === amount ? amount : null;
}

function calendarDay(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('INVALID_BOOKING_DATE');
  const value = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== date) throw new Error('INVALID_BOOKING_DATE');
  return value;
}

function clockMinutes(clock: string): number {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(clock)) throw new Error('INVALID_BOOKING_SHIFT');
  const [hours, minutes] = clock.split(':').map(Number);
  return hours * 60 + minutes;
}

function occupiedStarts(bookings: OccupiedBooking[]): number[] {
  return bookings.filter(booking => booking.status.toUpperCase() !== 'CANCELLED').map(booking => {
    const raw = booking.resource?.start || booking.timeSlot;
    if (!occupiedTimestamp.safeParse(raw).success) throw new Error('INVALID_OCCUPIED_TIME');
    if (!raw) throw new Error('INVALID_OCCUPIED_TIME');
    const value = Date.parse(raw);
    if (!Number.isFinite(value)) throw new Error('INVALID_OCCUPIED_TIME');
    return value;
  });
}

export function bookingSlots(date: string, timezone: string, shift: string, input: unknown[], now: number): BookingSlot[] {
  const day = calendarDay(date);
  if (!timezone || !Number.isFinite(now)) throw new Error('INVALID_BOOKING_CONFIGURATION');
  const format = new Intl.DateTimeFormat(calendarLocale, { timeZone: timezone, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const occupied = occupiedStarts(z.array(bookingSchema).parse(input));
  if (shift === 'OFF') return [];
  const range = shift.split('-');
  if (range.length !== 2) throw new Error('INVALID_BOOKING_SHIFT');
  const start = clockMinutes(range[0]); const end = clockMinutes(range[1]);
  if (end <= start) throw new Error('INVALID_BOOKING_SHIFT');
  const duration = bookingPolicy.slotMinutes * MINUTE_MS;
  const wall = (instant: number) => {
    const parts = Object.fromEntries(format.formatToParts(instant).map(part => [part.type, part.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, label: `${parts.hour}:${parts.minute}`,
      minutes: Number(parts.hour) * 60 + Number(parts.minute) };
  };
  const candidates = new Map<string, number[]>();
  // Adjacent UTC days cover every IANA civil offset. Round-tripping every minute
  // detects missing and repeated wall times without choosing a guessed DST offset.
  for (let instant = day - DAY_MS; instant < day + 2 * DAY_MS; instant += MINUTE_MS) {
    const local = wall(instant);
    if (local.date !== date || local.minutes < start || local.minutes + bookingPolicy.slotMinutes > end ||
        (local.minutes - start) % bookingPolicy.slotMinutes !== 0) continue;
    candidates.set(local.label, [...(candidates.get(local.label) ?? []), instant]);
  }
  return [...candidates.entries()].flatMap(([label, instants]) => {
    if (instants.length !== 1) return [];
    const instant = instants[0]; const finish = wall(instant + duration);
    if (instant <= now || finish.date !== date || finish.minutes > end ||
        occupied.some(taken => instant < taken + duration && instant + duration > taken)) return [];
    return [{ start: new Date(instant).toISOString(), label }];
  }).sort((a, b) => a.start.localeCompare(b.start));
}

const scheduleSchema = z.object({ timezone: z.string().min(1), schedule: z.record(z.string()) });
const pageSchema = z.object({ existingBookings: z.array(bookingSchema),
  lastEvaluatedKey: z.record(z.union([z.string(), z.number()])).nullish() });

export async function loadBookingAvailability(doctorId: string, date: string, get: (path: string) => Promise<unknown>,
  signal: AbortSignal, now: number): Promise<BookingAvailability> {
  const day = calendarDay(date); signal.throwIfAborted();
  const query = new URLSearchParams({ doctorId });
  const [rawSchedule, rawFirst] = await Promise.all([
    get(`${appointmentRouting.doctors}/${encodeURIComponent(doctorId)}${appointmentRouting.schedule}`),
    get(`${appointmentRouting.availability}?${query.toString()}`),
  ]);
  signal.throwIfAborted();
  const schedule = scheduleSchema.parse(rawSchedule);
  let page = pageSchema.parse(rawFirst); const bookings = [...page.existingBookings];
  const cursors = new Set<string>(); let pages = 1;
  while (page.lastEvaluatedKey && Object.keys(page.lastEvaluatedKey).length) {
    const cursor = JSON.stringify(Object.fromEntries(Object.entries(page.lastEvaluatedKey).sort(([a], [b]) => a.localeCompare(b))));
    if (cursors.has(cursor) || pages >= bookingPolicy.maxAvailabilityPages) throw new Error('INCOMPLETE_BOOKING_AVAILABILITY');
    cursors.add(cursor); query.set('startKey', cursor); signal.throwIfAborted();
    const raw = await get(`${appointmentRouting.availability}?${query.toString()}`);
    signal.throwIfAborted(); page = pageSchema.parse(raw); bookings.push(...page.existingBookings); pages++;
  }
  const weekday = new Intl.DateTimeFormat(calendarLocale, { weekday: 'long', timeZone: 'UTC' }).format(day);
  // An absent weekday has no verified schedule, so it cannot offer appointment slots.
  const shift = schedule.schedule[weekday];
  if (shift === undefined) throw new Error('MISSING_BOOKING_SHIFT');
  return { timezone: schedule.timezone, slots: bookingSlots(date, schedule.timezone, shift, bookings, now) };
}
