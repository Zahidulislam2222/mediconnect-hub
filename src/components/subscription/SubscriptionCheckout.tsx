/**
 * SubscriptionCheckout — Stripe payment + GDPR consent
 *
 * PCI-DSS: Card input is Stripe Elements iframe (never touches our DOM)
 * GDPR: Explicit consent checkboxes (not pre-checked)
 * Auto-renewal: Clear disclosure per FTC/EU/California requirements
 */

import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Lock, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { subscriptionApi, PLAN_DISPLAY, PlanId } from '@/lib/subscription';
import { useSubscription } from '@/context/SubscriptionContext';

interface SubscriptionCheckoutProps {
    planId: PlanId;
    isOpen: boolean;
    onClose: () => void;
}

const TERMS_VERSION = '1.0';

export function SubscriptionCheckout({ planId, isOpen, onClose }: SubscriptionCheckoutProps) {
    const stripe = useStripe();
    const elements = useElements();
    const { toast } = useToast();
    const { refresh } = useSubscription();

    const [loading, setLoading] = useState(false);
    const [consentBilling, setConsentBilling] = useState(false);
    const [consentData, setConsentData] = useState(false);
    const [consentRetention, setConsentRetention] = useState(false);

    const plan = PLAN_DISPLAY.find(p => p.id === planId);
    if (!plan) return null;

    const allConsented = consentBilling && consentData;
    const userRegion = localStorage.getItem('userRegion') || 'US';
    const isEU = userRegion === 'EU';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements || !allConsented) return;

        setLoading(true);
        try {
            // Step 1: Create subscription server-side (returns clientSecret)
            const result = await subscriptionApi.create(planId as 'plus' | 'premium', TERMS_VERSION);

            // Step 2: Confirm payment with Stripe Elements
            const cardElement = elements.getElement(CardElement);
            if (!cardElement) throw new Error('Card element not found');

            const { error } = await stripe.confirmCardPayment(result.clientSecret, {
                payment_method: { card: cardElement },
            });

            if (error) {
                toast({
                    title: 'Payment Failed',
                    description: error.message,
                    variant: 'destructive',
                });
                return;
            }

            // Step 3: Success — subscription activates via webhook (loophole #3)
            toast({
                title: 'Subscription Active!',
                description: `Welcome to ${plan.name}. Your ${plan.discountPercent}% discount applies to all visits.`,
            });

            await refresh();
            onClose();
        } catch (err: any) {
            toast({
                title: 'Subscription Failed',
                description: err.message || 'Please try again',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="font-display">Subscribe to {plan.name}</DialogTitle>
                    <DialogDescription>
                        ${plan.price}/month - {plan.discountPercent}% off every visit
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    {/* Stripe Card Element — PCI-DSS compliant iframe */}
                    <div className="border border-border rounded-xl p-3 bg-card">
                        <CardElement options={{
                            style: {
                                base: {
                                    fontSize: '16px',
                                    color: '#1a1a1a',
                                    '::placeholder': { color: '#9ca3af' },
                                },
                            },
                            hidePostalCode: true,
                        }} />
                    </div>

                    {/* GDPR Consent — explicit, not pre-checked */}
                    <div className="space-y-3 text-sm">
                        <label className="flex items-start gap-2 cursor-pointer">
                            <Checkbox
                                checked={consentBilling}
                                onCheckedChange={(v) => setConsentBilling(v === true)}
                                className="mt-0.5"
                            />
                            <span className="text-muted-foreground leading-tight">
                                I agree to the <a href="/terms" className="text-primary underline" target="_blank">Subscription Terms</a> and
                                authorize MediConnect to charge <strong>${plan.price}/month</strong> to my payment method.
                                This is a recurring charge that renews automatically until cancelled.
                                I can cancel at any time from Settings.
                            </span>
                        </label>

                        <label className="flex items-start gap-2 cursor-pointer">
                            <Checkbox
                                checked={consentData}
                                onCheckedChange={(v) => setConsentData(v === true)}
                                className="mt-0.5"
                            />
                            <span className="text-muted-foreground leading-tight">
                                I consent to MediConnect processing my billing data for subscription management,
                                as described in the <a href="/privacy" className="text-primary underline" target="_blank">Privacy Policy</a>.
                            </span>
                        </label>

                        {isEU && (
                            <label className="flex items-start gap-2 cursor-pointer">
                                <Checkbox
                                    checked={consentRetention}
                                    onCheckedChange={(v) => setConsentRetention(v === true)}
                                    className="mt-0.5"
                                />
                                <span className="text-muted-foreground leading-tight">
                                    I understand that my billing data will be retained for 7 years after subscription ends,
                                    as required by tax regulations (GDPR Art 6(1)(c)).
                                </span>
                            </label>
                        )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Shield className="h-3.5 w-3.5" />
                        <span>Card data is processed by Stripe. MediConnect never sees your card number.</span>
                    </div>

                    <Button
                        type="submit"
                        className="w-full rounded-xl bg-accent text-accent-foreground"
                        disabled={loading || !stripe || !allConsented || (isEU && !consentRetention)}
                    >
                        {loading ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                        ) : (
                            <><Lock className="mr-2 h-4 w-4" /> Subscribe - ${plan.price}/month</>
                        )}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
