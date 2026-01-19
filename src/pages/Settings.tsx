import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { signOut, getCurrentUser } from 'aws-amplify/auth';
import {
    User,
    Shield,
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
    FileText
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// --- OPTIMIZATION: Skeleton Loader Component ---
const SettingsSkeleton = () => (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
        {/* Header Skeleton */}
        <div className="h-40 rounded-xl bg-muted/20 animate-pulse border border-border/40" />
        {/* Form Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-12 rounded-lg bg-muted/20 animate-pulse" />
            <div className="h-12 rounded-lg bg-muted/20 animate-pulse" />
            <div className="h-12 rounded-lg bg-muted/20 animate-pulse" />
            <div className="h-12 rounded-lg bg-muted/20 animate-pulse" />
        </div>
        {/* Notifications Skeleton */}
        <div className="h-32 rounded-xl bg-muted/20 animate-pulse border border-border/40" />
    </div>
);

export default function Settings() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- STATE INITIALIZATION (Optimized) ---
    // 1. Read from LocalStorage IMMEDIATELLY to prevent "Generic Sidebar" flicker
    const [localUser] = useState(() => {
        const saved = localStorage.getItem('user');
        return saved ? JSON.parse(saved) : { name: "", avatar: "", role: "patient" };
    });

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Normalize Role: Ensure 'provider' maps to 'doctor'
    const [userRole, setUserRole] = useState<"patient" | "doctor">(() =>
        (localUser.role === 'doctor' || localUser.role === 'provider') ? 'doctor' : 'patient'
    );

    const [userId, setUserId] = useState("");

    // Unified Form Data
    const [formData, setFormData] = useState({
        name: localUser.name || "",
        email: "",
        phone: "",
        address: "",
        avatar: localUser.avatar || "",
        // Doctor Specific Fields (with smart defaults)
        specialization: "General Practice",
        licenseNumber: "",
        consultationFee: "",
        bio: ""
    });

    const [preferences, setPreferences] = useState({
        email: true,
        sms: true,
        promotional: false
    });

    // --- 1. LOAD DATA ---
    useEffect(() => {
        async function loadProfile() {
            try {
                const authUser = await getCurrentUser();
                setUserId(authUser.userId);

                // Determine Endpoint based on validated role
                const endpoint = userRole === 'doctor'
                    ? `${API_BASE_URL}/register-doctor?id=${authUser.userId}`
                    : `${API_BASE_URL}/register-patient?id=${authUser.userId}`;

                const response = await fetch(endpoint);

                if (response.ok) {
                    const rawData = await response.json();
                    // 🟢 FIX: Handle DynamoDB "Item" wrapper if present
                    const data = rawData.Item || rawData;

                    // 🟢 FIX: Safe Merge to prevent blank inputs
                    setFormData(prev => ({
                        ...prev,
                        name: data.name || prev.name,
                        email: data.email || authUser.signInDetails?.loginId || "",
                        phone: data.phone || "",
                        address: data.address || "",
                        avatar: data.avatar || prev.avatar,
                        // Doctor specific
                        specialization: data.specialization || "General Practice",
                        licenseNumber: data.licenseNumber || "",
                        consultationFee: data.consultationFee || "",
                        bio: data.bio || ""
                    }));

                    if (data.preferences) {
                        setPreferences(data.preferences);
                    }
                }
            } catch (error) {
                console.error("Profile load failed:", error);
                // Don't show error toast on 404 (new user), just let them fill form
            } finally {
                setIsLoading(false);
            }
        }
        loadProfile();
    }, [userRole]);

    // --- 2. HANDLE AVATAR UPLOAD ---
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 50000) {
            toast({
                variant: "destructive",
                title: "File too large",
                description: "Max size is 50KB for profile optimization.",
            });
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            setFormData(prev => ({ ...prev, avatar: ev.target?.result as string }));
        };
        reader.readAsDataURL(file);
    };

    // --- 3. SAVE CHANGES (Unified PUT) ---
    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Dynamic Payload Construction
            const basePayload = {
                name: formData.name,
                phone: formData.phone,
                avatar: formData.avatar,
                preferences: preferences,
                address: formData.address
            };

            let finalPayload;
            let endpoint;

            if (userRole === 'doctor') {
                endpoint = `${API_BASE_URL}/register-doctor`;
                finalPayload = {
                    ...basePayload,
                    doctorId: userId, // 🟢 CRITICAL: Use correct ID key
                    specialization: formData.specialization,
                    consultationFee: formData.consultationFee,
                    bio: formData.bio,
                };
            } else {
                endpoint = `${API_BASE_URL}/register-patient`;
                finalPayload = {
                    ...basePayload,
                    userId: userId, // 🟢 CRITICAL: Use correct ID key
                };
            }

            const response = await fetch(endpoint, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(finalPayload)
            });

            if (!response.ok) throw new Error("Update failed");

            // Update Local Storage & Sync Sidebar Instantly
            const updatedUser = {
                ...localUser,
                name: formData.name,
                avatar: formData.avatar,
                role: userRole
            };

            localStorage.setItem('user', JSON.stringify(updatedUser));

            // Dispatch events to update Sidebar without reload
            window.dispatchEvent(new Event("user-updated"));
            window.dispatchEvent(new Event("storage"));

            toast({
                title: "Settings Saved",
                description: "Your profile has been updated successfully.",
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
        await signOut();
        localStorage.removeItem('user');
        navigate("/");
    };

    const getInitials = (n: string) => {
        if (!n) return userRole === 'doctor' ? "DR" : "PT";
        const parts = n.trim().split(" ");
        return parts.length === 1 ? n.substring(0, 2).toUpperCase() : (parts[0][0] + parts[1][0]).toUpperCase();
    };

    return (
        <DashboardLayout
            title="Account Settings"
            subtitle={`Manage your ${userRole} profile`}
            userRole={userRole}
            userName={formData.name || localUser.name} // Fallback to local
            userAvatar={formData.avatar || localUser.avatar} // Fallback to local
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
                            {/* Avatar Row */}
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
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="font-medium text-lg">Profile Picture</h3>
                                    <p className="text-sm text-muted-foreground">
                                        JPG or PNG. Max size 50KB.
                                    </p>
                                </div>
                            </div>

                            {/* Basic Info Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Full Name</Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="name"
                                            className="pl-9"
                                            value={formData.name}
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
                                            id="email"
                                            className="pl-9 pr-9 bg-muted/50 cursor-not-allowed text-muted-foreground"
                                            value={formData.email}
                                            readOnly
                                        />
                                        <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground/50" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone Number</Label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="phone"
                                            className="pl-9"
                                            placeholder="+1 (555) 000-0000"
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
                                            id="address"
                                            className="pl-9"
                                            value={formData.address}
                                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                            placeholder="123 Medical Center Blvd"
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* --- 2. DOCTOR SPECIFIC CARD --- */}
                    {userRole === 'doctor' && (
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
                                                id="specialization"
                                                className="pl-9"
                                                value={formData.specialization}
                                                onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="fee">Consultation Fee ($)</Label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="fee"
                                                type="number"
                                                className="pl-9"
                                                value={formData.consultationFee}
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
                                                id="license"
                                                className="pl-9 bg-muted/50"
                                                value={formData.licenseNumber}
                                                readOnly
                                                placeholder="PENDING"
                                            />
                                            <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground/50" />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bio">Professional Bio</Label>
                                    <Textarea
                                        id="bio"
                                        placeholder="Describe your experience, education, and medical focus..."
                                        className="min-h-[100px] resize-none"
                                        value={formData.bio}
                                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* --- 3. NOTIFICATIONS (Common) --- */}
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
                            <Button variant="ghost" onClick={() => window.location.reload()} disabled={isSaving}>
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