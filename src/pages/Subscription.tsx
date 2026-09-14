/**
 * Subscription Page — Plan selection and checkout
 *
 * Shows 3 plan cards (Free/Plus/Premium) with Stripe checkout dialog.
 * Includes GDPR consent, auto-renewal disclosure, and subscription management.
 */

import React, { useState, useRef, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Elements } from '@stripe/react-stripe-js';
import type { Stripe } from '@stripe/stripe-js';
import { getPaymentClient } from '@/lib/payment-client';
import paymentCopy from '@/content/payment';
import { usePaymentLifetime } from '@/hooks/use-payment-lifetime';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, Crown, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/context/SubscriptionContext';
import { PlanCard } from '@/components/subscription/PlanCard';
import { SubscriptionCheckout } from '@/components/subscription/SubscriptionCheckout';
import { PLAN_DISPLAY, PlanId, subscriptionApi } from '@/lib/subscription';


export default function Subscription() {
    const [stripe, setStripe] = useState<Stripe | null>(null);
    const { subscription, isLoading, refresh, isSubscribed, planName } = useSubscription();
    const { toast } = useToast();
    const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
    const [cancelLoading, setCancelLoading] = useState(false);
    const [portalLoading, setPortalLoading] = useState(false);
    const [selectionLoading, setSelectionLoading] = useState(false);
    const selecting = useRef<AbortSignal | null>(null);
    const managing = useRef<AbortSignal | null>(null);
    const lifetime = usePaymentLifetime();
    const { key } = useLocation();
    useLayoutEffect(() => {
        const signal = lifetime.current.signal;
        const reset = () => {
            selecting.current = null;
            managing.current = null;
            setCancelLoading(false);
            setPortalLoading(false);
            setSelectionLoading(false);
            setSelectedPlan(null);
            setStripe(null);
        };
        signal.addEventListener('abort', reset, { once: true });
        return () => signal.removeEventListener('abort', reset);
    }, [key, lifetime]);

    const handleSelectPlan = async (planId: string) => {
        const signal = lifetime.current.signal;
        if (selecting.current || managing.current || selectedPlan || signal.aborted) return;
        if (planId === 'free') { setSelectedPlan('free'); return; }
        selecting.current = signal;
        setSelectionLoading(true);
        try {
            const client = await getPaymentClient();
            if (signal.aborted) return;
            if (!client) throw new Error('PAYMENT_SERVICE_UNAVAILABLE');
            setStripe(client);
            setSelectedPlan(planId as PlanId);
        } catch {
            if (!signal.aborted) toast({ title: paymentCopy.unavailableTitle, variant: 'destructive' });
        } finally {
            if (selecting.current === signal) selecting.current = null;
            if (!signal.aborted) setSelectionLoading(false);
        }
    };

    const handleCancel = async () => {
        const signal = lifetime.current.signal;
        if (signal.aborted || managing.current || selecting.current || selectedPlan) return;
        if (!confirm(paymentCopy.cancellationConfirmation)) return;
        managing.current = signal;
        setCancelLoading(true);
        try {
            const result = await subscriptionApi.cancel(paymentCopy.cancellationReason);
            if (signal.aborted) return;
            const accessUntil = typeof result.accessUntil === 'string' ? new Date(result.accessUntil) : null;
            if (!accessUntil || !Number.isFinite(accessUntil.getTime())) throw new Error('INVALID_CANCELLATION_RESPONSE');
            const refreshed = await refresh(signal);
            if (!refreshed) throw new Error('SUBSCRIPTION_REFRESH_UNCONFIRMED');
            if (signal.aborted) return;
            toast({
                title: paymentCopy.cancellationScheduledTitle,
                description: paymentCopy.cancellationScheduledTemplate.replace('{date}', accessUntil.toLocaleDateString()),
            });
        } catch {
            if (!signal.aborted) toast({ title: paymentCopy.cancellationUnconfirmedTitle,
                description: paymentCopy.cancellationUnconfirmedDescription, variant: 'destructive' });
        } finally {
            if (managing.current === signal) managing.current = null;
            if (!signal.aborted) setCancelLoading(false);
        }
    };

    const handleManageBilling = async () => {
        const signal = lifetime.current.signal;
        if (signal.aborted || managing.current || selecting.current || selectedPlan) return;
        managing.current = signal;
        setPortalLoading(true);
        try {
            const { url } = await subscriptionApi.getPortalUrl();
            if (signal.aborted) return;
            const destination = new URL(url);
            if (destination.protocol !== 'https:' || destination.username || destination.password) throw new Error('INVALID_PORTAL_RESPONSE');
            window.open(destination.href, '_blank', 'noopener,noreferrer');
        } catch {
            if (!signal.aborted) toast({ title: paymentCopy.portalUnavailableTitle,
                description: paymentCopy.portalUnavailableDescription, variant: 'destructive' });
        } finally {
            if (managing.current === signal) managing.current = null;
            if (!signal.aborted) setPortalLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
            {/* Header */}
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-display font-bold text-foreground">
                    Choose Your Plan
                </h1>
                <p className="text-muted-foreground max-w-lg mx-auto">
                    Save on every doctor visit with MediConnect subscription plans.
                    Cancel anytime. No hidden fees.
                </p>
            </div>

            {/* Current plan banner */}
            {isSubscribed && (
                <Card className="rounded-2xl border-primary/30 bg-primary/5">
                    <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <Crown className="h-5 w-5 text-primary" />
                            <div>
                                <p className="font-display font-semibold text-foreground">
                                    {planName}
                                    <Badge className="ml-2 bg-primary/10 text-primary rounded-lg text-xs">Active</Badge>
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {subscription?.discountPercent}% discount on all visits
                                    {subscription?.cancelAtPeriodEnd && (
                                        <span className="text-amber-600 ml-2">
                                            <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
                                            Cancels on {new Date(subscription.cycleEnd).toLocaleDateString()}
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button
                                variant="outline"
                                size="sm"
                                className="rounded-xl flex-1 sm:flex-none"
                                onClick={handleManageBilling}
                                disabled={portalLoading || cancelLoading || selectionLoading || selectedPlan !== null}
                            >
                                {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-1.5" />}
                                Manage Billing
                            </Button>
                            {!subscription?.cancelAtPeriodEnd && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-xl text-muted-foreground flex-1 sm:flex-none"
                                    onClick={handleCancel}
                                    disabled={cancelLoading || portalLoading || selectionLoading || selectedPlan !== null}
                                >
                                    {cancelLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cancel Plan'}
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Plan cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {PLAN_DISPLAY.map((plan) => (
                    <PlanCard
                        key={plan.id}
                        plan={plan}
                        currentPlanId={subscription?.planId}
                        onSelect={handleSelectPlan}
                        isLoading={selectionLoading || cancelLoading || portalLoading || selectedPlan !== null}
                    />
                ))}
            </div>

            {selectionLoading && <p role="status" className="text-center text-muted-foreground">{paymentCopy.loadingTitle}</p>}

            {/* Bottom info */}
            <div className="text-center text-xs text-muted-foreground space-y-1 max-w-lg mx-auto">
                <p>{paymentCopy.readinessDisclosure}</p>
                <p>Subscription renews automatically. Cancel anytime from Settings or Manage Billing.</p>
                <p>Prices shown in USD. Actual charge may include applicable taxes.</p>
            </div>

            {/* Checkout dialog — wrapped in Stripe Elements */}
            {selectedPlan && selectedPlan !== 'free' && (
                <Elements stripe={stripe}>
                    <SubscriptionCheckout
                        planId={selectedPlan}
                        isOpen={true}
                        onClose={() => setSelectedPlan(null)}
                    />
                </Elements>
            )}
        </div>
    );
}
