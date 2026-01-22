import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, signOut, fetchAuthSession } from 'aws-amplify/auth';
import {
    Search, Send, Video, ChevronLeft, Calendar
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// 🔒 SECURITY: Env vars prevent hardcoding
const API_URL = import.meta.env.VITE_API_BASE_URL;
const WS_URL = import.meta.env.VITE_WEBSOCKET_API_URL;

export default function Messages() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const scrollRef = useRef<HTMLDivElement>(null);

    // --- STATE ---
    const [user, setUser] = useState<any>({ name: "", id: "", role: "" });
    const [contacts, setContacts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // WebSocket State
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    // UI State
    const [activeContactId, setActiveContactId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [inputText, setInputText] = useState("");

    // 💾 MEMORY: Stores messages by contactId { "user123": [msg1, msg2] }
    const [chatHistory, setChatHistory] = useState<Record<string, any[]>>({});

    // 📜 AUTO-SCROLL: Whenever history changes, scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [chatHistory, activeContactId]);

    // --- 1. INITIALIZATION (Load User & Contacts) ---
    useEffect(() => {
        const init = async () => {
            try {
                // A. Get User Identity
                const authUser = await getCurrentUser();
                const session = await fetchAuthSession();
                const token = session.tokens?.idToken?.toString();

                // (Fallback to local storage for display name/role if DB fetch hasn't happened yet)
                const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
                const currentRole = storedUser.role || 'patient';
                const isDoctor = currentRole === 'doctor';

                setUser({
                    name: storedUser.name || "User",
                    id: authUser.userId,
                    role: currentRole,
                    token: token,
                    // 👇 Ensure this is here too
                    avatar: storedUser.avatar || null
                });

                // B. Build Contact List from Appointments
                // This replaces the "Mock Data" with real people you actually have business with.
                const paramKey = isDoctor ? 'doctorId' : 'patientId';
                const res = await fetch(`${API_URL}/doctor-appointments?${paramKey}=${authUser.userId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    const rawList = data.existingBookings || [];

                    // Deduplicate Contacts (A patient might have 5 appointments with the same doctor)
                    const uniqueMap = new Map();
                    rawList.forEach((apt: any) => {
                        const contactId = isDoctor ? apt.patientId : apt.doctorId;
                        const contactName = isDoctor ? apt.patientName : apt.doctorName;

                        // 👇 UPDATE THIS LINE
                        if (!contactId || !contactName) return;

                        if (!uniqueMap.has(contactId)) {
                            uniqueMap.set(contactId, {
                                id: contactId,
                                name: contactName,
                                role: isDoctor ? "Patient" : "Doctor",
                                lastInteraction: apt.timeSlot
                            });
                        }
                    });
                    setContacts(Array.from(uniqueMap.values()));
                }

            } catch (err) {
                console.error("Init failed", err);
                toast({ variant: "destructive", title: "Error", description: "Could not load contacts." });
            } finally {
                setIsLoading(false);
            }
        };
        init();
    }, []);

    // --- 2. WEBSOCKET CONNECTION (The Live Line) ---
    useEffect(() => {
        if (!user.id || !WS_URL) return;

        console.log("🔌 Connecting to WebSocket...");

        // Phase 1: We pass userId in query params. 
        // Phase 2 Preparation: We also pass the token (Lambda ignores it for now, but it's ready).
        const ws = new WebSocket(`${WS_URL}?userId=${user.id}&token=${user.token}`);

        ws.onopen = () => {
            console.log("🟢 WS Connected");
            setIsConnected(true);
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                // Payload: { action, senderId, text, timestamp }

                // Identify who sent this to us
                const contactId = msg.senderId;

                // Update Chat History
                setChatHistory(prev => ({
                    ...prev,
                    [contactId]: [...(prev[contactId] || []), {
                        id: Date.now(),
                        senderId: msg.senderId,
                        text: msg.text,
                        time: msg.timestamp
                    }]
                }));
            } catch (e) {
                console.error("WS Parse Error", e);
            }
        };

        ws.onclose = () => {
            console.log("🔴 WS Disconnected");
            setIsConnected(false);
        };

        setSocket(ws);

        // CLEANUP: Close connection when user leaves the page
        return () => {
            ws.close();
        };
    }, [user.id]);

    // --- 3. FETCH HISTORY (The Memory) ---
    useEffect(() => {
        if (!activeContactId || !user.id) return;

        // If we already loaded history for this person, don't spam the API
        if (chatHistory[activeContactId]?.length > 0) return;

        const loadHistory = async () => {
            try {
                // 🔐 ALPHABETICAL SORT: This ensures Dr. Smith & Patient John always share the same ID.
                // Example: "d-123#p-456"
                const participants = [user.id, activeContactId].sort();
                const conversationId = `${participants[0]}#${participants[1]}`;

                // Call the NEW GET Endpoint
                const res = await fetch(`${API_URL}/chat?conversationId=${conversationId}`);
                if (res.ok) {
                    const data = await res.json();

                    // Format DynamoDB data for UI
                    const formattedMessages = (data.messages || []).map((m: any) => ({
                        id: m.timestamp,
                        senderId: m.senderId,
                        text: m.text,
                        time: m.timestamp
                    }));

                    setChatHistory(prev => ({
                        ...prev,
                        [activeContactId]: formattedMessages
                    }));
                }
            } catch (err) {
                console.error("History load failed", err);
            }
        };

        loadHistory();
    }, [activeContactId, user.id]);

    // --- 4. ACTION: SEND MESSAGE ---
    const handleSendMessage = () => {
        if (!inputText.trim() || !activeContactId || !socket) return;

        const timestamp = new Date().toISOString();

        const payload = {
            action: "sendMessage", // Matches API Gateway Route
            senderId: user.id,
            recipientId: activeContactId,
            text: inputText
        };

        // A. Send to AWS
        socket.send(JSON.stringify(payload));

        // B. Optimistic Update (Show it immediately!)
        setChatHistory(prev => ({
            ...prev,
            [activeContactId]: [...(prev[activeContactId] || []), {
                id: Date.now(),
                senderId: user.id,
                text: inputText,
                time: timestamp
            }]
        }));

        setInputText("");
    };

    // --- HELPERS ---
    const getInitials = (name: string) => {
        if (!name) return "??";
        return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
    };

    const formatTime = (iso: string) => {
        if (!iso) return "";
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const activeMessages = chatHistory[activeContactId] || [];

    return (
        <DashboardLayout
            title="Messages"
            subtitle={isConnected ? "Live Secure Connection" : "Connecting..."}
            userRole={user.role}
            userName={user.name}
            userAvatar={user.avatar}
            onLogout={() => { signOut(); navigate('/'); }}
        >
            <div className="h-[calc(100vh-12rem)] min-h-[500px] flex rounded-xl overflow-hidden border border-border/50 bg-card shadow-sm">

                {/* SIDEBAR: CONTACT LIST */}
                <div className={cn(
                    "border-r border-border/50 bg-slate-50/50 flex flex-col w-full md:w-80 transition-all",
                    activeContactId ? "hidden md:flex" : "flex"
                )}>
                    <div className="p-4 border-b bg-white">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search contacts..."
                                className="pl-9 bg-slate-50"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {isLoading ? <div className="p-8 text-center text-sm text-muted-foreground">Loading Contacts...</div> :
                            contacts.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No bookings found.</div> :
                                contacts.map(c => (
                                    <div
                                        key={c.id}
                                        onClick={() => setActiveContactId(c.id)}
                                        className={cn(
                                            "p-4 flex items-center gap-3 cursor-pointer hover:bg-white border-l-4 transition-colors",
                                            activeContactId === c.id ? "bg-white border-primary shadow-sm" : "border-transparent"
                                        )}
                                    >
                                        <Avatar><AvatarFallback className="bg-primary/10 text-primary">{getInitials(c.name)}</AvatarFallback></Avatar>
                                        <div>
                                            <p className="font-semibold text-sm text-slate-900">{c.name}</p>
                                            <p className="text-xs text-muted-foreground">{c.role}</p>
                                        </div>
                                    </div>
                                ))}
                    </div>
                </div>

                {/* CHAT AREA */}
                <div className={cn("flex-1 flex-col bg-white", !activeContactId ? "hidden md:flex" : "flex")}>
                    {activeContactId ? (
                        <>
                            {/* Header */}
                            <div className="p-4 border-b flex justify-between items-center shadow-sm z-10">
                                <div className="flex items-center gap-3">
                                    <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setActiveContactId(null)}>
                                        <ChevronLeft className="h-5 w-5" />
                                    </Button>
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback className="text-xs bg-primary/10">
                                            {getInitials(contacts.find(c => c.id === activeContactId)?.name || "??")}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h3 className="font-semibold text-sm">
                                            {contacts.find(c => c.id === activeContactId)?.name}
                                        </h3>
                                        <div className="flex items-center gap-1.5">
                                            <span className={cn("h-1.5 w-1.5 rounded-full", isConnected ? "bg-green-500" : "bg-yellow-500")}></span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {isConnected ? "Real-time" : "Connecting..."}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => navigate('/consultation')} className="gap-2">
                                    <Video className="h-4 w-4" />
                                    <span className="hidden sm:inline">Video Call</span>
                                </Button>
                            </div>

                            {/* Messages List */}
                            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50">
                                {activeMessages.length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                                        <Calendar className="h-10 w-10 mb-2 stroke-1" />
                                        <p className="text-sm">No messages yet. Say hello!</p>
                                    </div>
                                )}
                                {activeMessages.map((msg, i) => {
                                    const isMe = msg.senderId === user.id;
                                    return (
                                        <div key={i} className={cn("flex animate-in slide-in-from-bottom-2", isMe ? "justify-end" : "justify-start")}>
                                            <div className={cn(
                                                "max-w-[75%] px-4 py-2 rounded-2xl text-sm shadow-sm",
                                                isMe ? "bg-primary text-primary-foreground rounded-br-none" : "bg-white border border-slate-200 text-slate-800 rounded-bl-none"
                                            )}>
                                                <p>{msg.text}</p>
                                                <span className={cn("text-[10px] block text-right mt-1 opacity-70", isMe ? "text-primary-foreground" : "text-muted-foreground")}>
                                                    {formatTime(msg.time)}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                                <div ref={scrollRef} />
                            </div>

                            {/* Input Area */}
                            <div className="p-4 border-t bg-white">
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={inputText}
                                        onChange={e => setInputText(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                                        placeholder="Type your message..."
                                        className="bg-slate-50"
                                        disabled={!isConnected}
                                    />
                                    <Button
                                        onClick={handleSendMessage}
                                        size="icon"
                                        disabled={!isConnected || !inputText.trim()}
                                        className={cn("shrink-0", isConnected ? "bg-primary" : "bg-muted")}
                                    >
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
                                Choose a contact from the sidebar to start messaging securely.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}