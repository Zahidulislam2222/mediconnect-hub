import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { signOut, getCurrentUser, fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth';
import { Save, Loader2 } from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

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
                ? `/register-doctor?id=${authUser.userId}`
                : `/register-patient?id=${authUser.userId}`;

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
        } catch (error) {
            console.error("Profile load failed:", error);
            if (isMounted.current) toast({ variant: "destructive", title: "Error loading profile" });
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

    const updateSchedule = (day: string, field: string, value: any) => {
        setWeeklySchedule((prev: any) => ({
            ...prev, [day]: { ...prev[day], [field]: value }
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const basePayload = {
                name: formData.name, phone: formData.phone,
                avatar: formData.avatar, preferences, address: formData.address
            };

            let profileReq;
            if (userRole === 'doctor') {
                profileReq = api.put(`/doctors/${userId}`, {
                    ...basePayload, doctorId: userId,
                    specialization: formData.specialization, consultationFee: formData.consultationFee, bio: formData.bio,
                });
            } else {
                profileReq = api.put(`/patients/${userId}`, { ...basePayload, userId: userId });
            }

            const promises = [profileReq];

            if (userRole === 'doctor') {
                const finalSchedule: any = {};
                DAYS.forEach(day => {
                    const dayData = weeklySchedule[day] || { active: false, start: "09:00", end: "17:00" };
                    finalSchedule[day] = dayData.active ? `${dayData.start}-${dayData.end}` : "OFF";
                });
                promises.push(api.post(`/doctors/${userId}/schedule`, { schedule: finalSchedule }));
            }

            await Promise.all(promises);

            const updatedUser = { ...localUser, name: formData.name, avatar: formData.avatar, role: userRole };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            window.dispatchEvent(new Event("user-updated"));
            window.dispatchEvent(new Event("storage"));

            toast({ title: "Settings Saved", description: "Your profile has been updated." });
        } catch (error) {
            console.error("Save error:", error);
            toast({ variant: "destructive", title: "Save Failed", description: "Could not update profile." });
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