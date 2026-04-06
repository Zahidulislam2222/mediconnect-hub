/**
 * Subscription Types & API Helpers
 *
 * All prices are display-only — actual charges happen server-side.
 * Discount percentages come from server, never hardcoded client-side.
 */

import { api } from './api';

// ─── Types ──────────────────────────────────────────────────────────────

export type PlanId = 'free' | 'plus' | 'premium';
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

export interface PlanDisplay {
    id: PlanId;
    name: string;
    price: number;
    discountPercent: number;
    features: string[];
    highlighted?: boolean;
}

export const PLAN_DISPLAY: PlanDisplay[] = [
    {
        id: 'free',
        name: 'Free',
        price: 0,
        discountPercent: 0,
        features: [
            'Pay-per-visit at full rate',
            'Access to all doctors',
            'Secure video consultations',
            'FHIR health records',
        ],
    },
    {
        id: 'plus',
        name: 'MediConnect Plus',
        price: 19,
        discountPercent: 20,
        highlighted: true,
        features: [
            '20% discount on all visits',
            'Priority booking (24h early access)',
            'Chat follow-ups with doctors',
            'Access to all doctors',
            'Secure video consultations',
            'FHIR health records',
        ],
    },
    {
        id: 'premium',
        name: 'MediConnect Premium',
        price: 39,
        discountPercent: 30,
        features: [
            '30% discount on all visits',
            '1 free GP visit per month',
            'Family sharing (up to 4 members)',
            'Priority booking (24h early access)',
            'Chat follow-ups with doctors',
            'Access to all specialists',
            'Secure video consultations',
            'FHIR health records',
        ],
    },
];

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
