import { useNavigate } from "react-router-dom";
import { Clock, CheckCircle2, MoreVertical, Play, AlertCircle } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { patientQueue, currentDoctor } from "@/lib/mockData";
import { cn } from "@/lib/utils";

export default function PatientQueue() {
    const navigate = useNavigate();

    const handleLogout = () => {
        navigate("/");
    };

    const getPriorityColor = (priority: string) => {
        switch (priority.toLowerCase()) {
            case "high":
                return "bg-destructive/10 text-destructive border-destructive/20";
            case "medium":
                return "bg-warning/10 text-warning border-warning/20";
            default:
                return "bg-success/10 text-success border-success/20";
        }
    };

    return (
        <DashboardLayout
            title="Patient Queue"
            subtitle="Real-time waiting list management"
            userRole="doctor"
            userName={currentDoctor.name}
            userAvatar={currentDoctor.avatar}
            onLogout={handleLogout}
        >
            <div className="space-y-6 animate-fade-in pb-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card className="bg-primary text-primary-foreground border-none">
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                                <p className="text-primary-foreground/80 font-medium">Waiting</p>
                                <h3 className="text-3xl font-bold">{patientQueue.length}</h3>
                            </div>
                            <Clock className="h-8 w-8 opacity-20" />
                        </CardContent>
                    </Card>
                    <Card className="bg-success text-success-foreground border-none">
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                                <p className="text-success-foreground/80 font-medium">Completed</p>
                                <h3 className="text-3xl font-bold">12</h3>
                            </div>
                            <CheckCircle2 className="h-8 w-8 opacity-20" />
                        </CardContent>
                    </Card>
                    <Card className="bg-accent text-accent-foreground border-none">
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                                <p className="text-accent-foreground/80 font-medium">Avg Wait</p>
                                <h3 className="text-3xl font-bold">14m</h3>
                            </div>
                            <Clock className="h-8 w-8 opacity-20" />
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Current Queue</h2>
                    {patientQueue.map((patient) => (
                        <Card key={patient.id} className="group hover:shadow-md transition-shadow">
                            <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4 justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <Avatar className="h-12 w-12 border-2 border-border">
                                            <AvatarFallback className="bg-primary/5 text-primary">
                                                {patient.avatar}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className={cn(
                                            "absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center border-2 border-background font-bold text-[10px]",
                                            getPriorityColor(patient.priority).replace("border-", "bg-")
                                        )}>
                                            {patient.priority === 'High' ? '!' : '#'}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-lg">{patient.name}</h3>
                                            <Badge variant="outline" className={cn("text-xs font-normal capitalize", getPriorityColor(patient.priority))}>
                                                {patient.priority} Priority
                                            </Badge>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                                            <span>{patient.age} years old</span>
                                            <span>•</span>
                                            <span>Waiting: <span className="text-foreground font-medium">{patient.waitTime}</span></span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1 text-foreground">
                                                <AlertCircle className="h-3 w-3" />
                                                {patient.condition}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 self-end md:self-center mt-2 md:mt-0">
                                    <Button variant="outline" size="sm" onClick={() => navigate("/patient-records")}>
                                        History
                                    </Button>
                                    <Button onClick={() => navigate("/consultation")} className="bg-primary hover:bg-primary/90">
                                        <Play className="h-4 w-4 mr-2" />
                                        Start
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </DashboardLayout>
    );
}
