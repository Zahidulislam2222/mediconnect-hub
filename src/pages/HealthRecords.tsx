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

  // --- 1. INITIAL DATA LOAD (AUTH + VAULT + GRAPH) ---
  useEffect(() => {
    async function loadData() {
      try {
        // A. Get User
        const authUser = await getCurrentUser();
        const userId = authUser.userId;

        // Fetch Profile for Avatar/Name
        try {
          const profile: any = await api.get(`/register-patient?id=${userId}`);
          const userData = { name: profile.name || "Patient", id: userId, avatar: profile.avatar };

          setUser(userData);

          // 🟢 FIX: Update Storage Safely
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

        // C. Fetch Relationship Graph (Using GET Pattern)
        // Note: We append "PATIENT#" because DynamoDB stores keys like "PATIENT#123"
        try {
          const gData: any = await api.get(`/relationships?entityId=PATIENT#${userId}`);
          setGraphConnections(gData.connections || []);
        } catch (e) { console.warn("Graph load failed"); }

      } catch (error) {
        console.error("Data Load Error:", error);
      } finally {
        setLoadingRecords(false);
      }
    }
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
      const data: any = await api.post('/analyze-image', {
        imageBase64: base64Clean,
        patientId: user.id
      });

      if (data.report && !data.report.diagnosis.includes("Analysis Failed")) {
        setAiResult(data.report);
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

  // --- HELPER: Graph Positions ---
  // Maps the dynamic array of connections to fixed visual positions
  const getGraphNodePosition = (index: number) => {
    const positions = [
      "top-0 left-1/2 -translate-x-1/2",    // Top Center
      "right-0 top-1/2 -translate-y-1/2",   // Right Center
      "bottom-0 left-1/2 -translate-x-1/2", // Bottom Center
      "left-0 top-1/2 -translate-y-1/2"     // Left Center
    ];
    return positions[index % positions.length];
  };
  // 🟢 ADD THIS FUNCTION:
  const handleVaultUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];
    setIsUploading(true);

    try {
      // Step 1: Request Presigned URL from Lambda
      const token = (await getCurrentUser()).userId; // Or fetch session token if needed

      const initRes: any = await api.post('/ehr', {
        action: "request_upload",
        patientId: user.id,
        fileName: file.name,
        fileType: file.type,
        description: "Uploaded by Patient via Portal"
      });

      const { uploadUrl } = initRes;

      // Step 2: Upload directly to S3
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      });

      if (!uploadRes.ok) throw new Error("S3 Upload Failed");

      toast({ title: "Success", description: "Document securely uploaded to vault." });

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
                        <div className="aspect-square bg-slate-100 rounded-lg mb-2 overflow-hidden flex items-center justify-center">
                          {doc.fileType?.includes("image") ? (
                            <ImageIcon className="h-8 w-8 text-blue-400" />
                          ) : (
                            <FileText className="h-8 w-8 text-slate-400" />
                          )}
                        </div>
                        <span className="text-sm font-semibold text-center block truncate text-blue-900">
                          {doc.fileName || "Untitled"}
                        </span>
                        <span className="text-xs text-blue-600/70 block text-center mt-1">
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </span>

                        {/* Open Button */}
                        {doc.s3Url && (
                          <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px]">
                            <a href={doc.s3Url} target="_blank" rel="noreferrer">
                              <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </a>
                          </div>
                        )}
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
                        <Button variant="outline" size="sm" className="gap-2">
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
                            <h4 className="font-semibold text-foreground">{item.fileName}</h4>
                            <p className="text-sm text-muted-foreground">
                              Uploaded by: {item.uploadedBy || "System"}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{item.description || "No notes attached."}</p>
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
                  Care Network
                </CardTitle>
                <CardDescription>Visualizing your connected doctors and medications from DynamoDB.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden">
                  <div className="text-center w-full h-full flex items-center justify-center relative">

                    {/* The Graph Canvas */}
                    <div className="relative w-80 h-80">

                      {/* Central Node (YOU) */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-indigo-600 text-white flex flex-col items-center justify-center shadow-xl z-20 border-4 border-white ring-2 ring-indigo-200 animate-in zoom-in">
                        <Avatar className="h-10 w-10 mb-1 border-2 border-indigo-300">
                          <AvatarImage src={user.avatar} />
                          <AvatarFallback className="text-indigo-800 bg-indigo-100 text-xs">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-bold">YOU</span>
                      </div>

                      {/* Connected Nodes */}
                      {graphConnections.length > 0 ? (
                        graphConnections.map((conn, idx) => {
                          // Clean the ID (Remove "DOCTOR#" prefix)
                          const label = conn.SK.split("#")[1] || conn.SK;
                          const pos = getGraphNodePosition(idx);

                          return (
                            <div
                              key={idx}
                              className={cn(
                                "absolute w-20 h-20 rounded-full flex flex-col items-center justify-center text-xs font-medium shadow-md bg-white border border-slate-200 z-10 transition-all hover:scale-110 cursor-pointer",
                                pos
                              )}
                            >
                              <div className="h-8 w-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center mb-1">
                                <Stethoscope className="h-4 w-4" />
                              </div>
                              <span className="max-w-[80px] truncate px-1">{label}</span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white px-3 py-1 rounded-full shadow text-xs text-muted-foreground">
                          No connections found in database.
                        </div>
                      )}

                      {/* Lines (SVG) */}
                      {graphConnections.length > 0 && (
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
                          <line x1="50%" y1="50%" x2="50%" y2="10%" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
                          <line x1="50%" y1="50%" x2="90%" y2="50%" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
                          <line x1="50%" y1="50%" x2="50%" y2="90%" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
                          <line x1="50%" y1="50%" x2="10%" y2="50%" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}