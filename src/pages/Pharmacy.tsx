import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from 'aws-amplify/auth';
import {
  Pill,
  RefreshCw,
  QrCode,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Phone,
  Loader2,
  FileWarning
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function Pharmacy() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // --- STATE ---
  const [user, setUser] = useState<any>({ name: "Patient", id: "", avatar: null });
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null); // For loading buttons

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

      // Get Profile (for Avatar/Name)
      const profileRes = await fetch(`${API_BASE_URL}/register-patient?id=${authUser.userId}`);
      if (profileRes.ok) {
        const profile = await profileRes.json();
        setUser({ name: profile.name || "Patient", id: authUser.userId, avatar: profile.avatar });
      }

      // Get Prescriptions (Using the NEW GET Endpoint)
      const rxRes = await fetch(`${API_BASE_URL}/prescription?patientId=${authUser.userId}`);
      if (rxRes.ok) {
        const data = await rxRes.json();
        // Backend returns { count: n, prescriptions: [...] }
        setPrescriptions(data.prescriptions || []);
      }
    } catch (error) {
      console.error("Failed to load pharmacy data:", error);
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Could not load prescriptions from backend."
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrescriptions();
  }, []);

  const handleLogout = () => {
    navigate("/");
  };

  // --- 2. ACTIONS: GENERATE QR / PICKUP ---
  const handleGenerateQR = async (rx: any) => {
    setProcessingId(rx.prescriptionId);
    try {
      // Logic: Generating a QR code implies "Getting it ready for pickup"
      const response = await fetch(`${API_BASE_URL}/pharmacy/generate-qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prescriptionId: rx.prescriptionId })
      });

      if (!response.ok) throw new Error("Failed to generate code");

      const data = await response.json();
      setGeneratedQR(data.qrPayload); // e.g., "PICKUP-1234-5678"
      setSelectedRx(rx);
      setShowQRModal(true);

      // Update local state to reflect status change immediately
      updateLocalStatus(rx.prescriptionId, "READY_FOR_PICKUP");

    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not generate pickup code." });
    } finally {
      setProcessingId(null);
    }
  };

  // --- 3. ACTIONS: REFILL REQUEST ---
  const handleRefillRequest = async () => {
    if (!selectedRx) return;
    setProcessingId(selectedRx.prescriptionId); // Use generic loading state
    setShowRefillModal(false);

    try {
      // Re-using Generate QR endpoint as the "Trigger" for a refill/pickup
      const response = await fetch(`${API_BASE_URL}/pharmacy/generate-qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prescriptionId: selectedRx.prescriptionId })
      });

      if (!response.ok) throw new Error("Refill request failed");

      toast({
        title: "Refill Requested",
        description: `Order sent to Pharmacy for ${selectedRx.medication}.`,
        variant: "default"
      });

      updateLocalStatus(selectedRx.prescriptionId, "READY_FOR_PICKUP");

    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not process refill." });
    } finally {
      setProcessingId(null);
    }
  };

  // Helper to update UI without refetching
  const updateLocalStatus = (id: string, newStatus: string) => {
    setPrescriptions(prev => prev.map(item =>
      item.prescriptionId === id ? { ...item, status: newStatus } : item
    ));
  };

  // --- HELPERS ---
  const getStatusColor = (status: string) => {
    switch (status) {
      case "ISSUED": return "bg-blue-100 text-blue-700 border-blue-200";
      case "READY_FOR_PICKUP": return "bg-green-100 text-green-700 border-green-200";
      case "PICKED_UP": return "bg-slate-100 text-slate-700 border-slate-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getFormatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString();
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
      <div className="space-y-6 animate-fade-in">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="shadow-soft border-border/50">
            <CardContent className="pt-5 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Pill className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{prescriptions.length}</p>
                <p className="text-sm text-muted-foreground">Active Medications</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-border/50">
            <CardContent className="pt-5 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
                <RefreshCw className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {prescriptions.filter(p => p.status === "ISSUED").length}
                </p>
                <p className="text-sm text-muted-foreground">Pending Refills</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-border/50">
            <CardContent className="pt-5 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {prescriptions.filter(p => p.status === "READY_FOR_PICKUP").length}
                </p>
                <p className="text-sm text-muted-foreground">Ready for Pickup</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Prescriptions List */}
        <Card className="shadow-card border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Your Prescriptions</CardTitle>
              <Button variant="outline" size="sm" className="gap-2" onClick={fetchPrescriptions} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Sync with Pharmacy
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>Loading prescription history...</p>
              </div>
            ) : prescriptions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
                <FileWarning className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No active prescriptions found.</p>
                <p className="text-xs">Ask your doctor to send a digital prescription.</p>
              </div>
            ) : (
              prescriptions.map((rx) => (
                <div
                  key={rx.prescriptionId}
                  className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl border border-border bg-card hover:shadow-soft transition-all"
                >
                  {/* Icon */}
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Pill className="h-6 w-6 text-primary" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-foreground">{rx.medication}</h4>
                      <Badge variant="outline" className={getStatusColor(rx.status)}>
                        {rx.status?.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {rx.dosage} • {rx.instructions || "Follow doctor's orders"}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        Issued: {getFormatDate(rx.timestamp)}
                      </span>
                      <span>•</span>
                      <span>Rx ID: {rx.prescriptionId.slice(-4).toUpperCase()}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        CVS Pharmacy (Default)
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => handleGenerateQR(rx)}
                      disabled={processingId === rx.prescriptionId}
                    >
                      {processingId === rx.prescriptionId ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                      Pickup Code
                    </Button>
                    <Button
                      size="sm"
                      className="gap-2 bg-primary hover:bg-primary/90"
                      onClick={() => {
                        setSelectedRx(rx);
                        setShowRefillModal(true);
                      }}
                      disabled={rx.status === "PICKED_UP"}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Request Refill
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Pharmacy Info & Interactions (Static but Useful) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Preferred Pharmacy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
                  <MapPin className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h4 className="font-semibold">CVS Pharmacy</h4>
                  <p className="text-sm text-muted-foreground">123 Main Street, San Francisco, CA 94102</p>
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    (415) 555-0123
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Hours: Mon-Sat 9am-9pm, Sun 10am-6pm
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Drug Interactions Alert
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                <p className="text-sm text-foreground mb-2">
                  <strong>Automated Safety Check:</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  Our system automatically screens all new prescriptions against your current medication list to prevent dangerous interactions.
                </p>
              </div>
              <Button variant="link" className="p-0 h-auto mt-3 text-primary">
                View interaction history →
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* QR Code Modal */}
      <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pickup Code</DialogTitle>
            <DialogDescription>
              Show this code at CVS Pharmacy to pick up your prescription.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-6">
            <div className="w-48 h-48 bg-white rounded-xl p-4 shadow-lg mb-4 flex items-center justify-center">
              {/* Real QR Code Generated via API */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${generatedQR}`}
                alt="Pickup QR"
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-lg font-mono font-bold">{generatedQR}</p>
            <p className="text-sm text-muted-foreground mt-2">{selectedRx?.medication} - {selectedRx?.dosage}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Refill Request Modal */}
      <Dialog open={showRefillModal} onOpenChange={setShowRefillModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Refill</DialogTitle>
            <DialogDescription>
              Request a refill for {selectedRx?.medication} {selectedRx?.dosage}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pharmacy</Label>
              <Input value="CVS Pharmacy (Default)" disabled />
            </div>
            <div className="space-y-2">
              <Label>Instructions</Label>
              <Input value={selectedRx?.instructions || "Standard"} disabled />
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea placeholder="Any special instructions for your pharmacist..." />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowRefillModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleRefillRequest} disabled={!!processingId}>
              {processingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}