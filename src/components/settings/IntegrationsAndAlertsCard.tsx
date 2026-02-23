import React from "react";
import { 
    Mail, 
    Smartphone, 
    Calendar, 
    CheckCircle, 
    ShieldCheck, 
    BellRing 
} from "lucide-react";
import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle, 
    CardDescription 
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface IntegrationsAndAlertsCardProps {
    preferences: {
        email: boolean;
        sms: boolean;
        promotional: boolean;
    };
    setPreferences: React.Dispatch<React.SetStateAction<any>>;
    calendarConnected: boolean;
    handleConnectCalendar: () => Promise<void>;
    handleDisconnectCalendar: () => Promise<void>;
    userRole: "patient" | "doctor";
}

export const IntegrationsAndAlertsCard: React.FC<IntegrationsAndAlertsCardProps> = ({
    preferences,
    setPreferences,
    calendarConnected,
    handleConnectCalendar,
    handleDisconnectCalendar,
    userRole
}) => {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-800">
            {/* 1. NOTIFICATIONS SECTION (GDPR Consent Management) */}
            <Card className="shadow-card border-border/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BellRing className="h-5 w-5 text-primary" />
                        Notification Preferences
                    </CardTitle>
                    <CardDescription>
                        Manage how we contact you regarding appointments and health updates
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors">
                        <div className="space-y-0.5">
                            <div className="font-medium flex items-center gap-2">
                                <Mail className="h-4 w-4 text-primary" /> Email Alerts
                            </div>
                            <div className="text-sm text-muted-foreground">
                                Receive booking confirmations and clinical updates via email
                            </div>
                        </div>
                        <Switch
                            checked={preferences.email}
                            onCheckedChange={(c) => setPreferences({ ...preferences, email: c })}
                            className="data-[state=checked]:bg-primary"
                        />
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors">
                        <div className="space-y-0.5">
                            <div className="font-medium flex items-center gap-2">
                                <Smartphone className="h-4 w-4 text-primary" /> SMS Alerts
                            </div>
                            <div className="text-sm text-muted-foreground">
                                Get urgent text messages for appointment changes
                            </div>
                        </div>
                        <Switch
                            checked={preferences.sms}
                            onCheckedChange={(c) => setPreferences({ ...preferences, sms: c })}
                            className="data-[state=checked]:bg-primary"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* 2. GOOGLE CALENDAR INTEGRATION (Doctor Only - HIPAA Handshake) */}
            {userRole === 'doctor' && (
                <Card className="shadow-card border-border/50 overflow-hidden">
                    <CardHeader className="bg-muted/20">
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-primary" />
                            External Integrations
                        </CardTitle>
                        <CardDescription>
                            Sync your MediConnect clinical schedule with external platforms
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className={`flex flex-col md:flex-row items-center justify-between p-5 border rounded-xl transition-all ${
                            calendarConnected 
                                ? 'border-green-200 bg-green-50/30' 
                                : 'border-border/60 bg-background'
                        }`}>
                            <div className="flex items-center gap-5 mb-4 md:mb-0">
                                <div className={`p-4 rounded-full shadow-inner ${
                                    calendarConnected ? 'bg-white text-green-600' : 'bg-muted text-muted-foreground'
                                }`}>
                                    {calendarConnected ? <CheckCircle className="h-7 w-7" /> : <Calendar className="h-7 w-7" />}
                                </div>
                                <div className="space-y-1">
                                    <h4 className="font-bold text-lg flex items-center gap-2">
                                        Google Calendar
                                        {calendarConnected && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase tracking-widest">Active</span>}
                                    </h4>
                                    <p className="text-sm text-muted-foreground leading-snug max-w-[300px]">
                                        {calendarConnected
                                            ? "Appointments are syncing automatically to your personal device."
                                            : "Connect to manage your availability across all your devices."}
                                    </p>
                                </div>
                            </div>

                            {calendarConnected ? (
                                <Button 
                                    variant="outline" 
                                    onClick={handleDisconnectCalendar} 
                                    className="w-full md:w-auto border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 shadow-sm"
                                >
                                    Disconnect Sync
                                </Button>
                            ) : (
                                <Button 
                                    onClick={handleConnectCalendar} 
                                    className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center gap-2"
                                >
                                    <ShieldCheck className="h-4 w-4" />
                                    Connect Google
                                </Button>
                            )}
                        </div>
                        
                        <p className="mt-4 text-[10px] text-center text-muted-foreground uppercase font-semibold tracking-tighter opacity-70">
                            MediConnect uses AES-256 encryption for all third-party authorization tokens.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};