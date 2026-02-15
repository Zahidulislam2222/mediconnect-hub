import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getCurrentUser } from 'aws-amplify/auth';
import {
    Send, Search, Video,
    Loader2, User, Paperclip, CheckCheck, ChevronLeft, Lock
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// Interface for our Clean Contact List (Not Appointments)
interface Contact {
    id: string;          // The Person's ID (PatientID or DoctorID)
    name: string;        // Name
    avatar: string;      // URL
    role: string;        // "Doctor" or "Patient"
    lastSeen?: string;
    specialization?: string; // For doctors
}

interface Message {
    senderId: string;
    text: string;
    timestamp: string;
    conversationId?: string;
    resource?: any; // FHIR structure
    isOptimistic?: boolean; // 🟢 Add this line to fix the error
}

const getAuthToken = () => {
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        // Cognito keys usually end in .idToken or .accessToken
        // Your Authorizer is configured for "id" tokens
        if (key && key.includes("idToken")) {
            const token = localStorage.getItem(key);
            // Ensure we don't return the literal string "null"
            return (token && token !== "null") ? token : null;
        }
    }
    return null;
};

export default function Messages() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { toast } = useToast();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    // --- STATE ---
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userRole, setUserRole] = useState<'patient' | 'doctor'>('patient');
    
    // The "Single Thread" Contact List
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(true);

    // Active Chat
    const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
    const [activeContact, setActiveContact] = useState<Contact | null>(null);
    
    const [messages, setMessages] = useState<Message[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [inputMessage, setInputMessage] = useState("");

    // --- 1. INITIALIZATION & DEDUPLICATION ---
    useEffect(() => {
    const init = async () => {
        try {
            const authUser = await getCurrentUser();
            const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
            const currentRole = storedUser.role || 'patient';
            const isDoctor = currentRole === 'doctor';

            setCurrentUser({ ...storedUser, id: authUser.userId });
            setUserRole(currentRole);

            // 1. Fetch Appointments
            const paramKey = isDoctor ? 'doctorId' : 'patientId';
            const res: any = await api.get(`/doctor-appointments?${paramKey}=${authUser.userId}`);
            const rawList = res.existingBookings || (Array.isArray(res) ? res : []);
            
            const uniqueMap = new Map<string, Contact>();

            // 2. Identify Unique People
            rawList.forEach((item: any) => {
                    const contactId = isDoctor ? item.patientId : item.doctorId;
                    const contactName = isDoctor ? item.patientName : item.doctorName;

                    if (!contactId) return;

                    if (!uniqueMap.has(contactId)) {
                        uniqueMap.set(contactId, {
                            id: contactId,
                            name: contactName || "Unknown",
                            avatar: "", // Will be filled in next step
                            role: isDoctor ? "Patient" : "Doctor",
                            specialization: isDoctor ? "Patient" : (item.specialization || "General Practice")
                        });
                    }
                });

                // 2. 🟢 Fetch Fresh Profiles (to get real S3 URLs)
                const uniqueContactIds = Array.from(uniqueMap.keys());
                const profiles = await Promise.all(
                    uniqueContactIds.map(id => {
                        // Fetch from the source service to get the Presigned URL
                        const endpoint = isDoctor ? `/register-patient?id=${id}` : `/register-doctor?id=${id}`;
                        return api.get(endpoint).catch(() => null);
                    })
                );

                // 3. 🟢 Hydrate Map with real Avatars
                profiles.forEach((p: any) => {
                    if (p) {
                        const profileData = p.Item || p;
                        const pid = profileData.patientId || profileData.doctorId || profileData.id;
                        
                        if (uniqueMap.has(pid)) {
    const contact = uniqueMap.get(pid)!;
    contact.avatar = profileData.avatar || ""; 
    // 🟢 Also get fresh specialization/role info
    if (profileData.specialization) contact.specialization = profileData.specialization;
    uniqueMap.set(pid, contact);
}
                    }
                });

            // 5. Update State
            const cleanContacts = Array.from(uniqueMap.values());
            setContacts(cleanContacts);

            // 6. Handle URL Redirect
            const targetAptId = searchParams.get("appointmentId");
            if (targetAptId && rawList.length > 0) {
                const targetApt = rawList.find((a: any) => a.appointmentId === targetAptId);
                if (targetApt) {
                    const personId = isDoctor ? targetApt.patientId : targetApt.doctorId;
                    setSelectedRecipientId(personId);
                }
            }
        } catch (error) {
            console.error("Init Error:", error);
        } finally {
            setLoadingContacts(false);
        }
    };
    init();
}, []);

// --- 🟢 REAL-TIME WEBSOCKET LISTENER ---
useEffect(() => {
    // 1. Safety Guard: Don't connect if we don't have a user or a selected chat
    if (!currentUser || !selectedRecipientId) return;

    const wsUrl = import.meta.env.VITE_COMMUNICATION_WS_URL;
    const token = getAuthToken();

    // 2. Security Guard: If token is missing, don't attempt connection
    // This prevents the wss://.../?token=null error in your console
    if (!token) {
        console.warn("⚠️ WebSocket: Auth token not found. Real-time messaging is disabled.");
        return;
    }

    console.log("📡 Attempting Secure WebSocket Connection...");
    const socket = new WebSocket(`${wsUrl}?token=${token}`);

    socket.onopen = () => {
        console.log("✅ Secure WebSocket Connected");
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            // 🟢 HIPAA Logic: Only display if the message belongs to the current conversation
            // and the recipient matches our current view
            if (data.type === "message" && data.senderId === selectedRecipientId) {
                setMessages(prev => {
                    const isDuplicate = prev.some(m => m.timestamp === data.timestamp && m.text === data.text);
                    if (isDuplicate) return prev;
                    return [...prev, data];
                });
            }
        } catch (err) {
            console.error("❌ WS Message Parsing Error:", err);
        }
    };

    socket.onerror = (error) => {
        console.error("❌ WebSocket Security/Network Error:", error);
    };

    socket.onclose = (event) => {
        if (event.code === 1008) { // Policy Violation (usually expired token)
            console.error("❌ WebSocket: Policy Violation. Token likely expired.");
        } else {
            console.log("❌ WebSocket Connection Closed.");
        }
    };

    // 3. Cleanup: Close pipe when switching chats or leaving page
    return () => {
        if (socket.readyState === WebSocket.OPEN) {
            socket.close();
        }
    };
}, [currentUser, selectedRecipientId]);

    // --- 2. UPDATE ACTIVE CONTACT METADATA ---
    useEffect(() => {
        if (selectedRecipientId && contacts.length > 0) {
            const match = contacts.find(c => c.id === selectedRecipientId);
            if (match) setActiveContact(match);
        }
    }, [selectedRecipientId, contacts]);

    // --- 3. LOAD HISTORY (Single Thread API) ---
    useEffect(() => {
        if (!selectedRecipientId) return;

        const loadHistory = async () => {
            setLoadingMessages(true);
            try {
                // 🟢 UPDATED API CALL: Uses recipientId, not conversationId/appointmentId
                const history: any = await api.get(`/chat/history?recipientId=${selectedRecipientId}`);
                setMessages(history); 
            } catch (error) {
                console.error("History Error", error);
            } finally {
                setLoadingMessages(false);
            }
        };
        loadHistory();
    }, [selectedRecipientId]);

    // --- 4. AUTO SCROLL ---
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // --- 5. SEND MESSAGE ---
    const handleSendMessage = async () => {
        if (!inputMessage.trim() || !selectedRecipientId || !currentUser) return;

        try {
            // Optimistic UI Update
            const tempMsg: Message = {
    senderId: currentUser.id,
    text: inputMessage,
    timestamp: new Date().toISOString(),
    isOptimistic: true // Custom flag
};
setMessages(prev => [...prev, tempMsg]);
            const msgToSend = inputMessage;
            setInputMessage(""); // Clear input immediately

            // 🟢 UPDATED PAYLOAD: Matches chat.controller.ts logic
            await api.post('/chat/ws-event', {
                routeKey: "sendMessage",
                body: {
                    recipientId: selectedRecipientId, // Target Person
                    text: msgToSend
                }
            });

        } catch (error) {
            console.error("Send Error:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to send message" });
        }
    };

    return (
        <DashboardLayout
            title="Secure Messages"
            subtitle="Encrypted clinical communication"
            userRole={userRole}
            userName={currentUser?.name}
            userAvatar={currentUser?.avatar}
            onLogout={async () => navigate("/")}
        >
            <div className="h-[calc(100vh-12rem)] min-h-[600px] flex rounded-xl overflow-hidden border border-border/50 bg-card shadow-sm animate-fade-in">
                
                {/* LEFT: CONTACT LIST (DEDUPLICATED) */}
                <div className={cn(
                    "w-full md:w-80 border-r border-border/50 bg-slate-50/50 flex flex-col",
                    selectedRecipientId ? "hidden md:flex" : "flex"
                )}>
                    <div className="p-4 border-b bg-white">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search people..." className="pl-9 bg-slate-50" />
                        </div>
                    </div>
                    
                    <ScrollArea className="flex-1">
                        {loadingContacts ? (
                            <div className="p-4 space-y-4">
                                <div className="h-12 bg-muted animate-pulse rounded-lg" />
                                <div className="h-12 bg-muted animate-pulse rounded-lg" />
                            </div>
                        ) : contacts.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                No active contacts found.
                            </div>
                        ) : (
                            contacts.map((contact) => (
                                <div
                                    key={contact.id}
                                    onClick={() => setSelectedRecipientId(contact.id)}
                                    className={cn(
                                        "p-4 flex items-center gap-3 cursor-pointer border-b hover:bg-white transition-colors",
                                        selectedRecipientId === contact.id ? "bg-white border-l-4 border-l-primary" : "border-l-4 border-l-transparent"
                                    )}
                                >
                                    <Avatar>
                                        <AvatarImage src={contact.avatar} className="object-cover" />
                                        <AvatarFallback>{contact.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-semibold text-sm truncate">{contact.name}</h4>
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {contact.specialization || contact.role}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </ScrollArea>
                </div>

                {/* RIGHT: CHAT WINDOW */}
                <div className={cn(
                    "flex-1 flex flex-col bg-white",
                    !selectedRecipientId ? "hidden md:flex" : "flex"
                )}>
                    {selectedRecipientId && activeContact ? (
                        <>
                            {/* Header */}
                            <div className="p-4 border-b flex justify-between items-center bg-slate-50/30">
                                <div className="flex items-center gap-3">
                                    <Button 
                                        variant="ghost" size="icon" className="md:hidden"
                                        onClick={() => setSelectedRecipientId(null)}
                                    >
                                        <ChevronLeft className="h-5 w-5" />
                                    </Button>
                                    <Avatar className="h-10 w-10 border shadow-sm">
                                        <AvatarImage src={activeContact.avatar} className="object-cover" />
                                        <AvatarFallback>{activeContact.name.substring(0, 2)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h3 className="font-semibold text-sm">{activeContact.name}</h3>
                                        <div className="flex items-center gap-2">
                                            <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                                            <span className="text-xs text-muted-foreground">Secure Connection</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {/* Video Call links to generic consultation page, not tied to Appointment ID anymore */}
                                    <Button variant="outline" size="sm" onClick={() => navigate(`/consultation?patientName=${activeContact.name}`)}>
                                        <Video className="h-4 w-4 mr-2" /> 
                                        Video Call
                                    </Button>
                                </div>
                            </div>

                            {/* Messages Area */}
                            <ScrollArea className="flex-1 p-4">
                                {loadingMessages ? (
                                    <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-muted" /></div>
                                ) : messages.length === 0 ? (
                                    <div className="text-center text-muted-foreground py-20 flex flex-col items-center">
                                        <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                            <Lock className="h-8 w-8 text-slate-300" />
                                        </div>
                                        <p>Encrypted history with {activeContact.name}.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {messages.map((msg, idx) => {
                                            const isMe = msg.senderId === currentUser.id;
                                            // Handle FHIR structure or flattened structure from AWS
                                            const content = msg.resource?.payload?.[0]?.contentString || msg.text || "";
                                            const displayTime = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : "";
                                            
                                            return (
                                                <div key={idx} className={cn("flex w-full", isMe ? "justify-end" : "justify-start")}>
                                                    <div className={cn(
                                                        "max-w-[70%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                                                        isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-slate-100 text-slate-900 rounded-tl-none"
                                                    )}>
                                                        <p>{content}</p>
                                                        <div className={cn(
                                                            "text-[10px] mt-1 flex items-center gap-1",
                                                            isMe ? "text-primary-foreground/70 justify-end" : "text-slate-500"
                                                        )}>
                                                            {displayTime}
                                                            {isMe && <CheckCheck className="h-3 w-3" />}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div ref={messagesEndRef} />
                                    </div>
                                )}
                            </ScrollArea>

                            {/* Input Area */}
                            <div className="p-4 border-t bg-slate-50/50">
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground">
                                        <Paperclip className="h-5 w-5" />
                                    </Button>
                                    <Input 
                                        placeholder={`Message ${activeContact.name}...`} 
                                        className="bg-white"
                                        value={inputMessage}
                                        onChange={(e) => setInputMessage(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    />
                                    <Button onClick={handleSendMessage} disabled={!inputMessage.trim()}>
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </div>
                                <p className="text-[10px] text-center text-muted-foreground mt-2 flex items-center justify-center gap-1">
                                    <Lock className="h-3 w-3" /> End-to-end encrypted for HIPAA compliance
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-slate-50/30">
                            <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                                <User className="h-10 w-10 text-slate-300" />
                            </div>
                            <h3 className="font-semibold text-lg text-slate-700">Select a Contact</h3>
                            <p className="text-sm max-w-xs text-center mt-2">
                                Choose a patient or doctor from the sidebar to start a secure conversation.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}