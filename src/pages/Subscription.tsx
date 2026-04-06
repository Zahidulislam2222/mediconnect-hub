/**
 * Subscription Page — Plan selection and checkout
 *
 * Shows 3 plan cards (Free/Plus/Premium) with Stripe checkout dialog.
 * Includes GDPR consent, auto-renewal disclosure, and subscription management.
 */

import React, { useState } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, Crown, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/context/SubscriptionContext';
import { PlanCard } from '@/components/subscription/PlanCard';
import { SubscriptionCheckout } from '@/components/subscription/SubscriptionCheckout';
import { PLAN_DISPLAY, PlanId, subscriptionApi } from '@/lib/subscription';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

export default function Subscription() {
    const { subscription, isLoading, refresh, isSubscribed, planName } = useSubscription();
    const { toast } = useToast();
    const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
    const [cancelLoading, setCancelLoading] = useState(false);
    const [portalLoading, setPortalLoading] = useState(false);

    const handleSelectPlan = (planId: string) => {
        setSelectedPlan(planId as PlanId);
    };

    const handleCancel = async () => {
        if (!confirm('Your plan will remain active until the end of your billing period. No refund for the remaining period. Continue?')) {
            return;
        }

        setCancelLoading(true);
        try {
            const result = await subscriptionApi.cancel('User requested cancellation');
            toast({
                title: 'Cancellation Scheduled',
                description: `Your ${planName} plan will end on ${new Date(result.accessUntil).toLocaleDateString()}`,
            });
            await refresh();
        } catch (err: any) {
            toast({ title: 'Cancel Failed', description: err.message, variant: 'destructive' });
        } finally {
            setCancelLoading(false);
        }
    };

    const handleManageBilling = async () => {
        setPortalLoading(true);
        try {
            const { url } = await subscriptionApi.getPortalUrl();
            window.open(url, '_blank');
        } catch (err: any) {
            toast({ title: 'Portal Error', description: err.message, variant: 'destructive' });
        } finally {
            setPortalLoading(false);
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
                                disabled={portalLoading}
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
                                    disabled={cancelLoading}
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
                        isLoading={isLoading}
                    />
                ))}
            </div>

            {/* Bottom info */}
            <div className="text-center text-xs text-muted-foreground space-y-1 max-w-lg mx-auto">
                <p>All plans include HIPAA-compliant video consultations and FHIR health records.</p>
                <p>Subscription renews automatically. Cancel anytime from Settings or Manage Billing.</p>
                <p>Prices shown in USD. Actual charge may include applicable taxes.</p>
            </div>

            {/* Checkout dialog — wrapped in Stripe Elements */}
            {selectedPlan && selectedPlan !== 'free' && (
                <Elements stripe={stripePromise}>
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
