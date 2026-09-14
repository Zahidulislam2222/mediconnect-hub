import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fetchUserAttributes, fetchAuthSession, signOut } from 'aws-amplify/auth';
import {
    CreditCard,
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
import { cn } from "@/lib/utils";

import { useCheckout } from "@/context/CheckoutContext";
import { api } from "@/lib/api";
import { usePaymentLifetime } from "@/hooks/use-payment-lifetime";
import paymentCopy from "@/content/payment";
import { getUser, setUser as setStoredUser, clearAllSensitive } from "@/lib/secure-storage";

export default function Billing() {
    return <BillingContent />;
}

function BillingContent() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { requestPayment } = useCheckout();
    const lifetime = usePaymentLifetime();
    const paying = useRef(false);

    // --- STATE ---
    const [userProfile, setUserProfile] = useState(() => {
        // ─── SECURE STORAGE FIX ───
        // ORIGINAL: const stored = localStorage.getItem('user'); return stored ? JSON.parse(stored) : ...
        const stored = getUser();
        return stored || { name: "Patient", avatar: "", id: "" };
    });

    const [loadingBilling, setLoadingBilling] = useState(true);
    const [billingData, setBillingData] = useState<any>(null);
    const [processingPayment, setProcessingPayment] = useState(false);

    const [lastEvaluatedKey, setLastEvaluatedKey] = useState<any>(null);
    const [loadingMore, setLoadingMore] = useState(false);

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
        const signal = lifetime.current.signal;
        if (signal.aborted) return;
        try {
            setLoadingBilling(true);
            const token = await getAuthToken();
            const attributes = await fetchUserAttributes();
            const userId = attributes.sub;

            // 🟢 PARALLEL FETCH (Optimized)
            const [profileRes, billingRes] = await Promise.allSettled([
                // 1. FIXED ROUTE: Use the RESTful endpoint we verified in patient.controller.ts
                api.get(`/patients/${userId}`),
                // 2. BILLING: Fetch transaction history
                api.get(`/billing?patientId=${userId}`)
            ]);

            if (signal.aborted) return;

            // 1. Update Profile (if needed)
            if (profileRes.status === "fulfilled") {
                const profileJson: any = profileRes.value;
                // DynamoDB often returns the Item directly or wrapped
                const p = profileJson.Item || profileJson;
                
                const freshProfile = {
                    name: p.name || attributes.name || "Patient",
                    avatar: p.avatar || "",
                    id: userId
                };
                setUserProfile(freshProfile);
                
                // Sync to local storage for persistence
                // ─── SECURE STORAGE FIX ───
                // ORIGINAL: const currentLocal = JSON.parse(localStorage.getItem('user') || '{}');
                // ORIGINAL: localStorage.setItem('user', JSON.stringify({ ...currentLocal, ...freshProfile }));
                const currentLocal = getUser() || {};
                setStoredUser({ ...currentLocal, ...freshProfile });
            }

            // 2. Update Billing Data
            if (billingRes.status === "fulfilled") {
    const billingJson: any = billingRes.value;
    setBillingData(billingJson);
    setLastEvaluatedKey(billingJson.lastEvaluatedKey || null); 
} else {
                console.error("Billing fetch failed");
            }

        } catch (e: any) {
    if (signal.aborted) return;
    const msg = e?.message || String(e);
    // Logic: Only logout if user is actually deleted/banned
    if (msg.includes('401')) {
    // ─── SECURE STORAGE FIX ───
    // ORIGINAL: localStorage.clear();
    clearAllSensitive();
    navigate("/auth");
} else {

    toast({ variant: "destructive", title: "Error", description: msg });
}
} finally {
    if (!signal.aborted) setLoadingBilling(false);
}
    }

    // Initial Load
    useEffect(() => {
        loadFreshData();
    }, []);

    // --- HANDLERS ---
    const handleLogout = async () => {
        lifetime.current.abort();
        clearAllSensitive();
        try {
            await signOut();
            // ─── SECURE STORAGE FIX ───
            // ORIGINAL: localStorage.clear();
            clearAllSensitive();
            navigate("/auth");
        } catch (error) {
            navigate("/auth", { replace: true });
        }
    };

    // 🟢 PROFESSIONAL PAYMENT HANDLER (FIFO Strategy)
    const handlePayBill = async () => {
        const signal = lifetime.current.signal;
        if (!billingData?.transactions || paying.current || signal.aborted) return;

        // 1. Find the Oldest Unpaid Bill (FIFO)
        // This ensures patients pay off old debt before new debt
        const billToPay = [...billingData.transactions]
            .reverse() // Oldest first
            .find((tx: any) => tx.status === 'PENDING' || tx.status === 'DUE' || tx.status === 'UNPAID');

        if (!billToPay || !billToPay.billId) {
            toast({ title: "No Pending Bills", description: "You are all caught up!" });
            return;
        }

        paying.current = true;
        setProcessingPayment(true);

        try {
            // STEP A: Get Payment Method via Modal
            const paymentMethod = await requestPayment({
                amount: billToPay.amount || billToPay.totalAmount || 0,
                title: "Pay Bill",
                description: `Invoice #${billToPay.billId.slice(0, 8)}`
            });

            if (signal.aborted) return;

            // STEP B: Create Payment Intent on Backend (Zero-Trust)
            // We send the Payment Method ID so backend can confirm it securely
            const paymentIntent: any = await api.post('/billing/pay', {
                billId: billToPay.billId,
                patientId: userProfile.id,
                paymentMethodId: paymentMethod.id // 🟢 CRITICAL: Pass the ID to controller
            });

            if (signal.aborted) return;
            // HTTP success acknowledges processing; only an explicit status proves settlement.
            const status = paymentIntent?.status;
            if (status === 'succeeded') {
                toast({ title: paymentCopy.succeededTitle, description: paymentCopy.succeededDescription });
            } else if (status === 'processing' || status === 'requires_capture') {
                toast({ title: paymentCopy.processingTitle, description: paymentCopy.processingDescription });
            } else if (status === 'requires_action' || status === 'requires_confirmation') {
                toast({ title: paymentCopy.actionTitle, description: paymentCopy.actionDescription });
            } else if (status === 'requires_payment_method' || status === 'canceled') {
                toast({ title: paymentCopy.failedTitle, description: paymentCopy.failedDescription, variant: 'destructive' });
            } else {
                toast({ title: paymentCopy.unknownTitle, description: paymentCopy.unknownDescription, variant: 'destructive' });
            }
            await loadFreshData();

        } catch (e: any) {
            if (signal.aborted || e.message === "PAYMENT_UI_CLOSED") return;
            if (e.message !== "User cancelled payment") {
                toast({
                    variant: "destructive",
                    title: e.code === "OUTCOME_UNKNOWN" ? paymentCopy.unknownTitle : paymentCopy.failedTitle,
                    description: e.code === "OUTCOME_UNKNOWN" ? paymentCopy.unknownDescription : paymentCopy.failedDescription
                });
            }
        } finally {
            paying.current = false;
            if (!signal.aborted) setProcessingPayment(false);
        }
    };

    const handleLoadMore = async () => {
    if (!lastEvaluatedKey) return;
    try {
        setLoadingMore(true);
        const keyParam = encodeURIComponent(JSON.stringify(lastEvaluatedKey));
        const res: any = await api.get(`/billing?patientId=${userProfile.id}&startKey=${keyParam}`);
        
        setBillingData((prev: any) => ({
            ...prev,
            transactions: [...prev.transactions, ...(res.transactions || [])]
        }));
        setLastEvaluatedKey(res.lastEvaluatedKey || null);
    } catch (e) {
        toast({ variant: "destructive", title: "Error", description: "Could not load more transactions." });
    } finally {
        setLoadingMore(false);
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
                <div className="grid grid-cols-1 gap-6">

                    {/* BALANCE CARD */}
                    <Card className="shadow-card border-border rounded-2xl overflow-hidden">
                        <CardHeader className="pb-2">
                            <CardTitle className="font-display flex items-center gap-2 text-base">
                                <CreditCard className="h-5 w-5 text-primary" />
                                Outstanding Balance
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loadingBilling ? (
                                <div className="h-28 flex items-center justify-center">
                                    <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/30" />
                                </div>
                            ) : (
                                <>
                                    <div className="font-display text-4xl font-bold mb-1.5 text-foreground">
                                        ${billingData?.outstandingBalance?.toFixed(2) || "0.00"}
                                    </div>
                                    <p className="text-muted-foreground text-sm mb-5">
                                        {billingData?.outstandingBalance > 0
                                            ? "Due immediately. Secure payment processing via Stripe."
                                            : "You are all caught up! No payment due."}
                                    </p>

                                    <Button
                                        className="w-full h-11 rounded-xl bg-accent text-accent-foreground shadow-sm hover:shadow-md transition-all"
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
                </div>

                {/* TRANSACTION HISTORY */}
                <Card className="shadow-card border-border rounded-2xl">
                    <CardHeader>
                        <CardTitle className="font-display flex items-center gap-2 text-base">
                            <Clock className="h-5 w-5 text-muted-foreground" /> Transaction History
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
                                {billingData.transactions
                                    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                    .map((tx: any, i: number) => {
                                        // 🟢 CATEGORY LOGIC
                                        const isRefund = tx.type === 'REFUND' || tx.status === 'REFUNDED' || tx.amount < 0;
                                        const isUnpaid = tx.status === 'PENDING' || tx.status === 'DUE' || tx.status === 'UNPAID';
                                        
                                        return (
                                            <div key={i} className="p-3 sm:p-4 border border-border rounded-2xl flex items-start sm:items-center justify-between gap-3 bg-card hover:bg-secondary/30 transition-colors">
                                                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                                                    <div className={cn(
                                                        "h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center flex-shrink-0",
                                                        isRefund ? "bg-green-500/10 text-green-600" :
                                                            isUnpaid ? "bg-orange-500/10 text-orange-600" : "bg-secondary text-muted-foreground"
                                                    )}>
                                                        {isRefund ? <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5" /> :
                                                            isUnpaid ? <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" /> : <FileText className="h-4 w-4 sm:h-5 sm:w-5" />}
                                                    </div>

                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <p className="font-medium text-foreground text-sm sm:text-base leading-snug">
                                                                {(() => {
                                                                    const desc = tx.description || "";
                                                                    if (desc.includes("User requested cancellation") || tx.amount < 0) {
                                                                        const match = billingData.transactions.find((t: any) =>
                                                                            t.doctorId === tx.doctorId &&
                                                                            t.description?.includes("Consultation with")
                                                                        );
                                                                        const name = match?.description?.split("with ")[1];
                                                                        return name ? `Cancelled Consultation: ${name}` : 'Cancelled Consultation';
                                                                    }
                                                                    if (desc.startsWith("Medication:")) {
                                                                        return desc.replace("Medication:", "Prescription Pharmacy:");
                                                                    }
                                                                    return desc;
                                                                })()}
                                                            </p>
                                                            {isUnpaid && (
                                                                <Badge variant="outline" className="text-[9px] h-5 px-1.5 border-orange-200 text-orange-700 bg-orange-50 rounded-md">
                                                                    Unpaid
                                                                </Badge>
                                                            )}
                                                            {isRefund && (
                                                                <Badge variant="outline" className="text-[9px] h-5 px-1.5 border-green-200 text-green-700 bg-green-50 rounded-md">
                                                                    Refunded
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}
                                                            {' · '}
                                                            <span className="font-mono">{tx.billId ? `#${tx.billId.slice(0, 8)}` : ''}</span>
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="text-right flex-shrink-0">
                                                    <span className={cn(
                                                        "font-bold block text-base sm:text-lg whitespace-nowrap",
                                                        isRefund ? "text-green-600" : "text-foreground"
                                                    )}>
                                                        {isRefund ? '+' : '-'}${Math.abs(tx.amount || tx.totalAmount || 0).toFixed(2)}
                                                    </span>
                                                    {isUnpaid && processingPayment && (
                                                        <span className="text-[10px] text-muted-foreground flex items-center justify-end gap-1">
                                                            <Loader2 className="h-3 w-3 animate-spin" /> Processing
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {lastEvaluatedKey && (
                                        <Button 
                                            variant="ghost" 
                                            className="w-full mt-4 text-primary hover:bg-primary/5"
                                            onClick={handleLoadMore}
                                            disabled={loadingMore}
                                        >
                                            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Load More Activity"}
                                        </Button>
                                    )}
                            </div>
                        ) : billingData?.outstandingBalance > 0 ? (
                            // Legacy Data Fallback
                            <div className="p-4 border border-border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card">
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
