import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { signOut, getCurrentUser, fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth';
import { Save, Loader2 } from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getRegionalResources } from "../aws-config";
// 🟢 NEW: Import our newly created modular components
import { ProfileInformationCard } from "@/components/settings/ProfileInformationCard";
import { DoctorProfessionalCard } from "@/components/settings/DoctorProfessionalCard";
import { DoctorScheduleCard } from "@/components/settings/DoctorScheduleCard";
import { IntegrationsAndAlertsCard } from "@/components/settings/IntegrationsAndAlertsCard";
import { SettingsSkeleton } from "@/components/settings/SettingsSkeleton";

// HELPER: Generate Time Options (08:00 - 22:00)
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
    
    const [rawAvatarKey, setRawAvatarKey] = useState("");

    const [localUser] = useState(() => {
        const saved = localStorage.getItem('user');
        return saved ? JSON.parse(saved) : { name: "", avatar: "", role: "patient" };
    });

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [userRole] = useState<"patient" | "doctor">(() =>
        (localUser.role === 'doctor' || localUser.role === 'provider') ? 'doctor' : 'patient'
    );
    const [userId, setUserId] = useState("");
    const [calendarConnected, setCalendarConnected] = useState(false);

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

    const [weeklySchedule, setWeeklySchedule] = useState<any>({});
    const [preferences, setPreferences] = useState({ email: true, sms: true, promotional: false });

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
            const cognitoPhone = userAttrs?.phone_number || "";
            setUserId(authUser.userId);

            const endpoint = userRole === 'doctor' 
    ? `/doctors/${authUser.userId}` 
    : `/patients/${authUser.userId}`;

            const data: any = await api.get(endpoint);
            if (data) {
                const profileData = data.Item || data;
                if (isMounted.current) {
                    setFormData(prev => ({
                        ...prev,
                        name: profileData.name || prev.name,
                        email: profileData.email || authUser.signInDetails?.loginId || "",
                        phone: profileData.phone || cognitoPhone || "",
                        address: profileData.address || "",
                        avatar: profileData.avatar || prev.avatar,
                        specialization: profileData.specialization || "General Practice",
                        licenseNumber: profileData.licenseNumber || "",
                        consultationFee: profileData.consultationFee || "",
                        bio: profileData.bio || ""
                    }));
                    setRawAvatarKey(profileData.avatar || "");
                    if (profileData.preferences) setPreferences(profileData.preferences);
                }
            }

            if (userRole === 'doctor') {
                try {
                    const scheduleData: any = await api.get(`/doctors/${authUser.userId}/schedule`);
                    if (scheduleData && isMounted.current) {
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

                    const calStatus: any = await api.get(`/doctors/${authUser.userId}/calendar/status`);
                    if (isMounted.current) setCalendarConnected(calStatus.connected);
                } catch (e) { console.error("Schedule/Calendar load error", e); }
            }
        } catch (error: any) {
        console.error("Operation failed:", error);
        const msg = error?.message || String(error);
        
        // 🟢 STANDARD AUTH RULE
        if (msg.includes('401') || msg.includes('403') || msg.includes('The user is not authenticated')) {
            localStorage.clear();
            navigate("/auth");
            return;
        }
        
        // If it's a 404 on the PROFILE, that's also a security issue
        if (msg.includes('404')) {
            localStorage.clear();
            navigate("/auth");
            return;
        }

        toast({ variant: "destructive", title: "Error", description: "Operation failed. Please try again." });
        } finally {
            if (isMounted.current) setIsLoading(false);
        }
    }

    const [avatarFile, setAvatarFile] = useState<File | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5000000) {
            toast({ variant: "destructive", title: "File too large", description: "Max size is 5MB." });
            return;
        }

        setAvatarFile(file);

        const reader = new FileReader();
        reader.onload = (ev) => {
            setFormData(prev => ({ ...prev, avatar: ev.target?.result as string }));
        };
        reader.readAsDataURL(file);
    };

    const updateSchedule = (day: string, field: string, value: any) => {
        setWeeklySchedule((prev: any) => ({
            ...prev, [day]: { ...prev[day], [field]: value }
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const session = await fetchAuthSession();
            let finalAvatarKey = avatarFile ? "" : rawAvatarKey;

            // 🟢 1. PROFESSIONAL S3 UPLOAD
            if (avatarFile) {
                const resources = getRegionalResources();
                const s3Client = new S3Client({ 
                    region: resources.region, 
                    credentials: session.credentials 
                });

                const fileExt = avatarFile.name.split('.').pop();
                const folder = userRole === 'doctor' ? 'doctor' : 'patient';
                
                // Define key here and immediately assign it to finalAvatarKey
                const newKey = `${folder}/${userId}/profile_picture.${fileExt}`;
                finalAvatarKey = newKey; 

                await s3Client.send(new PutObjectCommand({
                    Bucket: userRole === 'doctor' ? resources.buckets.doctor : resources.buckets.patient,
                    Key: newKey, // 🟢 Use newKey
                    Body: new Uint8Array(await avatarFile.arrayBuffer()),
                    ContentType: avatarFile.type,
                    Tagging: "DataType=Biometric" 
                }));
            }

            // 🟢 2. SAVE PROFILE 
            const basePayload: any = {
                name: formData.name, 
                phone: formData.phone,
                preferences, 
                address: formData.address
            };

            // Only include avatar in the database update if a NEW file was uploaded
            if (finalAvatarKey) {
                basePayload.avatar = finalAvatarKey;
            }

            let profileReq;
            if (userRole === 'doctor') {
                profileReq = api.put(`/doctors/${userId}`, {
                    ...basePayload, 
                    doctorId: userId,
                    specialization: formData.specialization, 
                    bio: formData.bio,
                });
            } else {
                profileReq = api.put(`/patients/${userId}`, { ...basePayload, userId: userId });
            }

            const promises =[profileReq];

            // 🟢 3. Handle Doctor Schedule
            if (userRole === 'doctor') {
                const finalSchedule: any = {};
                DAYS.forEach(day => {
                    const dayData = weeklySchedule[day] || { active: false, start: "09:00", end: "17:00" };
                    finalSchedule[day] = dayData.active ? `${dayData.start}-${dayData.end}` : "OFF";
                });
                promises.push(api.put(`/doctors/${userId}/schedule`, { schedule: finalSchedule }));
            }

            await Promise.all(promises);

            // 🟢 4. Update Local Session
            const updatedUser = { 
                ...localUser, 
                name: formData.name, 
                avatar: avatarFile ? formData.avatar : localUser.avatar, 
                role: userRole 
            };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            
            window.dispatchEvent(new Event("user-updated"));
            window.dispatchEvent(new Event("storage"));

            toast({ title: "Settings Saved", description: "Your profile has been updated." });
            setAvatarFile(null); 
            
        } catch (error: any) {
            console.error("Operation failed:", error);
            const msg = error?.message || String(error);
            
            if (msg.includes('401') || msg.includes('403') || msg.includes('404')) {
                localStorage.clear();
                navigate("/auth");
                return;
            }

            toast({ variant: "destructive", title: "Error", description: "Operation failed. Please try again." });
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut();
            localStorage.removeItem('user');
            navigate("/");
        } catch (error) { console.error("Sign out error", error); }
    };

    const handleDiscard = () => {
        setIsLoading(true);
        loadProfile();
        toast({ title: "Changes Discarded", description: "Form reset to saved values." });
    };

    const handleConnectCalendar = async () => {
        try {
            const res: any = await api.get(`/doctors/auth/google?id=${userId}`);
            if (res.url) window.location.href = res.url;
        } catch (e) { toast({ variant: "destructive", title: "Connection Failed" }); }
    };

    const handleDisconnectCalendar = async () => {
        try {
            await api.delete(`/doctors/${userId}/calendar`);
            setCalendarConnected(false);
            toast({ title: "Disconnected", description: "Google Calendar sync stopped." });
        } catch (e) { toast({ variant: "destructive", title: "Error" }); }
    };

    const handleDeleteAccount = async () => {
    const confirm = window.confirm("Are you absolutely sure? This cannot be undone.");
    if (!confirm) return;

    try {
        if (userRole === 'patient') {
            await api.delete('/me');
            toast({ title: "Account Deleted", description: "Your identity has been erased." });
            handleLogout(); // Clean up local storage and redirect
        } else {
            // Doctors send a request or call the delete endpoint if allowed
            toast({ title: "Request Sent", description: "Admin will review your closure request." });
        }
    } catch (e) {
        toast({ variant: "destructive", title: "Error", description: "Could not complete deletion." });
    }
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
                <SettingsSkeleton userRole={userRole} />
            ) : (
                <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-10">
                    <ProfileInformationCard 
                        formData={formData} 
                        setFormData={setFormData} 
                        userRole={userRole} 
                        fileInputRef={fileInputRef} 
                        handleFileChange={handleFileChange} 
                    />

                    <DoctorProfessionalCard 
                        formData={formData} 
                        setFormData={setFormData} 
                        userRole={userRole} 
                    />

                    <DoctorScheduleCard 
                        weeklySchedule={weeklySchedule} 
                        updateSchedule={updateSchedule} 
                        DAYS={DAYS} 
                        TIME_OPTIONS={TIME_OPTIONS} 
                        userRole={userRole} 
                    />

                    <IntegrationsAndAlertsCard 
                        preferences={preferences} 
                        setPreferences={setPreferences} 
                        calendarConnected={calendarConnected} 
                        handleConnectCalendar={handleConnectCalendar} 
                        handleDisconnectCalendar={handleDisconnectCalendar} 
                        userRole={userRole} 
                    />

                    <div className="mt-12 p-6 border border-red-200 rounded-xl bg-red-50/30">
                        <h3 className="text-lg font-bold text-red-700">Danger Zone</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Once you delete your account, your identity will be erased. 
                            Medical records will be anonymized per HIPAA/GDPR legal compliance.
                        </p>
                        <Button 
                            variant="destructive" 
                            onClick={handleDeleteAccount}
                            className="bg-red-600 hover:bg-red-700 shadow-sm"
                        >
                            {userRole === 'doctor' ? 'Request Account Closure' : 'Delete My Account'}
                        </Button>
                    </div>

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