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
  Pencil,
  Sparkles,
  ChevronRight,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export default function ConsultationRoom() {
  const navigate = useNavigate();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [activeTab, setActiveTab] = useState("scribe");
  const [cameraError, setCameraError] = useState(false);

  // Video Ref to show Real Camera
  const myVideoRef = useRef<HTMLVideoElement>(null);

  // --- 1. ACCESS REAL CAMERA ---
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  // Watch for toggle button
  useEffect(() => {
    if (isVideoOff) stopCamera();
    else startCamera();
  }, [isVideoOff]);

  const startCamera = async () => {
    try {
      if (myVideoRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
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

  const transcription = [
    { time: "0:00", speaker: "Dr. Chen", text: "Good afternoon, how are you feeling today?" },
    { time: "0:05", speaker: "Patient", text: "I've been having some chest discomfort." },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/50">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-white/70 hover:text-white hover:bg-white/10"
            onClick={() => navigate(-1)}
          >
            <ChevronRight className="h-5 w-5 rotate-180" />
          </Button>
          <div>
            <h1 className="font-semibold text-lg">Consultation with Dr. Sarah Chen</h1>
            <p className="text-sm text-white/50">Cardiology • 2:30 PM</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20 px-3 py-1">
            <span className="animate-pulse mr-2 h-2 w-2 rounded-full bg-red-500 inline-block" />
            REC
          </Badge>
          <span className="text-sm font-mono text-white/60 bg-white/5 px-2 py-1 rounded">24:35</span>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Video Area */}
        <div className="flex-1 p-6 relative">
          <div className="relative h-full w-full rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 overflow-hidden shadow-2xl border border-white/10">

            {/* MAIN VIDEO (The Doctor - Simulated with Avatar) */}
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
              <div className="text-center">
                <div className="relative inline-block">
                  <Avatar className="h-40 w-40 mx-auto mb-4 border-4 border-emerald-500/30 shadow-xl">
                    <AvatarFallback className="bg-slate-700 text-slate-300 text-5xl font-light">SC</AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-2 right-2 h-6 w-6 bg-emerald-500 rounded-full border-4 border-slate-800"></div>
                </div>
                <h2 className="text-2xl font-semibold mt-4">Dr. Sarah Chen</h2>
                <p className="text-emerald-400 text-sm font-medium mt-1">Speaking...</p>

                {/* Audio Wave Animation */}
                <div className="flex items-center justify-center gap-1 mt-6 h-8">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="w-1 bg-emerald-500/50 rounded-full animate-pulse" style={{ height: `${Math.random() * 100}%`, animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
              </div>
            </div>

            {/* PiP (PATIENT SELF VIEW - REAL CAMERA) */}
            <div className="absolute bottom-24 right-6 w-64 aspect-video rounded-xl bg-black border-2 border-white/10 overflow-hidden shadow-2xl transition-all hover:scale-105 z-20">
              {!isVideoOff && !cameraError ? (
                <video
                  ref={myVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover transform -scale-x-100"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-800">
                  <div className="text-center">
                    <Avatar className="h-12 w-12 mx-auto mb-2 bg-slate-700">
                      <AvatarFallback>YOU</AvatarFallback>
                    </Avatar>
                    <p className="text-xs text-white/50">{cameraError ? "Camera Error" : "Camera Off"}</p>
                  </div>
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] font-medium backdrop-blur-sm">
                You (Patient)
              </div>
            </div>

            {/* Floating Controls Bar */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 bg-slate-900/90 backdrop-blur-md rounded-full border border-white/10 shadow-xl z-30">
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-12 w-12 rounded-full transition-all", isMuted ? "bg-red-500/20 text-red-500 hover:bg-red-500/30" : "bg-white/5 hover:bg-white/10")}
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className={cn("h-12 w-12 rounded-full transition-all", isVideoOff ? "bg-red-500/20 text-red-500 hover:bg-red-500/30" : "bg-white/5 hover:bg-white/10")}
                onClick={() => setIsVideoOff(!isVideoOff)}
              >
                {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className={cn("h-12 w-12 rounded-full transition-all", isScreenSharing ? "bg-emerald-500/20 text-emerald-500" : "bg-white/5 hover:bg-white/10")}
                onClick={() => setIsScreenSharing(!isScreenSharing)}
              >
                <MonitorUp className="h-5 w-5" />
              </Button>

              <div className="w-px h-8 bg-white/10 mx-2" />

              <Button
                variant="destructive"
                size="icon"
                className="h-12 w-12 rounded-full shadow-lg hover:bg-red-600 transition-transform hover:scale-110"
                onClick={() => navigate(-1)}
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
            </div>

          </div>
        </div>

        {/* Side Panel (AI Scribe) */}
        <div className="w-96 border-l border-white/10 bg-slate-900/50 backdrop-blur-sm">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="px-4 pt-4">
              <TabsList className="w-full grid grid-cols-2 bg-slate-800/50 p-1">
                <TabsTrigger value="scribe" className="data-[state=active]:bg-slate-700">AI Scribe</TabsTrigger>
                <TabsTrigger value="chat" className="data-[state=active]:bg-slate-700">Chat</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="scribe" className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-full px-4">
                <div className="space-y-6 pb-6">
                  {/* Real-time Transcription */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-white/90">Live Transcription</h3>
                      <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/5">
                        <Sparkles className="w-3 h-3 mr-1" /> AWS Transcribe
                      </Badge>
                    </div>

                    <div className="space-y-4 pl-4 border-l-2 border-white/10">
                      {transcription.map((item, idx) => (
                        <div key={idx} className="relative">
                          <div className={`absolute -left-[21px] top-0 w-3 h-3 rounded-full border-2 border-slate-900 ${item.speaker === "Dr. Chen" ? "bg-emerald-500" : "bg-blue-500"}`} />
                          <div className="text-xs text-white/40 mb-1 flex justify-between">
                            <span className={item.speaker === "Dr. Chen" ? "text-emerald-400 font-medium" : "text-blue-400 font-medium"}>
                              {item.speaker}
                            </span>
                            <span>{item.time}</span>
                          </div>
                          <p className="text-sm text-white/80 leading-relaxed bg-white/5 p-2 rounded-lg rounded-tl-none">
                            {item.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Findings */}
                  <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-xl p-4 border border-indigo-500/20">
                    <h3 className="text-sm font-medium text-white/90 mb-3 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      AWS Comprehend Findings
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between bg-black/20 p-2 rounded">
                        <span className="text-sm">Chest discomfort</span>
                        <Badge className="bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30">98%</Badge>
                      </div>
                      <div className="flex items-center justify-between bg-black/20 p-2 rounded">
                        <span className="text-sm">Shortness of breath</span>
                        <Badge className="bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30">92%</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="chat" className="flex-1 flex flex-col mt-0">
              <div className="flex-1 flex items-center justify-center text-white/30">
                <p className="text-sm">No messages yet</p>
              </div>
              <div className="p-4 border-t border-white/10">
                <div className="relative">
                  <input className="w-full bg-slate-800 border-none rounded-full py-3 px-4 text-sm text-white placeholder:text-white/30 focus:ring-1 focus:ring-emerald-500" placeholder="Type a message..." />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}