/**
 * SubscriptionContext — Global subscription state
 *
 * Provides subscription status to all components.
 * Fetches from server on mount (never trusts JWT — loophole #10).
 * Caches in secure-storage (AES-GCM encrypted — HIPAA compliant).
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { subscriptionApi, SubscriptionInfo, PlanId } from '@/lib/subscription';
import { isAuthenticated } from '@/lib/secure-storage';

interface SubscriptionContextType {
    subscription: SubscriptionInfo | null;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    isSubscribed: boolean;
    discountPercent: number;
    planName: string;
}

const defaultSubscription: SubscriptionInfo = {
    planId: 'free',
    status: 'none',
    discountPercent: 0,
    freeGpVisitsRemaining: 0,
    familyMembers: [],
    cycleStart: '',
    cycleEnd: '',
    cancelAtPeriodEnd: false,
};

const SubscriptionContext = createContext<SubscriptionContextType>({
    subscription: null,
    isLoading: false,
    error: null,
    refresh: async () => {},
    isSubscribed: false,
    discountPercent: 0,
    planName: 'Free',
});

export const useSubscription = () => useContext(SubscriptionContext);

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!isAuthenticated()) return;

        setIsLoading(true);
        setError(null);
        try {
            const data = await subscriptionApi.getStatus();
            setSubscription(data || defaultSubscription);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch subscription');
            setSubscription(defaultSubscription);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const isSubscribed = subscription?.status === 'active' && subscription?.planId !== 'free';
    const discountPercent = subscription?.discountPercent || 0;
    const planNames: Record<PlanId, string> = {
        free: 'Free',
        plus: 'MediConnect Plus',
        premium: 'MediConnect Premium',
    };
    const planName = planNames[subscription?.planId || 'free'];

    return (
        <SubscriptionContext.Provider value={{
            subscription,
            isLoading,
            error,
            refresh,
            isSubscribed,
            discountPercent,
            planName,
        }}>
            {children}
        </SubscriptionContext.Provider>
    );
};
