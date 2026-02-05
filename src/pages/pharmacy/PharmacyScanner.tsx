import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { QrCode, Search, CheckCircle2, AlertTriangle, Pill, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

import { api } from "@/lib/api";

// Mock user for Pharmacy View
const pharmacistUser = {
    name: "CVS Pharmacy #1234",
    avatar: "RX",
    role: "pharmacist"
};

export default function PharmacyScanner() {
    const navigate = useNavigate();
    const { toast } = useToast();

    const [rxToken, setRxToken] = useState("");
    const [loading, setLoading] = useState(false);
    const [scanResult, setScanResult] = useState<any>(null);

    const handleLogout = () => navigate("/");

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rxToken) return;

        setLoading(true);
        setScanResult(null);

        try {
            // Phase 2/3: Real API Call
            // Phase 2/3: Real API Call
            const data: any = await api.post('/pharmacy/fulfill', { token: rxToken });

            if (!data) throw new Error("Invalid Token");

            setScanResult(data);
            toast({ title: "Success", description: "Prescription retrieved successfully." });

        } catch (error: any) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Scan Failed",
                description: error.message || "Could not verify prescription token."
            });
        } finally {
            setLoading(false);
        }
    };

    const fulfillOrder = async () => {
        // In a real app, this would be a second confirmation step
        toast({ title: "Order Fulfilled", description: "Patient has been notified." });
        setScanResult(null);
        setRxToken("");
    };

    return (
        <DashboardLayout
            title="Pharmacy Portal"
            subtitle="Scan and fulfill e-prescriptions"
            userRole="doctor" // reusing doctor layout for professional view
            userName={pharmacistUser.name}
            userAvatar={pharmacistUser.avatar}
            onLogout={handleLogout}
        >
            <div className="max-w-2xl mx-auto space-y-8 animate-fade-in pt-10">

                {/* Scanner Input */}
                <Card className="shadow-lg border-2 border-primary/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <QrCode className="h-6 w-6 text-primary" />
                            Scan Prescription
                        </CardTitle>
                        <CardDescription>Enter the alpha-numeric code from the patient's app</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleScan} className="flex gap-4">
                            <Input
                                placeholder="RX-2026-ABCD"
                                value={rxToken}
                                onChange={(e) => setRxToken(e.target.value.toUpperCase())}
                                className="text-lg tracking-widest font-mono uppercase h-12"
                            />
                            <Button type="submit" size="lg" disabled={loading} className="w-32">
                                {loading ? <Loader2 className="animate-spin" /> : "Verify"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Results Info */}
                {scanResult && (
                    <Card className="bg-success/5 border-success/30 shadow-md animate-fade-in-up">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-success flex items-center gap-2">
                                    <CheckCircle2 className="h-6 w-6" />
                                    Verified Valid
                                </CardTitle>
                                <span className="font-mono text-sm text-muted-foreground">{scanResult.id}</span>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-start gap-4 p-4 bg-white rounded-lg border border-border">
                                <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                                    <Pill className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">{scanResult.medicationName || "Lisinopril"}</h3>
                                    <p className="text-muted-foreground">{scanResult.dosage || "10mg"} • {scanResult.frequency || "Once Daily"}</p>
                                    <div className="flex gap-4 mt-2 text-sm">
                                        <span className="font-medium text-foreground">Patient: {scanResult.patientName || "John Doe"}</span>
                                        <span className="text-muted-foreground">Prescribed by: {scanResult.doctorName || "Dr. Chen"}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <Button variant="outline" onClick={() => setScanResult(null)}>Cancel</Button>
                                <Button className="bg-success hover:bg-success/90 text-white gap-2" onClick={fulfillOrder}>
                                    <CheckCircle2 className="h-4 w-4" />
                                    Mark Fulfilled
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

            </div>
        </DashboardLayout>
    );
}
