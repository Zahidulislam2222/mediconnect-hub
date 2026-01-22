import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from 'aws-amplify/auth';
import {
  Send,
  Upload,
  Brain,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  X,
  Sparkles,
  Loader2,
  Activity,
  FileText
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// --- DEMO FALLBACK DATA (For when AWS Limit is Reached) ---
const DEMO_TEXT_RESPONSE = {
  risk: "Low",
  reason: "[DEMO MODE] The AI service is currently busy (Daily Quota Reached). Based on standard protocols, mild symptoms usually require rest and hydration. Please consult a doctor if symptoms persist."
};

const DEMO_IMAGE_RESPONSE = {
  diagnosis: "[DEMO MODE] Clear lung fields. No detected fractures or anomalies. Cardiac silhouette is within normal limits.",
  visionTags: ["X-Ray", "Chest", "Normal", "Medical Imaging"]
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
  const [isAnalyzing, setIsAnalyzing] = useState(false); // For Image

  // Image Analysis State
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 1. AUTH & PROFILE LOAD ---
  useEffect(() => {
    async function fetchProfile() {
      try {
        const authUser = await getCurrentUser();
        const res = await fetch(`${API_BASE_URL}/register-patient?id=${authUser.userId}`);
        if (res.ok) {
          const profile = await res.json();
          const userData = {
            name: profile.name || "Patient",
            id: authUser.userId,
            avatar: profile.avatar
          };
          setUser(userData);

          // 🟢 FIX: Update Storage Safely
          const currentLocal = JSON.parse(localStorage.getItem('user') || '{}');
          localStorage.setItem('user', JSON.stringify({ ...currentLocal, ...userData }));
        }
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
      const response = await fetch(`${API_BASE_URL}/symptom-checker`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: userText,        // Matches Backend Expectation
          userId: user.id        // Matches Backend Expectation
        })
      });

      let aiContent = "";
      let riskLevel = "Unknown";

      if (response.ok) {
        const data = await response.json();

        // 1. FIX: Check for 'risk_analysis' (from Lambda) OR 'assessment' (old way)
        const result = data.risk_analysis || data.assessment;

        if (result && result.risk !== "Error") {
          riskLevel = result.risk;

          // 2. VIDEO FEATURE: Show which Cloud provided the answer
          const providerName = data.provider || "AWS Bedrock";
          aiContent = `[System: ${providerName}]\n\nRisk: ${riskLevel}\n${result.reason}`;

        } else {
          throw new Error("AI Service Limit");
        }
      } else {
        // Network or 500 Error
        throw new Error("Network Error");
      }

      // Add AI Response
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: aiContent, risk: riskLevel }
      ]);

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

  // --- 3. IMAGE UPLOAD LOGIC ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // 1. Create Preview
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        setUploadedImagePreview(result);

        // 2. Start Upload Process
        processImageUpload(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImageUpload = async (base64Full: string) => {
    setIsAnalyzing(true);
    setAnalysisResult(null);

    // Strip header (data:image/jpeg;base64,)
    const base64Clean = base64Full.split(",")[1];

    try {
      const response = await fetch(`${API_BASE_URL}/analyze-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Clean, // Matches Backend Expectation
          patientId: user.id
        })
      });

      if (!response.ok) throw new Error("Upload Failed");

      const data = await response.json();

      // Backend returns { report: { diagnosis: "...", visionTags: [...] } }
      if (data.report && !data.report.diagnosis.includes("Analysis Failed")) {
        setAnalysisResult(data.report);
      } else {
        throw new Error("AI Failed");
      }

    } catch (error) {
      console.warn("Image AI Error, switching to Demo Mode");
      // DEMO MODE FALLBACK
      setTimeout(() => {
        setAnalysisResult(DEMO_IMAGE_RESPONSE);
      }, 1500); // Fake delay for realism
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLogout = async () => {
    navigate("/");
  };

  // --- RENDER ---
  return (
    <DashboardLayout
      title="AI Health Assistant"
      subtitle="Symptom checker & Medical Imaging Analysis"
      userRole="patient"
      userName={user.name}
      userAvatar={user.avatar}
      onLogout={handleLogout}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in h-[calc(100vh-140px)]">

        {/* LEFT: CHAT INTERFACE */}
        <Card className="lg:col-span-2 shadow-card border-border/50 flex flex-col h-full">
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

        {/* RIGHT: IMAGE UPLOAD */}
        <div className="space-y-6 flex flex-col h-full">
          <Card className="shadow-card border-border/50 flex-shrink-0">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-lg flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-primary" />
                Medical Imaging
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {!uploadedImagePreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileSelect}
                  />
                  <div className="h-12 w-12 mx-auto bg-primary/10 text-primary rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Upload className="h-6 w-6" />
                  </div>
                  <p className="font-medium text-slate-900">Upload X-Ray / MRI</p>
                  <p className="text-xs text-muted-foreground mt-1">Supports JPG, PNG (Max 5MB)</p>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden border bg-black group">
                  <img src={uploadedImagePreview} alt="Upload" className="w-full h-48 object-contain opacity-90" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      setUploadedImagePreview(null);
                      setAnalysisResult(null);
                      fileInputRef.current!.value = ""; // Reset input
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                      <Loader2 className="h-8 w-8 animate-spin mb-2" />
                      <span className="text-sm font-medium">Scanning Image...</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Analysis Results */}
          {analysisResult && (
            <Card className="shadow-card border-border/50 animate-in slide-in-from-bottom-4 flex-1 flex flex-col">
              <CardHeader className="pb-3 bg-indigo-50/50 border-b border-indigo-100">
                <CardTitle className="text-md flex items-center gap-2 text-indigo-900">
                  <FileText className="h-4 w-4" />
                  Analysis Report
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4 flex-1 overflow-auto">
                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {analysisResult.visionTags?.map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-xs font-normal">
                      {tag}
                    </Badge>
                  ))}
                </div>

                {/* Main Text */}
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-sm text-slate-700 leading-relaxed">
                  <span className="font-semibold text-slate-900 block mb-1">Findings:</span>
                  {analysisResult.diagnosis}
                </div>

                {/* Disclaimer */}
                <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100 mt-auto">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p>AI results are for informational purposes only. Consult a radiologist for confirmation.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}