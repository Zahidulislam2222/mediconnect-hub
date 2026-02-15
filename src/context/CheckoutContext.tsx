import React, { createContext, useContext, useState, ReactNode, useMemo } from "react";
import { loadStripe, Stripe, PaymentMethod } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// 1. Initialize Stripe

interface PaymentRequestProps {
    amount: number;
    title: string;
    description: string;
}

interface CheckoutContextType {
    requestPayment: (props: PaymentRequestProps) => Promise<PaymentMethod>;
    stripe: Stripe | null;
}

const CheckoutContext = createContext<CheckoutContextType | null>(null);

export const useCheckout = () => {
    const context = useContext(CheckoutContext);
    if (!context) throw new Error("useCheckout must be used within a CheckoutProvider");
    return context;
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements) return;

        setLoading(true);

        try {
            const cardElement = elements.getElement(CardElement);
            if (!cardElement) throw new Error("Card element not found");

            const { error, paymentMethod } = await stripe.createPaymentMethod({
                type: 'card',
                card: cardElement,
            });

            if (error) {
                throw new Error(error.message);
            }

            if (paymentMethod) {
                onConfirm(paymentMethod);
            }
        } catch (err: any) {
            console.error("Payment Method Creation Failed:", err);
            toast({
                variant: "destructive",
                title: "Payment Error",
                description: err.message || "Could not process card details."
            });
        } finally {
            setLoading(false);
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
                            <span className="text-sm text-slate-500 font-medium">Total Amount</span>
                            <span className="text-2xl font-bold text-slate-800">${details.amount.toFixed(2)}</span>
                        </div>

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
                                    <Lock className="w-4 h-4 mr-2" /> Pay ${details.amount.toFixed(2)}
                                </>
                            )}
                        </Button>
                        <p className="text-xs text-center text-slate-400 flex items-center justify-center gap-1">
                            <Lock className="w-3 h-3" /> Secure 256-bit SSL Encrypted Payment
                        </p>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export const CheckoutProvider = ({ children }: { children: ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [paymentDetails, setPaymentDetails] = useState<PaymentRequestProps>({ amount: 0, title: "", description: "" });
    const [promiseCallbacks, setPromiseCallbacks] = useState<{
        resolve: (value: PaymentMethod) => void;
        reject: (reason?: any) => void;
    } | null>(null);

    // 🟢 ARCHITECTURE #2 FIX: Load Stripe only when this provider is actually used
    const stripePromise = useMemo(() => {
        console.log("💳 Stripe Initialized for Secure Session");
        return loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
    }, []);

    const requestPayment = (props: PaymentRequestProps): Promise<PaymentMethod> => {
        setPaymentDetails(props);
        setIsOpen(true);
        return new Promise((resolve, reject) => {
            setPromiseCallbacks({ resolve, reject });
        });
    };

    const handleClose = () => {
        setIsOpen(false);
        if (promiseCallbacks) {
            promiseCallbacks.reject(new Error("User cancelled payment"));
            setPromiseCallbacks(null);
        }
    };

    const handleConfirm = (pm: PaymentMethod) => {
        setIsOpen(false);
        if (promiseCallbacks) {
            promiseCallbacks.resolve(pm);
            setPromiseCallbacks(null);
        }
    };

    return (
        <Elements stripe={stripePromise}>
            <CheckoutContextWrapper
                requestPayment={requestPayment}
                modalProps={{
                    isOpen,
                    onClose: handleClose,
                    details: paymentDetails,
                    onConfirm: handleConfirm
                }}
            >
                {children}
            </CheckoutContextWrapper>
        </Elements>
    );
};

// Wrapper needed to access useStripe context from within the provider
const CheckoutContextWrapper = ({
    children,
    requestPayment,
    modalProps
}: {
    children: ReactNode,
    requestPayment: (props: PaymentRequestProps) => Promise<PaymentMethod>,
    modalProps: any
}) => {
    const stripe = useStripe();

    return (
        <CheckoutContext.Provider value={{ requestPayment, stripe }}>
            {children}
            <CheckoutModal {...modalProps} />
        </CheckoutContext.Provider>
    );
};
