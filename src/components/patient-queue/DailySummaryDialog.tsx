import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getInitials, getAptTime } from "./utils";

interface Props {
    show: boolean;
    onOpenChange: (show: boolean) => void;
    fullHistory: any[];
}

export function DailySummaryDialog({ show, onOpenChange, fullHistory }: Props) {
    const completed = fullHistory.filter(a => a.status === 'COMPLETED');
    const cancelled = fullHistory.filter(a => a.status === 'CANCELLED');

    return (
        <Dialog open={show} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl bg-white max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Daily Practice Summary</DialogTitle>
                    <DialogDescription>Patients processed today ({new Date().toLocaleDateString()}).</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {completed.length === 0 && cancelled.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8 border rounded-lg">No history record for today.</p>
                    ) : (
                        <>
                            <h4 className="font-semibold text-sm text-emerald-700">Completed ({completed.length})</h4>
                            <div className="space-y-2">
                                {completed.map(apt => (
                                    <div key={apt.appointmentId} className="flex items-center justify-between p-3 border rounded-lg bg-emerald-50/50">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8"><AvatarFallback>{getInitials(apt.patientName)}</AvatarFallback></Avatar>
                                            <div>
                                                <p className="font-medium text-sm">{apt.patientName}</p>
                                                <p className="text-xs text-muted-foreground">{new Date(getAptTime(apt)).toLocaleTimeString()}</p>
                                            </div>
                                        </div>
                                        <Badge className="bg-emerald-200 text-emerald-800 border-none">Billed</Badge>
                                    </div>
                                ))}
                            </div>

                            {cancelled.length > 0 && (
                                <>
                                    <h4 className="font-semibold text-sm text-red-700 mt-4">Cancelled / No-Show</h4>
                                    <div className="space-y-2">
                                        {cancelled.map(apt => (
                                            <div key={apt.appointmentId} className="flex items-center justify-between p-3 border rounded-lg bg-red-50/50">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8"><AvatarFallback>{getInitials(apt.patientName)}</AvatarFallback></Avatar>
                                                    <div>
                                                        <p className="font-medium text-sm">{apt.patientName}</p>
                                                        <p className="text-xs text-muted-foreground">{new Date(getAptTime(apt)).toLocaleTimeString()}</p>
                                                    </div>
                                                </div>
                                                <Badge variant="destructive">Cancelled</Badge>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}