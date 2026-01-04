import { useNavigate } from "react-router-dom";
import {
    User,
    Bell,
    Shield,
    CreditCard,
    Globe,
    Moon,
    Smartphone,
    LogOut
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label"; // Assuming you have a Label component or use standard label
import { currentUser, currentDoctor } from "@/lib/mockData";

interface SettingsProps {
    role?: "patient" | "doctor";
}

export default function Settings({ role = "patient" }: SettingsProps) {
    const navigate = useNavigate();
    const user = role === "patient" ? currentUser : currentDoctor;

    const handleLogout = () => {
        navigate("/");
    };

    return (
        <DashboardLayout
            title="Settings"
            subtitle="Manage your account preferences"
            userRole={role}
            userName={user.name}
            userAvatar={user.avatar}
            onLogout={handleLogout}
        >
            <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-10">

                {/* Profile Section */}
                <Card className="shadow-card border-border/50">
                    <CardHeader>
                        <CardTitle>Profile Information</CardTitle>
                        <CardDescription>Update your personal details and public profile</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-20 w-20">
                                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} />
                                <AvatarFallback>{user.name[0]}</AvatarFallback>
                            </Avatar>
                            <div className="space-y-2">
                                <Button variant="outline" size="sm">Change Avatar</Button>
                                <p className="text-xs text-muted-foreground">JPG, GIF or PNG. 1MB max.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName">Full Name</Label>
                                <div className="px-3 py-2 border rounded-md bg-secondary/20">{user.name}</div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <div className="px-3 py-2 border rounded-md bg-secondary/20">{user.email}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Notifications */}
                <Card className="shadow-card border-border/50">
                    <CardHeader>
                        <CardTitle>Notifications</CardTitle>
                        <CardDescription>Configure how you receive alerts and updates</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <div className="font-medium">Appointment Reminders</div>
                                <div className="text-sm text-muted-foreground">Receive notifications for upcoming visits</div>
                            </div>
                            <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <div className="font-medium">Test Results</div>
                                <div className="text-sm text-muted-foreground">Get notified when lab results are ready</div>
                            </div>
                            <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <div className="font-medium">Promotional Emails</div>
                                <div className="text-sm text-muted-foreground">Receive news about new features and updates</div>
                            </div>
                            <Switch />
                        </div>
                    </CardContent>
                </Card>

                {/* Security */}
                <Card className="shadow-card border-border/50">
                    <CardHeader>
                        <CardTitle>Security & Privacy</CardTitle>
                        <CardDescription>Manage your password and active sessions</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                    <Shield className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="font-medium">Two-Factor Authentication</p>
                                    <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                                </div>
                            </div>
                            <Button variant="outline">Enable</Button>
                        </div>
                        <Button variant="destructive" className="w-full sm:w-auto">
                            Delete Account
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
