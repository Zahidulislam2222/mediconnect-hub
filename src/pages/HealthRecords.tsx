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
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { currentUser, ehrTimeline, documents } from "@/lib/mockData";
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

export default function HealthRecords() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"timeline" | "grid" | "graph">("timeline");

  const handleLogout = () => {
    navigate("/");
  };

  return (
    <DashboardLayout
      title="Health Records"
      subtitle="Your complete medical history in one place"
      userRole="patient"
      userName={currentUser.name}
      userAvatar={currentUser.avatar}
      onLogout={handleLogout}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search records, documents, or prescriptions..." className="pl-10" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            <div className="flex border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === "timeline" ? "secondary" : "ghost"}
                size="icon"
                className="rounded-none"
                onClick={() => setViewMode("timeline")}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="rounded-none"
                onClick={() => setViewMode("grid")}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "graph" ? "secondary" : "ghost"}
                size="icon"
                className="rounded-none"
                onClick={() => setViewMode("graph")}
              >
                <Network className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="timeline" className="space-y-6">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="documents">Document Vault</TabsTrigger>
            <TabsTrigger value="graph">Relationships</TabsTrigger>
          </TabsList>

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
