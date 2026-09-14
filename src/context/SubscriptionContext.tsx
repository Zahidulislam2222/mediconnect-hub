/**
 * SubscriptionContext — Global subscription state
 *
 * Provides subscription status to all components.
 * Fetches from server on mount (never trusts JWT — loophole #10).
 * Caches through the in-memory profile storage boundary; cache state never establishes identity or compliance.
 */

import React, { createContext, useContext, useState, useLayoutEffect, useRef, useCallback, ReactNode } from 'react';
import { subscriptionApi, SubscriptionInfo } from '@/lib/subscription';
import { SESSION_CLEARED_EVENT } from '@/lib/secure-storage';
import { useVerifiedSession } from '@/context/VerifiedSession';
import { Hub } from 'aws-amplify/utils';
import paymentCopy from '@/content/payment';
import { subscriptionPlanName } from '@/content/subscription-plans';

interface SubscriptionContextType {
    subscription: SubscriptionInfo | null;
    isLoading: boolean;
    error: string | null;
    refresh: (signal?: AbortSignal) => Promise<boolean>;
    isSubscribed: boolean;
    discountPercent: number;
    planName: string;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
    subscription: null,
    isLoading: false,
    error: null,
    refresh: async () => false,
    isSubscribed: false,
    discountPercent: 0,
    planName: subscriptionPlanName('free'),
});

export const useSubscription = () => useContext(SubscriptionContext);

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const identity = useVerifiedSession();
    const generation = useRef(0);
    const active = useRef(false);

    const refresh = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
        if (!active.current || !identity || signal?.aborted) return false;
        const request = ++generation.current;
        const current = () => active.current && generation.current === request && !signal?.aborted;
        const abort = () => {
            if (generation.current === request) {
                generation.current++;
                if (active.current) setIsLoading(false);
            }
        };
        signal?.addEventListener('abort', abort, { once: true });
        setIsLoading(true);
        setError(null);
        try {
            const data = await subscriptionApi.getStatus();
            if (!current()) return false;
            if (!data) throw new Error('MISSING_SUBSCRIPTION_STATUS');
            setSubscription(data);
            return true;
        } catch {
            if (current()) {
                setError(paymentCopy.subscriptionStatusUnavailable);
                setSubscription(null);
            }
            return false;
        } finally {
            signal?.removeEventListener('abort', abort);
            if (current()) setIsLoading(false);
        }
    }, [identity]);

    useLayoutEffect(() => {
        active.current = Boolean(identity);
        const invalidate = () => {
            active.current = false;
            generation.current++;
            setSubscription(null);
            setIsLoading(false);
            setError(null);
        };
        setSubscription(null);
        setIsLoading(false);
        setError(null);
        const unsubscribe = Hub.listen('auth', ({ payload }) => {
            if (payload.event === 'signedOut' || payload.event === 'tokenRefresh_failure' || payload.event === 'signedIn') invalidate();
        });
        window.addEventListener(SESSION_CLEARED_EVENT, invalidate);
        void refresh();
        return () => {
            active.current = false;
            generation.current++;
            unsubscribe();
            window.removeEventListener(SESSION_CLEARED_EVENT, invalidate);
        };
    }, [identity, refresh]);

    const isSubscribed = subscription?.status === 'active' && subscription?.planId !== 'free';
    const discountPercent = subscription?.discountPercent || 0;
    const planName = subscriptionPlanName(subscription ? subscription.planId : 'free');

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
