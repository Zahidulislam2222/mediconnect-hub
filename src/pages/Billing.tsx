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
    AlertCircle
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

// --- STRIPE IMPORTS ---
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

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

    // --- 1. INSTANT STATE (Reads Cache First) ---
    // This makes the page load instantly (0ms)
    const [userProfile, setUserProfile] = useState(() => {
        const stored = localStorage.getItem('user');
        return stored ? JSON.parse(stored) : { name: "Patient", avatar: "", id: "" };
    });

    // We only show spinners for the specific cards that need fresh data
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

    // --- MAIN DATA FETCH (Background Fix) ---
    useEffect(() => {
        async function loadFreshData() {
            try {
                // 1. Get Secure Token
                const token = await getAuthToken();

                // 2. Get User ID from Cognito
                const attributes = await fetchUserAttributes();
                const userId = attributes.sub;

                // 3. Parallel Fetch (Fastest)
                const [profileRes, billingRes] = await Promise.allSettled([
                    fetch(`${API_BASE_URL}/register-patient?id=${userId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }),
                    fetch(`${API_BASE_URL}/billing?patientId=${userId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                ]);

                // 4. SELF-CORRECTION LOGIC (Update Name/Avatar)
                if (profileRes.status === "fulfilled" && profileRes.value.ok) {
                    const profileJson = await profileRes.value.json();

                    const freshProfile = {
                        name: profileJson.name || attributes.name || "Patient",
                        avatar: profileJson.avatar || "",
                        id: userId
                    };

                    // Update State (Fixes UI)
                    setUserProfile(freshProfile);

                    // Update Cache (Fixes next load)
                    const currentLocal = JSON.parse(localStorage.getItem('user') || '{}');
                    localStorage.setItem('user', JSON.stringify({ ...currentLocal, ...freshProfile }));
                }

                // 5. Update Billing Data
                if (billingRes.status === "fulfilled" && billingRes.value.ok) {
                    const billingJson = await billingRes.value.json();
                    setBillingData(billingJson);
                }

            } catch (e) {
                console.error("Background Fetch Error", e);
            } finally {
                // Stop the specific spinners inside the cards
                setLoadingBilling(false);
            }
        }
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

    const handlePayBill = async () => {
        setProcessingPayment(true);
        try {
            // Simulate Payment (Replace with real /pay-bill)
            await new Promise(r => setTimeout(r, 1500));
            toast({
                title: "Payment Initiated",
                description: "Redirecting to secure payment gateway...",
            });
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: "Payment initialization failed." });
        } finally {
            setProcessingPayment(false);
        }
    };

    // --- RENDER (INSTANT LAYOUT) ---
    return (
        <DashboardLayout
            title="Billing & Insurance"
            subtitle="Manage your payments and coverage details"
            userRole="patient"
            userName={userProfile.name} // Might show ID for 0.5s, then fixes to Name
            userAvatar={userProfile.avatar}
            onLogout={handleLogout}
        >
            <div className="space-y-6 animate-fade-in">

                {/* SUMMARY CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* BALANCE CARD (Has its own spinner) */}
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
                                    <p className="text-muted-foreground text-sm mb-4">
                                        {billingData?.outstandingBalance > 0
                                            ? "Due immediately. Secure payment processing via Stripe."
                                            : "You are all caught up! No payment due."}
                                    </p>
                                    <Button
                                        className="w-full bg-primary hover:bg-primary/90"
                                        disabled={!billingData?.outstandingBalance || billingData?.outstandingBalance <= 0 || processingPayment}
                                        onClick={handlePayBill}
                                    >
                                        {processingPayment ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                        {billingData?.outstandingBalance > 0 ? "Pay Now" : "No Balance Due"}
                                    </Button>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* INSURANCE CARD (Has its own spinner) */}
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
                                            <span>Copay Amount:</span>
                                            <span className="font-medium text-foreground">$20.00</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Policy Renewal:</span>
                                            <span className="font-medium text-foreground">Dec 31, 2026</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* TRANSACTION HISTORY (Has its own spinner) */}
                <Card className="shadow-card border-border/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5" /> Transaction History
                        </CardTitle>
                        <CardDescription>Recent invoices and payments</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loadingBilling ? (
                            <div className="h-24 flex items-center justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" />
                            </div>
                        ) : billingData?.transactions && billingData.transactions.length > 0 ? (
                            <div className="space-y-3">
                                {billingData.transactions.map((tx: any, i: number) => (
                                    <div key={i} className="p-4 border rounded-lg flex items-center justify-between bg-white hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${tx.type === 'PAYMENT' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                                                <FileText className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{tx.description || (tx.type === 'PAYMENT' ? 'Payment Received' : 'Invoice Generated')}</p>
                                                <p className="text-xs text-muted-foreground">{new Date(tx.date || Date.now()).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <span className={`font-bold ${tx.type === 'PAYMENT' ? 'text-green-600' : 'text-orange-600'}`}>
                                            {tx.type === 'PAYMENT' ? '+' : '-'}${Math.abs(tx.amount).toFixed(2)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : billingData?.outstandingBalance > 0 ? (
                            <div className="p-4 border rounded-lg flex items-center justify-between bg-white">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                                        <AlertCircle className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-medium">Pending Balance</p>
                                        <p className="text-xs text-muted-foreground">Consolidated outstanding amount</p>
                                    </div>
                                </div>
                                <span className="font-bold text-orange-600">
                                    -${billingData?.outstandingBalance?.toFixed(2)}
                                </span>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                                <CheckCircle2 className="h-8 w-8 opacity-20" />
                                <p>No recent transactions found.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>
        </DashboardLayout>
    );
}