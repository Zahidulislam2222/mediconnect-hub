import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Calendar,
  Pill,
  Image,
  Stethoscope,
  Download,
  Eye,
  Search,
  Filter,
  Grid,
  List,
  Share2,
  Network,
  Upload,
  Cloud,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  ScanLine
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { currentUser, currentDoctor, ehrTimeline, documents } from "@/lib/mockData";
import { cn } from "@/lib/utils";

const typeIcons = {
  visit: Stethoscope,
  lab: FileText,
  prescription: Pill,
  imaging: Image,
};

const typeColors = {
  visit: "bg-primary/10 text-primary border-primary/30",
  lab: "bg-accent/10 text-accent border-accent/30",
  prescription: "bg-warning/10 text-warning border-warning/30",
  imaging: "bg-purple-500/10 text-purple-600 border-purple-500/30",
};

const docTypeIcons = {
  insurance: "📋",
  lab: "🧪",
  imaging: "🩻",
  record: "📄",
  referral: "📨",
};

interface HealthRecordsProps {
  role?: "patient" | "doctor";
}

export default function HealthRecords({ role = "patient" }: HealthRecordsProps) {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"timeline" | "grid" | "graph">("timeline");

  // --- AI SIMULATION STATE ---
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [resultReady, setResultReady] = useState(false);

  const user = role === "patient" ? currentUser : currentDoctor;

  const handleLogout = () => {
    navigate("/");
  };

  // --- THE "HYBRID CLOUD" SIMULATION FUNCTION ---
  const handleFileUpload = () => {
    setIsUploading(true);
    setUploadProgress(0);
    setResultReady(false);

    // 1. Simulate Upload to Google Cloud Storage (2 seconds)
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          startAiAnalysis(); // Trigger AI step
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const startAiAnalysis = () => {
    setAiProcessing(true);
    // 2. Simulate Google Vertex AI Processing (3 seconds)
    setTimeout(() => {
      setAiProcessing(false);
      setResultReady(true);
    }, 3000);
  };

  return (
    <DashboardLayout
      title="Health Records"
      subtitle="Hybrid Cloud: AWS S3 Storage + Google Vertex AI Analysis"
      userRole={role}
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
                <p className="text-2xl font-bold">24</p>
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
                <p className="text-2xl font-bold">5</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-500/5 border-green-500/20">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Recent Results</p>
                <p className="text-2xl font-bold">Normal</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="ai-analysis" className="space-y-6">
          <TabsList className="bg-secondary/50 w-full justify-start overflow-x-auto">
            <TabsTrigger value="ai-analysis" className="gap-2">
              <Cpu className="h-4 w-4" /> AI Analysis (GCP)
            </TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="documents">Document Vault</TabsTrigger>
            <TabsTrigger value="graph">Relationships</TabsTrigger>
          </TabsList>

          {/* --- AI ANALYSIS TAB --- */}
          <TabsContent value="ai-analysis" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Upload Zone */}
              <Card className="border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                  <div className="h-20 w-20 bg-muted/50 rounded-full flex items-center justify-center relative">
                    <Cloud className="h-10 w-10 text-muted-foreground" />
                    <Badge className="absolute -top-2 -right-2 bg-blue-600 hover:bg-blue-700">GCP</Badge>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Upload X-Ray or MRI</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
                      Drag and drop your DICOM or JPEG file here.
                      Analysis provided by Google Vertex AI.
                    </p>
                  </div>

                  {!isUploading && !aiProcessing && !resultReady && (
                    <Button onClick={handleFileUpload}>Select File to Analyze</Button>
                  )}

                  {isUploading && (
                    <div className="w-full max-w-xs space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Uploading to Google Cloud Storage...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                    </div>
                  )}

                  {aiProcessing && (
                    <div className="flex flex-col items-center gap-3 text-primary font-medium animate-pulse">
                      <Cpu className="h-8 w-8 text-purple-600" />
                      <span className="text-purple-600">Processing with Vertex AI...</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Result Area */}
              <div className="space-y-4">
                {!resultReady && !aiProcessing && !isUploading && (
                  <div className="h-full bg-muted/20 border rounded-xl flex items-center justify-center text-muted-foreground text-sm p-10 text-center">
                    AI Analysis results will appear here after processing.
                  </div>
                )}

                {resultReady && (
                  <Card className="border-l-4 border-l-red-500 shadow-lg animate-in slide-in-from-bottom-4">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50">Abnormality Detected</Badge>
                          <Badge variant="secondary" className="bg-blue-50 text-blue-700">Confidence: 94.2%</Badge>
                        </div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Vertex AI</span>
                      </div>
                      <CardTitle className="mt-2">Chest X-Ray Analysis Report</CardTitle>
                      <CardDescription>Scan ID: XR-2025-8992 • Today, 2:41 PM</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                        <h4 className="font-semibold text-red-900 flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-4 w-4" />
                          Primary Finding: Pneumonia
                        </h4>
                        <p className="text-sm text-red-800/80">
                          Localized opacity detected in the lower right lobe consistent with bacterial pneumonia. Immediate clinical correlation recommended.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Right Lung Opacity</span>
                          <span className="font-medium text-red-600">High Risk</span>
                        </div>
                        {/* FIXED: Removed indicatorClassName, used tailwind to style child div */}
                        <Progress value={85} className="h-1.5 bg-red-100 [&>div]:bg-red-500" />
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button variant="outline" size="sm" className="gap-2">
                          <Download className="h-4 w-4" />
                          Download Full Report (PDF)
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Timeline View */}
          <TabsContent value="timeline" className="space-y-0">
            <Card className="shadow-card border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Medical Timeline</CardTitle>
                  <Badge variant="secondary">{ehrTimeline.length} records</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-0">
                  {ehrTimeline.map((item) => {
                    const Icon = typeIcons[item.type as keyof typeof typeIcons];
                    const colorClass = typeColors[item.type as keyof typeof typeColors];

                    return (
                      <div key={item.id} className="timeline-item">
                        <div className={cn("timeline-dot", colorClass)}>
                          <Icon className="h-3 w-3" />
                        </div>
                        <div className="p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-semibold text-foreground">{item.title}</h4>
                              <p className="text-sm text-muted-foreground">
                                {item.doctor || item.facility}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">{item.date}</span>
                              <Badge variant="outline" className={cn("text-xs", colorClass)}>
                                {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">{item.summary}</p>
                          {item.documents.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {item.documents.map((doc, idx) => (
                                <Button
                                  key={idx}
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-2 text-xs"
                                >
                                  <FileText className="h-3 w-3" />
                                  {doc}
                                  <Download className="h-3 w-3" />
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Document Vault */}
          <TabsContent value="documents">
            <Card className="shadow-card border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Document Vault</CardTitle>
                  <Button size="sm" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Upload Document
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {documents.map((doc) => (
                    <div key={doc.id} className="document-card group">
                      <div className="text-4xl mb-2">
                        {docTypeIcons[doc.type as keyof typeof docTypeIcons]}
                      </div>
                      <span className="text-sm font-medium text-center line-clamp-2">
                        {doc.name}
                      </span>
                      <span className="text-xs text-muted-foreground">{doc.date}</span>
                      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Share2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Graph View */}
          <TabsContent value="graph">
            <Card className="shadow-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Network className="h-5 w-5 text-primary" />
                  Health Relationships Graph
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] rounded-xl bg-secondary/30 border border-border flex items-center justify-center">
                  <div className="text-center">
                    <div className="relative w-64 h-64 mx-auto">
                      {/* Central Node */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium shadow-lg z-10">
                        You
                      </div>

                      {/* Connected Nodes */}
                      {[
                        { label: "Dr. Chen", pos: "top-0 left-1/2 -translate-x-1/2", color: "bg-accent" },
                        { label: "Lisinopril", pos: "right-0 top-1/2 -translate-y-1/2", color: "bg-warning" },
                        { label: "Dr. Roberts", pos: "bottom-0 left-1/2 -translate-x-1/2", color: "bg-accent" },
                        { label: "Metformin", pos: "left-0 top-1/2 -translate-y-1/2", color: "bg-warning" },
                      ].map((node, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "absolute w-16 h-16 rounded-full flex items-center justify-center text-white text-xs font-medium shadow-md",
                            node.pos,
                            node.color
                          )}
                        >
                          {node.label}
                        </div>
                      ))}

                      {/* Connection Lines (SVG) */}
                      <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }}>
                        <line x1="50%" y1="30%" x2="50%" y2="40%" stroke="hsl(var(--border))" strokeWidth="2" />
                        <line x1="70%" y1="50%" x2="60%" y2="50%" stroke="hsl(var(--border))" strokeWidth="2" />
                        <line x1="50%" y1="70%" x2="50%" y2="60%" stroke="hsl(var(--border))" strokeWidth="2" />
                        <line x1="30%" y1="50%" x2="40%" y2="50%" stroke="hsl(var(--border))" strokeWidth="2" />
                      </svg>
                    </div>
                    <p className="text-sm text-muted-foreground mt-4">
                      Visualizing drug interactions, doctor referrals, and care connections
                    </p>
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