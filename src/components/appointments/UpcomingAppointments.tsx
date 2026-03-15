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

    if (loading) return <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;
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
                    <Card key={i} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex gap-4 items-center">
                                <Avatar className="h-12 w-12 border shadow-sm">
                                    <AvatarImage src={docProfile?.avatar} className="object-cover" />
                                    <AvatarFallback>{docName.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>

                                <div className="bg-primary/10 p-3 rounded-lg text-primary text-center min-w-[60px]">
                                    <div className="font-bold text-xl">{dateObj.getDate()}</div>
                                    <div className="text-xs font-bold uppercase">{dateObj.toLocaleString('default', { month: 'short' })}</div>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg">{docName}</h3>
                                    <div className="flex gap-4 text-sm text-muted-foreground mt-1 items-center">
                                        <span className="flex items-center gap-1 text-primary/80 font-medium capitalize"><Stethoscope className="h-3 w-3" /> {docSpecialty.replace(/_/g, ' ')}</span>
                                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 items-center">
                                <Button variant="outline" size="sm" className="h-9 border-slate-200 text-slate-600" onClick={() => onReceipt(apt.appointmentId)}>
                                    <FileText className="h-4 w-4 mr-1" /> Receipt
                                </Button>
                                <Button variant="outline" size="sm" className="h-9 text-red-600 border-red-100 hover:bg-red-50" onClick={() => onCancel(apt.appointmentId)}>
                                    Cancel
                                </Button>
                                <Button size="sm" className="h-9" onClick={() => onJoin(apt)}>
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