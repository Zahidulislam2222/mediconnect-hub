import { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { currentUser, knowledgeArticles } from "@/lib/mockData";
import { cn } from "@/lib/utils";

const categoryIcons: Record<string, any> = {
  "Heart Health": Heart,
  Diabetes: TrendingUp,
  Wellness: Brain,
  Vaccines: Syringe,
  Nutrition: Apple,
  Pharmacy: Pill,
};

const categoryColors: Record<string, string> = {
  "Heart Health": "bg-red-500/10 text-red-600 border-red-500/30",
  Diabetes: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  Wellness: "bg-accent/10 text-accent border-accent/30",
  Vaccines: "bg-primary/10 text-primary border-primary/30",
  Nutrition: "bg-green-500/10 text-green-600 border-green-500/30",
  Pharmacy: "bg-warning/10 text-warning border-warning/30",
};

export default function KnowledgeBase() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const handleLogout = () => {
    navigate("/");
  };

  const filteredArticles = knowledgeArticles.filter(
    (article) =>
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const popularTopics = [
    "Blood Pressure",
    "Diabetes Management",
    "Mental Health",
    "COVID-19",
    "Heart Disease",
    "Weight Management",
  ];

  return (
    <DashboardLayout
      title="Knowledge Base"
      subtitle="Evidence-based health information and guides"
      userRole="patient"
      userName={currentUser.name}
      userAvatar={currentUser.avatar}
      onLogout={handleLogout}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Search Section */}
        <Card className="shadow-card border-0 medical-gradient overflow-hidden">
          <CardContent className="py-8">
            <div className="max-w-2xl mx-auto text-center">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-white/90" />
              <h2 className="text-2xl font-bold text-white mb-2">
                Find Health Information
              </h2>
              <p className="text-white/80 mb-6">
                Search our library of medical conditions, medications, and wellness guides
              </p>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search conditions, medications, or topics..."
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

        {/* Categories */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {Object.entries(categoryIcons).map(([category, Icon]) => (
            <button
              key={category}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border shadow-soft hover:shadow-card transition-all hover:-translate-y-0.5"
              onClick={() => setSearchQuery(category)}
            >
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl",
                  categoryColors[category]?.split(" ")[0]
                )}
              >
                <Icon className={cn("h-6 w-6", categoryColors[category]?.split(" ")[1])} />
              </div>
              <span className="text-sm font-medium text-center">{category}</span>
            </button>
          ))}
        </div>

        {/* Articles Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {searchQuery ? `Results for "${searchQuery}"` : "Featured Articles"}
            </h3>
            <span className="text-sm text-muted-foreground">
              {filteredArticles.length} articles
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map((article) => {
              const Icon = categoryIcons[article.category] || BookOpen;
              const colorClass = categoryColors[article.category] || "bg-primary/10 text-primary";

              return (
                <Card
                  key={article.id}
                  className="knowledge-card cursor-pointer group"
                >
                  <div className="h-40 bg-gradient-to-br from-secondary to-muted flex items-center justify-center">
                    <Icon className={cn("h-16 w-16 opacity-20", colorClass.split(" ")[1])} />
                  </div>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className={cn("text-xs", colorClass)}>
                        {article.category}
                      </Badge>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {article.readTime}
                      </span>
                    </div>
                    <h4 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                      {article.title}
                    </h4>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {article.excerpt}
                    </p>
                    <Button
                      variant="ghost"
                      className="p-0 h-auto text-primary group-hover:underline"
                    >
                      Read Article
                      <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* CMS Attribution */}
        <Card className="shadow-soft border-border/50">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground text-center">
              Content powered by MediConnect CMS • Last updated: January 4, 2026 •{" "}
              <button className="text-primary hover:underline">Submit feedback</button>
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
