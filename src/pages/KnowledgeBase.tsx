import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  BookOpen,
  Heart,
  Brain,
  Pill,
  Apple,
  Moon,
  Syringe,
  Clock,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { currentUser } from "@/lib/mockData";
import { cn } from "@/lib/utils";

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
  Diabetes: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  Wellness: "bg-accent/10 text-accent border-accent/30",
  Vaccines: "bg-primary/10 text-primary border-primary/30",
  Nutrition: "bg-green-500/10 text-green-600 border-green-500/30",
  Pharmacy: "bg-warning/10 text-warning border-warning/30",
  "Sleep & Mental Health": "bg-indigo-500/10 text-indigo-600 border-indigo-500/30",
};

export default function KnowledgeBase() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [articles, setArticles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchFromStrapi() {
      try {
        // Fetch with populate to ensure coverImage is included
        const response = await fetch("http://localhost:1337/api/articles?populate=*");
        const json = await response.json();

        const normalized = json.data.map((item: any) => {
          // 1. Extract Excerpt from content blocks
          const firstPara = item.content?.find((block: any) => block.type === 'paragraph');
          const excerptText = firstPara?.children?.[0]?.text || "Read our latest health guide...";

          // 2. ROBUST IMAGE FINDER (This is what fixed it in the debugger)
          let imageUrl = null;
          const img = item.coverImage;

          if (img) {
            if (img.url) {
              imageUrl = `http://localhost:1337${img.url}`;
            } else if (img.data?.attributes?.url) {
              imageUrl = `http://localhost:1337${img.data.attributes.url}`;
            } else if (Array.isArray(img) && img[0]?.url) {
              imageUrl = `http://localhost:1337${img[0].url}`;
            }
          }

          return {
            id: item.id,
            documentId: item.documentId,
            title: item.title,
            category: item.category || "Wellness",
            excerpt: excerptText.substring(0, 100) + "...",
            image: imageUrl, // Set the robust image URL
            readTime: "5 min",
          };
        });

        setArticles(normalized);
      } catch (error) {
        console.error("Strapi connection failed:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchFromStrapi();
  }, []);

  const handleLogout = () => navigate("/");

  const filteredArticles = articles.filter(
    (article) =>
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const popularTopics = ["Blood Pressure", "Diabetes", "Mental Health", "Nutrition"];

  return (
    <DashboardLayout
      title="Knowledge Base"
      subtitle="Evidence-based health information from MediConnect CMS"
      userRole="patient"
      userName={currentUser.name}
      userAvatar={currentUser.avatar}
      onLogout={handleLogout}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Search Header */}
        <Card className="shadow-card border-0 medical-gradient overflow-hidden">
          <CardContent className="py-8">
            <div className="max-w-2xl mx-auto text-center">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-white/90" />
              <h2 className="text-2xl font-bold text-white mb-2">Find Health Information</h2>
              <div className="relative mt-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search articles..."
                  className="pl-12 h-12 text-lg bg-white border-0 shadow-lg"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {popularTopics.map((topic) => (
                  <Badge
                    key={topic}
                    variant="secondary"
                    className="bg-white/20 text-white border-white/30 hover:bg-white/30 cursor-pointer"
                    onClick={() => setSearchQuery(topic)}
                  >
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Categories Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {Object.entries(categoryIcons).map(([category, Icon]) => (
            <button
              key={category}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border shadow-soft hover:shadow-card transition-all hover:-translate-y-0.5"
              onClick={() => setSearchQuery(category)}
            >
              <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", categoryColors[category]?.split(" ")[0])}>
                <Icon className={cn("h-6 w-6", categoryColors[category]?.split(" ")[1])} />
              </div>
              <span className="text-sm font-medium text-center">{category}</span>
            </button>
          ))}
        </div>

        {/* Articles Grid */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-foreground">Featured Articles</h3>
            <span className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
              {filteredArticles.length} items
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              <p className="col-span-full text-center py-20 text-muted-foreground">Updating library...</p>
            ) : (
              filteredArticles.map((article) => {
                const Icon = categoryIcons[article.category] || BookOpen;
                const colorClass = categoryColors[article.category] || "bg-primary/10 text-primary";

                return (
                  <Card
                    key={article.id}
                    className="knowledge-card cursor-pointer group hover:shadow-xl transition-all border-border/40 overflow-hidden"
                    onClick={() => navigate(`/knowledge/${article.documentId}`)}
                  >
                    {/* FIXED: REAL IMAGE SECTION */}
                    <div className="h-44 w-full relative overflow-hidden bg-slate-50">
                      {article.image ? (
                        <img
                          src={article.image}
                          alt={article.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center opacity-20">
                          <Icon className={cn("h-16 w-16", colorClass.split(" ")[1])} />
                        </div>
                      )}
                    </div>

                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wider", colorClass)}>
                          {article.category}
                        </Badge>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase font-medium">
                          <Clock className="h-3 w-3" />
                          {article.readTime}
                        </span>
                      </div>
                      <h4 className="font-bold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
                        {article.title}
                      </h4>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                        {article.excerpt}
                      </p>
                      <Button
                        variant="ghost"
                        className="p-0 h-auto text-primary font-bold hover:bg-transparent group-hover:underline"
                      >
                        Read Article
                        <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}