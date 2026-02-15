import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Heart, TrendingUp, Brain, Syringe, Apple, Pill, Moon, ArrowRight, BookOpen, Activity } from "lucide-react"; // Added Activity for default icon

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PublicHeader } from "@/components/PublicHeader";
import { api } from "../lib/api";

// 1. CONFIG: Map Category Names to Icons & Colors (Styling Logic)
// If you add a new category in Strapi (e.g. "Skin Care"), it will use the "Default" style.
const STYLE_MAP: Record<string, any> = {
  "Heart Health": { icon: Heart, color: "text-red-500", bg: "bg-red-50", desc: "Cardiology & Blood Pressure" },
  "Diabetes": { icon: TrendingUp, color: "text-purple-500", bg: "bg-purple-50", desc: "Blood Sugar Management" },
  "Wellness": { icon: Brain, color: "text-blue-500", bg: "bg-blue-50", desc: "Mental & Physical Balance" },
  "Vaccines": { icon: Syringe, color: "text-emerald-500", bg: "bg-emerald-50", desc: "Immunization Schedules" },
  "Nutrition": { icon: Apple, color: "text-green-500", bg: "bg-green-50", desc: "Dietary Guidelines" },
  "Pharmacy": { icon: Pill, color: "text-orange-500", bg: "bg-orange-50", desc: "Medication Safety" },
  "Sleep & Mental Health": { icon: Moon, color: "text-indigo-500", bg: "bg-indigo-50", desc: "Stress & Sleep Hygiene" },
  "Default": { icon: Activity, color: "text-slate-500", bg: "bg-slate-100", desc: "General Health Information" }
};

// 2. MOCK DATA (Fallback if API fails or is empty)
const MOCK_CATEGORIES = [
  { name: "Heart Health", ...STYLE_MAP["Heart Health"] },
  { name: "Diabetes", ...STYLE_MAP["Diabetes"] },
  { name: "Wellness", ...STYLE_MAP["Wellness"] },
  { name: "Nutrition", ...STYLE_MAP["Nutrition"] },
];

interface KnowledgeBaseProps {
  role?: "patient" | "doctor";
}

export default function KnowledgeBase({ role = "patient" }: KnowledgeBaseProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  // 3. STATE: Start with MOCK_CATEGORIES, but allow API to overwrite it
  const [categories, setCategories] = useState(MOCK_CATEGORIES);
  const [articles, setArticles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // src/pages/KnowledgeBase.tsx

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const response: any = await api.get('/public/knowledge');

        // 1. DEBUG: Look at your Browser Console (F12) to see this!
        console.log("RAW API DATA:", response);

        // 2. ROBUST EXTRACTION: Handle direct array, .articles, or DynamoDB .Items
        const rawList = Array.isArray(response)
          ? response
          : (response.Items || response.articles || response.data || []);

        if (rawList.length > 0) {
          const mappedArticles = rawList.map((item: any) => ({ // 👈 Change 'data' to 'rawList'
            id: item.id,
            title: item.description || "Untitled Article",
            // Backend sends art.category inside 'legacyData'
            category: item.legacyData?.category || "General",
            // Backend sends art.coverImage inside 'content' array
            image: item.content?.[0]?.attachment?.url || null,
            content: item.legacyData?.content || "",
            readTime: "5 min"
          }));

          setArticles(mappedArticles);

          // 3. DYNAMIC CATEGORIES
          const uniqueFromDB = [...new Set(mappedArticles.map((a: any) => a.category))];
          const mainCategories = [
            "Heart Health", "Diabetes", "Wellness",
            "Nutrition", "Pharmacy", "Sleep & Mental Health"
          ];

          const allCategoryNames = [...new Set([...mainCategories, ...uniqueFromDB])];
          const finalCategories = allCategoryNames.map((catName: any) => {
            const style = STYLE_MAP[catName] || STYLE_MAP["Default"];
            return {
              name: catName,
              icon: style.icon,
              color: style.color,
              bg: style.bg,
              description: style.desc
            };
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

    return title.toLowerCase().includes(query) ||
      category.toLowerCase().includes(query);
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicHeader />

      <div className="max-w-7xl mx-auto p-6 pt-24 space-y-12">

        {/* Search Hero */}
        <div className="relative rounded-[32px] overflow-hidden bg-gradient-to-r from-cyan-500 to-blue-600 p-12 text-center shadow-xl">
          <div className="relative z-10 space-y-6 max-w-2xl mx-auto">
            <div className="inline-flex items-center justify-center p-3 bg-white/10 backdrop-blur-md rounded-2xl mb-4">
              <BookOpen className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight">
              Find Health Information
            </h1>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                placeholder="Search articles..."
                className="h-14 pl-12 rounded-2xl bg-white border-0 shadow-lg text-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* ✅ DYNAMIC LOGIC: Tags from Real Data */}
            <div className="flex flex-wrap justify-center gap-2">
              {categories.slice(0, 5).map((cat: any) => (
                <Badge
                  key={cat.name}
                  variant="secondary"
                  className="bg-white/20 hover:bg-white/30 text-white border-0 cursor-pointer px-4 py-1.5 backdrop-blur-sm transition-colors"
                  onClick={() => setSearchQuery(cat.name)}
                >
                  {cat.name}
                </Badge>
              ))}
            </div>

          </div>
        </div>

        {/* Dynamic Categories Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {categories.map((cat: any) => (
            <button
              key={cat.name}
              onClick={() => setSearchQuery(cat.name)}
              className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:scale-105 transition-all group"
            >
              <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center transition-colors", cat.bg)}>
                <cat.icon className={cn("h-6 w-6", cat.color)} />
              </div>
              <span className="text-xs font-bold text-slate-700 text-center group-hover:text-primary transition-colors">{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Articles List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900">Featured Articles</h2>
            <Badge variant="outline" className="text-slate-500">{filteredArticles.length} items</Badge>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 bg-slate-200 rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredArticles.map((article) => (
                <Card
                  key={article.id}
                  className="group border-0 shadow-sm hover:shadow-xl transition-all duration-300 rounded-[32px] overflow-hidden cursor-pointer bg-white"
                  onClick={() => navigate(role === 'doctor'
                    ? `/doctor/knowledge/${encodeURIComponent(article.id)}`
                    : `/knowledge/${encodeURIComponent(article.id)}`
                  )}
                >
                  <div className="h-48 overflow-hidden relative">
                    {article.image ? (
                      <img
                        src={article.image}
                        alt={article.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                        <BookOpen className="h-12 w-12 text-slate-300" />
                      </div>
                    )}
                    <div className="absolute top-4 left-4">
                      <Badge className="bg-white/90 backdrop-blur text-slate-900 shadow-sm border-0 font-bold">
                        {article.category}
                      </Badge>
                    </div>
                  </div>
                  <CardHeader className="p-6 pb-2">
                    <CardTitle className="line-clamp-2 text-xl group-hover:text-primary transition-colors">
                      {article.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 mt-2">
                      Click to read full article
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 pt-4 flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1">
                      {article.category}
                    </span>
                    <div className="flex items-center text-slate-400 text-xs font-bold gap-1">
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