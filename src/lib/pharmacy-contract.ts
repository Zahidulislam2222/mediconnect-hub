import { z } from 'zod';
import routing from '@/config/pharmacy-routing.json';
import paymentCopy from '@/content/payment';

const route = z.string().regex(/^\/[A-Za-z0-9/-]+$/);
export const pharmacyRoutes = z.object({ profile: route, prescriptions: route, billing: route, pay: route, pickup: route, refill: route }).strict().parse(routing);
const text = z.string().trim().min(1);
const number = z.union([z.number().finite(), z.string().regex(/^\d+(?:\.\d+)?$/).transform(Number)]);
const schema = z.object({
  prescriptionId: text, medication: text, status: text,
  paymentStatus: z.string().optional(), dosage: z.string().optional(), instructions: z.string().optional(),
  timestamp: z.string().optional(), livePrice: number.optional(), price: number.optional(),
  liveStock: z.number().int().nonnegative().optional(), refillsRemaining: z.number().int().nonnegative().optional(),
});
export type Prescription = z.infer<typeof schema>;
export function prescriptionsFrom(value: unknown) {
  const rows = z.object({ prescriptions: z.array(schema) }).parse(value).prescriptions;
  if (new Set(rows.map(row => row.prescriptionId)).size !== rows.length) throw new Error('DUPLICATE_PRESCRIPTION');
  return rows;
}
// Existing pharmacy API protocol. Never manufacture a token from this prefix.
export function pickupFrom(value: unknown, prescriptionId: string) {
  const result = z.object({ qrPayload: z.string().min(1) }).parse(value);
  if (result.qrPayload !== `PICKUP-${prescriptionId}`) throw new Error('INVALID_PICKUP_RESPONSE');
  return result.qrPayload;
}
export function refillAcknowledged(value: unknown) {
  return z.object({ message: z.literal('Refill authorized') }).safeParse(value).success;
}
const bill = z.object({ billId: text, referenceId: text, patientId: text, amount: number, status: text,
  paymentAttemptId: z.unknown().optional(), paymentIntentId: z.unknown().optional() });
export function payableBillFrom(value: unknown, prescriptionId: string, patientId: string) {
  const response = z.object({ transactions: z.array(bill), currency: z.literal('USD'), lastEvaluatedKey: z.unknown().optional() }).parse(value);
  // An incomplete billing list cannot establish a unique payable bill.
  if (response.lastEvaluatedKey != null) throw new Error('INCOMPLETE_BILLING');
  const candidates = response.transactions.filter(row => row.referenceId === prescriptionId && row.status !== 'PAID');
  if (candidates.length !== 1) throw new Error('AMBIGUOUS_BILL');
  const selected = candidates[0];
  const cents = selected.amount * 100;
  if (selected.patientId !== patientId || !['PENDING', 'DUE', 'UNPAID', 'FAILED'].includes(selected.status) ||
      selected.paymentAttemptId != null || selected.paymentIntentId != null || selected.amount <= 0 ||
      !Number.isSafeInteger(Math.round(cents)) || Math.abs(cents - Math.round(cents)) > Number.EPSILON * Math.abs(cents)) {
    throw new Error('BILL_REQUIRES_REVIEW');
  }
  return selected;
}
export function paymentNotice(value: unknown) {
  const parsed = z.object({ status: z.string() }).safeParse(value);
  const status = parsed.success ? parsed.data.status : undefined;
  if (status === 'succeeded') return { title: paymentCopy.succeededTitle, description: paymentCopy.succeededDescription };
  if (status === 'processing' || status === 'requires_capture') return { title: paymentCopy.processingTitle, description: paymentCopy.processingDescription };
  if (status === 'requires_action' || status === 'requires_confirmation') return { title: paymentCopy.actionTitle, description: paymentCopy.actionDescription };
  if (status === 'requires_payment_method' || status === 'canceled') return { title: paymentCopy.failedTitle, description: paymentCopy.failedDescription };
  return { title: paymentCopy.unknownTitle, description: paymentCopy.unknownDescription };
}
