import { HttpResponseError, MutationOutcomeUnknownError } from '@/lib/api';

/**
 * /billing/pay refusals the booking service returns before it calls the payment provider (billing.controller payBill),
 * so the request made no new charge. BILL_ALREADY_PAID and BILL_NOT_PAYABLE are returned exactly when money was already
 * taken, so copy must speak only of this attempt. PAYMENT_RECONCILIATION_REQUIRED is not one of them: it can follow a
 * provider call or an earlier attempt whose outcome is unknown.
 */
export const REFUSED_BEFORE_CHARGE_CODES: readonly string[] = ['BILL_ALREADY_PAID', 'BILL_NOT_PAYABLE', 'BILL_AMOUNT_REQUIRES_REVIEW'];

/** /billing/pay refusals whose charge outcome is unknown: a provider call or an earlier attempt may have charged. */
export const OUTCOME_UNCONFIRMED_CODES: readonly string[] = ['PAYMENT_RECONCILIATION_REQUIRED'];

/** The pay request was definitely refused before any charge was attempted. */
export function refusedBeforeCharge(error: unknown): boolean {
  return error instanceof HttpResponseError && error.status === 409
    && error.code !== undefined && REFUSED_BEFORE_CHARGE_CODES.includes(error.code);
}

/** The pay request may have charged: never tell the patient it failed or invite a retry. */
export function outcomeUnconfirmed(error: unknown): boolean {
  if (error instanceof MutationOutcomeUnknownError) return true;
  return error instanceof HttpResponseError && error.status === 409
    && error.code !== undefined && OUTCOME_UNCONFIRMED_CODES.includes(error.code);
}
