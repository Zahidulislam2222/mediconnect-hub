import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from 'aws-amplify/auth';
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

// --- DEMO FALLBACK DATA (For when AWS Limit is Reached) ---
const DEMO_TEXT_RESPONSE = {
  risk: "Low",
  reason: "[DEMO MODE] The AI service is currently busy (Daily Quota Reached). Based on standard protocols, mild symptoms usually require rest and hydration. Please consult a doctor if symptoms persist."
};



export default function SymptomChecker() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- STATE ---
  const [user, setUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : { name: "Patient", id: "guest", avatar: null };
    } catch (e) { return { name: "Patient", id: "guest", avatar: null }; }
  });
  const [messages, setMessages] = useState<any[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello. I am your AI Health Assistant. Describe your symptoms briefly, and I will assess the risk level."
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false); // For Text

  // --- 1. AUTH & PROFILE LOAD ---
  useEffect(() => {
    async function fetchProfile() {
      try {
        const authUser = await getCurrentUser();
        const profile: any = await api.get(`/register-patient?id=${authUser.userId}`);

        const userData = {
          name: profile.name || "Patient",
          id: authUser.userId,
          avatar: profile.avatar
        };
        setUser(userData);

        // 🟢 FIX: Update Storage Safely
        const currentLocal = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...currentLocal, ...userData }));
      } catch (err) {
        console.warn("Auth load failed, using guest mode");
      }
    }
    fetchProfile();
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
    return "text-green-600 bg-green-50 border-green-200";
  };

  // --- 2. TEXT SYMPTOM CHECKER LOGIC ---
  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userText = inputValue;
    setInputValue("");

    // Add User Message
    const newMsg = { id: Date.now().toString(), role: "user", content: userText };
    setMessages((prev) => [...prev, newMsg]);
    setIsLoading(true);

    try {
      // API CALL
      const data: any = await api.post('/ai/symptoms', {
        text: userText
      });

      let aiContent = "";
      let riskLevel = "Unknown";

      // 1. FIX: Check for 'risk_analysis' (from Lambda) OR 'assessment' (old way)
      const result = data.analysis;

      if (result && result.risk !== "Error") {
        riskLevel = result.risk;

        // 2. VIDEO FEATURE: Show which Cloud provided the answer
        const providerName = data.provider || "AWS Bedrock";
        aiContent = `[System: ${providerName}]\n\nRisk: ${riskLevel}\n${result.reason}`;

      } else {
        throw new Error("AI Service Limit");
      }

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
            content: "Your official clinical report is ready.",
            pdfData: data.pdfBase64 // Store it in the message
          }
        ]);
      }

    } catch (error) {
      console.warn("AI Error, switching to Demo Mode:", error);
      toast({
        title: "System Busy",
        description: "AWS Daily Limit reached. Showing simulated response.",
        variant: "default",
      });

      // DEMO MODE FALLBACK
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Risk Assessment: ${DEMO_TEXT_RESPONSE.risk}\n\n${DEMO_TEXT_RESPONSE.reason}`,
          risk: DEMO_TEXT_RESPONSE.risk
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };



  const handleLogout = async () => {
    navigate("/");
  };

  // --- RENDER ---
  return (
    <DashboardLayout
      title="AI Health Assistant"
      subtitle="Symptom Checker"
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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl medical-gradient">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Symptom Checker</CardTitle>
                <p className="text-xs text-muted-foreground">Powered by Claude 3 (Bedrock)</p>
              </div>
            </div>
            <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">
              <span className="h-2 w-2 rounded-full bg-green-500 mr-1.5 animate-pulse" />
              Active
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
                        Download Clinical PDF
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
                    <span className="text-xs text-muted-foreground">Analyzing symptoms...</span>
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
                placeholder="Ex: I have a severe headache and sensitivity to light..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isLoading && handleSend()}
                className="flex-1"
                disabled={isLoading}
              />
              <Button onClick={handleSend} disabled={isLoading || !inputValue.trim()} className="bg-primary hover:bg-primary/90">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}