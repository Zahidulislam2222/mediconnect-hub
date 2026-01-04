import { useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft,
    Calendar,
    Clock,
    Share2,
    Bookmark,
    ThumbsUp,
    MessageSquare,
    User,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { currentUser, currentDoctor, knowledgeArticles } from "@/lib/mockData";

interface KnowledgeBasePostProps {
    role?: "patient" | "doctor";
}

export default function KnowledgeBasePost({ role = "patient" }: KnowledgeBasePostProps) {
    const navigate = useNavigate();
    const { slug } = useParams();

    // In a real app, we would fetch the article based on the slug or ID
    const article = knowledgeArticles[0];
    const user = role === "patient" ? currentUser : currentDoctor;
    const backLink = role === "patient" ? "/knowledge" : "/doctor/knowledge";

    const handleLogout = () => {
        navigate("/");
    };

    return (
        <DashboardLayout
            title="Knowledge Base"
            subtitle="Article View"
            userRole={role}
            userName={user.name}
            userAvatar={user.avatar}
            onLogout={handleLogout}
        >
            <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-10">
                <Button
                    variant="ghost"
                    className="pl-0 hover:pl-2 transition-all"
                    onClick={() => navigate(backLink)}
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Knowledge Base
                </Button>

                <Card className="overflow-hidden border-border/50 shadow-card">
                    <div className="h-48 md:h-64 bg-gradient-to-r from-primary/10 to-accent/10 relative">
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-4xl font-bold text-primary/20">
                                {article.category}
                            </span>
                        </div>
                    </div>
                    <CardContent className="p-6 md:p-8">
                        <div className="flex flex-wrap items-center gap-3 mb-6">
                            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 capitalize">
                                {article.category}
                            </Badge>
                            <span className="flex items-center text-sm text-muted-foreground">
                                <Clock className="h-4 w-4 mr-1" />
                                {article.readTime}
                            </span>
                            <span className="flex items-center text-sm text-muted-foreground">
                                <Calendar className="h-4 w-4 mr-1" />
                                Jan 12, 2024
                            </span>
                        </div>

                        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                            {article.title}
                        </h1>

                        <div className="flex items-center justify-between py-6 border-y border-border/50 mb-8">
                            <div className="flex items-center gap-3">
                                <Avatar>
                                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=Doctor`} />
                                    <AvatarFallback>DR</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-medium text-sm">Dr. Sarah Mitchell</p>
                                    <p className="text-xs text-muted-foreground">Chief Cardiologist</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="icon">
                                    <Bookmark className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon">
                                    <Share2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="prose prose-slate dark:prose-invert max-w-none">
                            <p className="text-lg leading-relaxed text-muted-foreground mb-6">
                                {article.excerpt}
                            </p>

                            <h2>Understanding the Basics</h2>
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                                incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
                                exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                            </p>

                            <p>
                                Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
                                fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
                                culpa qui officia deserunt mollit anim id est laborum.
                            </p>

                            <blockquote className="border-l-4 border-primary pl-4 italic my-6 text-foreground">
                                "Early detection and consistent monitoring are key factors in successful long-term health outcomes."
                            </blockquote>

                            <h2>Key Recommendations</h2>
                            <ul className="list-disc pl-6 space-y-2 mb-6">
                                <li>Maintain a balanced diet rich in vegetables, fruits, and whole grains.</li>
                                <li>Exercise at least 30 minutes a day, 5 days a week.</li>
                                <li>Monitor your vital signs regularly and keep a log.</li>
                                <li>Stay hydrated and reduce sodium intake.</li>
                            </ul>

                            <h3>When to See a Doctor</h3>
                            <p>
                                If you experience any sudden changes in your condition or if your symptoms persist
                                despite following these guidelines, please consult your healthcare provider immediately.
                            </p>
                        </div>

                        <Separator className="my-8" />

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Button variant="outline" size="sm" className="gap-2">
                                    <ThumbsUp className="h-4 w-4" />
                                    Helpful (124)
                                </Button>
                                <Button variant="ghost" size="sm" className="gap-2">
                                    <MessageSquare className="h-4 w-4" />
                                    Comments (8)
                                </Button>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                Reviewed by Medical Board
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
