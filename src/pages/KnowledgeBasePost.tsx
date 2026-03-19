import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Share2, Bookmark, Heart, TrendingUp,
  Brain, Syringe, Apple, Pill, Moon, BookOpen, UserCheck, ShieldCheck,
  ChevronRight, MessageSquare, Loader2
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import DOMPurify from 'dompurify';
import { PublicHeader } from "@/components/PublicHeader";
import { api } from "../lib/api";

const categoryIcons: Record<string, any> = {
  "Heart Health": Heart,
  Diabetes: TrendingUp,
  Wellness: Brain,
  Vaccines: Syringe,
  Nutrition: Apple,
  Pharmacy: Pill,
  "Sleep & Mental Health": Moon,
};

const categoryColors: Record<string, string> = {
  "Heart Health": "bg-red-500/10 text-red-600 border-red-500/30",
  Diabetes: "bg-violet-500/10 text-violet-600 border-violet-500/30",
  Wellness: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  Vaccines: "bg-primary/10 text-primary border-primary/30",
  Nutrition: "bg-green-500/10 text-green-600 border-green-500/30",
  Pharmacy: "bg-warning/10 text-warning border-warning/30",
  "Sleep & Mental Health": "bg-indigo-500/10 text-indigo-600 border-indigo-500/30",
};

// =========================================================================
// CROSS-REGION ARTICLE FETCH
// If the article isn't found in the user's region, try the other region.
// This is needed because doctors publish articles in their own region's DB.
// =========================================================================
async function fetchArticleCrossRegion(slug: string): Promise<any> {
  // 1. Try user's current region first (fastest path)
  try {
    const item = await api.get(`/public/knowledge/${encodeURIComponent(slug)}`);
    if (item && item.id) return item;
  } catch { /* Not found in user's region */ }

  // 2. Try the other region
  const userRegion = localStorage.getItem('userRegion') || 'US';
  const otherRegion = userRegion === 'EU' ? 'US' : 'EU';

  const otherPrimary = otherRegion === 'US'
    ? import.meta.env.VITE_PATIENT_SERVICE_URL_US
    : import.meta.env.VITE_PATIENT_SERVICE_URL_EU;
  const otherBackup = otherRegion === 'US'
    ? import.meta.env.VITE_PATIENT_SERVICE_URL_US_BACKUP
    : import.meta.env.VITE_PATIENT_SERVICE_URL_EU_BACKUP;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'x-user-region': otherRegion,
  };

  try {
    const { fetchAuthSession } = await import('aws-amplify/auth');
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch { /* Guest */ }

  const endpoint = `/public/knowledge/${encodeURIComponent(slug)}`;

  async function tryFetch(baseUrl: string, timeoutMs: number): Promise<any> {
    if (!baseUrl) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      clearTimeout(timeout);
      return null;
    }
  }

  let result = await tryFetch(otherPrimary, 5000);
  if (!result && otherBackup) {
    result = await tryFetch(otherBackup, 15000);
  }

  return result;
}

// =========================================================================
// COMPONENT
// =========================================================================
interface KnowledgeBasePostProps {
  role?: "patient" | "doctor";
}

