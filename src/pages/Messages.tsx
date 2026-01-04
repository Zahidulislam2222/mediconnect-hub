import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Send, Phone, Video, MoreVertical, Image as ImageIcon, Paperclip } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { currentUser, currentDoctor } from "@/lib/mockData";
import { cn } from "@/lib/utils";

const mockContacts = [
    { id: 1, name: "Dr. Sarah Mitchell", role: "Cardiologist", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah", lastMessage: "Your test results look normal, keep it up!", time: "10:30 AM", unread: 2, online: true },
    { id: 2, name: "Dr. James Chen", role: "General Practitioner", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=James", lastMessage: "Let's schedule a follow-up next week.", time: "Yesterday", unread: 0, online: false },
    { id: 3, name: "Nurse Emily", role: "Care Coordinator", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emily", lastMessage: "Did you receive the prescription refill?", time: "Tue", unread: 0, online: true },
];

const mockMessages = [
    { id: 1, senderId: 2, text: "Hello! How have you been feeling since our last visit?", time: "10:00 AM" },
    { id: 2, senderId: 0, text: "Hi Dr. Chen, much better thanks. The medication seems to be working.", time: "10:05 AM" },
    { id: 3, senderId: 2, text: "That's great to hear. Any side effects?", time: "10:06 AM" },
    { id: 4, senderId: 0, text: "None so far, thankfully.", time: "10:08 AM" },
    { id: 5, senderId: 2, text: "Perfect. Let's schedule a follow-up next week just to be sure.", time: "10:10 AM" },
];

interface MessagesProps {
    role?: "patient" | "doctor";
}

export default function Messages({ role = "patient" }: MessagesProps) {
    const navigate = useNavigate();
    const [activeContact, setActiveContact] = useState(mockContacts[0]);
    const [messageInput, setMessageInput] = useState("");
    const user = role === "patient" ? currentUser : currentDoctor;

    const handleLogout = () => {
        navigate("/");
    };

    return (
        <DashboardLayout
            title="Messages"
            subtitle="Secure communication with your care team"
            userRole={role}
            userName={user.name}
            userAvatar={user.avatar}
            onLogout={handleLogout}
        >
            <div className="h-[calc(100vh-12rem)] min-h-[500px] flex rounded-xl overflow-hidden border border-border/50 bg-card shadow-sm animate-fade-in">
                {/* Sidebar */}
                <div className="w-80 border-r border-border/50 bg-secondary/10 flex flex-col">
                    <div className="p-4 border-b border-border/50">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search messages..." className="pl-9 bg-background" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {mockContacts.map((contact) => (
                            <div
                                key={contact.id}
                                className={cn(
                                    "p-4 flex items-center gap-3 cursor-pointer hover:bg-background/80 transition-colors border-l-4",
                                    activeContact.id === contact.id
                                        ? "bg-background border-primary"
                                        : "border-transparent"
                                )}
                                onClick={() => setActiveContact(contact)}
                            >
                                <div className="relative">
                                    <Avatar>
                                        <AvatarImage src={contact.avatar} />
                                        <AvatarFallback>{contact.name[0]}</AvatarFallback>
                                    </Avatar>
                                    {contact.online && (
                                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-success border-2 border-background" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-medium text-sm truncate">{contact.name}</span>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">{contact.time}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">{contact.lastMessage}</p>
                                </div>
                                {contact.unread > 0 && (
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-medium">
                                        {contact.unread}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 flex flex-col bg-background">
                    <div className="p-4 border-b border-border/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Avatar>
                                <AvatarImage src={activeContact.avatar} />
                                <AvatarFallback>{activeContact.name[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                                <h3 className="font-medium">{activeContact.name}</h3>
                                <p className="text-xs text-muted-foreground">{activeContact.role}</p>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <Button variant="ghost" size="icon">
                                <Phone className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                                <Video className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 p-4 overflow-y-auto space-y-4">
                        {mockMessages.map((msg) => {
                            const isMe = msg.senderId === 0;
                            return (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        "flex",
                                        isMe ? "justify-end" : "justify-start"
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "max-w-[70%] rounded-2xl px-4 py-2 text-sm",
                                            isMe
                                                ? "bg-primary text-primary-foreground rounded-br-none"
                                                : "bg-secondary text-secondary-foreground rounded-bl-none"
                                        )}
                                    >
                                        <p>{msg.text}</p>
                                        <span className={cn(
                                            "text-[10px] block text-right mt-1 opacity-70",
                                            isMe ? "text-primary-foreground" : "text-muted-foreground"
                                        )}>
                                            {msg.time}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="p-4 border-t border-border/50">
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" className="shrink-0">
                                <Paperclip className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="shrink-0">
                                <ImageIcon className="h-4 w-4" />
                            </Button>
                            <Input
                                placeholder="Type a message..."
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                className="flex-1"
                            />
                            <Button size="icon" className="shrink-0">
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
