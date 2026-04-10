import { Loader2, Stethoscope, Clock, FileText, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function UpcomingAppointments({ appointments, doctors, loading, onJoin, onCancel, onReceipt }: any) {
    const upcoming = appointments.filter((apt: any) => {
        if (apt.status === 'CANCELLED' || apt.status === 'COMPLETED') return false;
        const timeSlot = apt.resource?.start || apt.timeSlot;
        if (!timeSlot) return false;

        const aptDate = new Date(timeSlot);
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        return aptDate >= startOfToday;
    });

    if (loading) return <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>;
    if (upcoming.length === 0) return <div className="text-center text-muted-foreground py-10">No upcoming appointments.</div>;

    return (
        <div className="space-y-4">
            {upcoming.map((apt: any, i: number) => {
                const timeSlot = apt.resource?.start || apt.timeSlot;
                const docProfile = doctors.find((d: any) => d.doctorId === apt.doctorId);
                const docName = apt.doctorName || docProfile?.name || "Doctor";
                const docSpecialty = docProfile?.specialization || "General Practice";
                const dateObj = new Date(timeSlot);

                return (
                    <Card key={i} className="hover:shadow-card transition-shadow rounded-2xl border-border">
                        <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                            <div className="flex gap-3 sm:gap-4 items-center min-w-0">
                                <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border shadow-sm flex-shrink-0 rounded-xl">
                                    <AvatarImage src={docProfile?.avatar} className="object-cover" />
                                    <AvatarFallback className="bg-primary/10 text-primary font-bold rounded-xl">{docName.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>

                                <div className="bg-primary/10 p-2.5 sm:p-3 rounded-xl text-primary text-center min-w-[50px] sm:min-w-[60px] flex-shrink-0">
                                    <div className="font-bold text-lg sm:text-xl font-display">{dateObj.getDate()}</div>
                                    <div className="text-[10px] sm:text-xs font-bold uppercase">{dateObj.toLocaleString('default', { month: 'short' })}</div>
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-base sm:text-lg truncate">{docName}</h3>
                                    <div className="flex flex-wrap gap-2 sm:gap-4 text-sm text-muted-foreground mt-1 items-center">
                                        <span className="flex items-center gap-1 text-primary/80 font-medium capitalize text-xs sm:text-sm truncate">
                                            <Stethoscope className="h-3 w-3 flex-shrink-0" /> {docSpecialty.replace(/_/g, ' ')}
                                        </span>
                                        <span className="flex items-center gap-1 text-xs sm:text-sm">
                                            <Clock className="h-3 w-3 flex-shrink-0" />{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 items-center sm:flex-shrink-0">
                                <Button variant="outline" size="sm" className="h-9 rounded-xl border-border text-muted-foreground flex-1 sm:flex-none" onClick={() => onReceipt(apt.appointmentId)}>
                                    <FileText className="h-4 w-4 mr-1" /> Receipt
                                </Button>
                                <Button variant="outline" size="sm" className="h-9 rounded-xl text-red-600 border-red-200 hover:bg-red-50 flex-1 sm:flex-none" onClick={() => onCancel(apt.appointmentId)}>
                                    Cancel
                                </Button>
                                <Button size="sm" className="h-9 rounded-xl bg-accent text-accent-foreground flex-1 sm:flex-none" onClick={() => onJoin(apt)}>
                                    <Video className="h-4 w-4 mr-1" /> Join
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
