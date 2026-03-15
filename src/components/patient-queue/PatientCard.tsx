import { useNavigate } from "react-router-dom";
import { Clock, CheckCircle2, MoreVertical, Play, AlertCircle, Loader2, Video, XCircle, AlertTriangle, Stethoscope, FileText, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getInitials, getAptTime } from "./utils";

interface Props {
    patient: any;
    isUpcoming?: boolean;
    patientDirectory: any[];
    processingId: string | null;
    onUpdateStatus: (id: string, status: string, name: string) => void;
}

export function PatientCard({ patient, isUpcoming = false, patientDirectory, processingId, onUpdateStatus }: Props) {
    const navigate = useNavigate();
    
    const realProfile = patientDirectory.find(p => p.patientId === patient.patientId);
    const aptDate = new Date(getAptTime(patient));
    const diffMs = Date.now() - aptDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    let timeStatus = { text: "On Time", color: "text-blue-600 bg-blue-50 border-blue-200", icon: Clock };

    if (!isUpcoming) {
        if (diffMins > 10) timeStatus = { text: `LATE (+${diffMins}m)`, color: "text-red-600 bg-red-50 border-red-200", icon: AlertCircle };
        else if (diffMins < -10) timeStatus = { text: "Early Arrival", color: "text-emerald-600 bg-emerald-50 border-emerald-200", icon: CheckCircle2 };
    } else {
        timeStatus = { text: aptDate.toLocaleDateString(), color: "text-gray-600 bg-gray-50 border-gray-200", icon: CalendarDays };
    }

    const StatusIcon = timeStatus.icon;

    return (
        <Card
            className={cn(
                "group hover:shadow-md transition-all border-l-4 mb-3",
                patient.status === 'IN_PROGRESS' ? "border-l-blue-500 bg-blue-50/30" :
                    patient.patientArrived ? "border-l-green-500 bg-green-50/20" :
                        patient.priority === 'High' ? "border-l-red-500" : "border-l-transparent"
            )}
        >
            <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4 justify-between">
                <div className="flex items-center gap-4">
                    <HoverCard>
                        <HoverCardTrigger asChild>
                            <div className="relative cursor-help">
                                <Avatar className="h-14 w-14 border-2 border-background shadow-sm">
                                    <AvatarImage src={realProfile?.avatar} alt={patient.patientName} />                                        
                                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                                        {getInitials(patient.patientName)}
                                    </AvatarFallback>
                                </Avatar>
                                {patient.patientArrived && <span className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 border-2 border-white rounded-full animate-pulse shadow-sm" />}
                            </div>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80">
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                    <FileText className="h-4 w-4" /> Patient Details
                                </h4>
                                <div className="text-sm text-muted-foreground">
                                    <p><span className="font-medium text-foreground">Age:</span> {patient.patientAge || "N/A"}</p>
                                    <p><span className="font-medium text-foreground">Reason:</span> {patient.reason}</p>
                                </div>
                            </div>
                        </HoverCardContent>
                    </HoverCard>

                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{patient.patientName}</h3>
                            {patient.status === 'IN_PROGRESS' && (
                                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none animate-pulse">In Consultation</Badge>
                            )}
                            {patient.priority === 'High' && (
                                <Badge variant="destructive" className="flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" /> High Risk
                                </Badge>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                            <span className={cn("flex items-center gap-1 font-medium px-1.5 rounded text-xs", timeStatus.color)}>
                                <StatusIcon className="h-3 w-3" /> {isUpcoming ? aptDate.toLocaleDateString() : timeStatus.text}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-foreground font-medium">
                                <Clock className="h-3 w-3" /> {aptDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                                <Stethoscope className="h-3 w-3" /> {patient.reason || "General Checkup"}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center mt-2 md:mt-0">
                    {patient.status === 'IN_PROGRESS' ? (
                        <Button
                            onClick={() => onUpdateStatus(patient.appointmentId, 'COMPLETED', patient.patientName)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]"
                            disabled={!!processingId}
                        >
                            {processingId === patient.appointmentId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Complete Visit"}
                        </Button>
                    ) : (
                        <Button
                            onClick={() => onUpdateStatus(patient.appointmentId, 'IN_PROGRESS', patient.patientName)}
                            className={cn("min-w-[120px] text-white", patient.patientArrived ? "bg-green-600 hover:bg-green-700 animate-pulse" : "bg-blue-600 hover:bg-blue-700")}
                            disabled={!!processingId || isUpcoming}
                        >
                            {processingId === patient.appointmentId ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                                <>{patient.patientArrived ? <Video className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />} Start</>
                            )}
                        </Button>
                    )}

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4 text-muted-foreground" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/patient-records`, { state: { patientId: patient.patientId } })}>
                                View Full History
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-red-600 focus:text-red-600"
                                onClick={() => onUpdateStatus(patient.appointmentId, 'CANCELLED', patient.patientName)}
                            >
                                <XCircle className="h-4 w-4 mr-2" /> Mark No-Show / Cancel
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardContent>
        </Card>
    );
}