export default function KnowledgeBasePost({ role = "patient" }: KnowledgeBasePostProps) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchArticle() {
      if (!slug || slug === "undefined") {
        setError("Invalid Article ID");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // Cross-region fetch: tries user's region first, then the other
        const item = await fetchArticleCrossRegion(slug);

        if (!item || !item.id) {
          setError("This article is no longer available.");
          return;
        }

        const publishedAt = item.date;
        const rawContent = item.legacyData?.content;
        const content = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;

        setArticle({
          id: item.id,
          title: item.description || item.title,
          category: item.legacyData?.category || item.category || "General",
          content: content,
          image: item.content?.[0]?.attachment?.url || item.coverImage,
          publishDate: publishedAt ? new Date(publishedAt).toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric'
          }) : 'Recently published',
        });
      } catch (error: any) {
        console.error("Failed to fetch article details:", error);
        setError("This article is no longer available.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchArticle();
  }, [slug]);

  const renderContent = (content: any[]) => {
    if (!content) return null;
    return content.map((block, index) => {
      if (block.type === 'paragraph') {
        return (
          <p key={index} className="mb-6 text-muted-foreground leading-relaxed text-lg">
            {block.children?.map((child: any, i: number) => (
              <span key={i} className={cn(child.bold && "font-bold text-foreground", child.italic && "italic")}>
                {child.text}
              </span>
            ))}
          </p>
        );
      }
      if (block.type === 'heading') {
        return (
          <h2 key={index} className="font-display text-2xl font-bold mt-10 mb-5 text-foreground tracking-tight">
            {block.children?.[0]?.text}
          </h2>
        );
      }
      if (typeof block === 'string') {
        return (
          <div key={index} className="mb-4" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block) }} />
        );
      }
      return null;
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium">Loading article...</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <BookOpen className="h-8 w-8 text-destructive/50" />
          </div>
          <p className="font-display font-bold text-xl text-foreground">Unable to load article</p>
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button onClick={() => navigate(role === 'doctor' ? "/doctor/knowledge" : "/knowledge")} className="rounded-xl">
            Return to Library
          </Button>
        </div>
      </div>
    );
  }

  const Icon = categoryIcons[article.category] || BookOpen;

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-20 p-4 sm:p-6 pt-24">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate(role === 'doctor' ? "/doctor/knowledge" : "/knowledge")}
            className="group hover:bg-secondary rounded-xl px-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
            <span className="font-medium text-muted-foreground">Back to Library</span>
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="rounded-xl h-10 w-10 border-border"><Bookmark className="h-4 w-4 text-muted-foreground" /></Button>
            <Button variant="outline" size="icon" className="rounded-xl h-10 w-10 border-border"><Share2 className="h-4 w-4 text-muted-foreground" /></Button>
          </div>
        </div>

        {/* Hero Banner */}
        <div className="relative h-64 sm:h-80 md:h-[420px] w-full rounded-3xl overflow-hidden shadow-elevated group border border-border">
          {article.image ? (
            <img src={article.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={article.title} />
          ) : (
            <div className="w-full h-full bg-secondary flex items-center justify-center">
              <Icon className="h-24 w-24 opacity-10 text-primary" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-6 sm:bottom-10 left-6 sm:left-10 right-6 sm:right-10 space-y-3">
            <Badge className="bg-white/15 backdrop-blur-md text-white border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-widest">
              {article.category}
            </Badge>
            <h1 className="font-display text-2xl sm:text-4xl md:text-5xl font-bold text-white leading-[1.1] tracking-tight max-w-3xl drop-shadow-lg">
              {article.title}
            </h1>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 lg:gap-12 pt-2">
          {/* Main Body */}
          <div className="space-y-8">
            {/* Author Card */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-card border border-border shadow-soft">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/8 flex items-center justify-center border border-primary/10 flex-shrink-0">
                  <UserCheck className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground text-base flex items-center gap-2">
                    MediConnect Medical Board
                    <ShieldCheck className="h-4 w-4 text-primary" />
                  </h4>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Clinical Compliance Reviewer</p>
                </div>
              </div>
              <div className="flex items-center gap-4 sm:gap-6 text-sm">
                <div className="text-center px-3 sm:border-r border-border">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground/60 mb-0.5">Updated</p>
                  <p className="text-sm font-medium text-foreground">{article.publishDate}</p>
                </div>
                <div className="text-center px-3">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground/60 mb-0.5">Duration</p>
                  <p className="text-sm font-medium text-foreground">5 min read</p>
                </div>
              </div>
            </div>

            <article className="prose prose-slate max-w-none dark:prose-invert">
              {renderContent(article.content)}
            </article>

            {/* Disclaimer */}
            <div className="p-6 sm:p-8 rounded-2xl bg-secondary/50 border border-border mt-8">
              <div className="flex gap-4">
                <div className="h-10 w-10 rounded-xl bg-card flex items-center justify-center shadow-sm flex-shrink-0">
                  <ShieldCheck className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <div className="space-y-1.5">
                  <h5 className="font-display font-semibold text-foreground">Medical Disclaimer</h5>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The information provided in this guide is for educational purposes only and is not intended as medical advice. Always consult with a qualified healthcare provider regarding your health and symptoms.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* CTA Card */}
            <Card className="border-0 shadow-elevated medical-gradient rounded-2xl overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <MessageSquare className="h-28 w-28 -mr-6 -mt-6" />
              </div>
              <div className="absolute inset-0 grain" />
              <CardContent className="p-6 sm:p-7 space-y-5 relative z-10">
                <h4 className="font-display text-xl font-bold text-white leading-tight">Discuss this topic with a doctor?</h4>
                <p className="text-white/70 text-sm leading-relaxed">
                  Connect with a certified specialist in less than 15 minutes via secure video call.
                </p>
                <Button
                  variant="secondary"
                  className="w-full h-12 rounded-xl font-semibold text-primary shadow-sm hover:shadow-card transition-all"
                  onClick={() => navigate("/consultation")}
                >
                  Book Consultation
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            {/* Topic Info */}
            <Card className="shadow-soft bg-card rounded-2xl border border-border">
              <CardContent className="p-6 space-y-5">
                <div className="space-y-1">
                  <h5 className="font-display font-semibold text-foreground">Topic Specialty</h5>
                  <p className="text-sm text-muted-foreground">Related Clinical Area</p>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50 border border-border">
                  <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center", categoryColors[article.category]?.split(" ")[0] || "bg-secondary")}>
                    <Icon className={cn("h-5 w-5", categoryColors[article.category]?.split(" ")[1] || "text-muted-foreground")} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{article.category}</p>
                    <p className="text-[10px] font-medium uppercase text-muted-foreground tracking-wider">Medical Hub</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
