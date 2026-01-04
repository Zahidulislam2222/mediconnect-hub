import { useState } from "react";
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
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

  const transcription = [
    { time: "0:00", speaker: "Dr. Chen", text: "Good afternoon, how are you feeling today?" },
    {
      time: "0:05",
      speaker: "Patient",
      text: "I've been having some chest discomfort and shortness of breath for the past few days.",
    },
    {
      time: "0:15",
      speaker: "Dr. Chen",
      text: "I see. Can you describe the chest discomfort? Is it sharp or more of a pressure feeling?",
    },
    {
      time: "0:25",
      speaker: "Patient",
      text: "It's more like a pressure, especially when I climb stairs or walk quickly.",
    },
  ];

  const extractedSymptoms = [
    { symptom: "Chest discomfort", confidence: 95 },
    { symptom: "Shortness of breath", confidence: 92 },
    { symptom: "Exercise-induced symptoms", confidence: 88 },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
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
            <h1 className="font-semibold">Consultation with John Doe</h1>
            <p className="text-sm text-white/60">Chest Pain - Follow up</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <span className="animate-pulse mr-1.5 h-2 w-2 rounded-full bg-red-500 inline-block" />
            Live
          </Badge>
          <span className="text-sm text-white/60">24:35</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Video Area */}
        <div className="flex-1 p-6">
          <div className="relative h-full rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden">
            {/* Main Video (Doctor) */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Avatar className="h-32 w-32 mx-auto mb-4 border-4 border-primary/30">
                  <AvatarFallback className="bg-primary/20 text-primary text-4xl">
                    SC
                  </AvatarFallback>
                </Avatar>
                <p className="text-lg font-medium">Dr. Sarah Chen</p>
                <p className="text-sm text-white/60">Cardiologist</p>
              </div>
            </div>

            {/* PiP (Patient) */}
            <div className="absolute bottom-6 right-6 w-48 h-36 rounded-xl bg-slate-800 border-2 border-white/10 overflow-hidden shadow-lg">
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Avatar className="h-12 w-12 mx-auto mb-2">
                    <AvatarFallback className="bg-accent/20 text-accent">JD</AvatarFallback>
                  </Avatar>
                  <p className="text-xs text-white/80">You</p>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
              <Button
                variant="ghost"
                size="lg"
                className={cn(
                  "h-14 w-14 rounded-full",
                  isMuted ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-white/10 text-white hover:bg-white/20"
                )}
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </Button>

              <Button
                variant="ghost"
                size="lg"
                className={cn(
                  "h-14 w-14 rounded-full",
                  isVideoOff ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-white/10 text-white hover:bg-white/20"
                )}
                onClick={() => setIsVideoOff(!isVideoOff)}
              >
                {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
              </Button>

              <Button
                variant="ghost"
                size="lg"
                className={cn(
                  "h-14 w-14 rounded-full",
                  isScreenSharing ? "bg-primary/20 text-primary hover:bg-primary/30" : "bg-white/10 text-white hover:bg-white/20"
                )}
                onClick={() => setIsScreenSharing(!isScreenSharing)}
              >
                <MonitorUp className="h-6 w-6" />
              </Button>

              <Button
                variant="ghost"
                size="lg"
                className="h-14 w-14 rounded-full bg-red-500 text-white hover:bg-red-600"
                onClick={() => navigate(-1)}
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div className="w-96 border-l border-white/10 bg-slate-800/50">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3 bg-transparent border-b border-white/10 rounded-none p-0 h-auto">
              <TabsTrigger
                value="scribe"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                AI Scribe
              </TabsTrigger>
              <TabsTrigger
                value="chat"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Chat
              </TabsTrigger>
              <TabsTrigger
                value="whiteboard"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Draw
              </TabsTrigger>
            </TabsList>

            <TabsContent value="scribe" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-6">
                  {/* Real-time Transcription */}
                  <div>
                    <h3 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                      Real-time Transcription
                    </h3>
                    <div className="space-y-3">
                      {transcription.map((item, idx) => (
                        <div key={idx} className="text-sm">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white/40 text-xs">{item.time}</span>
                            <span className="font-medium text-primary">{item.speaker}</span>
                          </div>
                          <p className="text-white/70 pl-10">{item.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Extracted Symptoms */}
                  <div className="pt-4 border-t border-white/10">
                    <h3 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      AI Extracted Symptoms
                    </h3>
                    <div className="space-y-2">
                      {extractedSymptoms.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-lg bg-white/5"
                        >
                          <span className="text-sm text-white/80">{item.symptom}</span>
                          <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                            {item.confidence}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="chat" className="flex-1 m-0 p-4">
              <div className="h-full flex flex-col items-center justify-center text-center">
                <MessageSquare className="h-12 w-12 text-white/20 mb-3" />
                <p className="text-white/60 text-sm">Chat messages will appear here</p>
              </div>
            </TabsContent>

            <TabsContent value="whiteboard" className="flex-1 m-0 p-4">
              <div className="h-full rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <div className="text-center">
                  <Pencil className="h-12 w-12 text-white/20 mx-auto mb-3" />
                  <p className="text-white/60 text-sm">Digital Whiteboard</p>
                  <p className="text-white/40 text-xs mt-1">Draw diagrams for patient</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
