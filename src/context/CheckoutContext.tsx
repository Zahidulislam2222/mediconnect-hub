import paymentCopy from "@/content/payment";
import React, { createContext, useContext, useState, ReactNode, useRef, useEffect } from "react";
import type { Stripe, PaymentMethod } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getPaymentClient } from "@/lib/payment-client";
import { usePaymentLifetime } from "@/hooks/use-payment-lifetime";

// 1. Initialize Stripe

interface PaymentRequestProps {
    amount: number;
    title: string;
    description: string;
    presentation?: { amount: string; label: string; disclosure: string; confirmLabel: string };
}

interface CheckoutContextType {
    requestPayment: (props: PaymentRequestProps, signal: AbortSignal) => Promise<PaymentMethod>;
    stripe: Stripe | null;
}

const CheckoutContext = createContext<CheckoutContextType | null>(null);

export const useCheckout = () => {
    const context = useContext(CheckoutContext);
    const lifetime = usePaymentLifetime();
    if (!context) throw new Error("useCheckout must be used within a CheckoutProvider");
    return {
        stripe: context.stripe,
        requestPayment: (props: PaymentRequestProps) => context.requestPayment(props, lifetime.current.signal),
    };
};

// Internal component to handle the actual Stripe logic/hooks
const CheckoutModal = ({
    isOpen,
    onClose,
    details,
    onConfirm
}: {
    isOpen: boolean;
    onClose: () => void;
    details: PaymentRequestProps;
    onConfirm: (pm: PaymentMethod) => void;
}) => {
    const stripe = useStripe();
    const elements = useElements();
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const mounted = useRef(true);
    const submitting = useRef(false);
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements || submitting.current) return;
        submitting.current = true;

        setLoading(true);

        try {
            const cardElement = elements.getElement(CardElement);
            if (!cardElement) throw new Error("Card element not found");

            const { error, paymentMethod } = await stripe.createPaymentMethod({
                type: 'card',
                card: cardElement,
            });

            if (!mounted.current) return;
            if (error) {
                throw new Error(error.message);
            }

            if (paymentMethod) {
                onConfirm(paymentMethod);
            }
        } catch (err: any) {
            if (!mounted.current) return;
            toast({
                variant: "destructive",
                title: "Payment Error",
                description: err.message || "Could not process card details."
            });
        } finally {
            submitting.current = false;
            if (mounted.current) setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !loading) onClose(); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{details.title}</DialogTitle>
                    <DialogDescription>{details.description}</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                            <span className="text-sm text-slate-500 font-medium">{details.presentation?.label ?? paymentCopy.totalAmount}</span>
                            <span className="text-2xl font-bold text-slate-800">{details.presentation?.amount ?? `$${details.amount.toFixed(2)}`}</span>
                        </div>
                        {details.presentation && <p className="text-sm text-muted-foreground">{details.presentation.disclosure}</p>}

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                <CreditCard className="w-3 h-3" /> Card Information
                            </label>
                            <div className="p-3 bg-white border rounded-md shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                                <CardElement options={{
                                    style: {
                                        base: {
                                            fontSize: '16px',
                                            color: '#424770',
                                            '::placeholder': { color: '#aab7c4' },
                                        },
                                        invalid: { color: '#9e2146' },
                                    },
                                }} />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <Button type="submit" className="w-full h-11 text-base shadow-lg hover:shadow-xl transition-all" disabled={loading || !stripe}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                                </>
                            ) : (
                                <>
                                    <Lock className="w-4 h-4 mr-2" /> {details.presentation?.confirmLabel ?? paymentCopy.payAmountTemplate.replace('{amount}', `$${details.amount.toFixed(2)}`)}
                                </>
                            )}
                        </Button>
                        <p className="text-xs text-center text-slate-400 flex items-center justify-center gap-1">
                            <Lock className="w-3 h-3" /> {paymentCopy.cardPrivacy}
                        </p>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

interface PendingPayment {
    id: number;
    resolve: (value: PaymentMethod) => void;
    reject: (reason: Error) => void;
    signal: AbortSignal;
    detach: () => void;
}

export const CheckoutProvider = ({ children }: { children: ReactNode }) => {
    const [stripe, setStripe] = useState<Stripe | null>(null);
    const [dialog, setDialog] = useState<{ details: PaymentRequestProps; request: PendingPayment } | null>(null);
    const active = useRef<PendingPayment | null>(null);
    const sequence = useRef(0);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            const pending = active.current;
            active.current = null;
            pending?.detach();
            pending?.reject(new Error("PAYMENT_UI_CLOSED"));
        };
    }, []);

    const requestPayment = (details: PaymentRequestProps, signal: AbortSignal): Promise<PaymentMethod> => {
        if (signal.aborted) return Promise.reject(new Error("PAYMENT_UI_CLOSED"));
        if (active.current || !mounted.current) return Promise.reject(new Error("PAYMENT_UI_UNAVAILABLE"));
        return new Promise<PaymentMethod>((resolve, reject) => {
            const pending: PendingPayment = { id: ++sequence.current, resolve, reject, signal, detach: () => {} };
            const cancel = (error: Error) => {
                if (active.current !== pending) return;
                active.current = null;
                pending.detach();
                if (mounted.current) setDialog(null);
                reject(error);
            };
            const onAbort = () => cancel(new Error("PAYMENT_UI_CLOSED"));
            pending.detach = () => signal.removeEventListener('abort', onAbort);
            signal.addEventListener('abort', onAbort, { once: true });
            active.current = pending;
            Promise.resolve().then(() => active.current === pending ? getPaymentClient() : null).then(client => {
                if (active.current !== pending || signal.aborted || !mounted.current) return;
                if (!client) { cancel(new Error("PAYMENT_SERVICE_UNAVAILABLE")); return; }
                setStripe(client);
                setDialog({ details, request: pending });
            }).catch(() => cancel(new Error("PAYMENT_SERVICE_UNAVAILABLE")));
        });
    };

    const settle = (pending: PendingPayment, method?: PaymentMethod) => {
        if (active.current !== pending || pending.signal.aborted) return;
        active.current = null;
        pending.detach();
        setDialog(null);
        if (method) pending.resolve(method);
        else pending.reject(new Error("User cancelled payment"));
    };

    return (
        <CheckoutContext.Provider value={{ requestPayment, stripe }}>
            {children}
            {dialog && stripe && <Elements key={dialog.request.id} stripe={stripe}>
                <CheckoutModal isOpen={true} details={dialog.details}
                    onClose={() => settle(dialog.request)}
                    onConfirm={method => settle(dialog.request, method)} />
            </Elements>}
        </CheckoutContext.Provider>
    );
};
