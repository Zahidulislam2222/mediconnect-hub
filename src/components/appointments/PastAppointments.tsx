import { FileText, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function PastAppointments({ appointments, doctors, onReceipt, lastEvaluatedKey, isLoadingMore, onLoadMore }: any) {
    const past = appointments.filter((apt: any) => {
        const timeSlot = apt.resource?.start || apt.timeSlot;
        if (!timeSlot) return false;
        const isPast = new Date(timeSlot) < new Date();
        const isDone = apt.status === 'CANCELLED' || apt.status === 'COMPLETED';
        return (isPast || isDone);
    });

    return (
        <div className="space-y-4">
            {past.map((apt: any, i: number) => {
                const timeSlot = apt.resource?.start || apt.timeSlot;
                const docProfile = doctors.find((d: any) => d.doctorId === apt.doctorId);
                const docName = apt.doctorName || docProfile?.name || "Doctor";
                const dateObj = new Date(timeSlot);

                return (
                    <Card key={i} className="opacity-75 bg-secondary/50 hover:opacity-100 transition-opacity rounded-2xl border-border">
                        <CardContent className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                <div className="bg-muted p-2 rounded-xl text-center min-w-[46px] sm:min-w-[50px] flex-shrink-0">
                                    <div className="font-bold text-muted-foreground font-display">{dateObj.getDate()}</div>
                                    <div className="text-[10px] font-bold uppercase text-muted-foreground/70">{dateObj.toLocaleString('default', { month: 'short' })}</div>
                                </div>
                                <div className="min-w-0">
                                    <div className="font-semibold text-base sm:text-lg truncate">{docName}</div>
                                    <div className="text-sm text-muted-foreground flex items-center gap-2 capitalize">
                                        <span className="truncate">{(docProfile?.specialization || "General").replace(/_/g, ' ')}</span>
                                        <span>·</span>
                                        <span className="flex-shrink-0">{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-3 sm:flex-shrink-0">
                                <Button variant="outline" size="sm" className="h-8 rounded-xl border-border flex-1 sm:flex-none" onClick={() => onReceipt(apt.appointmentId)}>
                                    <FileText className="h-4 w-4 mr-2" /> Receipt
                                </Button>
                                <Badge variant={apt.status === 'CANCELLED' ? 'destructive' : 'outline'} className="rounded-lg">
                                    {apt.status || 'COMPLETED'}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}

            {past.length === 0 && <div className="text-center text-muted-foreground py-10">No past appointments.</div>}

            {lastEvaluatedKey && (
                <Button variant="outline" className="w-full mt-4 rounded-xl" onClick={onLoadMore} disabled={isLoadingMore}>
                    {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    Load Older Appointments
                </Button>
            )}
        </div>
    );
}
