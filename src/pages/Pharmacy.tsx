import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Pill,
  RefreshCw,
  QrCode,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Phone,
  X,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { currentUser, prescriptions } from "@/lib/mockData";
import { cn } from "@/lib/utils";

export default function Pharmacy() {
  const navigate = useNavigate();
  const [showQRModal, setShowQRModal] = useState(false);
  const [showRefillModal, setShowRefillModal] = useState(false);
  const [selectedRx, setSelectedRx] = useState<typeof prescriptions[0] | null>(null);

  const handleLogout = () => {
    navigate("/");
  };

  return (
    <DashboardLayout
      title="Pharmacy"
      subtitle="Manage your prescriptions and refills"
      userRole="patient"
      userName={currentUser.name}
      userAvatar={currentUser.avatar}
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
                <p className="text-2xl font-bold">2</p>
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
                <p className="text-2xl font-bold">1</p>
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
              <Button variant="outline" size="sm" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Sync with Pharmacy
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {prescriptions.map((rx) => (
              <div
                key={rx.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:shadow-soft transition-all"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Pill className="h-6 w-6 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-foreground">{rx.name}</h4>
                    <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                      Active
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {rx.dosage} • {rx.frequency}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Last filled: {rx.lastFilled}
                    </span>
                    <span>•</span>
                    <span>{rx.refillsLeft} refills remaining</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {rx.pharmacy}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      setSelectedRx(rx);
                      setShowQRModal(true);
                    }}
                  >
                    <QrCode className="h-4 w-4" />
                    Pickup Code
                  </Button>
                  <Button
                    size="sm"
                    className="gap-2 bg-primary hover:bg-primary/90"
                    onClick={() => {
                      setSelectedRx(rx);
                      setShowRefillModal(true);
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Request Refill
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Pharmacy Info */}
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
                  <strong>Moderate interaction detected:</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  Lisinopril and Metformin may increase the risk of lactic acidosis in rare cases. 
                  Monitor for symptoms and stay hydrated.
                </p>
              </div>
              <Button variant="link" className="p-0 h-auto mt-3 text-primary">
                Learn more about your medications →
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
              Show this code at {selectedRx?.pharmacy} to pick up your prescription.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-6">
            <div className="w-48 h-48 bg-white rounded-xl p-4 shadow-lg mb-4">
              <div className="w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMSAyMSI+PHBhdGggZD0iTTEgMWg3djdIMXptMiAydjNoM1Yzem0tMiA4aDd2N0gxem0yIDJ2M2gzdi0zem04LTEyaDd2N2gtN3ptMiAydjNoM1YzeiIvPjwvc3ZnPg==')] bg-contain" />
            </div>
            <p className="text-lg font-mono font-bold">RX-2026-{selectedRx?.id.slice(-4).toUpperCase()}</p>
            <p className="text-sm text-muted-foreground mt-2">{selectedRx?.name} - {selectedRx?.dosage}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Refill Request Modal */}
      <Dialog open={showRefillModal} onOpenChange={setShowRefillModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Refill</DialogTitle>
            <DialogDescription>
              Request a refill for {selectedRx?.name} {selectedRx?.dosage}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pharmacy</Label>
              <Input value={selectedRx?.pharmacy} disabled />
            </div>
            <div className="space-y-2">
              <Label>Refills Remaining</Label>
              <Input value={selectedRx?.refillsLeft} disabled />
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
            <Button onClick={() => setShowRefillModal(false)}>
              Submit Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
