import { describe, expect, it } from 'vitest';
import { payableBillFrom, pickupFrom, prescriptionsFrom, refillAcknowledged } from '@/lib/pharmacy-contract';

const bill = { billId: 'test-bill', referenceId: 'test-rx', patientId: 'test-patient', amount: 12.34, status: 'PENDING' };
const response = (changes = {}, outer = {}) => ({ currency: 'USD', transactions: [{ ...bill, ...changes }], ...outer });
describe('Pharmacy boundary contracts', () => {
  it('uses the authoritative bill amount', () => expect(payableBillFrom(response(), 'test-rx', 'test-patient').amount).toBe(12.34));
  it.each([
    { patientId: 'test-other' }, { referenceId: 'test-other' }, { amount: 0 }, { amount: -1 },
    { amount: Infinity }, { amount: 1.001 }, { amount: Number.MAX_SAFE_INTEGER },
    { amount: 'invalid' }, { status: 'PAID' }, { status: 'PROCESSING' }, { status: 'UNKNOWN' },
    { paymentIntentId: 'test-intent' }, { paymentAttemptId: 'test-attempt' }, { billId: '' },
  ])('rejects an unsafe bill %j', changes => expect(() => payableBillFrom(response(changes), 'test-rx', 'test-patient')).toThrow());
  it.each([
    { currency: 'EUR' }, { currency: undefined }, { lastEvaluatedKey: { billId: 'test-next' } },
    { transactions: [] }, { transactions: [bill, { ...bill, billId: 'test-second' }] },
  ])('rejects ambiguous/incomplete billing %j', outer => expect(() => payableBillFrom(response({}, outer), 'test-rx', 'test-patient')).toThrow());
  it('ignores a previous paid bill when identifying the single new bill', () => {
    const data = response({}, { transactions: [{ ...bill, billId: 'test-old', status: 'PAID' }, bill] });
    expect(payableBillFrom(data, 'test-rx', 'test-patient').billId).toBe('test-bill');
  });
  it.each([null, [], {}, { qrPayload: 12 }, { qrPayload: 'PICKUP-test-other' }, { qrPayload: ' PICKUP-test-rx' }])('rejects invalid pickup payload %j', payload => expect(() => pickupFrom(payload, 'test-rx')).toThrow());
  it('preserves the exact response token', () => expect(pickupFrom({ qrPayload: 'PICKUP-test-rx' }, 'test-rx')).toBe('PICKUP-test-rx'));
  it('requires the actual refill acknowledgement', () => {
    expect(refillAcknowledged({ message: 'Refill authorized' })).toBe(true);
    expect(refillAcknowledged({ success: true })).toBe(false);
  });
  it('rejects duplicated and malformed prescriptions', () => {
    const rx = { prescriptionId: 'test-rx', medication: 'Test medication', status: 'ISSUED' };
    expect(() => prescriptionsFrom({ prescriptions: [rx, rx] })).toThrow();
    expect(() => prescriptionsFrom({ prescriptions: [{ ...rx, medication: null }] })).toThrow();
  });
});
