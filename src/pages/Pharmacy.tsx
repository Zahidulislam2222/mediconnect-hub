import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, signOut, fetchAuthSession } from 'aws-amplify/auth';
import QRCode from "react-qr-code";
import {
  Pill,
  RefreshCw,
  QrCode,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Loader2,
  FileWarning,
  CreditCard,
  History
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

import { api } from "@/lib/api";
import { useCheckout } from "@/context/CheckoutContext";

export default function Pharmacy() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { requestPayment } = useCheckout();

  // --- STATE ---
  const [user, setUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : { name: "Patient", id: "", avatar: null };
    } catch (e) { return { name: "Patient", id: "", avatar: null }; }
  });
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [justPaidIds, setJustPaidIds] = useState<string[]>([]);

  // Modals
  const [showQRModal, setShowQRModal] = useState(false);
  const [showRefillModal, setShowRefillModal] = useState(false);
  const [selectedRx, setSelectedRx] = useState<any>(null);
  const [generatedQR, setGeneratedQR] = useState<string>("");

  // --- 1. LOAD DATA ---
  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const authUser = await getCurrentUser();

      const [profileData, rxData] = await Promise.all([
        api.get(`/register-patient?id=${authUser.userId}`).catch(() => null),
        api.get(`/prescription?patientId=${authUser.userId}`).catch(() => null)
      ]);

      if (profileData) {
        const profile: any = profileData;
        const userData = { name: profile.name || "Patient", id: authUser.userId, avatar: profile.avatar };
        setUser(userData);
        localStorage.setItem('user', JSON.stringify({ ...user, ...userData }));
      }

      if (rxData) {
        const data: any = rxData;
        setPrescriptions(data.prescriptions || []);
      }
    } catch (error) {
      console.error("Failed to load pharmacy data:", error);
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Could not sync with pharmacy network."
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrescriptions();
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  // --- NEW: Pharmacy Payment Handler ---
  const handlePayMedication = async (rx: any) => {
    setProcessingId(rx.prescriptionId);
    try {
      // 1. Fetch user's billing to find the exact Bill ID for this medicine
      // Note: In our backend, referenceId = prescriptionId
      const billing: any = await api.get(`/billing?patientId=${user.id}`);
      const transaction = billing.transactions?.find(
        (t: any) => t.referenceId === rx.prescriptionId
      );

      if (!transaction || !transaction.billId) {
        throw new Error("Billing record not found. Please sync or contact support.");
      }

      // 2. Open the Professional Modal
      const paymentMethod = await requestPayment({
        amount: Number(rx.price), // 🟢 Use exact price from DB
        title: "Pharmacy Payment",
        description: `Medication: ${rx.medication}`
      });

      // 3. Execute Payment on Backend
      // We pass the billId and the paymentMethod.id
      await api.post('/pay-bill', {
        billId: transaction.billId,
        patientId: user.id,
        paymentMethodId: paymentMethod.id
      });
      setJustPaidIds(prev => [...prev, rx.prescriptionId]);
      toast({
        title: "Verifying Payment...",
        description: "Finalizing with your pharmacy. Please wait a moment."
      });
      setTimeout(async () => {
        await fetchPrescriptions();
        setProcessingId(null);
      }, 3000);

    } catch (error: any) {
      setProcessingId(null);
      if (error.message !== "User cancelled payment") {
        toast({ variant: "destructive", title: "Payment Error", description: error.message });
      }
    }
  };

  // --- 2. ACTIONS ---
  const handleGenerateQR = async (rx: any) => {
    setProcessingId(rx.prescriptionId);
    try {
      const data: any = await api.post(`/pharmacy/generate-qr`, { prescriptionId: rx.prescriptionId });

      setGeneratedQR(data.qrPayload || `PICKUP-${rx.prescriptionId.substring(0, 8)}`);
      setSelectedRx(rx);
      setShowQRModal(true);

      updateLocalStatus(rx.prescriptionId, "READY_FOR_PICKUP");

    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not generate pickup code." });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRefillRequest = async () => {
    if (!selectedRx) return;
    setProcessingId(selectedRx.prescriptionId);
    setShowRefillModal(false);

    try {
      await api.post(`/pharmacy/request-refill`, { prescriptionId: selectedRx.prescriptionId });

      toast({
        title: "Refill Requested",
        description: `Doctor notified for ${selectedRx.medication}.`,
        variant: "default"
      });

      updateLocalStatus(selectedRx.prescriptionId, "REFILL_REQUESTED");

    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not send request." });
    } finally {
      setProcessingId(null);
    }
  };

  const updateLocalStatus = (id: string, newStatus: string) => {
    setPrescriptions(prev => prev.map(item =>
      item.prescriptionId === id ? { ...item, status: newStatus } : item
    ));
  };

  // --- HELPERS ---
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ISSUED": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200">Active</Badge>;
      case "READY_FOR_PICKUP": return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200">Ready for Pickup</Badge>;
      case "REFILL_REQUESTED": return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200">Pending Approval</Badge>;
      case "PICKED_UP": return <Badge variant="secondary">Completed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout
      title="Pharmacy"
      subtitle="Manage your prescriptions and refills"
      userRole="patient"
      userName={user.name}
      userAvatar={user.avatar}
      onLogout={handleLogout}
    >
      <div className="space-y-6 animate-fade-in pb-10">

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="shadow-sm border-slate-200">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="bg-blue-50 p-3 rounded-xl"><Pill className="text-blue-600 h-6 w-6" /></div>
              <div>
                <div className="text-2xl font-bold">{prescriptions.length}</div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total Meds</div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-slate-200">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="bg-orange-50 p-3 rounded-xl"><RefreshCw className="text-orange-600 h-6 w-6" /></div>
              <div>
                <div className="text-2xl font-bold">
                  {prescriptions.filter(p => p.status === "REFILL_REQUESTED").length}
                </div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Pending Approval</div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-slate-200">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="bg-green-50 p-3 rounded-xl"><CheckCircle2 className="text-green-600 h-6 w-6" /></div>
              <div>
                <p className="text-2xl font-bold">
                  {prescriptions.filter(p => p.status === "READY_FOR_PICKUP").length}
                </p>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Ready for Pickup</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* LIST */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="border-b bg-slate-50/50 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Current Medications</CardTitle>
              <Button variant="ghost" size="sm" onClick={fetchPrescriptions} disabled={loading} className="h-8">
                <History className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Sync
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" /></div>
            ) : prescriptions.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <FileWarning className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>No prescriptions found.</p>
              </div>
            ) : (
              <div className="divide-y">
                {prescriptions.map((rx) => (
                  <div key={rx.prescriptionId} className="p-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-slate-50/50 transition-colors">

                    {/* Icon & Name */}
                    <div className="flex items-start gap-4 flex-1">
                      <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        <Pill className="h-5 w-5 text-slate-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-slate-900">{rx.medication}</h4>
                          {getStatusBadge(rx.status)}
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">{rx.dosage} • {rx.instructions || "Follow label instructions"}</p>
                        {/* 🟢 NEW: PRICE & STOCK INFO */}
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-sm font-bold text-slate-700">
                            Price: ${rx.livePrice}
                          </span>
                          {rx.liveStock === 0 ? (
                            <Badge variant="outline" className="text-red-600 border-red-600 bg-red-50">Out of Stock</Badge>
                          ) : (
                            <span className="text-xs text-slate-400">{rx.liveStock} in stock</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Issued: {new Date(rx.timestamp).toLocaleDateString()}</span>
                          <span>ID: #{rx.prescriptionId.substring(0, 6)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">

                      {/* 1. THE PAYMENT DOOR (Shows if NOT paid) */}
                      {rx.status === "ISSUED" && rx.paymentStatus !== "PAID" && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={rx.liveStock === 0 || processingId === rx.prescriptionId}
                          onClick={() => handlePayMedication(rx)} // Call our new function
                        >
                          {processingId === rx.prescriptionId ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <CreditCard className="h-4 w-4 mr-2" />
                          )}
                          Pay ${rx.livePrice}
                        </Button>
                      )}

                      {/* 2. THE PICKUP GATE (Shows ONLY if paid or already ready) */}
                      {((rx.status === "ISSUED" && rx.paymentStatus === "PAID") || rx.status === "READY_FOR_PICKUP") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateQR(rx)}
                          disabled={processingId === rx.prescriptionId}
                        >
                          {processingId === rx.prescriptionId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <QrCode className="h-4 w-4 mr-2" />
                          )}
                          Pickup Code
                        </Button>
                      )}

                      {/* 3. THE REFILL BUTTON (Always visible for active/ready meds) */}
                      <Button
                        size="sm"
                        className="bg-primary"
                        onClick={() => { setSelectedRx(rx); handleRefillRequest(); }} // Update this
                        disabled={
                          rx.status === "REFILL_REQUESTED" ||
                          rx.status === "READY_FOR_PICKUP" ||
                          rx.status === "ISSUED" ||   // 🟢 ADD: Cannot refill if just issued
                          rx.status === "PENDING"     // 🟢 ADD: Cannot refill if not yet paid
                        }
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-2" />
                        {rx.refillsRemaining > 0 ? `Refill (${rx.refillsRemaining} left)` : "Request Refill"}
                      </Button>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* STATIC INFO */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4 flex gap-4">
              <div className="bg-purple-50 p-3 rounded-lg"><MapPin className="text-purple-600 h-5 w-5" /></div>
              <div>
                <h4 className="font-semibold text-sm">Preferred Pharmacy</h4>
                <p className="text-sm text-slate-600">CVS Pharmacy #4402</p>
                <p className="text-xs text-slate-400 mt-1">123 Market St • (415) 555-0123</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4 flex gap-4">
              <div className="bg-red-50 p-3 rounded-lg"><AlertTriangle className="text-red-600 h-5 w-5" /></div>
              <div>
                <h4 className="font-semibold text-sm">Interaction Guard™</h4>
                <p className="text-xs text-slate-600 mt-1">
                  Your prescriptions are automatically screened against known drug interactions by our AI engine.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* QR MODAL */}
      <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
        <DialogContent className="sm:max-w-xs text-center">
          <DialogHeader>
            <DialogTitle>Scan at Pharmacy</DialogTitle>
            <DialogDescription>Show this code to the pharmacist.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4 bg-white rounded-lg border my-2">
            {/* 🔴 WAS: qrValue && ( ... ) */}
            {/* 🟢 CHANGE TO: generatedQR && ( ... ) */}
            {generatedQR && (
              <QRCode
                value={generatedQR} // 🟢 FIX HERE
                size={180}
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                viewBox={`0 0 256 256`}
              />
            )}
          </div>
          {/* 🟢 FIX HERE TOO */}
          <p className="font-mono text-lg font-bold tracking-widest text-slate-700">{generatedQR}</p>
        </DialogContent>
      </Dialog>

      {/* REFILL CONFIRM MODAL */}
      <Dialog open={showRefillModal} onOpenChange={setShowRefillModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Refill Request</DialogTitle>
            <DialogDescription>
              This will send a request to your doctor to approve a refill for <strong>{selectedRx?.medication}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>Additional Notes (Optional)</Label>
              <Textarea placeholder="e.g. I am traveling next week..." />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowRefillModal(false)}>Cancel</Button>
            <Button onClick={handleRefillRequest} disabled={!!processingId} className="bg-primary">
              {processingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Send Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}