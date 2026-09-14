/** Stable plan identifiers required by the existing subscription API contract. */
export const SUBSCRIPTION_PLAN_IDS = ['free', 'plus', 'premium'] as const;
export type PlanId = typeof SUBSCRIPTION_PLAN_IDS[number];
