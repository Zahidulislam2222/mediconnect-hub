import { HttpResponseError } from '@/lib/api';

/**
 * /billing/pay refusals the booking service returns before it calls the payment provider (billing.controller payBill),
 * so the request charged nothing. PAYMENT_RECONCILIATION_REQUIRED is not one of them: it can follow a provider call or
 * an earlier attempt whose outcome is unknown.
 */
export const REFUSED_BEFORE_CHARGE_CODES: readonly string[] = ['BILL_ALREADY_PAID', 'BILL_NOT_PAYABLE', 'BILL_AMOUNT_REQUIRES_REVIEW'];

/** The pay request was definitely refused before any charge was attempted. */
export function refusedBeforeCharge(error: unknown): boolean {
  return error instanceof HttpResponseError && error.status === 409
    && error.code !== undefined && REFUSED_BEFORE_CHARGE_CODES.includes(error.code);
}
