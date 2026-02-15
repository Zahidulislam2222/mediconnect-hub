import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth'; // Updated import
import {
  ConsoleLogger,
  DefaultDeviceController,
  DefaultMeetingSession,
  LogLevel,
  MeetingSessionConfiguration
} from "amazon-chime-sdk-js";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Sparkles,
  ChevronRight,
  Settings,
  Users,
  ShieldCheck,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

export default function ConsultationRoom() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // --- 1. DATA FROM NAVIGATION ---
  const appointmentId = location.state?.appointmentId || searchParams.get("appointmentId");

  // --- 2. STATE ---
  const [hasJoined, setHasJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isRemoteVideoActive, setIsRemoteVideoActive] = useState(false); // New: Tracks if remote video is actually flowing
  const [activeTab, setActiveTab] = useState("scribe");
  const [roster, setRoster] = useState<Record<string, boolean>>({});
  const [localUserId, setLocalUserId] = useState<string>("");
  const [transcriptLines, setTranscriptLines] = useState<{ sender: string, text: string }[]>([]);
  const fullTranscriptRef = useRef<string>(""); // Used for the final summary

  // --- 3. REFS ---
  const meetingSessionRef = useRef<DefaultMeetingSession | null>(null);
  const audioVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const hiddenAudioRef = useRef<HTMLAudioElement>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // --- CHAT STATE ---
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");

  // --- 4. WEBSOCKET CONNECTION (SECURE) ---
  useEffect(() => {
    if (!hasJoined || !appointmentId) return;

    let ws: WebSocket | null = null;

    const connectSocket = async () => {
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();

        if (!token) throw new Error("Authentication token missing");

        // WSS Protocol ensures TLS encryption (HIPAA requirement for transit)
        const wsUrl = `${import.meta.env.VITE_COMMUNICATION_WS_URL}?token=${token}&appointmentId=${appointmentId}`;
        ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => console.log("Secure Chat Connected");

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setMessages((prev) => [...prev, { ...data, timestamp: new Date() }]);
          } catch (e) {
            console.error("Failed to parse incoming message", e);
          }
        };

        ws.onclose = () => console.log("Chat Disconnected");

      } catch (error) {
        console.error("WebSocket Connection Failed:", error);
      }
    };

    connectSocket();

    return () => {
      if (ws) ws.close();
    };
  }, [hasJoined, appointmentId]);

  // --- 5. TOGGLE HANDLERS ---
  const toggleMute = () => {
    if (meetingSessionRef.current) {
      const muted = !isMuted;
      if (muted) meetingSessionRef.current.audioVideo.realtimeMuteLocalAudio();
      else meetingSessionRef.current.audioVideo.realtimeUnmuteLocalAudio();
      setIsMuted(muted);
    }
  };

  const toggleVideo = async () => {
    if (meetingSessionRef.current) {
      const videoOff = !isVideoOff; // Toggle intent
      if (videoOff) {
        // Stop the hardware camera to ensure privacy
        await meetingSessionRef.current.audioVideo.stopLocalVideoTile();
      } else {
        // Restart hardware camera
        await meetingSessionRef.current.audioVideo.startLocalVideoTile();
      }
      setIsVideoOff(videoOff);
    }
  };

  const sendChatMessage = () => {
    if (chatInput.trim() && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {

      // LOGIC: Find the "other" person in the roster
      const rosterIds = Object.keys(roster);
      const recipientId = rosterIds.find(id => id !== localUserId) || "BROADCAST";

      const payload = {
        action: "sendMessage",
        recipientId: recipientId,
        conversationId: appointmentId,
        text: chatInput,
        timestamp: new Date().toISOString() // Audit trail
      };

      socketRef.current.send(JSON.stringify(payload));
      setMessages(prev => [...prev, { senderId: 'me', text: chatInput, timestamp: new Date() }]);
      setChatInput("");
    }
  };

  const leaveMeeting = () => {
    if (meetingSessionRef.current) {
      // 1. Stop AV hardware (GDPR/Privacy - ensure light goes off)
      meetingSessionRef.current.audioVideo.stop();
      meetingSessionRef.current.audioVideo.stopLocalVideoTile();

      // 2. Clear References
      meetingSessionRef.current = null;
    }
  };

  const handleExit = async () => {
    // 1. Backend cleanup (Stop billing/recording)
    try {
      await api.delete(`/video/session?appointmentId=${appointmentId}`);
    } catch (e) {
      console.warn("Session cleanup warning (non-blocking)");
    }

    // 2. Hardware cleanup
    leaveMeeting();

    // 3. Navigate immediately (Prevent lobby flash)
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    navigate(currentUser.role === 'doctor' ? '/patient-queue' : '/appointments');
  };

  // --- HELPER FOR SPEAKERS ---
  const getBestAudioOutput = async (meetingSession: DefaultMeetingSession) => {
    const audioOutputs = await meetingSession.audioVideo.listAudioOutputDevices();
    const defaultDevice = audioOutputs.find(d => d.deviceId === 'default');
    return defaultDevice?.deviceId || audioOutputs[0]?.deviceId || null;
  };

  // --- 6. JOIN LOGIC ---
  const handleJoin = async () => {
    if (!appointmentId) {
      toast({ variant: "destructive", title: "Error", description: "Missing Appointment ID." });
      return;
    }

    setIsJoining(true);
    try {
      // A. Authentication & User Identity
      const currentUser = await getCurrentUser();
      setLocalUserId(currentUser.userId); // Store for Chat logic

      // B. Backend Session Request
      const data: any = await api.post('/video/session', { appointmentId });
      const { Meeting, Attendee } = data;

      // C. Initialize SDK
      const logger = new ConsoleLogger('MediConnectLogger', LogLevel.WARN); // WARN level for Production
      const deviceController = new DefaultDeviceController(logger);
      const configuration = new MeetingSessionConfiguration(Meeting, Attendee);
      const meetingSession = new DefaultMeetingSession(configuration, logger, deviceController);
      meetingSessionRef.current = meetingSession;

      // D. Audio Input Selection
      const audioInputs = await meetingSession.audioVideo.listAudioInputDevices();
      let bestMic = audioInputs.find(d => d.deviceId === 'default') ||
        audioInputs.find(d => d.label.toLowerCase().includes("realtek")) ||
        audioInputs[0];

      if (bestMic) {
        await meetingSession.audioVideo.startAudioInput(bestMic.deviceId);
      }

      // E. Video Input Selection
      const videoInputs = await meetingSession.audioVideo.listVideoInputDevices();
      if (videoInputs.length > 0) {
        await meetingSession.audioVideo.startVideoInput(videoInputs[0].deviceId);
      }

      // F. Audio Output Selection
      const bestSpeakerId = await getBestAudioOutput(meetingSession);
      if (bestSpeakerId) {
        await meetingSession.audioVideo.chooseAudioOutput(bestSpeakerId);
      }

      // G. Observers (The "Eyes & Ears")
      meetingSession.audioVideo.addObserver({
        // VIDEO BINDING
        videoTileDidUpdate: (tileState: any) => {
          if (!tileState.boundAttendeeId || tileState.isContent) return;

          if (tileState.localTile) {
            // Bind Local Video
            if (audioVideoRef.current) {
              meetingSession.audioVideo.bindVideoElement(tileState.tileId, audioVideoRef.current);
            }
          } else {
            // Bind Remote Video
            if (remoteVideoRef.current) {
              meetingSession.audioVideo.bindVideoElement(tileState.tileId, remoteVideoRef.current);
              setIsRemoteVideoActive(true); // <--- UPDATE UI STATE
            }
          }
        },
        // REMOTE VIDEO STOPPED
        videoTileWasRemoved: (tileId: number) => {
          const tileState = meetingSession.audioVideo.getVideoTile(tileId)?.state();
          // Only hide the remote view if the tile removed was NOT the local one
          if (tileState && !tileState.localTile) {
            setIsRemoteVideoActive(false);
          }
        },
        // AUDIO START
        audioVideoDidStart: async () => {
          const audioOutputElement = hiddenAudioRef.current;
          if (audioOutputElement) {
            await meetingSession.audioVideo.bindAudioElement(audioOutputElement);
            audioOutputElement.volume = 1.0;

            // BROWSER COMPATIBILITY FIX: Check if setSinkId exists (Fixes Safari/Firefox crash)
            if ('setSinkId' in audioOutputElement && bestSpeakerId) {
              // @ts-ignore - Typescript might not know about setSinkId yet
              await audioOutputElement.setSinkId(bestSpeakerId);
            }

            try {
              await audioOutputElement.play();
            } catch (err) {
              console.warn("Autoplay blocked - User interaction needed");
            }
          }
        },
      });

      // Presence Subscription
      meetingSession.audioVideo.realtimeSubscribeToAttendeeIdPresence(
        (attendeeId: string, present: boolean) => {
          setRoster((prev) => {
            const newRoster = { ...prev };
            if (present) newRoster[attendeeId] = true;
            else delete newRoster[attendeeId];
            return newRoster;
          });
        }
      );

      // H. Start Session
      meetingSession.audioVideo.start();
      meetingSession.audioVideo.startLocalVideoTile();
      setHasJoined(true);
      toast({ title: "Secure Connection Established", description: "HIPAA Compliant Session Active" });

      // 🟢 ADD THIS: Listen for Live Transcription
      // 🟢 UPDATED WITH TYPE CAST TO FIX TS2339
      // 🟢 FIX: Correct Transcription Listener for Chime SDK JS
      meetingSession.audioVideo.transcriptionController.subscribeToTranscriptEvent((transcriptEvent: any) => {
          const results = transcriptEvent.results;
          if (!results) return;

          results.forEach((result: any) => {
            if (!result.alternatives || !result.alternatives[0]) return;
            
            const { transcript } = result.alternatives[0];
            const attendeeId = result.resultId; // Or check result.alternatives[0].items[0].attendeeId if available
            const isFinal = !result.isPartial;

            if (isFinal && transcript) {
              const sender = attendeeId === localUserId ? "Doctor" : "Patient";
              
              // Update State
              setTranscriptLines(prev => [...prev, { sender, text: transcript }]);
              
              // Update Ref for summary
              fullTranscriptRef.current += `${sender}: ${transcript}\n`;
            }
          });
      });

    } catch (error: any) {
      console.error("Join Error:", error);
      toast({ variant: "destructive", title: "Connection Failed", description: "Could not establish secure link." });
    } finally {
      setIsJoining(false);
    }

  };

  // --- LOBBY SCREEN ---
  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        {/* HIDDEN AUDIO ELEMENT FOR CHIME */}
        <audio ref={hiddenAudioRef} style={{ display: 'none' }} />

        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <div className="relative aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center">
              <Video className="h-16 w-16 text-slate-700 animate-pulse" />
              <p className="absolute bottom-4 text-xs text-slate-500">Camera preview starts securely after joining</p>
            </div>
          </div>

          <div className="space-y-6 text-center md:text-left">
            <div>
              <h1 className="text-3xl font-bold mb-2">Consultation Ready</h1>
              <p className="text-slate-400">ID: {appointmentId}</p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                className="w-full h-14 text-lg bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-900/20"
                onClick={handleJoin}
                disabled={isJoining || !appointmentId}
              >
                {isJoining ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-2 h-5 w-5" />}
                {isJoining ? "Establishing Secure Link..." : "Join Consultation"}
              </Button>
              <Button variant="outline" className="w-full bg-slate-800 text-white border-slate-700 hover:bg-slate-700" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </div>
            <p className="text-[10px] text-slate-600 text-center md:text-left">
              By joining, you consent to the secure transmission of audio/video data in compliance with HIPAA regulations.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN ROOM ---
  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      <audio ref={hiddenAudioRef} style={{ display: 'none' }} />

      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-slate-900/50 backdrop-blur-sm fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            {/* Note: In a real app, confirm before leaving */}
            <ChevronRight className="h-5 w-5 rotate-180" />
          </Button>
          <div>
            <h1 className="font-semibold text-sm md:text-base">Consultation Room</h1>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs text-emerald-400/80">AES-256 Encrypted</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-white/10 bg-white/5 hidden md:flex">
            <Users className="w-3 h-3 mr-1" /> {Object.keys(roster).length} Active
          </Badge>
          <Button variant="ghost" size="icon"><Settings className="w-5 h-5" /></Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="pt-16 flex h-screen">

        {/* Video Grid */}
        <div className="flex-1 p-4 flex flex-col gap-4 relative">

          {/* REMOTE VIDEO (Doctor/Patient) */}
          <div className="flex-1 rounded-2xl bg-slate-800 relative overflow-hidden flex items-center justify-center border border-white/10 shadow-2xl">
            <video
              ref={remoteVideoRef}
              className="w-full h-full object-cover"
              // Correct Logic: Only show video element if we have active remote video
              style={{ display: isRemoteVideoActive ? 'block' : 'none' }}
              autoPlay
              playsInline
            />

            {/* Fallback Avatar when no remote video */}
            {!isRemoteVideoActive && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                <div className="text-center animate-in fade-in zoom-in duration-500">
                  <Avatar className="h-32 w-32 mx-auto mb-4 border-4 border-emerald-500/20">
                    <AvatarFallback className="bg-slate-800 text-3xl font-bold text-emerald-500">
                      {Object.keys(roster).length > 1 ? "VIDEO OFF" : "WAITING"}
                    </AvatarFallback>
                  </Avatar>
                  <h2 className="text-xl font-medium text-slate-300">
                    {Object.keys(roster).length > 1 ? "Participant camera is off" : "Waiting for participant to join..."}
                  </h2>
                </div>
              </div>
            )}
          </div>

          {/* LOCAL VIDEO (PiP) */}
          <div className="absolute bottom-24 right-8 w-48 md:w-64 aspect-video bg-black rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl hover:scale-105 transition-transform cursor-pointer z-20">
            {!isVideoOff ? (
              <video
                ref={audioVideoRef}
                className="w-full h-full object-cover transform -scale-x-100"
                muted
                autoPlay
                playsInline
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-500 text-xs flex-col gap-2">
                <VideoOff className="h-6 w-6 opacity-50" />
                <span>Camera Paused</span>
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
              className={cn("h-14 w-14 rounded-full shadow-lg transition-all", isMuted ? "bg-red-500 text-white hover:bg-red-600" : "bg-slate-800 text-white hover:bg-slate-700")}
              onClick={toggleMute}
            >
              {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className={cn("h-14 w-14 rounded-full shadow-lg transition-all", isVideoOff ? "bg-red-500 text-white hover:bg-red-600" : "bg-slate-800 text-white hover:bg-slate-700")}
              onClick={toggleVideo}
            >
              {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
            </Button>
            <Button
              variant="destructive"
              size="icon"
              className="h-14 w-14 rounded-full shadow-lg bg-red-600 hover:bg-red-700"
              onClick={handleExit}
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 md:w-96 border-l border-white/10 bg-slate-900/95 hidden lg:flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="p-4 border-b border-white/10">
              <TabsList className="w-full grid grid-cols-2 bg-slate-800">
                <TabsTrigger value="scribe">AI Scribe</TabsTrigger>
                <TabsTrigger value="chat">Secure Chat</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="scribe" className="flex-1 p-0 m-0 overflow-hidden">
              <ScrollArea className="h-full p-4">
                <div className="space-y-6">
                  <Card className="bg-slate-800/50 border-white/5 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                        <Sparkles className="w-4 h-4" /> Live AI Scribe
                      </div>
                      {transcriptLines.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[10px] h-7 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          onClick={async () => {
                            setIsJoining(true); // Re-use loading state
                            try {
                              const res: any = await api.post('/predict/summarize', {
                                appointmentId,
                                transcript: fullTranscriptRef.current,
                                patientId: location.state?.patientId // Ensure this is passed in state
                              });
                              toast({ title: "Clinical Note Saved", description: "AI Summary added to EHR." });
                              setActiveTab("scribe");
                            } catch (e) {
                              toast({ variant: "destructive", title: "Summary Failed" });
                            } finally {
                              setIsJoining(false);
                            }
                          }}
                        >
                          Save Note to EHR
                        </Button>
                      )}
                    </div>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {transcriptLines.length === 0 ? (
                        <p className="text-slate-500 italic text-xs text-center py-10">
                          AI is listening... speak to begin transcription.
                        </p>
                      ) : (
                        transcriptLines.map((line, i) => (
                          <div key={i} className="text-xs border-l-2 border-emerald-500/30 pl-3 py-1">
                            <span className="font-bold text-emerald-400 block mb-0.5">{line.sender}</span>
                            <p className="text-slate-300 leading-relaxed">{line.text}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="chat" className="flex-1 p-0 m-0 flex flex-col h-full">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((m, i) => (
                    <div key={i} className={cn("flex flex-col", m.senderId === 'me' ? "items-end" : "items-start")}>
                      <div className={cn("max-w-[80%] p-3 rounded-2xl text-sm", m.senderId === 'me' ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-200")}>
                        {m.text}
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="p-4 border-t border-white/10 bg-slate-900">
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-slate-800 border-none rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500 outline-none text-white placeholder-slate-500"
                    placeholder="Type a secure message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                  />
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={sendChatMessage}>Send</Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}