import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  PhoneOff,
  MessageSquare,
  Sparkles,
  ChevronRight,
  Settings,
  Users,
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function ConsultationRoom() {
  const navigate = useNavigate();

  // --- STATE MANAGEMENT ---
  const [hasJoined, setHasJoined] = useState(false); // Controls Lobby vs Room
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [activeTab, setActiveTab] = useState("scribe");

  // Video Ref for Real Camera
  const myVideoRef = useRef<HTMLVideoElement>(null);

  // --- CAMERA LOGIC ---
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [hasJoined]); // Restart camera when switching views

  // Watch for toggle button
  useEffect(() => {
    if (isVideoOff) stopCamera();
    else startCamera();
  }, [isVideoOff]);

  const startCamera = async () => {
    try {
      if (myVideoRef.current && !isVideoOff) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        myVideoRef.current.srcObject = stream;
        setCameraError(false);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setCameraError(true);
    }
  };

  const stopCamera = () => {
    if (myVideoRef.current && myVideoRef.current.srcObject) {
      const stream = myVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      myVideoRef.current.srcObject = null;
    }
  };

  // --- LOBBY SCREEN (PRE-CALL) ---
  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">

          {/* Left: Camera Preview */}
          <div className="space-y-4">
            <div className="relative aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
              {!isVideoOff && !cameraError ? (
                <video
                  ref={myVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover transform -scale-x-100"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                  <div className="h-20 w-20 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                    {cameraError ? <VideoOff className="h-8 w-8 text-red-500" /> : <VideoOff className="h-8 w-8" />}
                  </div>
                  <p>{cameraError ? "Camera Access Denied" : "Camera is Off"}</p>
                </div>
              )}

              {/* Controls Overlay */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4">
                <Button
                  variant="secondary"
                  size="icon"
                  className={cn("h-12 w-12 rounded-full", isMuted && "bg-red-500 hover:bg-red-600 text-white")}
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className={cn("h-12 w-12 rounded-full", isVideoOff && "bg-red-500 hover:bg-red-600 text-white")}
                  onClick={() => setIsVideoOff(!isVideoOff)}
                >
                  {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                </Button>
              </div>
            </div>

            <div className="flex justify-between items-center text-sm text-slate-400 px-2">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4" />
                <span>Default Microphone (Realtek Audio)</span>
              </div>
              <Button variant="ghost" size="sm" className="h-8 text-xs">Test Audio</Button>
            </div>
          </div>

          {/* Right: Join Details */}
          <div className="space-y-6 text-center md:text-left">
            <div>
              <h1 className="text-3xl font-bold mb-2">Ready to join?</h1>
              <p className="text-slate-400">Dr. Sarah Chen is waiting in the lobby.</p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                className="w-full h-14 text-lg bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-900/20"
                onClick={() => setHasJoined(true)}
              >
                Join Consultation Now
              </Button>
              <Button variant="outline" className="w-full border-slate-700 hover:bg-slate-800" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </div>

            <div className="pt-6 border-t border-slate-800">
              <div className="flex items-center justify-center md:justify-start gap-2 text-xs text-slate-500">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>End-to-end encrypted • HIPAA Compliant</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN CONSULTATION ROOM ---
  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-slate-900/50 backdrop-blur-sm fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-white/70 hover:text-white hover:bg-white/10"
            onClick={() => setHasJoined(false)} // Go back to lobby
          >
            <ChevronRight className="h-5 w-5 rotate-180" />
          </Button>
          <div>
            <h1 className="font-semibold text-sm md:text-base">Dr. Sarah Chen</h1>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs text-white/50">04:23 • Encrypted</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-white/10 bg-white/5 hidden md:flex">
            <Users className="w-3 h-3 mr-1" /> 2 Participants
          </Badge>
          <Button variant="ghost" size="icon"><Settings className="w-5 h-5" /></Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="pt-16 flex h-screen">

        {/* Video Grid */}
        <div className="flex-1 p-4 flex flex-col gap-4 relative">

          {/* Dr. Chen (Mocked) */}
          <div className="flex-1 rounded-2xl bg-slate-800 relative overflow-hidden flex items-center justify-center border border-white/10 shadow-2xl">
            <div className="text-center">
              <Avatar className="h-32 w-32 mx-auto mb-4 border-4 border-emerald-500/20">
                <AvatarFallback className="bg-slate-700 text-3xl">SC</AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-medium">Dr. Sarah Chen</h2>
              <p className="text-emerald-400 text-sm mt-1 animate-pulse">Speaking...</p>
            </div>
            {/* Audio Wave */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-end gap-1 h-8">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-1 bg-emerald-500 rounded-full animate-music" style={{ animationDelay: `${i * 0.1}s`, height: '40%' }} />
              ))}
            </div>
          </div>

          {/* Self View (Real Camera - PiP) */}
          <div className="absolute bottom-24 right-8 w-48 md:w-64 aspect-video bg-black rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl hover:scale-105 transition-transform cursor-pointer">
            {!isVideoOff ? (
              <video
                ref={myVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover transform -scale-x-100"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-500 text-xs">
                Camera Off
              </div>
            )}
            <div className="absolute bottom-2 left-2 text-[10px] font-medium bg-black/60 px-2 py-0.5 rounded backdrop-blur-md">
              You
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="h-20 flex items-center justify-center gap-4">
            <Button
              variant="secondary"
              size="icon"
              className={cn("h-14 w-14 rounded-full shadow-lg transition-all", isMuted ? "bg-red-500 hover:bg-red-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-white")}
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className={cn("h-14 w-14 rounded-full shadow-lg transition-all", isVideoOff ? "bg-red-500 hover:bg-red-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-white")}
              onClick={() => setIsVideoOff(!isVideoOff)}
            >
              {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
            </Button>
            <Button
              variant="destructive"
              size="icon"
              className="h-14 w-14 rounded-full shadow-lg bg-red-600 hover:bg-red-700"
              onClick={() => navigate(-1)}
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Right Sidebar (AI Scribe) */}
        <div className="w-80 md:w-96 border-l border-white/10 bg-slate-900/90 hidden lg:flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="p-4 border-b border-white/10">
              <TabsList className="w-full grid grid-cols-2 bg-slate-800">
                <TabsTrigger value="scribe">AI Scribe</TabsTrigger>
                <TabsTrigger value="chat">Chat</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="scribe" className="flex-1 p-0 m-0 overflow-hidden">
              <ScrollArea className="h-full p-4">
                <div className="space-y-6">
                  <Card className="bg-slate-800/50 border-white/5 p-4">
                    <div className="flex items-center gap-2 mb-3 text-emerald-400 text-sm font-medium">
                      <Sparkles className="w-4 h-4" /> Live Transcription
                    </div>
                    <div className="space-y-4">
                      <div className="text-sm">
                        <p className="text-slate-400 text-xs mb-1">Dr. Chen • 00:15</p>
                        <p className="text-slate-200">Good afternoon. I see you uploaded your X-Ray.</p>
                      </div>
                      <div className="text-sm">
                        <p className="text-emerald-500/80 text-xs mb-1">You • 00:22</p>
                        <p className="text-slate-200">Yes, I was worried about the chest pain.</p>
                      </div>
                    </div>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="chat" className="flex-1 p-0 m-0 flex flex-col">
              <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                No messages yet
              </div>
              <div className="p-4 border-t border-white/10">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="w-full bg-slate-800 border-none rounded-full px-4 py-2 text-sm focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}