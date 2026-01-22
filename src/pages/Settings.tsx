import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { signOut, getCurrentUser, fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth';
import {
    User,
    Camera,
    Save,
    Loader2,
    Mail,
    MapPin,
    Phone,
    Lock,
    Smartphone,
    Stethoscope,
    BadgeCheck,
    DollarSign,
    FileText,
    Clock // 🟢 Added Icon
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const SettingsSkeleton = () => (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
        <Card className="shadow-card border-border/50">
            <CardHeader>
                <div className="flex justify-between">
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-4 w-60" />
                    </div>
                    <Skeleton className="h-6 w-24 rounded-full" />
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center gap-6 pb-6 border-b border-border/40">
                    <Skeleton className="h-24 w-24 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-48" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            </CardContent>
        </Card>
        <Card className="shadow-card border-border/50">
            <CardHeader>
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-64 w-full" />
            </CardContent>
        </Card>
    </div>
);

// 🟢 HELPER: Generate Time Options (08:00 - 20:00)
const generateTimeOptions = () => {
    const times = [];
    for (let i = 7; i <= 22; i++) {
        const hour = i < 10 ? `0${i}` : i;
        times.push(`${hour}:00`);
        times.push(`${hour}:30`);
    }
    return times;
};
const TIME_OPTIONS = generateTimeOptions();
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function Settings() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isMounted = useRef(true);

    const [localUser] = useState(() => {
        const saved = localStorage.getItem('user');
        return saved ? JSON.parse(saved) : { name: "", avatar: "", role: "patient" };
    });

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [userRole, setUserRole] = useState<"patient" | "doctor">(() =>
        (localUser.role === 'doctor' || localUser.role === 'provider') ? 'doctor' : 'patient'
    );

    const [userId, setUserId] = useState("");

    const [formData, setFormData] = useState({
        name: localUser.name || "",
        email: "",
        phone: "",
        address: "",
        avatar: localUser.avatar || "",
        specialization: "General Practice",
        licenseNumber: "",
        consultationFee: "",
        bio: ""
    });

    // 🟢 NEW STATE: Doctor Schedule
    const [weeklySchedule, setWeeklySchedule] = useState<any>({});

    const [preferences, setPreferences] = useState({
        email: true,
        sms: true,
        promotional: false
    });

    useEffect(() => {
        isMounted.current = true;
        loadProfile();
        return () => { isMounted.current = false; };
    }, [userRole]);

    async function loadProfile() {
        try {
            const [session, authUser, userAttrs] = await Promise.all([
                fetchAuthSession(),
                getCurrentUser(),
                fetchUserAttributes().catch(() => ({} as any))
            ]);

            if (!isMounted.current) return;

            const token = session.tokens?.idToken?.toString();
            const cognitoPhone = userAttrs?.phone_number || "";

            setUserId(authUser.userId);

            // 1. Load Basic Profile
            const endpoint = userRole === 'doctor'
                ? `${API_BASE_URL}/register-doctor?id=${authUser.userId}`
                : `${API_BASE_URL}/register-patient?id=${authUser.userId}`;

            const response = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const rawData = await response.json();
                const data = rawData.Item || rawData;

                if (isMounted.current) {
                    setFormData(prev => ({
                        ...prev,
                        name: data.name || prev.name,
                        email: data.email || authUser.signInDetails?.loginId || "",
                        phone: data.phone || cognitoPhone || "",
                        address: data.address || "",
                        avatar: data.avatar || prev.avatar,
                        specialization: data.specialization || "General Practice",
                        licenseNumber: data.licenseNumber || "",
                        consultationFee: data.consultationFee || "",
                        bio: data.bio || ""
                    }));

                    if (data.preferences) setPreferences(data.preferences);
                }
            }

            // 🟢 2. Load Doctor Schedule (Separate standard standard fetch)
            if (userRole === 'doctor') {
                try {
                    const scheduleRes = await fetch(`${API_BASE_URL}/doctor-schedule?doctorId=${authUser.userId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (scheduleRes.ok) {
                        const scheduleData = await scheduleRes.json();
                        // Parse DB format ({"Mon": "09:00-17:00"}) to UI format
                        const schedule = scheduleData.schedule || {};
                        const parsedSchedule: any = {};

                        DAYS.forEach(day => {
                            const val = schedule[day];
                            if (val && val !== "OFF") {
                                const [start, end] = val.split('-');
                                parsedSchedule[day] = { active: true, start, end };
                            } else {
                                parsedSchedule[day] = { active: false, start: "09:00", end: "17:00" };
                            }
                        });
                        setWeeklySchedule(parsedSchedule);
                    }
                } catch (e) {
                    console.error("Schedule load error", e);
                }
            }

        } catch (error) {
            console.error("Profile load failed:", error);
            if (isMounted.current) {
                toast({
                    variant: "destructive",
                    title: "Error loading profile",
                    description: "Please refresh the page.",
                });
            }
        } finally {
            if (isMounted.current) setIsLoading(false);
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2000000) {
            toast({ variant: "destructive", title: "File too large", description: "Max size is 2MB." });
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            setFormData(prev => ({ ...prev, avatar: ev.target?.result as string }));
        };
        reader.readAsDataURL(file);
    };

    // 🟢 HELPER: Update Schedule State
    const updateSchedule = (day: string, field: string, value: any) => {
        setWeeklySchedule((prev: any) => ({
            ...prev,
            [day]: {
                ...prev[day],
                [field]: value
            }
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const session = await fetchAuthSession();
            const token = session.tokens?.idToken?.toString();

            const basePayload = {
                name: formData.name,
                phone: formData.phone,
                avatar: formData.avatar,
                preferences: preferences,
                address: formData.address
            };

            // 1. Save Profile
            let profileEndpoint;
            let profilePayload;

            if (userRole === 'doctor') {
                profileEndpoint = `${API_BASE_URL}/register-doctor`;
                profilePayload = {
                    ...basePayload,
                    doctorId: userId,
                    specialization: formData.specialization,
                    consultationFee: formData.consultationFee,
                    bio: formData.bio,
                };
            } else {
                profileEndpoint = `${API_BASE_URL}/register-patient`;
                profilePayload = { ...basePayload, userId: userId };
            }

            const profileReq = fetch(profileEndpoint, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify(profilePayload)
            });

            // 🟢 2. Save Schedule (If Doctor)
            const promises = [profileReq];

            if (userRole === 'doctor') {
                // Convert UI Format back to DB Format (e.g., "09:00-17:00" or "OFF")
                const finalSchedule: any = {};
                DAYS.forEach(day => {
                    const dayData = weeklySchedule[day] || { active: false, start: "09:00", end: "17:00" };
                    if (dayData.active) {
                        finalSchedule[day] = `${dayData.start}-${dayData.end}`;
                    } else {
                        finalSchedule[day] = "OFF";
                    }
                });

                const scheduleReq = fetch(`${API_BASE_URL}/doctor-schedule`, {
                    method: "POST", // Python Lambda expects POST
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({
                        doctorId: userId,
                        schedule: finalSchedule
                    })
                });
                promises.push(scheduleReq);
            }

            await Promise.all(promises);

            // Update local storage
            const updatedUser = {
                ...localUser,
                name: formData.name,
                avatar: formData.avatar,
                role: userRole
            };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            window.dispatchEvent(new Event("user-updated"));
            window.dispatchEvent(new Event("storage"));

            toast({
                title: "Settings Saved",
                description: "Your profile and schedule have been updated.",
            });

        } catch (error) {
            console.error("Save error:", error);
            toast({
                variant: "destructive",
                title: "Save Failed",
                description: "Could not update profile. Please try again.",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut();
            localStorage.removeItem('user');
            navigate("/");
        } catch (error) {
            console.error("Sign out error", error);
        }
    };

    const getInitials = (n: string) => {
        if (!n) return userRole === 'doctor' ? "DR" : "PT";
        const parts = n.trim().split(" ");
        return parts.length === 1 ? n.substring(0, 2).toUpperCase() : (parts[0][0] + parts[1][0]).toUpperCase();
    };

    const handleDiscard = () => {
        setIsLoading(true);
        loadProfile();
        toast({ title: "Changes Discarded", description: "Form reset to saved values." });
    };

    return (
        <DashboardLayout
            title="Account Settings"
            subtitle={`Manage your ${userRole} profile`}
            userRole={userRole}
            userName={formData.name || localUser.name}
            userAvatar={formData.avatar || localUser.avatar}
            onLogout={handleLogout}
        >
            {isLoading ? (
                <SettingsSkeleton />
            ) : (
                <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-10">
                    {/* --- 1. COMMON PROFILE HEADER --- */}
                    <Card className="shadow-card border-border/50 bg-card">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle>Profile Information</CardTitle>
                                    <CardDescription>Update your photo and personal details</CardDescription>
                                </div>
                                <Badge variant={userRole === 'doctor' ? "default" : "secondary"} className="uppercase">
                                    {userRole} Account
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center gap-6 pb-6 border-b border-border/40">
                                <div className="relative group">
                                    <Avatar className="h-24 w-24 border-4 border-background shadow-sm ring-2 ring-muted">
                                        <AvatarImage src={formData.avatar} className="object-cover" />
                                        <AvatarFallback className="text-xl bg-primary/10 text-primary font-bold">
                                            {getInitials(formData.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div
                                        className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full shadow-md cursor-pointer hover:bg-primary/90 transition-transform active:scale-95"
                                        onClick={() => fileInputRef.current?.click()}
                                        title="Change Photo"
                                    >
                                        <Camera className="h-4 w-4" />
                                    </div>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="font-medium text-lg">Profile Picture</h3>
                                    <p className="text-sm text-muted-foreground">JPG or PNG. Max size 2MB.</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Full Name</Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="name" className="pl-9" value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="John Doe"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email Address</Label>
                                    <div className="relative group">
                                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="email" className="pl-9 pr-9 bg-muted/50 cursor-not-allowed text-muted-foreground"
                                            value={formData.email} readOnly
                                        />
                                        <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground/50" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone Number</Label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="phone" className="pl-9" placeholder="+1 (555) 000-0000"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="address">{userRole === 'doctor' ? "Clinic Address" : "Home Address"}</Label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="address" className="pl-9" value={formData.address}
                                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                            placeholder="123 Medical Center Blvd"
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* --- 2. DOCTOR SPECIFIC DETAILS --- */}
                    {userRole === 'doctor' && (
                        <>
                            <Card className="shadow-card border-border/50">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Stethoscope className="h-5 w-5 text-primary" />
                                        Professional Details
                                    </CardTitle>
                                    <CardDescription>Manage your public practice information</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="specialization">Specialization</Label>
                                            <div className="relative">
                                                <BadgeCheck className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="specialization" className="pl-9" value={formData.specialization}
                                                    onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="fee">Consultation Fee ($)</Label>
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="fee" type="number" className="pl-9" value={formData.consultationFee}
                                                    onChange={(e) => setFormData({ ...formData, consultationFee: e.target.value })}
                                                    placeholder="150"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="license">Medical License ID</Label>
                                            <div className="relative">
                                                <FileText className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="license" className="pl-9 bg-muted/50" value={formData.licenseNumber}
                                                    readOnly placeholder="PENDING"
                                                />
                                                <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground/50" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="bio">Professional Bio</Label>
                                        <Textarea
                                            id="bio" placeholder="Describe your experience..."
                                            className="min-h-[100px] resize-none" value={formData.bio}
                                            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* 🟢 3. NEW SCHEDULE CARD --- */}
                            <Card className="shadow-card border-border/50">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Clock className="h-5 w-5 text-primary" />
                                        Weekly Schedule
                                    </CardTitle>
                                    <CardDescription>Set your availability for patient appointments</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {DAYS.map((day) => {
                                        const schedule = weeklySchedule[day] || { active: false, start: "09:00", end: "17:00" };
                                        return (
                                            <div key={day} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-lg border border-border/40 hover:bg-muted/30 transition-colors">
                                                <div className="flex items-center gap-3 min-w-[140px]">
                                                    <Switch
                                                        checked={schedule.active}
                                                        onCheckedChange={(checked) => updateSchedule(day, 'active', checked)}
                                                    />
                                                    <span className={`font-medium ${schedule.active ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                        {day}
                                                    </span>
                                                </div>

                                                {schedule.active ? (
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <div className="relative flex-1">
                                                            <select
                                                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                                value={schedule.start}
                                                                onChange={(e) => updateSchedule(day, 'start', e.target.value)}
                                                            >
                                                                {TIME_OPTIONS.map(t => (
                                                                    <option key={`start-${t}`} value={t}>{t}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <span className="text-muted-foreground">-</span>
                                                        <div className="relative flex-1">
                                                            <select
                                                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                                value={schedule.end}
                                                                onChange={(e) => updateSchedule(day, 'end', e.target.value)}
                                                            >
                                                                {TIME_OPTIONS.map(t => (
                                                                    <option key={`end-${t}`} value={t}>{t}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex-1 text-center sm:text-left text-sm text-muted-foreground italic pl-2">
                                                        Unavailable / Off
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        </>
                    )}

                    {/* --- 4. NOTIFICATIONS (Common) --- */}
                    <Card className="shadow-card border-border/50">
                        <CardHeader>
                            <CardTitle>Notifications</CardTitle>
                            <CardDescription>Configure alerts</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <div className="font-medium flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-primary" /> Email Alerts
                                    </div>
                                    <div className="text-sm text-muted-foreground">Receive booking updates via email</div>
                                </div>
                                <Switch
                                    checked={preferences.email}
                                    onCheckedChange={(c) => setPreferences({ ...preferences, email: c })}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <div className="font-medium flex items-center gap-2">
                                        <Smartphone className="h-4 w-4 text-primary" /> SMS Alerts
                                    </div>
                                    <div className="text-sm text-muted-foreground">Get text messages for urgent updates</div>
                                </div>
                                <Switch
                                    checked={preferences.sms}
                                    onCheckedChange={(c) => setPreferences({ ...preferences, sms: c })}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* ACTION BAR */}
                    <div className="flex justify-end gap-4 sticky bottom-6 z-10">
                        <div className="bg-background/80 backdrop-blur-sm p-2 rounded-xl shadow-lg border border-border/50 flex gap-4">
                            <Button variant="ghost" onClick={handleDiscard} disabled={isSaving}>
                                Discard
                            </Button>
                            <Button onClick={handleSave} disabled={isSaving} className="min-w-[140px] shadow-md bg-blue-600 hover:bg-blue-700">
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}