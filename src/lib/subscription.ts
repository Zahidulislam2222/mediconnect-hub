/**
 * Subscription Types & API Helpers
 *
 * All prices are display-only — actual charges happen server-side.
 * Display catalog lives in validated content; actual discounts/entitlements come from the server.
 */

import { api } from './api';

// ─── Types ──────────────────────────────────────────────────────────────

import type { PlanId } from './subscription-protocol';
export type { PlanId } from './subscription-protocol';
export type { PlanDisplay } from '@/content/subscription-plans';
export { subscriptionPlans as PLAN_DISPLAY } from '@/content/subscription-plans';
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'incomplete' | 'none';

export interface SubscriptionInfo {
    planId: PlanId;
    status: SubscriptionStatus;
    discountPercent: number;
    freeGpVisitsRemaining: number;
    familyMembers: string[];
    cycleStart: string;
    cycleEnd: string;
    cancelAtPeriodEnd: boolean;
}

// ─── API Calls ──────────────────────────────────────────────────────────

export const subscriptionApi = {
    getStatus: (): Promise<SubscriptionInfo> =>
        api.get('/subscriptions/status'),

    create: (planId: 'plus' | 'premium', consentTermsVersion: string) =>
        api.post('/subscriptions/create', { planId, consentTermsVersion }),

    cancel: (reason?: string) =>
        api.post('/subscriptions/cancel', { reason }),

    upgrade: (newPlanId: 'plus' | 'premium') =>
        api.post('/subscriptions/upgrade', { newPlanId }),

    getPortalUrl: (): Promise<{ url: string }> =>
        api.get('/subscriptions/portal'),

    addFamilyMember: (memberId: string, relationship: string) =>
        api.post('/subscriptions/family/add', { memberId, relationship }),

    removeFamilyMember: (memberId: string) =>
        api.post('/subscriptions/family/remove', { memberId }),
};

// ─── Doctor API ─────────────────────────────────────────────────────────

export interface DoctorTierInfo {
    tier: 'new' | 'established' | 'top';
    doctorPercentage: number;
    platformPercentage: number;
    consultationFee: number;
    rateHistory: Array<{ rate: number; effectiveDate: string }>;
    upgradeEligibleTo: string | null;
    monthsOnPlatform: number;
    rating: number;
}

export interface PayoutRecord {
    doctorId: string;
    periodStart: string;
    periodEnd: string;
    totalVisits: number;
    grossEarnings: number;
    platformFee: number;
    netPayout: number;
    status: 'pending' | 'paid' | 'failed';
    paidAt?: string;
}

export const doctorSubscriptionApi = {
    getTier: (): Promise<DoctorTierInfo> =>
        api.get('/doctors/me/tier'),

    updateRate: (newRate: number) =>
        api.put('/doctors/me/rate', { newRate }),

    getEarnings: (): Promise<{ payouts: PayoutRecord[]; summary: any }> =>
        api.get('/doctors/me/earnings'),
};
