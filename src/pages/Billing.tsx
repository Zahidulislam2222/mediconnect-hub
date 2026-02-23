import { useState, useEffect } from "react";
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

export default function Billing() {
    return <BillingContent />;
}

function BillingContent() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { requestPayment, stripe } = useCheckout();

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

            // 🟢 PARALLEL FETCH (Optimized)
            const [profileRes, billingRes] = await Promise.allSettled([
                // 1. FIXED ROUTE: Use the RESTful endpoint we verified in patient.controller.ts
                api.get(`/patients/${userId}`),
                // 2. BILLING: Fetch transaction history
                api.get(`/billing?patientId=${userId}`)
            ]);

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
                const currentLocal = JSON.parse(localStorage.getItem('user') || '{}');
                localStorage.setItem('user', JSON.stringify({ ...currentLocal, ...freshProfile }));
            }

            // 2. Update Billing Data
            if (billingRes.status === "fulfilled") {
                const billingJson: any = billingRes.value;
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

    // 🟢 PROFESSIONAL PAYMENT HANDLER (FIFO Strategy)
    const handlePayBill = async () => {
        if (!stripe) return;
        if (!billingData?.transactions) return;

        // 1. Find the Oldest Unpaid Bill (FIFO)
        // This ensures patients pay off old debt before new debt
        const billToPay = [...billingData.transactions]
            .reverse() // Oldest first
            .find((tx: any) => tx.status === 'PENDING' || tx.status === 'DUE' || tx.status === 'UNPAID');

        if (!billToPay || !billToPay.billId) {
            toast({ title: "No Pending Bills", description: "You are all caught up!" });
            return;
        }

        setProcessingPayment(true);

        try {
            // STEP A: Get Payment Method via Modal
            const paymentMethod = await requestPayment({
                amount: billToPay.amount || billToPay.totalAmount || 0,
                title: "Pay Bill",
                description: `Invoice #${billToPay.billId.slice(0, 8)}`
            });

            // STEP B: Create Payment Intent on Backend (Zero-Trust)
            // We send the Payment Method ID so backend can confirm it securely
            const paymentIntent: any = await api.post('/pay-bill', {
                billId: billToPay.billId,
                patientId: userProfile.id,
                paymentMethodId: paymentMethod.id // 🟢 CRITICAL: Pass the ID to controller
            });

            // STEP C: Handle Success
            if (paymentIntent.success || paymentIntent.status === 'succeeded') {
                toast({
                    title: "Payment Successful",
                    description: `Transaction ${billToPay.billId.slice(0, 8)}... completed.`,
                    className: "bg-green-50 border-green-200 text-green-900"
                });

                // 🟢 Auto-Refresh Data to show $0.00 Balance
                await loadFreshData();
            }

        } catch (e: any) {
            if (e.message !== "User cancelled payment") {
                console.error("Payment Error:", e);
                toast({
                    variant: "destructive",
                    title: "Payment Failed",
                    description: e.message || "Please check your card details and try again."
                });
            }
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
                <div className="grid grid-cols-1 gap-6">

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
                                {billingData.transactions
                                    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                    .map((tx: any, i: number) => {
                                        // 🟢 CATEGORY LOGIC
                                        const isRefund = tx.type === 'REFUND' || tx.status === 'REFUNDED' || tx.amount < 0;
                                        const isUnpaid = tx.status === 'PENDING' || tx.status === 'DUE' || tx.status === 'UNPAID';
                                        
                                        return (
                                            <div key={i} className="p-4 border rounded-lg flex items-center justify-between bg-white hover:bg-slate-50 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    {/* ICON LOGIC: Green for refunds, Slate for charges, Orange for unpaid */}
                                                    <div className={cn(
                                                        "h-10 w-10 rounded-full flex items-center justify-center",
                                                        isRefund ? "bg-green-100 text-green-600" :
                                                            isUnpaid ? "bg-orange-100 text-orange-600" : "bg-slate-100 text-slate-600"
                                                    )}>
                                                        {isRefund ? <ArrowUpRight className="h-5 w-5" /> :
                                                            isUnpaid ? <AlertCircle className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                                                    </div>

                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-medium text-slate-900">
                                                                {(() => {
                                                                    const desc = tx.description || "";

                                                                    // 🟢 REFUND DETECTION
                                                                    if (desc.includes("User requested cancellation") || tx.amount < 0) {
                                                                        // Try to find the original consultation name
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
                                                                <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-orange-200 text-orange-700 bg-orange-50">
                                                                    Unpaid
                                                                </Badge>
                                                            )}
                                                            {isRefund && (
                                                                <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-green-200 text-green-700 bg-green-50">
                                                                    Refunded
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
                                                    {/* AMOUNT LOGIC: Green (+) for refunds, Neutral/Black (-) for charges */}
                                                    <span className={cn(
                                                        "font-bold block text-lg",
                                                        isRefund ? "text-green-600" : "text-slate-900"
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
                            </div>
                        ) : billingData?.outstandingBalance > 0 ? (
                            // Legacy Data Fallback
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