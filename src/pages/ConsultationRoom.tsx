import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { getCurrentUser } from 'aws-amplify/auth';
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


const API_URL = import.meta.env.VITE_API_BASE_URL || "";

export default function ConsultationRoom() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams(); // <--- Init Search Params
  const { toast } = useToast();

  // --- 1. DATA FROM NAVIGATION (The "Keys" to the Room) ---
  const appointmentId = location.state?.appointmentId || searchParams.get("appointmentId");
  const patientName = location.state?.patientName || searchParams.get("patientName") || "Patient";

  // --- 2. STATE ---
  const [hasJoined, setHasJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [activeTab, setActiveTab] = useState("scribe");
  const [roster, setRoster] = useState<any>({}); // Tracks who is in the meeting

  // --- 3. REFS (Direct HTML/SDK Access) ---
  const meetingSessionRef = useRef<DefaultMeetingSession | null>(null);
  const audioVideoRef = useRef<HTMLVideoElement>(null); // For Local Preview
  const remoteVideoRef = useRef<HTMLVideoElement>(null); // For Doctor's Video
  const hiddenAudioRef = useRef<HTMLAudioElement>(null); // For Incoming Audio (Voice)

  // --- 4. CLEANUP ON UNMOUNT ---
  useEffect(() => {
    return () => {
      leaveMeeting();
    };
  }, []);

  // --- 5. TOGGLE HANDLERS (Real SDK Logic) ---
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
      const videoOff = !isVideoOff;
      if (videoOff) {
        await meetingSessionRef.current.audioVideo.stopLocalVideoTile();
      } else {
        await meetingSessionRef.current.audioVideo.startLocalVideoTile();
      }
      setIsVideoOff(videoOff);
    }
  };

  const leaveMeeting = () => {
    if (meetingSessionRef.current) {
      meetingSessionRef.current.audioVideo.stop();
      meetingSessionRef.current.audioVideo.stopLocalVideoTile();
      setHasJoined(false);
    }
  };

  const handleExit = () => {
    leaveMeeting();

    // 🟢 THE WORKFLOW FIX:
    // We need to know who is leaving the call. Get user role from localStorage.
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    if (currentUser.role === 'doctor') {
      // If the doctor leaves, send them back to the queue to complete the paperwork.
      navigate('/patient-queue');
    } else {
      // If the patient leaves, send them back to their appointments list.
      navigate('/appointments');
    }
  };

  // --- HELPER FOR SPEAKERS ---
  const getBestAudioOutput = async (meetingSession: DefaultMeetingSession) => {
    // We fixed Windows, so now we just trust the "Default" setting.
    // This connects to whatever works for YouTube.
    const audioOutputs = await meetingSession.audioVideo.listAudioOutputDevices();
    const defaultDevice = audioOutputs.find(d => d.deviceId === 'default');
    if (defaultDevice) return defaultDevice.deviceId;

    // Fallback if something is weird
    if (audioOutputs.length > 0) return audioOutputs[0].deviceId;

    return null;
  };

  // --- 6. THE CORE JOIN LOGIC ---
  const handleJoin = async () => {
    if (!appointmentId) {
      toast({ variant: "destructive", title: "Error", description: "Missing Appointment ID." });
      return;
    }

    setIsJoining(true);
    try {
      const currentUser = await getCurrentUser();
      const userId = currentUser.userId;

      // A. CALL BACKEND
      const res = await fetch(`${API_URL}/video-service`, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: appointmentId,
          userId: userId,
          userName: patientName || "Patient"
        })
      });

      if (!res.ok) throw new Error("Failed to join");
      const { Meeting, Attendee } = await res.json();

      // B. INITIALIZE CHIME SDK
      const logger = new ConsoleLogger('MediConnectLogger', LogLevel.INFO);
      const deviceController = new DefaultDeviceController(logger);
      const configuration = new MeetingSessionConfiguration(Meeting, Attendee);
      const meetingSession = new DefaultMeetingSession(configuration, logger, deviceController);
      meetingSessionRef.current = meetingSession;

      // C. CONFIGURE AUDIO INPUT (SMART SELECTION)
      const audioInputs = await meetingSession.audioVideo.listAudioInputDevices();

      // 1. PRIORITY: System Default (Mic #2 in your test - Best Volume)
      let bestMic = audioInputs.find(d => d.deviceId === 'default');

      // 2. SECONDARY: Realtek (Mic #1 in your test - Working)
      if (!bestMic) {
        bestMic = audioInputs.find(d => d.label.includes("Realtek"));
      }

      // 3. FALLBACK: Whatever is first (Mic #0 - DroidCam - BAD, but last resort)
      const micId = bestMic ? bestMic.deviceId : audioInputs[0]?.deviceId;

      if (micId) {
        console.log(`🎤 Connecting to Mic: ${bestMic ? bestMic.label : "First Available"}...`);
        await meetingSession.audioVideo.startAudioInput(micId);
      }

      // --- VIDEO INPUT (Keep existing logic) ---
      const videoInputs = await meetingSession.audioVideo.listVideoInputDevices();
      if (videoInputs.length > 0) {
        await meetingSession.audioVideo.startVideoInput(videoInputs[0].deviceId);
      }

      // D. CONFIGURE OUTPUT (The Fix)
      const bestSpeakerId = await getBestAudioOutput(meetingSession);
      if (bestSpeakerId) {
        await meetingSession.audioVideo.chooseAudioOutput(bestSpeakerId);
      }

      // E. BIND OBSERVERS
      meetingSession.audioVideo.addObserver({
        videoTileDidUpdate: (tileState: any) => {
          if (!tileState.boundAttendeeId || tileState.isContent) return;
          if (tileState.localTile) {
            if (audioVideoRef.current) meetingSession.audioVideo.bindVideoElement(tileState.tileId, audioVideoRef.current);
          } else {
            if (remoteVideoRef.current) meetingSession.audioVideo.bindVideoElement(tileState.tileId, remoteVideoRef.current);
          }
        },
        audioVideoDidStart: async () => {
          console.log("🔊 Meeting Started. Binding Audio...");
          const audioOutputElement = hiddenAudioRef.current;
          if (audioOutputElement) {
            // 1. Bind the stream
            await meetingSession.audioVideo.bindAudioElement(audioOutputElement);

            // 2. Force Volume & Play
            audioOutputElement.volume = 1.0;
            try {
              await audioOutputElement.setSinkId('default'); // Force Default
              await audioOutputElement.play();
            } catch (err) {
              console.warn("Autoplay blocked:", err);
            }
          }
        },

      });
      // Real-time presence subscription (Corrected)
      meetingSession.audioVideo.realtimeSubscribeToAttendeeIdPresence(
        (attendeeId: string, present: boolean) => {
          setRoster((prev: any) => {
            const newRoster = { ...prev };
            if (present) {
              newRoster[attendeeId] = true;
            } else {
              delete newRoster[attendeeId];
            }
            return newRoster;
          });
        }
      );

      // F. START
      meetingSession.audioVideo.start();
      meetingSession.audioVideo.startLocalVideoTile();

      setHasJoined(true);
      toast({ title: "Connected", description: "Secure session established." });

    } catch (error: any) {
      console.error("Join Error:", error);
      toast({ variant: "destructive", title: "Connection Failed", description: error.message });
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
          {/* Camera Preview */}
          <div className="space-y-4">
            <div className="relative aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
              {/* Note: We use a simple getUserMedia preview here for the lobby, 
                   or we could init SDK early. For simplicity, we use a placeholder icon in lobby until join. */}
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                <Video className="h-16 w-16 mb-4 opacity-50" />
                <p>Camera preview starts after joining</p>
              </div>
            </div>
          </div>

          {/* Join Details */}
          <div className="space-y-6 text-center md:text-left">
            <div>
              <h1 className="text-3xl font-bold mb-2">Ready to join?</h1>
              <p className="text-slate-400">Appointment ID: {appointmentId || "Unknown"}</p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                className="w-full h-14 text-lg bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-900/20"
                onClick={handleJoin}
                disabled={isJoining || !appointmentId}
              >
                {isJoining ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                {isJoining ? "Connecting..." : "Join Consultation Now"}
              </Button>
              <Button variant="outline" className="w-full bg-slate-800 text-white border-slate-700 hover:bg-slate-700" onClick={() => navigate(-1)}>
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

  // --- MAIN ROOM ---
  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      {/* REQUIRED FOR INCOMING AUDIO */}
      <audio ref={hiddenAudioRef} style={{ display: 'none' }} />

      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-slate-900/50 backdrop-blur-sm fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setHasJoined(false)}>
            <ChevronRight className="h-5 w-5 rotate-180" />
          </Button>
          <div>
            <h1 className="font-semibold text-sm md:text-base">Consultation Room</h1>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs text-white/50">Encrypted Connection</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-white/10 bg-white/5 hidden md:flex">
            <Users className="w-3 h-3 mr-1" /> {Object.keys(roster).length} Participants
          </Badge>
          <Button variant="ghost" size="icon"><Settings className="w-5 h-5" /></Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="pt-16 flex h-screen">

        {/* Video Grid */}
        <div className="flex-1 p-4 flex flex-col gap-4 relative">

          {/* 🟢 REMOTE VIDEO (The Doctor) */}
          <div className="flex-1 rounded-2xl bg-slate-800 relative overflow-hidden flex items-center justify-center border border-white/10 shadow-2xl">
            <video
              ref={remoteVideoRef}
              className="w-full h-full object-cover"
              style={{ display: remoteVideoRef.current?.srcObject ? 'block' : 'none' }}
              autoPlay      // <--- ADD THIS
              playsInline   // <--- ADD THIS
            />
            {/* Fallback if no video yet */}
            <div className={`absolute inset-0 flex items-center justify-center ${remoteVideoRef.current?.srcObject ? 'hidden' : 'flex'}`}>
              <div className="text-center">
                <Avatar className="h-32 w-32 mx-auto mb-4 border-4 border-emerald-500/20">
                  <AvatarFallback className="bg-slate-700 text-3xl">DR</AvatarFallback>
                </Avatar>
                <h2 className="text-xl font-medium">Waiting for Doctor...</h2>
              </div>
            </div>
          </div>

          {/* 🟢 LOCAL VIDEO (Self - PiP) */}
          <div className="absolute bottom-24 right-8 w-48 md:w-64 aspect-video bg-black rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl hover:scale-105 transition-transform cursor-pointer">
            {!isVideoOff ? (
              <video
                ref={audioVideoRef}
                className="w-full h-full object-cover transform -scale-x-100"
                muted
                autoPlay      // <--- ADD THIS
                playsInline   // <--- ADD THIS
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
              className={cn("h-14 w-14 rounded-full shadow-lg transition-all", isMuted ? "bg-red-500 text-white" : "bg-slate-800 text-white")}
              onClick={toggleMute}
            >
              {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className={cn("h-14 w-14 rounded-full shadow-lg transition-all", isVideoOff ? "bg-red-500 text-white" : "bg-slate-800 text-white")}
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

        {/* Right Sidebar (Unchanged - Ready for WebSocket Integration) */}
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
                      <p className="text-slate-400 italic text-sm">Transcription service connecting...</p>
                    </div>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="chat" className="flex-1 p-0 m-0 flex flex-col">
              {/* Chat UI - Ready for WebSocket */}
            </TabsContent>
          </Tabs>
        </div>

      </div>
    </div>
  );
}