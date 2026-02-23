import React from "react";
import { Clock } from "lucide-react";
import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle, 
    CardDescription 
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

interface ScheduleDay {
    active: boolean;
    start: string;
    end: string;
}

interface DoctorScheduleCardProps {
    weeklySchedule: Record<string, ScheduleDay>;
    updateSchedule: (day: string, field: string, value: any) => void;
    DAYS: string[];
    TIME_OPTIONS: string[];
    userRole: "patient" | "doctor";
}

export const DoctorScheduleCard: React.FC<DoctorScheduleCardProps> = ({
    weeklySchedule,
    updateSchedule,
    DAYS,
    TIME_OPTIONS,
    userRole
}) => {
    // SECURITY GATE: Prevent patient accounts from accessing scheduling infrastructure
    if (userRole !== "doctor") return null;

    return (
        <Card className="shadow-card border-border/50 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Weekly Schedule
                </CardTitle>
                <CardDescription>
                    Configure your clinical availability for patient appointments
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {DAYS.map((day) => {
                    const schedule = weeklySchedule[day] || { 
                        active: false, 
                        start: "09:00", 
                        end: "17:00" 
                    };

                    return (
                        <div 
                            key={day} 
                            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border transition-all duration-200 ${
                                schedule.active 
                                    ? 'border-primary/20 bg-primary/5 shadow-sm' 
                                    : 'border-border/40 hover:bg-muted/30'
                            }`}
                        >
                            {/* Day Selector */}
                            <div className="flex items-center gap-4 min-w-[140px]">
                                <Switch
                                    checked={schedule.active}
                                    onCheckedChange={(checked) => updateSchedule(day, 'active', checked)}
                                    className="data-[state=checked]:bg-primary"
                                />
                                <span className={`font-semibold tracking-tight ${
                                    schedule.active ? 'text-foreground' : 'text-muted-foreground'
                                }`}>
                                    {day}
                                </span>
                            </div>

                            {/* Time Selectors - FHIR Mapping: availableTime.availableStartTime/EndTime */}
                            {schedule.active ? (
                                <div className="flex items-center gap-3 flex-1 animate-in zoom-in-95 duration-300">
                                    <div className="relative flex-1">
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer hover:border-primary/50"
                                            value={schedule.start}
                                            onChange={(e) => updateSchedule(day, 'start', e.target.value)}
                                        >
                                            {TIME_OPTIONS.map(t => (
                                                <option key={`start-${day}-${t}`} value={t}>{t}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <span className="text-muted-foreground font-medium">to</span>
                                    <div className="relative flex-1">
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer hover:border-primary/50"
                                            value={schedule.end}
                                            onChange={(e) => updateSchedule(day, 'end', e.target.value)}
                                        >
                                            {TIME_OPTIONS.map(t => (
                                                <option key={`end-${day}-${t}`} value={t}>{t}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 text-center sm:text-left text-xs text-muted-foreground uppercase font-bold tracking-widest pl-2 opacity-50">
                                    Not accepting appointments
                                </div>
                            )}
                        </div>
                    );
                })}
                
                <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-100 flex items-start gap-3">
                    <div className="p-1 bg-blue-100 rounded-full text-blue-600">
                        <Clock className="h-3 w-3" />
                    </div>
                    <p className="text-[11px] text-blue-700 leading-relaxed">
                        <strong>Note:</strong> Changes here update your public booking calendar immediately. 
                        Slots are calculated in 30-minute intervals based on your local timezone.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
};