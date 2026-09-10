import { z } from 'zod';
import source from '@/content/booking.json';
import policy from '@/config/booking-policy.json';

const text = z.string().trim().min(1);
export const bookingContent = z.object({
  title: text, specialty: text, chooseSpecialty: text, doctor: text, chooseDoctor: text,
  date: text, time: text, chooseTime: text, noSlots: text, loading: text, fee: text,
  feeUnavailable: text, feeDisclosure: text, scheduleError: text, paymentTitle: text,
  paymentDescription: text, proceed: text, selectPaymentMethod: text, cancel: text, successTitle: text,
  successDescription: text, errorTitle: text, paymentUnavailable: text,
  unknownOutcome: text, selectionChanged: text,
}).strict().parse(source);

export const bookingPolicy = z.object({
  slotMinutes: z.number().int().positive().max(1440),
  maxAvailabilityPages: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  displayLocale: text,
}).strict().parse(policy);
