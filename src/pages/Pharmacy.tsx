import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import QRCode from "react-qr-code";
import { Pill, RefreshCw, QrCode, Clock, CheckCircle2, AlertTriangle, MapPin, Loader2, FileWarning, CreditCard, History } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { getUser, setUser as setStoredUser, clearAllSensitive } from "@/lib/secure-storage";
import { useCheckout } from "@/context/CheckoutContext";
import { usePaymentLifetime } from "@/hooks/use-payment-lifetime";
import copy from "@/content/pharmacy";
import { pharmacyRoutes as routes, prescriptionsFrom, pickupFrom, refillAcknowledged, payableBillFrom, paymentNotice, type Prescription } from "@/lib/pharmacy-contract";

type Action = { id: string; signal: AbortSignal };
export default function Pharmacy() {
  const navigate = useNavigate();
  const { key: locationKey } = useLocation();
  const { toast } = useToast();
  const { requestPayment } = useCheckout();
  const lifetime = usePaymentLifetime();
  const active = useRef<Action | null>(null);
  const loggedOut = useRef(false);
  const loadSequence = useRef(0);
  const [user, setUser] = useState({ name: copy.patient, id: '', avatar: undefined as string | undefined });
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [paymentReview, setPaymentReview] = useState<string[]>([]);
  const [refillReview, setRefillReview] = useState<string[]>([]);
  const [generatedQR, setGeneratedQR] = useState('');

  const fetchPrescriptions = useCallback(async () => {
    const signal = lifetime.current.signal;
    if (signal.aborted || loggedOut.current) return;
    const sequence = ++loadSequence.current;
    const current = () => !signal.aborted && sequence === loadSequence.current;
    setLoading(true); setLoadError(false); setGeneratedQR('');
    try {
      const authUser = await getCurrentUser();
      if (!current() || !authUser.userId) return;
      const id = encodeURIComponent(authUser.userId);
      const [profile, response] = await Promise.all([
        api.get(routes.profile + '?id=' + id), api.get(routes.prescriptions + '?patientId=' + id),
      ]);
      if (!current()) return;
      const rows = prescriptionsFrom(response);
      const name = typeof profile?.name === 'string' && profile.name.trim() ? profile.name : copy.patient;
      const avatar = typeof profile?.avatar === 'string' ? profile.avatar : undefined;
      const verifiedUser = { id: authUser.userId, name, avatar };
      setStoredUser({ ...getUser(), ...verifiedUser });
      setUser(verifiedUser); setPrescriptions(rows);
    } catch (error) {
      if (!current()) return;
      setPrescriptions([]); setLoadError(true);
      if (error && typeof error === 'object' && 'status' in error && (error.status === 401 || error.status === 403)) {
        loggedOut.current = true; clearAllSensitive(); navigate('/auth');
      } else toast({ variant: 'destructive', title: copy.loadErrorTitle, description: copy.loadErrorDescription });
    } finally { if (current()) setLoading(false); }
  }, [lifetime, navigate, toast]);

  useEffect(() => {
    active.current = null; setProcessingId(null);
    setPaymentReview([]); setRefillReview([]);
    const signal = lifetime.current.signal;
    const clearView = () => { setGeneratedQR(''); setPrescriptions([]); };
    signal.addEventListener('abort', clearView);
    void fetchPrescriptions();
    return () => { signal.removeEventListener('abort', clearView); ++loadSequence.current; };
  }, [fetchPrescriptions, lifetime, locationKey]);

  async function handleLogout() {
    loggedOut.current = true;
    lifetime.current.abort(); clearAllSensitive();
    try { await signOut(); } finally { navigate('/auth'); }
  }
  function begin(rx: Prescription) {
    if (active.current || loading || loggedOut.current || !user.id || lifetime.current.signal.aborted) return null;
    const action = { id: rx.prescriptionId, signal: lifetime.current.signal };
    active.current = action; setProcessingId(action.id); setGeneratedQR('');
    return action;
  }
  function current(action: Action) { return active.current === action && !action.signal.aborted; }
  function end(action: Action) {
    if (active.current === action) { active.current = null; if (!action.signal.aborted) setProcessingId(null); }
  }
  function updateLocalStatus(id: string, status: string) {
    setPrescriptions(previous => previous.map(item => item.prescriptionId === id ? { ...item, status } : item));
  }
  async function handleGenerateQR(rx: Prescription) {
    const action = begin(rx); if (!action) return;
    try {
      const response = await api.post(routes.pickup, { prescriptionId: action.id });
      if (!current(action)) return;
      const qr = pickupFrom(response, action.id);
      setGeneratedQR(qr); updateLocalStatus(action.id, 'READY_FOR_PICKUP');
    } catch { if (current(action)) toast({ variant: 'destructive', title: copy.pickupErrorTitle, description: copy.pickupErrorDescription }); }
    finally { end(action); }
  }
  async function handleRefillRequest(rx: Prescription) {
    if (refillReview.includes(rx.prescriptionId) || rx.status !== 'PICKED_UP' || !rx.refillsRemaining) return;
    const action = begin(rx); if (!action) return;
    // A lost response can still represent a completed refill/bill. Never retry it automatically.
    setRefillReview(previous => [...previous, action.id]);
    try {
      const response = await api.post(routes.refill, { prescriptionId: action.id });
      if (!current(action)) return;
      if (!refillAcknowledged(response)) throw new Error('REFILL_UNCONFIRMED');
      updateLocalStatus(action.id, 'PENDING');
      toast({ title: copy.refillTitle, description: copy.refillDescription });
    } catch { if (current(action)) toast({ variant: 'destructive', title: copy.refillErrorTitle, description: copy.refillErrorDescription }); }
    finally { end(action); }
  }
  async function handlePayMedication(rx: Prescription) {
    if (paymentReview.includes(rx.prescriptionId)) return;
    const action = begin(rx); if (!action) return;
    let submitted = false;
    try {
      const billing = await api.get(routes.billing + '?patientId=' + encodeURIComponent(user.id));
      if (!current(action)) return;
      const transaction = payableBillFrom(billing, action.id, user.id);
      const method = await requestPayment({ amount: transaction.amount, title: copy.paymentTitle,
        description: copy.medicationTemplate.replace('{medication}', rx.medication) });
      if (!current(action)) return;
      if (!method || typeof method.id !== 'string' || !method.id.trim()) throw new Error('PAYMENT_METHOD_UNAVAILABLE');
      submitted = true; setPaymentReview(previous => [...previous, action.id]);
      const result = await api.post(routes.pay, { billId: transaction.billId, patientId: user.id, paymentMethodId: method.id });
      if (!current(action)) return;
      toast(paymentNotice(result));
      await fetchPrescriptions();
    } catch (error) {
      if (!current(action)) return;
      if (error instanceof Error && ['User cancelled payment', 'PAYMENT_UI_CLOSED'].includes(error.message)) return;
      toast(submitted ? { ...paymentNotice(undefined), variant: 'destructive' } : {
        variant: 'destructive', title: copy.billingErrorTitle, description: copy.billingErrorDescription,
      });
    } finally { end(action); }
  }

  // --- HELPERS ---
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ISSUED": return <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-border">{copy.active}</Badge>;
      case "READY_FOR_PICKUP": return <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-border">{copy.ready}</Badge>;
      case "PENDING":
      case "REFILL_REQUESTED": return <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-border">{copy.pending}</Badge>;
      case "PICKED_UP": return <Badge variant="secondary">{copy.completed}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout
      title={copy.title}
      subtitle={copy.subtitle}
      userRole="patient"
      userName={user.name}
      userAvatar={user.avatar}
      onLogout={handleLogout}
    >
      <div className="space-y-6 animate-fade-in pb-10">

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="shadow-card border-border rounded-2xl">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-xl"><Pill className="text-primary h-6 w-6" /></div>
              <div>
                <div className="text-2xl font-display font-bold">{prescriptions.length}</div>
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{copy.totalMeds}</div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card border-border rounded-2xl">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-xl"><RefreshCw className="text-primary h-6 w-6" /></div>
              <div>
                <div className="text-2xl font-display font-bold">
                  {prescriptions.filter(p => p.status === "REFILL_REQUESTED" || p.status === "PENDING").length}
                </div>
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{copy.pending}</div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card border-border rounded-2xl">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-xl"><CheckCircle2 className="text-primary h-6 w-6" /></div>
              <div>
                <p className="text-2xl font-display font-bold">
                  {prescriptions.filter(p => p.status === "READY_FOR_PICKUP").length}
                </p>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{copy.ready}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card border-border rounded-2xl">
          <CardHeader className="border-b border-border bg-secondary/30 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-display font-semibold">{copy.current}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => void fetchPrescriptions()} disabled={loading || !!processingId} className="h-8 rounded-xl">
                <History className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> {copy.sync}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground/30" /></div>
            ) : prescriptions.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <FileWarning className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>{loadError ? copy.loadErrorDescription : copy.empty}</p>
              </div>
            ) : (
              <div className="divide-y">
                {prescriptions.map((rx) => (
                  <div key={rx.prescriptionId} className="p-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-secondary/30 transition-colors">

                    <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                        <Pill className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-foreground">{rx.medication}</h4>
                          {getStatusBadge(rx.status)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5 truncate">{rx.dosage} · {rx.instructions || copy.instructionsUnknown}</p>
                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-1">
                          <span className="text-sm font-bold text-foreground">
                            {copy.price}: {rx.livePrice == null ? copy.priceUnknown : `$${rx.livePrice}`}
                          </span>
                          {rx.liveStock === 0 ? (
                            <Badge variant="outline" className="text-primary border-border bg-primary/10">{copy.outOfStock}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">{rx.liveStock == null ? copy.stockUnknown : copy.stockTemplate.replace('{stock}', String(rx.liveStock))}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {copy.issued}: {rx.timestamp && Number.isFinite(Date.parse(rx.timestamp)) ? new Date(rx.timestamp).toLocaleDateString() : copy.dateUnknown}</span>
                          <span className="font-mono">#{rx.prescriptionId.substring(0, 6)}</span>
                        </div>
                      </div>
                    </div>

                    {paymentReview.includes(rx.prescriptionId) && <p role="status" className="text-sm text-muted-foreground">{copy.paymentReview}</p>}
                    {refillReview.includes(rx.prescriptionId) && <p role="status" className="text-sm text-muted-foreground">{copy.refillReview}</p>}

                    <div className="flex flex-wrap items-center gap-2 md:flex-shrink-0">

                      {rx.status === "ISSUED" && rx.paymentStatus !== "PAID" && (
                        <Button
                          size="sm"
                          className="bg-accent text-accent-foreground rounded-xl"
                          disabled={!rx.liveStock || !!processingId || paymentReview.includes(rx.prescriptionId)}
                          onClick={() => handlePayMedication(rx)}
                        >
                          {processingId === rx.prescriptionId ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <CreditCard className="h-4 w-4 mr-2" />
                          )}
                          {copy.payTemplate.replace('{amount}', rx.livePrice == null ? copy.priceUnknown : `$${rx.livePrice}`)}
                        </Button>
                      )}

                      {((rx.status === "ISSUED" && rx.paymentStatus === "PAID") || rx.status === "READY_FOR_PICKUP") && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-border"
                          onClick={() => handleGenerateQR(rx)}
                          disabled={!!processingId}
                        >
                          {processingId === rx.prescriptionId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <QrCode className="h-4 w-4 mr-2" />
                          )}
                          {copy.pickup}
                        </Button>
                      )}

                      <Button
                        size="sm"
                        className="bg-primary rounded-xl"
                        onClick={() => void handleRefillRequest(rx)}
                        disabled={!!processingId || rx.status !== 'PICKED_UP' || !rx.refillsRemaining || refillReview.includes(rx.prescriptionId)}
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-2" />
                        {rx.refillsRemaining ? copy.refillTemplate.replace('{remaining}', String(rx.refillsRemaining)) : copy.requestRefill}
                      </Button>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-border shadow-card rounded-2xl">
            <CardContent className="p-4 flex gap-4">
              <div className="bg-primary/10 p-3 rounded-xl"><MapPin className="text-primary h-5 w-5" /></div>
              <div>
                <h4 className="font-semibold text-sm">{copy.pharmacyTitle}</h4>
                <p className="text-sm text-muted-foreground">{copy.pharmacyDescription}</p>

              </div>
            </CardContent>
          </Card>
          <Card className="border-border shadow-card rounded-2xl">
            <CardContent className="p-4 flex gap-4">
              <div className="bg-primary/10 p-3 rounded-xl"><AlertTriangle className="text-primary h-5 w-5" /></div>
              <div>
                <h4 className="font-semibold text-sm">{copy.interactionTitle}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {copy.interactionDescription}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      <Dialog open={!!generatedQR} onOpenChange={open => { if (!open) setGeneratedQR(''); }}>
        <DialogContent className="sm:max-w-xs text-center">
          <DialogHeader>
            <DialogTitle>{copy.qrTitle}</DialogTitle>
            <DialogDescription>{copy.qrDescription}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4 bg-background rounded-lg border my-2">


            {generatedQR && (
              <QRCode
                value={generatedQR}
                size={180}
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                viewBox={`0 0 256 256`}
              />
            )}
          </div>

          <p className="font-mono text-lg font-bold tracking-widest text-foreground">{generatedQR}</p>
        </DialogContent>
      </Dialog>


    </DashboardLayout>
  );
}
