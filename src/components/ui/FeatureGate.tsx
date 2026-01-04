import { ShieldAlert, Mail, ExternalLink, Zap } from "lucide-react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface FeatureGateProps {
    isOpen: boolean;
    onClose: () => void;
    serviceName: string;
}

export function FeatureGate({ isOpen, onClose, serviceName }: FeatureGateProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[450px] rounded-[32px] border-none shadow-2xl">
                <DialogHeader className="items-center text-center pt-4">
                    <div className="h-16 w-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                        <Zap className="h-8 w-8 text-amber-600 animate-pulse" />
                    </div>
                    <DialogTitle className="text-2xl font-black text-slate-900 leading-tight">
                        Enterprise Feature Activation
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 pt-2 text-base leading-relaxed">
                        The <span className="font-bold text-slate-900">{serviceName}</span> is currently in <span className="text-amber-600 font-bold">Hibernation Mode</span> to optimize cloud infrastructure costs.
                    </DialogDescription>
                </DialogHeader>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 my-4">
                    <div className="flex gap-3">
                        <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0" />
                        <p className="text-xs text-slate-600 leading-relaxed">
                            This feature requires active <span className="font-bold">AWS EKS & Neptune clusters</span>. In a production environment, this activates automatically based on demand.
                        </p>
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-col gap-3 pb-4">
                    <Button
                        className="w-full h-12 rounded-xl font-bold text-base"
                        onClick={() => window.location.href = "mailto:admin@mediconnect.com"}
                    >
                        <Mail className="mr-2 h-4 w-4" /> Request Technical Demo
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="w-full text-slate-400 font-medium hover:text-slate-600"
                    >
                        Continue in Preview Mode
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Minimal icons for the popup
function ShieldCheck({ className }: { className?: string }) {
    return <ShieldAlert className={className} />;
}