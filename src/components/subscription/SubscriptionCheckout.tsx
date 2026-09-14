/**
 * SubscriptionCheckout — Stripe payment + GDPR consent
 *
 * PCI-DSS: Card input is Stripe Elements iframe (never touches our DOM)
 * GDPR: Explicit consent checkboxes (not pre-checked)
 * Auto-renewal: Clear disclosure per FTC/EU/California requirements
 */

import React, { useState, useRef } from 'react';
import { usePaymentLifetime } from '@/hooks/use-payment-lifetime';
import paymentCopy from '@/content/payment';
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

const TERMS_VERSION = paymentCopy.termsVersion;

export function SubscriptionCheckout({ planId, isOpen, onClose }: SubscriptionCheckoutProps) {
    const stripe = useStripe();
    const elements = useElements();
    const { toast } = useToast();
    const { refresh } = useSubscription();

    const [loading, setLoading] = useState(false);
    const submitting = useRef(false);
    const paymentCompleted = useRef(false);
    const [pendingConfirmation, setPendingConfirmation] = useState(false);
    const lifetime = usePaymentLifetime();
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
        const signal = lifetime.current.signal;
        if (!stripe || !elements || !allConsented || submitting.current || paymentCompleted.current || signal.aborted || (isEU && !consentRetention)) return;
        submitting.current = true;

        setLoading(true);
        try {
            // Step 1: Create subscription server-side (returns clientSecret)
            const result = await subscriptionApi.create(planId as 'plus' | 'premium', TERMS_VERSION);
            if (signal.aborted) return;

            // Step 2: Confirm payment with Stripe Elements
            const cardElement = elements.getElement(CardElement);
            if (!cardElement) throw new Error('Card element not found');

            const { error, paymentIntent } = await stripe.confirmCardPayment(result.clientSecret, {
                payment_method: { card: cardElement },
            });

            if (signal.aborted) return;
            if (error) {
                toast({
                    title: 'Payment Failed',
                    description: error.message,
                    variant: 'destructive',
                });
                return;
            }

            if (paymentIntent?.status !== 'succeeded') {
                toast({ title: paymentCopy.subscriptionPendingTitle, description: paymentCopy.subscriptionPendingDescription });
                return;
            }
            paymentCompleted.current = true;
            setPendingConfirmation(true);
            const current = await subscriptionApi.getStatus();
            if (signal.aborted) return;
            const active = current?.status === 'active' && current.planId === planId;
            const refreshed = await refresh(signal);
            if (signal.aborted) return;
            if (!refreshed) {
                toast({ title: paymentCopy.subscriptionPendingTitle, description: paymentCopy.subscriptionPendingDescription });
                return;
            }
            toast({ title: active ? paymentCopy.subscriptionActiveTitle : paymentCopy.subscriptionPendingTitle,
                description: active ? paymentCopy.subscriptionActiveDescription : paymentCopy.subscriptionPendingDescription });
            if (!signal.aborted) onClose();
        } catch (err: any) {
            if (signal.aborted) return;
            toast({
                title: paymentCopy.unknownTitle,
                description: paymentCopy.unknownDescription,
                variant: 'destructive',
            });
        } finally {
            submitting.current = false;
            if (!signal.aborted) setLoading(false);
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
                                I agree to the <a href={paymentCopy.termsPath} className="text-primary underline" target="_blank">Subscription Terms</a> and
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
                                as described in the <a href={paymentCopy.privacyPath} className="text-primary underline" target="_blank">Privacy Policy</a>.
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
                                    {paymentCopy.retentionDisclosure}
                                </span>
                            </label>
                        )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Shield className="h-3.5 w-3.5" />
                        <span>{paymentCopy.cardPrivacy}</span>
                    </div>

                    <Button
                        type="submit"
                        className="w-full rounded-xl bg-accent text-accent-foreground"
                        disabled={loading || pendingConfirmation || !stripe || !allConsented || (isEU && !consentRetention)}
                    >
                        {pendingConfirmation && !loading ? paymentCopy.subscriptionPendingTitle : loading ? (
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
