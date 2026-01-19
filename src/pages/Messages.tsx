import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import {
    Search, Send, Phone, Video, MoreVertical,
    Image as ImageIcon, Paperclip, Loader2, Calendar, ChevronLeft
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const API_URL = import.meta.env.VITE_API_BASE_URL || "";

export default function Messages() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const scrollRef = useRef<HTMLDivElement>(null);

    // --- STATE ---
    const [user, setUser] = useState<any>({ name: "", id: "", role: "" });
    const [rawAppointments, setRawAppointments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // UI State
    const [activeContactId, setActiveContactId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [inputText, setInputText] = useState("");

    // Local Chat History (Simulates persistence since we lack a Chat DB)
    const [chatHistory, setChatHistory] = useState<Record<string, any[]>>({});

    // --- 1. INITIAL LOAD ---
    useEffect(() => {
        loadData();
    }, []);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [chatHistory, activeContactId]);

    const loadData = async () => {
        try {
            const authUser = await getCurrentUser();
            // Fetch User Profile to get Name/Role
            // We use the register-doctor endpoint as it returns the comprehensive profile
            const profileRes = await fetch(`${API_URL}/register-doctor?id=${authUser.userId}`);
            let profile = { name: "User", role: "patient", avatar: null };

            if (profileRes.ok) {
                const data = await profileRes.json();
                // Handle different lambda return structures
                const pData = data.doctors?.find((d: any) => d.doctorId === authUser.userId) || data;
                profile = {
                    name: pData.name || "User",
                    role: pData.role || "patient",
                    avatar: pData.avatar || null
                };
            }

            setUser({ ...profile, id: authUser.userId });

            // Fetch Appointment History (To build Contact List)
            // Logic: Doctor fetches by doctorId, Patient fetches by patientId
            const isDoctor = ['doctor', 'provider'].includes((profile.role || '').toLowerCase());
            const paramKey = isDoctor ? 'doctorId' : 'patientId';
            const scheduleRes = await fetch(`${API_URL}/doctor-schedule?${paramKey}=${authUser.userId}`);

            if (scheduleRes.ok) {
                const items = await scheduleRes.json();
                setRawAppointments(Array.isArray(items) ? items : []);
            }

        } catch (err) {
            console.error("Load Error", err);
            toast({ variant: "destructive", title: "Connection Error", description: "Could not load contacts." });
        } finally {
            setIsLoading(false);
        }
    };

    // --- 2. CONTACT LIST BUILDER (The Logic Core) ---
    const contacts = useMemo(() => {
        if (!user.id || rawAppointments.length === 0) return [];

        const uniqueMap = new Map();

        rawAppointments.forEach((apt) => {
            // Determine "The Other Person"
            const isMeDoctor = user.role === 'doctor';
            const contactId = isMeDoctor ? apt.patientId : apt.doctorId;
            const contactName = isMeDoctor ? apt.patientName : apt.doctorName;

            // Skip invalid records
            if (!contactId || !contactName) return;

            // Update only if this appointment is newer than what we have stored
            // OR if we haven't seen this person yet
            const existing = uniqueMap.get(contactId);
            const aptDate = new Date(apt.timeSlot || apt.createdAt);

            if (!existing || new Date(existing.lastInteraction) < aptDate) {
                uniqueMap.set(contactId, {
                    id: contactId,
                    name: contactName, // Raw name from DB (e.g., "ZAPA" or "Dr. Smith")
                    role: isMeDoctor ? "Patient" : "Doctor", // Static based on relationship
                    lastInteraction: apt.timeSlot || apt.createdAt,
                    avatar: null, // Appointments table doesn't have avatars, fallback to initials
                    status: apt.status
                });
            }
        });

        // Convert Map to Array & Sort by Date (Newest first)
        let list = Array.from(uniqueMap.values()).sort((a, b) =>
            new Date(b.lastInteraction).getTime() - new Date(a.lastInteraction).getTime()
        );

        // Client-side Search Filter
        if (searchQuery.trim()) {
            const lowerQ = searchQuery.toLowerCase();
            list = list.filter(c => c.name.toLowerCase().includes(lowerQ));
        }

        return list;
    }, [rawAppointments, user.role, user.id, searchQuery]);

    // Select first contact automatically if none selected
    useEffect(() => {
        if (!activeContactId && contacts.length > 0) {
            setActiveContactId(contacts[0].id);
        }
    }, [contacts, activeContactId]);

    // --- 3. HELPER FUNCTIONS ---

    // Smart Initials: "Dr. John Smith" -> "JS", "ZAPA" -> "ZA"
    const getInitials = (name: string) => {
        if (!name) return "??";
        const clean = name.replace(/Dr\.\s?/i, "").trim();
        const parts = clean.split(" ");

        if (parts.length === 1) return clean.substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[1][0]).toUpperCase();
    };

    const formatTime = (isoString: string) => {
        if (!isoString) return "";
        const date = new Date(isoString);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();

        return isToday
            ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    // --- 4. CHAT ACTIONS ---
    const handleSendMessage = () => {
        if (!inputText.trim() || !activeContactId) return;

        const newMessage = {
            id: Date.now(),
            senderId: user.id,
            text: inputText,
            time: new Date().toISOString()
        };

        // Update Local State
        setChatHistory(prev => ({
            ...prev,
            [activeContactId]: [...(prev[activeContactId] || []), newMessage]
        }));

        setInputText("");

        // Simulate "Read" status or simple confirmation
        setTimeout(() => {
            if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    const handleLogout = async () => {
        await signOut();
        navigate("/");
    };

    // Get Active Contact Object
    const activeContact = contacts.find(c => c.id === activeContactId);

    // Get Messages for Active Contact (Merge System Messages from Appointments)
    const activeMessages = useMemo(() => {
        if (!activeContactId) return [];

        // 1. User Typed Messages
        const userMsgs = chatHistory[activeContactId] || [];

        // 2. System Messages derived from Appointments (Context)
        // Find all appointments for this specific contact
        const contactApts = rawAppointments.filter(a =>
            a.patientId === activeContactId || a.doctorId === activeContactId
        );

        const systemMsgs = contactApts.map(a => ({
            id: `sys-${a.appointmentId}`,
            senderId: "system",
            text: `Appointment ${a.status}: ${new Date(a.timeSlot).toLocaleString()}`,
            time: a.createdAt || a.timeSlot,
            isSystem: true
        }));

        // Merge and Sort
        return [...systemMsgs, ...userMsgs].sort((a, b) =>
            new Date(a.time).getTime() - new Date(b.time).getTime()
        );

    }, [activeContactId, chatHistory, rawAppointments]);

    // --- SKELETON LOADERS ---
    const SidebarSkeleton = () => (
        <div className="p-4 flex items-center gap-3 border-l-4 border-transparent">
            <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
            <div className="space-y-2 flex-1">
                <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                <div className="h-2 w-16 bg-muted animate-pulse rounded" />
            </div>
        </div>
    );

    return (
        <DashboardLayout
            title="Messages"
            subtitle="Secure communication history"
            userRole={user.role}
            userName={user.name}
            userAvatar={user.avatar}
            onLogout={handleLogout}
        >
            <div className="h-[calc(100vh-12rem)] min-h-[500px] flex rounded-xl overflow-hidden border border-border/50 bg-card shadow-sm animate-fade-in">

                {/* 1. SIDEBAR (Contact List) */}
                <div className={cn(
                    "border-r border-border/50 bg-slate-50/50 flex flex-col transition-all",
                    "w-full md:w-80",
                    activeContactId ? "hidden md:flex" : "flex"
                )}>
                    <div className="p-4 border-b border-border/50 bg-white">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search contacts..."
                                className="pl-9 bg-slate-50"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {isLoading ? (
                            <>
                                <SidebarSkeleton /><SidebarSkeleton /><SidebarSkeleton />
                            </>
                        ) : contacts.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                <p>No contacts found.</p>
                                <p className="text-xs mt-1">Book an appointment to start chatting.</p>
                            </div>
                        ) : (
                            contacts.map((contact) => (
                                <div
                                    key={contact.id}
                                    className={cn(
                                        "p-4 flex items-center gap-3 cursor-pointer hover:bg-white transition-colors border-l-4 border-b border-b-slate-100",
                                        activeContactId === contact.id
                                            ? "bg-white border-l-primary shadow-sm"
                                            : "border-l-transparent"
                                    )}
                                    onClick={() => setActiveContactId(contact.id)}
                                >
                                    <div className="relative">
                                        <Avatar>
                                            <AvatarImage src={contact.avatar} />
                                            <AvatarFallback className="bg-indigo-100 text-indigo-700 font-semibold">
                                                {getInitials(contact.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        {/* Status Dot (Fake 'Online' for UI polish) */}
                                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-0.5">
                                            <span className="font-semibold text-sm truncate text-slate-900">{contact.name}</span>
                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                {formatTime(contact.lastInteraction)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                            {contact.role}
                                            {contact.status === 'COMPLETED' && <span className="text-green-600">• Completed</span>}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 2. CHAT AREA */}
                <div className={cn(
                    "flex-1 flex-col bg-white",
                    !activeContactId ? "hidden md:flex" : "flex"
                )}>
                    {activeContact ? (
                        <>
                            {/* Header */}
                            <div className="p-4 border-b border-border/50 flex items-center justify-between bg-white shadow-sm z-10">
                                <div className="flex items-center gap-3">
                                    {/* Mobile Back Button */}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="md:hidden -ml-2"
                                        onClick={() => setActiveContactId(null)}
                                    >
                                        <ChevronLeft className="h-5 w-5" />
                                    </Button>

                                    <Avatar className="h-10 w-10">
                                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                            {getInitials(activeContact.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h3 className="font-semibold text-sm">{activeContact.name}</h3>
                                        <p className="text-xs text-green-600 flex items-center gap-1">
                                            <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                                            Available
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" title="Audio Call">
                                        <Phone className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                    <Button variant="ghost" size="icon" title="Video Call" onClick={() => navigate('/consultation')}>
                                        <Video className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                </div>
                            </div>

                            {/* Messages Body */}
                            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/30">
                                {activeMessages.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                                        <ImageIcon className="h-12 w-12 mb-2 stroke-1" />
                                        <p>No messages yet</p>
                                    </div>
                                ) : (
                                    activeMessages.map((msg: any) => {
                                        const isMe = msg.senderId === user.id;

                                        if (msg.isSystem) {
                                            return (
                                                <div key={msg.id} className="flex justify-center my-4">
                                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1 rounded-full border flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {msg.text}
                                                    </span>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div
                                                key={msg.id}
                                                className={cn(
                                                    "flex animate-in slide-in-from-bottom-2",
                                                    isMe ? "justify-end" : "justify-start"
                                                )}
                                            >
                                                <div
                                                    className={cn(
                                                        "max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                                                        isMe
                                                            ? "bg-primary text-primary-foreground rounded-br-none"
                                                            : "bg-white text-slate-800 border border-slate-100 rounded-bl-none"
                                                    )}
                                                >
                                                    <p>{msg.text}</p>
                                                    <span className={cn(
                                                        "text-[10px] block text-right mt-1 opacity-70",
                                                        isMe ? "text-primary-foreground" : "text-slate-400"
                                                    )}>
                                                        {formatTime(msg.time)}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={scrollRef} />
                            </div>

                            {/* Input Area */}
                            <div className="p-4 border-t border-border/50 bg-white">
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-primary">
                                        <Paperclip className="h-5 w-5" />
                                    </Button>
                                    <Input
                                        placeholder="Type a message..."
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                                        className="flex-1 bg-slate-50"
                                    />
                                    <Button size="icon" className="shrink-0 bg-primary shadow-sm" onClick={handleSendMessage}>
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-slate-50/30">
                            <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <Send className="h-8 w-8 text-slate-300" />
                            </div>
                            <h3 className="font-semibold text-lg text-slate-700">Select a conversation</h3>
                            <p className="text-sm max-w-xs text-center mt-2">
                                Choose a contact from the sidebar to start messaging or view history.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}