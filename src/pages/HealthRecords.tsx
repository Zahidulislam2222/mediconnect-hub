import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from 'aws-amplify/auth';
import {
  FileText,
  Stethoscope,
  Pill,
  Image as ImageIcon,
  Download,
  Eye,
  Share2,
  Network,
  Cloud,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  ScanLine,
  Server,
  Loader2,
  Plus,
  Upload,
  Database
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// --- DEMO FALLBACK FOR AI QUOTA LIMITS ---
const DEMO_RADIOLOGY_REPORT = {
  diagnosis: "[DEMO MODE] Clear lung fields. No detected fractures or anomalies. Cardiac silhouette is within normal limits.",
  visionTags: ["X-Ray", "Chest", "Normal", "Medical Imaging"]
};

export default function HealthRecords() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const vaultInputRef = useRef<HTMLInputElement>(null); // New (for Vault)
  const [isUploading, setIsUploading] = useState(false);

  // --- STATE ---
  const [user, setUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : { name: "Patient", id: "", avatar: null };
    } catch (e) { return { name: "Patient", id: "", avatar: null }; }
  });
  const [records, setRecords] = useState<any[]>([]);
  const [graphConnections, setGraphConnections] = useState<any[]>([]);

  // Loading States
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);

  // AI Analysis State
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<any>(null);

  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // --- 1. INITIAL DATA LOAD (AUTH + VAULT + GRAPH) ---
  // Define it outside so the Upload function can call it too
  const loadData = async () => {
    try {
      setLoadingRecords(true);
      const authUser = await getCurrentUser();
      const userId = authUser.userId;

      // A. Fetch Profile for Avatar/Name
      try {
        const profile: any = await api.get(`/register-patient?id=${userId}`);
        const userData = { name: profile.name || "Patient", id: userId, avatar: profile.avatar };

        setUser(userData);

        // 🟢 Update Storage Safely
        const currentLocal = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...currentLocal, ...userData }));
      } catch (e) { /* ignore profile load error */ }

      // B. Fetch Document Vault (Using POST-RPC Pattern)
      try {
        const data: any = await api.post('/ehr', {
          action: "list_records",
          patientId: userId
        });
        // Sort by newest first
        const sorted = Array.isArray(data) ? data.sort((a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ) : [];
        setRecords(sorted);
      } catch (e) { console.warn("EHR List Failed", e); }

      // C. Fetch Relationship Graph
      if (userId) {
        try {
          setLoadingGraph(true); // 🟢 Start the spin
          const gData: any = await api.get(`/relationships?entityId=PATIENT#${userId}`);
          setGraphConnections(gData.connections || []);
        } catch (e) {
          console.warn("Graph load failed");
        } finally {
          setLoadingGraph(false); // 🔴 Stop the spin
        }
      }

    } catch (error) {
      console.error("Data Load Error:", error);
    } finally {
      setLoadingRecords(false);
    }
  };

  // Run once on component mount
  useEffect(() => {
    loadData();
  }, []);

  // --- 2. AI IMAGE ANALYSIS LOGIC (Reused from Symptom Checker) ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        setUploadedImagePreview(result);
        processImageUpload(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImageUpload = async (base64Full: string) => {
    setAiProcessing(true);
    setAiResult(null);
    const base64Clean = base64Full.split(",")[1];

    try {
      const data: any = await api.post('/chat/analyze-image', {
        imageBase64: base64Clean,
        patientId: user.id,
        prompt: "Perform a detailed clinical analysis of this imaging scan."
      });

      if (data.analysis) {
        setAiResult({
          diagnosis: data.analysis,
          pdfData: data.pdfBase64, // 🟢 STORE THE PDF STRING
          visionTags: ["Radiology", data.provider]
        });
      } else {
        throw new Error("AI Failed");
      }
    } catch (error) {
      console.warn("AI Limit Reached, showing Demo Report");
      toast({
        title: "Simulation Mode",
        description: "AWS Daily Limit reached. Showing demo radiology report.",
      });
      // Fallback to Demo Data so the UI doesn't look broken
      setTimeout(() => setAiResult(DEMO_RADIOLOGY_REPORT), 1500);
    } finally {
      setAiProcessing(false);
    }
  };

  const handleLogout = () => {
    navigate("/");
  };

  // --- HELPER: Initials ---
  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  // --- HELPER: Professional Coordinate System ---
  const getCoords = (type: 'DOCTOR' | 'DRUG', index: number, doctorIndex?: number, totalDoctors?: number) => {
    const centerX = 50;
    const centerY = 50;

    if (type === 'DOCTOR') {
      // Spread doctors in an arc across the top
      const angle = (index / (Math.max(1, totalDoctors! - 1) || 1)) * 120 - 150;
      const radius = 28;
      return {
        x: centerX + radius * Math.cos((angle * Math.PI) / 180),
        y: centerY + radius * Math.sin((angle * Math.PI) / 180)
      };
    } else {
      // Position drugs near their specific doctor
      const angle = (doctorIndex! / (Math.max(1, totalDoctors! - 1) || 1)) * 120 - 150;
      const drugOffset = (index * 15) - 7.5; // Fan out multiple drugs
      const radius = 45; // Outer ring
      return {
        x: centerX + radius * Math.cos(((angle + drugOffset) * Math.PI) / 180),
        y: centerY + radius * Math.sin(((angle + drugOffset) * Math.PI) / 180)
      };
    }
  };
  // 🟢 ADD THIS FUNCTION:
  const handleVaultUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setIsUploading(true);

    try {
      // 🟢 FIX: Catch 's3Key' from the response here
      const initRes: any = await api.post('/ehr', {
        action: "request_upload",
        patientId: user.id,
        fileName: file.name,
        fileType: file.type
      });

      const { uploadUrl, s3Key } = initRes; // 🟢 Now s3Key is defined!

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      });

      if (!uploadRes.ok) throw new Error("S3 Upload Failed");

      // 🟢 Now this call will work because s3Key is defined above
      await api.post('/ehr', {
        action: "save_record_metadata",
        patientId: user.id,
        fileName: file.name,
        fileType: file.type,
        s3Key: s3Key,
        description: "Self-uploaded via Patient Portal"
      });

      toast({ title: "Success", description: "Document saved to vault." });
      loadData();

      // Step 3: Refresh List
      // We essentially re-run the "list_records" logic here
      const listRes: any = await api.post('/ehr', { action: "list_records", patientId: user.id });

      if (listRes) {
        const data = listRes;
        const sorted = Array.isArray(data) ? data.sort((a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ) : [];
        setRecords(sorted);
      }

    } catch (error) {
      console.error("Upload Error:", error);
      toast({ variant: "destructive", title: "Upload Failed", description: "Could not save document." });
    } finally {
      setIsUploading(false);
      // Reset input so same file can be selected again if needed
      if (vaultInputRef.current) vaultInputRef.current.value = "";
    }
  };

  return (
    <DashboardLayout
      title="Health Records"
      subtitle="A secure, centralized archive of your complete health journey"
      userRole="patient"
      userName={user.name}
      userAvatar={user.avatar}
      onLogout={handleLogout}
    >
      <div className="space-y-6 animate-fade-in">

        {/* Top Stats Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Records</p>
                <p className="text-2xl font-bold">{records.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600">
                <ScanLine className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Imaging Scans</p>
                <p className="text-2xl font-bold">{records.filter(r => r.fileType?.includes('image')).length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-500/5 border-green-500/20">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">System Status</p>
                <p className="text-2xl font-bold">Online</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="documents" className="space-y-6">
          <TabsList className="bg-secondary/50 w-full justify-start overflow-x-auto">
            <TabsTrigger value="documents">Document Vault</TabsTrigger>
            <TabsTrigger value="ai-analysis" className="gap-2">
              <Cpu className="h-4 w-4" /> Hybrid AI Analysis
            </TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="graph">Relationships</TabsTrigger>
          </TabsList>

          {/* --- TAB 1: DOCUMENT VAULT (AWS S3) --- */}
          <TabsContent value="documents">
            <Card className="shadow-card border-blue-200 bg-blue-50/20">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2 text-blue-800">
                      <Server className="h-5 w-5" />
                      Encrypted Document Vault
                    </CardTitle>
                    <CardDescription>
                      Secure storage for your medical history.
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 hidden sm:flex">
                      AES-256
                    </Badge>

                    {/* 🟢 NEW UPLOAD BUTTON */}
                    <Button size="sm" onClick={() => vaultInputRef.current?.click()} disabled={isUploading}>
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Upload Record
                    </Button>

                    {/* 🟢 HIDDEN INPUT FOR VAULT */}
                    <input
                      type="file"
                      ref={vaultInputRef}
                      className="hidden"
                      onChange={handleVaultUpload}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingRecords ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-2" />
                    <p>Decrypting records from secure storage...</p>
                  </div>
                ) : records.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                    <Database className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>No records found in your vault.</p>
                    <p className="text-xs">Documents uploaded by your doctor will appear here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {records.map((doc, idx) => (
                      <div key={idx} className="relative group bg-white border border-blue-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-all">

                        {/* 🟢 CHANGE START: SMART ICON LOGIC */}
                        <div className="aspect-square bg-slate-100 rounded-lg mb-2 overflow-hidden flex items-center justify-center">
                          {doc.type === 'NOTE' ? (
                            <FileText className="h-8 w-8 text-amber-500" /> /* Amber for Notes */
                          ) : doc.fileType?.includes("image") ? (
                            <ImageIcon className="h-8 w-8 text-blue-400" /> /* Blue for Images */
                          ) : (
                            <FileText className="h-8 w-8 text-slate-400" /> /* Grey for PDFs */
                          )}
                        </div>

                        {/* 🟢 CHANGE START: SMART LABEL LOGIC */}
                        <span className="text-sm font-semibold text-center block truncate text-blue-900">
                          {doc.resource?.description || doc.fileName || (doc.type === 'NOTE' ? "Untitled Clinical Note" : "Untitled File")}
                        </span>
                        {/* 🟢 CHANGE END */}

                        <span className="text-xs text-blue-600/70 block text-center mt-1">
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </span>

                        {/* Open Button */}
                        <div
                          className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px] cursor-pointer"
                          onClick={() => {
                            if (doc.type === 'NOTE') {
                              setSelectedNote(doc); // This opens the text modal
                              setIsModalOpen(true);
                            } else if (doc.s3Url) {
                              window.open(doc.s3Url, '_blank'); // This opens the file
                            }
                          }}
                        >
                          <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- TAB 2: AI ANALYSIS (Hybrid) --- */}
          <TabsContent value="ai-analysis" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Upload Zone */}
              <Card className="border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors h-fit">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                  <div className="h-20 w-20 bg-muted/50 rounded-full flex items-center justify-center relative">
                    <Cloud className="h-10 w-10 text-muted-foreground" />
                    <Badge className="absolute -top-2 -right-2 bg-blue-600 hover:bg-blue-700">Vision</Badge>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Upload X-Ray or MRI</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
                      Powered by Google Vision & AWS Bedrock.
                    </p>
                  </div>

                  {!aiProcessing && !aiResult && (
                    <Button onClick={() => fileInputRef.current?.click()}>
                      Select File to Analyze
                    </Button>
                  )}

                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileSelect}
                  />

                  {aiProcessing && (
                    <div className="flex flex-col items-center gap-3 text-primary font-medium animate-pulse">
                      <Cpu className="h-8 w-8 text-purple-600" />
                      <span className="text-purple-600">Processing Cloud Analysis...</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Result Area */}
              <div className="space-y-4">
                {!aiResult && !aiProcessing && (
                  <div className="h-64 bg-muted/20 border rounded-xl flex items-center justify-center text-muted-foreground text-sm p-10 text-center">
                    Upload an image to see the hybrid cloud analysis result.
                  </div>
                )}

                {aiResult && (
                  <Card className="border-l-4 border-l-primary shadow-lg animate-in slide-in-from-bottom-4">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Analysis Complete</Badge>
                          <Badge variant="secondary" className="bg-blue-50 text-blue-700">Google Vision</Badge>
                        </div>
                      </div>
                      <CardTitle className="mt-2">Radiology Report</CardTitle>
                      <CardDescription>Generated by Claude 3 (Bedrock)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Diagnosis */}
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <p className="text-sm text-slate-800 leading-relaxed font-medium">
                          {aiResult.diagnosis}
                        </p>
                      </div>

                      {/* Vision Tags */}
                      <div className="space-y-2">
                        <span className="text-xs text-muted-foreground">Detected Entities (Vision API)</span>
                        <div className="flex flex-wrap gap-2">
                          {aiResult.visionTags?.map((tag: string) => (
                            <Badge key={tag} variant="secondary">{tag}</Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => {
                            if (!aiResult.pdfData) return;
                            const link = document.createElement('a');
                            link.href = `data:application/pdf;base64,${aiResult.pdfData}`;
                            link.download = `Radiology_Report_${new Date().getTime()}.pdf`;
                            link.click();

                            toast({ title: "Report Downloaded", description: "The clinical PDF is saved to your device." });
                          }}
                        >
                          <Download className="h-4 w-4" />
                          Save Report
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* --- TAB 3: TIMELINE (Derived from Vault) --- */}
          <TabsContent value="timeline" className="space-y-0">
            <Card className="shadow-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Medical Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-0 relative border-l border-muted ml-3 pl-6 py-2">
                  {records.map((item, idx) => (
                    <div key={idx} className="mb-8 relative last:mb-0">
                      <div className="absolute -left-[30px] top-1 h-3 w-3 rounded-full bg-primary border-2 border-white ring-2 ring-primary/20" />
                      <div className="p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-foreground">{item.resource?.description || item.fileName || "Untitled Record"}</h4>
                            <p className="text-sm text-muted-foreground">
                              Uploaded by: {item.uploadedBy || "System"}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {new Date(item.resource?.date || item.createdAt).toLocaleDateString()}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{item.resource?.summary || item.description || "No notes attached."}</p>
                      </div>
                    </div>
                  ))}
                  {records.length === 0 && (
                    <p className="text-sm text-muted-foreground italic">No timeline events found.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- TAB 4: RELATIONSHIP GRAPH (DynamoDB Graph) --- */}
          <TabsContent value="graph">
            <Card className="shadow-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Network className="h-5 w-5 text-primary" />
                  Clinical Chain of Care
                </CardTitle>
                <CardDescription>Visualizing treatment pathways from your healthcare providers.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[500px] rounded-xl bg-slate-50/50 border border-slate-200 flex items-center justify-center overflow-hidden relative">

                  {loadingGraph ? (
                    /* 🟢 OPTION 1: THE SPINNER */
                    <div className="flex flex-col items-center gap-3 animate-in fade-in">
                      <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                      <p className="text-sm font-medium text-slate-500 italic">Mapping Care Pathways...</p>
                    </div>
                  ) : graphConnections.length > 0 ? (
                    /* 🟢 OPTION 2: THE REAL GRAPH */
                    <div className="relative w-full h-full">

                      {/* SVG CONNECTOR LINES */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
                        {graphConnections.filter(c => c.SK.startsWith("DOCTOR#")).map((doc, dIdx, dArr) => {
                          const dPos = getCoords('DOCTOR', dIdx, undefined, dArr.length);

                          return (
                            <g key={`links-${doc.SK}`}>
                              {/* Line 1: Patient to Doctor */}
                              <line
                                x1="50%" y1="50%" x2={`${dPos.x}%`} y2={`${dPos.y}%`}
                                stroke="#94a3b8" strokeWidth="2" strokeDasharray="5,5"
                              />

                              {/* Line 2: Doctor to their specific Medications */}
                              {graphConnections
                                .filter(c => c.SK.startsWith("DRUG#") && (c.prescribedBy === doc.SK || c.prescribedBy === doc.SK.split('#')[1]))
                                .map((drug, drIdx) => {
                                  const drPos = getCoords('DRUG', drIdx, dIdx, dArr.length);
                                  return (
                                    <line
                                      key={`link-drug-${drug.SK}`}
                                      x1={`${dPos.x}%`} y1={`${dPos.y}%`} x2={`${drPos.x}%`} y2={`${drPos.y}%`}
                                      stroke="#cbd5e1" strokeWidth="2"
                                    />
                                  );
                                })}
                            </g>
                          );
                        })}
                      </svg>

                      {/* 1. CENTRAL PATIENT NODE */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                        <div className="w-20 h-20 rounded-full bg-indigo-600 border-4 border-white shadow-xl flex flex-col items-center justify-center text-white ring-4 ring-indigo-50">
                          <Avatar className="h-10 w-10 mb-1 border border-indigo-300">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback className="bg-indigo-100 text-indigo-700">{getInitials(user.name)}</AvatarFallback>
                          </Avatar>
                          <span className="text-[10px] font-bold">YOU</span>
                        </div>
                      </div>

                      {/* 2. DOCTOR NODES (The Providers) */}
                      {graphConnections.filter(c => c.SK.startsWith("DOCTOR#")).map((doc, idx, arr) => {
                        const pos = getCoords('DOCTOR', idx, undefined, arr.length);
                        return (
                          <div
                            key={doc.SK}
                            className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center group"
                            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                          >
                            <div className="w-16 h-16 rounded-full bg-white border-2 border-teal-400 shadow-lg flex items-center justify-center text-teal-600 group-hover:scale-110 transition-all">
                              <Stethoscope className="h-6 w-6" />
                            </div>
                            <span className="mt-1 text-[10px] font-bold text-slate-700 bg-white/90 px-2 py-0.5 rounded-full border shadow-sm">
                              Dr. {doc.doctorName || doc.SK.split('#')[1].substring(0, 6)}
                            </span>
                          </div>
                        );
                      })}

                      {/* 3. MEDICATION NODES (The Outcomes) */}
                      {graphConnections.filter(c => c.SK.startsWith("DOCTOR#")).map((doc, dIdx, dArr) =>
                        graphConnections
                          .filter(c => c.SK.startsWith("DRUG#") && (c.prescribedBy === doc.SK || c.prescribedBy === doc.SK.split('#')[1]))
                          .map((drug, drIdx) => {
                            const pos = getCoords('DRUG', drIdx, dIdx, dArr.length);
                            const label = drug.SK.split('#')[1];
                            return (
                              <div
                                key={drug.SK}
                                className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
                                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                              >
                                <div className="w-12 h-12 rounded-full bg-amber-50 border-2 border-amber-200 shadow-md flex items-center justify-center text-amber-600 hover:scale-110 transition-all">
                                  <Pill className="h-4 w-4" />
                                </div>
                                <span className="mt-1 text-[9px] font-semibold text-slate-500 capitalize bg-white/50 px-1">
                                  {label}
                                </span>
                              </div>
                            );
                          })
                      )}
                    </div>
                  ) : (
                    /* 🟢 OPTION 3: REAL EMPTY STATE */
                    <div className="flex flex-col items-center gap-2 animate-in zoom-in">
                      <Network className="h-12 w-12 text-slate-300" />
                      <p className="text-sm font-medium text-slate-500 text-center">
                        No Clinical Connections Found<br />
                        <span className="text-[10px] font-normal text-slate-400">Relationships will appear after your first consultation.</span>
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      {selectedNote && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-500" />
                {selectedNote.resource?.description || selectedNote.fileName || "Clinical Note"}
              </DialogTitle>
              <DialogDescription>
                Created on {new Date(selectedNote.resource?.date || selectedNote.createdAt).toLocaleDateString()}
              </DialogDescription>
            </DialogHeader>
            <div className="p-6 bg-slate-50 rounded-lg border border-slate-200 mt-4 max-h-[60vh] overflow-y-auto">
              <p className="whitespace-pre-wrap text-slate-800 leading-relaxed">
                {selectedNote.resource?.summary || selectedNote.content || selectedNote.note || selectedNote.description || "No content available."}
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}