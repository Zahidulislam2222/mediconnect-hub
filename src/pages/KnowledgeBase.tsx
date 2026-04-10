import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Heart, TrendingUp, Brain, Syringe, Apple, Pill, Moon, ArrowRight, BookOpen, Activity, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PublicHeader } from "@/components/PublicHeader";
import { api } from "../lib/api";

// =========================================================================
// STYLE MAP: Category → Icon + Color (Styling Logic Only)
// =========================================================================
const STYLE_MAP: Record<string, any> = {
  "Heart Health": { icon: Heart, color: "text-red-500", bg: "bg-red-500/10", desc: "Cardiology & Blood Pressure" },
  "Diabetes": { icon: TrendingUp, color: "text-violet-500", bg: "bg-violet-500/10", desc: "Blood Sugar Management" },
  "Wellness": { icon: Brain, color: "text-blue-500", bg: "bg-blue-500/10", desc: "Mental & Physical Balance" },
  "Vaccines": { icon: Syringe, color: "text-emerald-500", bg: "bg-emerald-500/10", desc: "Immunization Schedules" },
  "Nutrition": { icon: Apple, color: "text-green-500", bg: "bg-green-500/10", desc: "Dietary Guidelines" },
  "Pharmacy": { icon: Pill, color: "text-orange-500", bg: "bg-orange-500/10", desc: "Medication Safety" },
  "Sleep & Mental Health": { icon: Moon, color: "text-indigo-500", bg: "bg-indigo-500/10", desc: "Stress & Sleep Hygiene" },
  "Default": { icon: Activity, color: "text-muted-foreground", bg: "bg-secondary", desc: "General Health Information" }
};

const MOCK_CATEGORIES = [
  { name: "Heart Health", ...STYLE_MAP["Heart Health"] },
  { name: "Diabetes", ...STYLE_MAP["Diabetes"] },
  { name: "Wellness", ...STYLE_MAP["Wellness"] },
  { name: "Nutrition", ...STYLE_MAP["Nutrition"] },
];

// =========================================================================
// GLOBAL FETCH: Knowledge Base articles from BOTH US and EU regions
// Doctors publish articles in their region's DynamoDB table.
// This page shows ALL articles globally by querying both regions.
// =========================================================================
async function fetchGlobalKnowledgeBase(): Promise<any[]> {
  const usUrl = import.meta.env.VITE_PATIENT_SERVICE_URL_US;
  const euUrl = import.meta.env.VITE_PATIENT_SERVICE_URL_EU;
  const usBackup = import.meta.env.VITE_PATIENT_SERVICE_URL_US_BACKUP;
  const euBackup = import.meta.env.VITE_PATIENT_SERVICE_URL_EU_BACKUP;

  async function fetchRegion(primaryUrl: string, backupUrl: string, region: string): Promise<any[]> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'x-user-region': region,
    };

    // Try to add auth token if available (not required for public)
    try {
      const { fetchAuthSession } = await import('aws-amplify/auth');
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch { /* Guest mode */ }

    const endpoint = '/public/knowledge';

    async function tryFetch(baseUrl: string, timeoutMs: number): Promise<any[]> {
      if (!baseUrl) return [];
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;
        const res = await fetch(url, { headers, signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) return [];
        const data = await res.json();
        const rawList = Array.isArray(data) ? data : (data.Items || data.articles || data.data || []);
        // Tag each item with its source region
        return rawList.map((item: any) => ({ ...item, _sourceRegion: region }));
      } catch {
        clearTimeout(timeout);
        return [];
      }
    }

    // Try primary, fallback to backup
    let results = await tryFetch(primaryUrl, 5000);
    if (results.length === 0 && backupUrl) {
      results = await tryFetch(backupUrl, 15000);
    }
    return results;
  }

  // Fetch from BOTH regions in parallel
  const [usArticles, euArticles] = await Promise.all([
    fetchRegion(usUrl, usBackup, 'US'),
    fetchRegion(euUrl, euBackup, 'EU'),
  ]);

  // Merge and deduplicate by article ID (topic field is the DynamoDB PK)
  const seen = new Set<string>();
  const merged: any[] = [];
  for (const item of [...usArticles, ...euArticles]) {
    const key = item.id || item.topic;
    if (key && !seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }

  return merged;
}

// =========================================================================
// COMPONENT
// =========================================================================
interface KnowledgeBaseProps {
  role?: "patient" | "doctor";
}

