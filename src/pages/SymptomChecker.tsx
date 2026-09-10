import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import {
  Send,
  Brain,
  Sparkles,
  Loader2,
  Activity

} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { getUser, setUser as setStoredUser, clearAllSensitive } from "@/lib/secure-storage";
import { parseSymptomResponse } from "@/lib/symptom-response";
import { symptomContent as safety } from "@/lib/symptom-content";
import { symptomRouting } from "@/config/env";

// Only the explicit available response contract may produce an assessment.



export default function SymptomChecker() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionClosed = useRef(false);
  const mounted = useRef(false);
  const pendingAssessment = useRef<AbortController | null>(null);
  const pendingProfile = useRef<AbortController | null>(null);
  const logoutPending = useRef(false);

  // --- STATE ---
  const [user, setUser] = useState<any>(() => {
    // ─── SECURE STORAGE FIX ───
    // ORIGINAL: const saved = localStorage.getItem('user'); return saved ? JSON.parse(saved) : ...
    try {
      const saved = getUser();
      return saved || { name: safety.defaultUserName, id: "guest", avatar: null };
    } catch (e) { return { name: safety.defaultUserName, id: "guest", avatar: null }; }
  });
  const [messages, setMessages] = useState<any[]>([
    {
      id: "welcome",
      role: "assistant",
      content: safety.welcome
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionClosed, setIsSessionClosed] = useState(false);

  // --- 1. AUTH & PROFILE LOAD ---
  useEffect(() => {
    mounted.current = true;
    const profileController = new AbortController();
    pendingProfile.current = profileController;
    async function fetchProfile() {
      try {
        const authUser = await getCurrentUser();
        if (profileController.signal.aborted || sessionClosed.current) return;
        const query = new URLSearchParams({ id: authUser.userId });
        const profile: any = await api.get(`${symptomRouting.profile}?${query}`, { signal: profileController.signal });
        if (profileController.signal.aborted || sessionClosed.current) return;

        const userData = {
          name: profile.name || safety.defaultUserName,
          id: authUser.userId,
          avatar: profile.avatar
        };
        setUser(userData);

        // ─── SECURE STORAGE FIX ───
        // ORIGINAL: const currentLocal = JSON.parse(localStorage.getItem('user') || '{}');
        // ORIGINAL: localStorage.setItem('user', JSON.stringify({ ...currentLocal, ...userData }));
        const currentLocal = getUser() || {};
        setStoredUser({ ...currentLocal, ...userData });
      } catch (err) {
        // A missing profile never establishes a verified identity or assessment.
      }
    }
    fetchProfile();
    return () => {
      mounted.current = false;
      profileController.abort();
      pendingAssessment.current?.abort();
    };
  }, []);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // --- HELPERS ---
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRiskColor = (risk: string) => {
    const r = risk?.toLowerCase() || "";
    if (r.includes("high") || r.includes("critical")) return "text-red-600 bg-red-50 border-red-200";
    if (r.includes("medium")) return "text-orange-600 bg-orange-50 border-orange-200";
    if (r === "low") return "text-green-600 bg-green-50 border-green-200";
    return "text-muted-foreground bg-muted border-border";
  };

  // --- 2. TEXT SYMPTOM CHECKER LOGIC ---
  const handleSend = async () => {
    if (!inputValue.trim() || pendingAssessment.current || sessionClosed.current || !mounted.current) return;
    const controller = new AbortController();
    pendingAssessment.current = controller;

    const userText = inputValue;
    setInputValue("");

    // Add User Message
    const newMsg = { id: Date.now().toString(), role: "user", content: userText };
    setMessages((prev) => [...prev, newMsg]);
    setIsLoading(true);

    try {
      // API CALL
      const raw = await api.post(symptomRouting.assessment, {
        text: userText
      }, { signal: controller.signal });
      if (controller.signal.aborted || sessionClosed.current) return;
      const data = parseSymptomResponse(raw);
      const riskLevel = data.analysis.risk;
      const providerLabel = data.provider ? `[System: ${data.provider}]\n\n` : '';
      const aiContent = `${providerLabel}Risk: ${riskLevel}\n${data.analysis.reason}`;

      // Add AI Response
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: aiContent, risk: riskLevel }
      ]);

      if (data.pdfBase64) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 2).toString(),
            role: "assistant",
            content: safety.reportLabel,
            pdfData: data.pdfBase64 // Store it in the message
          }
        ]);
      }

    } catch {
      if (controller.signal.aborted || sessionClosed.current) return;
      toast({
        title: safety.unavailableTitle,
        description: safety.unavailable,
        variant: "destructive",
      });

      // An outage is not evidence of low clinical risk.
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: safety.unavailable
        }
      ]);
    } finally {
      if (pendingAssessment.current === controller) pendingAssessment.current = null;
      if (!controller.signal.aborted && !sessionClosed.current) setIsLoading(false);
    }
  };



  const handleLogout = async () => {
    if (logoutPending.current || !mounted.current) return;
    logoutPending.current = true;
    sessionClosed.current = true;
    pendingAssessment.current?.abort();
    pendingProfile.current?.abort();
    setIsSessionClosed(true);
    setIsLoading(false);
    setMessages([]);
    setInputValue("");
    setUser({ name: safety.defaultUserName, id: "guest", avatar: null });
    clearAllSensitive();
    try {
      await signOut();
      if (mounted.current) navigate(symptomRouting.auth, { replace: true });
    } catch {
      if (mounted.current) toast({ title: safety.logoutFailed, variant: "destructive" });
    } finally {
      logoutPending.current = false;
    }
  };

  // --- RENDER ---
  return (
    <DashboardLayout
      title={safety.pageTitle}
      subtitle={safety.title}
      userRole="patient"
      userName={user.name}
      userAvatar={user.avatar}
      onLogout={handleLogout}
    >
      <div className="max-w-4xl mx-auto animate-fade-in h-[calc(100vh-140px)]">

        {/* CHAT INTERFACE */}
        <Card className="shadow-card border-border/50 flex flex-col h-full">
          <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">{safety.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{safety.serviceLabel}</p>
              </div>
            </div>
            <Badge variant="outline">
              {safety.unverifiedStatus}
            </Badge>
          </CardHeader>

          <ScrollArea className="flex-1 p-4 bg-slate-50/50">
            <div className="space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}>
                  {/* Avatar */}
                  <Avatar className="h-8 w-8 flex-shrink-0 border bg-white">
                    {msg.role === "assistant" ? (
                      <AvatarFallback className="bg-primary/10 text-primary"><Sparkles className="h-4 w-4" /></AvatarFallback>
                    ) : (
                      <>
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback className="bg-indigo-100 text-indigo-700">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </>
                    )}
                  </Avatar>

                  {/* Bubble */}
                  <div className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 shadow-sm text-sm whitespace-pre-line leading-relaxed",
                    msg.role === "assistant"
                      ? "bg-white text-slate-700 border border-slate-100 rounded-tl-none"
                      : "bg-primary text-primary-foreground rounded-tr-none"
                  )}>
                    {msg.risk && (
                      <div className={`mb-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${getRiskColor(msg.risk)}`}>
                        <Activity className="w-3 h-3 mr-1" />
                        Risk: {msg.risk}
                      </div>
                    )}
                    {msg.content}
                    {msg.pdfData && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = `data:application/pdf;base64,${msg.pdfData}`;
                          link.download = `Symptom_Report_${new Date().getTime()}.pdf`;
                          link.click();
                        }}
                      >
                        {safety.downloadLabel}
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8"><AvatarFallback><Sparkles className="h-4 w-4 text-primary" /></AvatarFallback></Avatar>
                  <div className="bg-white border px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">{safety.loadingLabel}</span>
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 bg-white border-t">
            <div className="flex gap-3">
              <Input
                placeholder={safety.placeholder}
                aria-label={safety.inputLabel}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isLoading && handleSend()}
                className="flex-1"
                disabled={isLoading || isSessionClosed}
              />
              <Button aria-label={safety.sendLabel} onClick={handleSend} disabled={isLoading || isSessionClosed || !inputValue.trim()} className="bg-primary hover:bg-primary/90">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
