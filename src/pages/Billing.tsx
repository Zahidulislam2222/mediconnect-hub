import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchUserAttributes, fetchAuthSession, signOut } from 'aws-amplify/auth';
import {
    CreditCard,
    ShieldCheck,
    Clock,
    FileText,
    CheckCircle2,
    Loader2,
    AlertCircle,
    ArrowUpRight
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

// --- STRIPE IMPORTS ---
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Initialize Stripe outside component to avoid recreation
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function Billing() {
    return (
        <Elements stripe={stripePromise}>
            <BillingContent />
        </Elements>
    );
}

function BillingContent() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const stripe = useStripe();
    const elements = useElements();

    // --- STATE ---
    const [userProfile, setUserProfile] = useState(() => {
        const stored = localStorage.getItem('user');
        return stored ? JSON.parse(stored) : { name: "Patient", avatar: "", id: "" };
    });

    const [loadingBilling, setLoadingBilling] = useState(true);
    const [billingData, setBillingData] = useState<any>(null);
    const [processingPayment, setProcessingPayment] = useState(false);

    // --- AUTH HELPER ---
    const getAuthToken = async () => {
        try {
            const session = await fetchAuthSession();
            return session.tokens?.idToken?.toString() || "";
        } catch (e) {
            console.error("Token error", e);
            return "";
        }
    };

    // --- MAIN DATA FETCH ---
    async function loadFreshData() {
        try {
            setLoadingBilling(true);
            const token = await getAuthToken();
            const attributes = await fetchUserAttributes();
            const userId = attributes.sub;

            // Parallel Fetch for Speed
            const [profileRes, billingRes] = await Promise.allSettled([
                fetch(`${API_BASE_URL}/register-patient?id=${userId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${API_BASE_URL}/billing?patientId=${userId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            // 1. Update Profile (if needed)
            if (profileRes.status === "fulfilled" && profileRes.value.ok) {
                const profileJson = await profileRes.value.json();
                const freshProfile = {
                    name: profileJson.name || attributes.name || "Patient",
                    avatar: profileJson.avatar || "",
                    id: userId
                };
                setUserProfile(freshProfile);
                const currentLocal = JSON.parse(localStorage.getItem('user') || '{}');
                localStorage.setItem('user', JSON.stringify({ ...currentLocal, ...freshProfile }));
            }

            // 2. Update Billing Data
            if (billingRes.status === "fulfilled" && billingRes.value.ok) {
                const billingJson = await billingRes.value.json();
                setBillingData(billingJson);
            } else {
                console.error("Billing fetch failed");
            }

        } catch (e) {
            console.error("Background Fetch Error", e);
            toast({ variant: "destructive", title: "Connection Error", description: "Could not load billing details." });
        } finally {
            setLoadingBilling(false);
        }
    }

    // Initial Load
    useEffect(() => {
        loadFreshData();
    }, []);

    // --- HANDLERS ---
    const handleLogout = async () => {
        try {
            await signOut();
            localStorage.clear();
            navigate("/auth");
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    // 🟢 PROFESSIONAL PAYMENT HANDLER
    const handlePayBill = async () => {
        if (!stripe || !elements) return;
        if (!billingData?.transactions) return;

        // 1. Find the Oldest Unpaid Bill (FIFO Strategy)
        // We look for status 'PENDING' or 'DUE'
        const billToPay = [...billingData.transactions]
            .reverse() // Oldest first
            .find((tx: any) => tx.status === 'PENDING' || tx.status === 'DUE');

        if (!billToPay || !billToPay.billId) {
            toast({ title: "No Pending Bills", description: "You are all caught up!" });
            return;
        }

        setProcessingPayment(true);

        try {
            const token = await getAuthToken();

            // 2. Step 1: Create Payment Intent on Backend
            // We send the billId. The backend looks up the price securely.
            const response = await fetch(`${API_BASE_URL}/pay-bill`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    billId: billToPay.billId, // Secure Reference
                    patientId: userProfile.id
                })
            });

            if (!response.ok) throw new Error("Failed to initiate payment");

            const paymentIntent = await response.json();
            const clientSecret = paymentIntent.client_secret;

            // 3. Step 2: Confirm Card Payment with Stripe
            const result = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: elements.getElement(CardElement)!,
                    billing_details: {
                        name: userProfile.name,
                    },
                },
            });

            if (result.error) {
                // Show error to your customer (e.g., insufficient funds)
                throw new Error(result.error.message);
            } else {
                // 4. Step 3: Success!
                if (result.paymentIntent.status === 'succeeded') {
                    toast({
                        title: "Payment Successful",
                        description: `Transaction ${billToPay.billId.slice(0, 8)}... completed.`,
                        className: "bg-green-50 border-green-200 text-green-900"
                    });

                    // 🟢 Auto-Refresh Data to show $0.00 Balance
                    await loadFreshData();
                }
            }

        } catch (e: any) {
            console.error("Payment Error:", e);
            toast({
                variant: "destructive",
                title: "Payment Failed",
                description: e.message || "Please check your card details and try again."
            });
        } finally {
            setProcessingPayment(false);
        }
    };

    // --- RENDER ---
    return (
        <DashboardLayout
            title="Billing & Insurance"
            subtitle="Manage your payments and coverage details"
            userRole="patient"
            userName={userProfile.name}
            userAvatar={userProfile.avatar}
            onLogout={handleLogout}
        >
            <div className="space-y-6 animate-fade-in pb-10">

                {/* SUMMARY CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* BALANCE CARD */}
                    <Card className="shadow-card border-border/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5 text-primary" />
                                Outstanding Balance
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loadingBilling ? (
                                <div className="h-32 flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/30" />
                                </div>
                            ) : (
                                <>
                                    <div className="text-4xl font-bold mb-2">
                                        ${billingData?.outstandingBalance?.toFixed(2) || "0.00"}
                                    </div>
                                    <p className="text-muted-foreground text-sm mb-6">
                                        {billingData?.outstandingBalance > 0
                                            ? "Due immediately. Secure payment processing via Stripe."
                                            : "You are all caught up! No payment due."}
                                    </p>

                                    {/* STRIPE ELEMENT */}
                                    {billingData?.outstandingBalance > 0 && (
                                        <div className="mb-4 p-3 border rounded-md bg-slate-50">
                                            <CardElement options={{
                                                style: {
                                                    base: {
                                                        fontSize: '16px',
                                                        color: '#424770',
                                                        '::placeholder': {
                                                            color: '#aab7c4',
                                                        },
                                                    },
                                                    invalid: {
                                                        color: '#9e2146',
                                                    },
                                                },
                                            }} />
                                        </div>
                                    )}

                                    <Button
                                        className="w-full bg-primary hover:bg-primary/90 transition-all"
                                        disabled={!billingData?.outstandingBalance || billingData?.outstandingBalance <= 0 || processingPayment}
                                        onClick={handlePayBill}
                                    >
                                        {processingPayment ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                Processing...
                                            </>
                                        ) : billingData?.outstandingBalance > 0 ? (
                                            "Pay Outstanding Balance"
                                        ) : (
                                            "No Balance Due"
                                        )}
                                    </Button>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* INSURANCE CARD */}
                    <Card className="shadow-card border-border/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-green-600" />
                                Insurance Coverage
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loadingBilling ? (
                                <div className="h-32 flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/30" />
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-4 p-3 bg-green-50 rounded-lg border border-green-100">
                                        <div>
                                            <p className="font-semibold text-green-900">
                                                {billingData?.insuranceProvider || "No Provider"}
                                            </p>
                                            <Badge variant="outline" className="mt-1 border-green-200 text-green-700 bg-green-100">
                                                {billingData?.insuranceStatus || "Active"}
                                            </Badge>
                                        </div>
                                        <CheckCircle2 className="h-6 w-6 text-green-600" />
                                    </div>
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <div className="flex justify-between">
                                            <span>Standard Copay:</span>
                                            <span className="font-medium text-foreground">$20.00</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Policy Renewal:</span>
                                            <span className="font-medium text-foreground">Dec 31, 2026</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Deductible Met:</span>
                                            <span className="font-medium text-foreground">85%</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* TRANSACTION HISTORY */}
                <Card className="shadow-card border-border/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5" /> Transaction History
                        </CardTitle>
                        <CardDescription>Recent invoices, payments, and insurance adjustments</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loadingBilling ? (
                            <div className="h-24 flex items-center justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" />
                            </div>
                        ) : billingData?.transactions && billingData.transactions.length > 0 ? (
                            <div className="space-y-3">
                                {billingData.transactions.map((tx: any, i: number) => {
                                    const isPaid = tx.status === 'PAID' || tx.type === 'PAYMENT';
                                    const isPending = tx.status === 'PENDING' || tx.status === 'DUE';

                                    return (
                                        <div key={i} className="p-4 border rounded-lg flex items-center justify-between bg-white hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isPaid ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                                                    }`}>
                                                    {isPaid ? <CheckCircle2 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium">
                                                            {tx.description || (isPaid ? 'Payment Received' : 'Consultation Fee')}
                                                        </p>
                                                        {isPending && (
                                                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-orange-200 text-orange-700 bg-orange-50">
                                                                Unpaid
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}
                                                        {' • '}
                                                        <span className="font-mono">{tx.billId ? `#${tx.billId.slice(0, 8)}` : ''}</span>
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <span className={`font-bold block ${isPaid ? 'text-green-600' : 'text-foreground'
                                                    }`}>
                                                    {isPaid ? '-' : ''}${Math.abs(tx.amount || tx.totalAmount || 0).toFixed(2)}
                                                </span>
                                                {/* If it's the specific unpaid bill being processed, show spinner */}
                                                {isPending && processingPayment && (
                                                    <span className="text-[10px] text-muted-foreground flex items-center justify-end gap-1">
                                                        <Loader2 className="h-3 w-3 animate-spin" /> Processing
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : billingData?.outstandingBalance > 0 ? (
                            // Fallback if balance exists but no transaction records (legacy data)
                            <div className="p-4 border rounded-lg flex items-center justify-between bg-white">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                                        <AlertCircle className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-medium">Consolidated Balance</p>
                                        <p className="text-xs text-muted-foreground">Outstanding amount from previous visits</p>
                                    </div>
                                </div>
                                <span className="font-bold text-orange-600">
                                    ${billingData?.outstandingBalance?.toFixed(2)}
                                </span>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-3">
                                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                                    <ArrowUpRight className="h-6 w-6 opacity-30" />
                                </div>
                                <p>No transactions found.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>
        </DashboardLayout>
    );
}