export default function KnowledgeBase({ role = "patient" }: KnowledgeBaseProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState(MOCK_CATEGORIES);
  const [articles, setArticles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);

        // GLOBAL FETCH: Get articles from ALL regions
        const rawList = await fetchGlobalKnowledgeBase();

        if (rawList.length > 0) {
          const mappedArticles = rawList.map((item: any) => ({
            id: item.id || item.topic,
            title: item.description || item.title || "Untitled",
            category: item.legacyData?.category || item.category || "General",
            image: item.content?.[0]?.attachment?.url || item.coverImage || null,
            content: item.legacyData?.content || item.content || "",
            readTime: "5 min",
            _sourceRegion: item._sourceRegion || 'US',
          }));

          setArticles(mappedArticles);

          // Build dynamic categories from real data
          const uniqueFromDB = [...new Set(mappedArticles.map((a: any) => a.category))];
          const mainCategories = ["Heart Health", "Diabetes", "Wellness", "Nutrition", "Pharmacy", "Sleep & Mental Health"];
          const allCategoryNames = [...new Set([...mainCategories, ...uniqueFromDB])];

          const finalCategories = allCategoryNames.map((catName: any) => {
            const style = STYLE_MAP[catName] || STYLE_MAP["Default"];
            return { name: catName, icon: style.icon, color: style.color, bg: style.bg, description: style.desc };
          });
          setCategories(finalCategories);
        }
      } catch (error) {
        console.error("Failed to fetch articles:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredArticles = articles.filter(article => {
    const title = article.title || "";
    const category = article.category || "";
    const query = searchQuery.toLowerCase();
    return title.toLowerCase().includes(query) || category.toLowerCase().includes(query);
  });

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <div className="max-w-7xl mx-auto p-4 sm:p-6 pt-24 space-y-10">

        {/* Search Hero */}
        <div className="relative rounded-3xl overflow-hidden bg-foreground text-background p-8 sm:p-12 text-center">
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />

          <div className="relative z-10 space-y-6 max-w-2xl mx-auto">
            <div className="inline-flex items-center justify-center p-3 bg-white/10 backdrop-blur-md rounded-2xl mb-2">
              <BookOpen className="h-7 w-7 text-white" />
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Find Health Information
            </h1>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/50" />
              <Input
                placeholder="Search articles..."
                className="h-12 sm:h-14 pl-12 rounded-2xl bg-white border-0 shadow-elevated text-base"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {categories.slice(0, 5).map((cat: any) => (
                <Badge
                  key={cat.name}
                  variant="secondary"
                  className="bg-white/15 hover:bg-white/25 text-white border-0 cursor-pointer px-4 py-1.5 backdrop-blur-sm transition-colors"
                  onClick={() => setSearchQuery(cat.name)}
                >
                  {cat.name}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {categories.map((cat: any) => (
            <button
              key={cat.name}
              onClick={() => setSearchQuery(cat.name)}
              className="flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-card border border-border shadow-soft hover:shadow-card hover:-translate-y-0.5 transition-all group"
            >
              <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center transition-colors", cat.bg)}>
                <cat.icon className={cn("h-5 w-5", cat.color)} />
              </div>
              <span className="text-xs font-semibold text-foreground text-center group-hover:text-primary transition-colors leading-tight">{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Articles */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-foreground">Featured Articles</h2>
            <Badge variant="outline" className="text-muted-foreground rounded-lg">
              {filteredArticles.length} {filteredArticles.length === 1 ? 'article' : 'articles'}
            </Badge>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading articles from all regions...</p>
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div className="h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center">
                <BookOpen className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <div>
                <p className="font-semibold text-foreground">No articles found</p>
                <p className="text-sm text-muted-foreground mt-1">Try a different search term or browse categories above</p>
              </div>
              {searchQuery && (
                <Button variant="outline" size="sm" onClick={() => setSearchQuery("")} className="rounded-xl">
                  Clear Search
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredArticles.map((article) => (
                <Card
                  key={article.id}
                  className="group border border-border shadow-soft hover:shadow-elevated transition-all duration-300 rounded-2xl overflow-hidden cursor-pointer bg-card hover:-translate-y-1"
                  onClick={() => navigate(role === 'doctor'
                    ? `/doctor/knowledge/${encodeURIComponent(article.id)}`
                    : `/knowledge/${encodeURIComponent(article.id)}`
                  )}
                >
                  <div className="h-44 overflow-hidden relative">
                    {article.image ? (
                      <img
                        src={article.image}
                        alt={article.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-secondary flex items-center justify-center">
                        <BookOpen className="h-12 w-12 text-muted-foreground/20" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-card/90 backdrop-blur text-foreground shadow-sm border-0 text-xs font-semibold">
                        {article.category}
                      </Badge>
                    </div>
                  </div>
                  <CardHeader className="p-5 pb-2">
                    <CardTitle className="line-clamp-2 text-lg font-semibold group-hover:text-primary transition-colors font-display">
                      {article.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 mt-1.5 text-sm">
                      Click to read full article
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 pt-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                      {article.category}
                    </span>
                    <div className="flex items-center text-muted-foreground text-xs font-medium gap-1">
                      <span>Read Article</span>
                      <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
