import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Send,
  Upload,
  Brain,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  X,
  Sparkles,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { currentUser, aiSymptomMessages } from "@/lib/mockData";
import { cn } from "@/lib/utils";

export default function SymptomChecker() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState(aiSymptomMessages);
  const [inputValue, setInputValue] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const handleLogout = () => {
    navigate("/");
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    
    setMessages([
      ...messages,
      { id: `msg-${Date.now()}`, role: "user", content: inputValue },
    ]);
    setInputValue("");

    // Simulate AI response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now() + 1}`,
          role: "assistant",
          content:
            "Based on your symptoms, this could be related to tension headaches or fatigue. I recommend:\n\n• Ensuring adequate sleep (7-9 hours)\n• Staying hydrated\n• Taking regular breaks from screens\n\nWould you like me to help you schedule an appointment with a healthcare provider?",
        },
      ]);
    }, 1500);
  };

  const handleImageUpload = () => {
    setUploadedImage("/placeholder-xray.jpg");
    setShowAnalysis(true);
  };

  return (
    <DashboardLayout
      title="AI Symptom Checker"
      subtitle="Describe your symptoms to get AI-powered health insights"
      userRole="patient"
      userName={currentUser.name}
      userAvatar={currentUser.avatar}
      onLogout={handleLogout}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
        {/* Chat Interface */}
        <Card className="lg:col-span-2 shadow-card border-border/50 flex flex-col h-[calc(100vh-220px)]">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl medical-gradient">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Health Assistant</CardTitle>
                <p className="text-sm text-muted-foreground">Powered by Bedrock AI</p>
              </div>
              <Badge className="ml-auto bg-success/10 text-success border-success/30">
                <span className="h-2 w-2 rounded-full bg-success mr-1.5 animate-pulse" />
                Online
              </Badge>
            </div>
          </CardHeader>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3",
                    msg.role === "user" && "flex-row-reverse"
                  )}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback
                      className={cn(
                        "text-xs",
                        msg.role === "assistant"
                          ? "bg-primary/10 text-primary"
                          : "bg-accent/10 text-accent"
                      )}
                    >
                      {msg.role === "assistant" ? (
                        <Sparkles className="h-4 w-4" />
                      ) : (
                        currentUser.avatar
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-3",
                      msg.role === "assistant"
                        ? "bg-secondary text-secondary-foreground rounded-tl-none"
                        : "bg-primary text-primary-foreground rounded-tr-none"
                    )}
                  >
                    <p className="text-sm whitespace-pre-line">{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="p-4 border-t">
            <div className="flex gap-3">
              <Input
                placeholder="Describe your symptoms..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                className="flex-1"
              />
              <Button onClick={handleSend} className="bg-primary hover:bg-primary/90">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Medical Imaging Upload */}
        <div className="space-y-6">
          <Card className="shadow-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-primary" />
                Medical Imaging
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!uploadedImage ? (
                <div
                  onClick={handleImageUpload}
                  className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="font-medium text-foreground mb-1">
                    Upload X-Ray or MRI
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Drag and drop or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Supported: DICOM, PNG, JPG
                  </p>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden bg-slate-900">
                  <div className="aspect-square flex items-center justify-center">
                    <div className="text-center text-white/60">
                      <ImageIcon className="h-16 w-16 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">chest_xray_jan2026.dcm</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70"
                    onClick={() => {
                      setUploadedImage(null);
                      setShowAnalysis(false);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Analysis Results */}
          {showAnalysis && (
            <Card className="shadow-card border-border/50 animate-fade-in">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="font-medium text-success">No Anomalies Detected</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Clear lung fields. No signs of consolidation or effusion.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Confidence Scores</h4>
                  <div className="space-y-2">
                    {[
                      { label: "Normal Findings", score: 94 },
                      { label: "Image Quality", score: 98 },
                      { label: "Coverage", score: 100 },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{item.label}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 rounded-full bg-secondary overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${item.score}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{item.score}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t">
                  <p className="text-xs text-muted-foreground flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    AI analysis is for informational purposes only. Always consult with a healthcare professional for medical advice.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
