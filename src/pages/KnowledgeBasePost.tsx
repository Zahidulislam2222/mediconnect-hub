import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    ArrowLeft, Share2, Bookmark, Heart, TrendingUp,
    Brain, Syringe, Apple, Pill, Moon, BookOpen, UserCheck, ShieldCheck,
    ChevronRight,
    MessageSquare
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import DOMPurify from 'dompurify';
import { PublicHeader } from "@/components/PublicHeader"; // Add import

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
                // Try fetching by Document ID (Strapi v5) or ID (Strapi v4)
                console.log("Fetching article:", slug);
                const STRAPI_URL = import.meta.env.VITE_STRAPI_API_URL || 'http://localhost:1337';
                const response = await fetch(`${STRAPI_URL}/api/articles/${slug}?populate=*`);

                if (!response.ok) {
                    throw new Error(`Article not found (Status: ${response.status})`);
                }

                const json = await response.json();

                if (json.data) {
                    const item = json.data;
                    let imageUrl = null;
                    const img = item.coverImage || item.attributes?.coverImage;

                    // Robust Image Extraction
                    if (img) {
                        const imgData = img.data || img;
                        if (imgData) {
                            const rawUrl = imgData.attributes?.url || imgData.url || (Array.isArray(imgData) ? imgData[0].url : null);

                            if (rawUrl) {
                                // If it starts with "http", it's from S3 -> Use it directly.
                                // If it starts with "/", it's local -> Add localhost.
                                imageUrl = rawUrl.startsWith('http')
                                    ? rawUrl
                                    : `${import.meta.env.VITE_STRAPI_API_URL || 'http://localhost:1337'}${rawUrl}`;
                            }
                        }
                    }

                    // Handle Title/Content location (attributes for v4, root for v5)
                    const title = item.title || item.attributes?.title;
                    const category = item.category || item.attributes?.category || "General";
                    const content = item.content || item.attributes?.content;
                    const publishedAt = item.publishedAt || item.attributes?.publishedAt;

                    setArticle({
                        id: item.id,
                        title: title,
                        category: category,
                        content: content,
                        image: imageUrl,
                        publishDate: new Date(publishedAt).toLocaleDateString('en-US', {
                            month: 'long', day: 'numeric', year: 'numeric'
                        })
                    });
                } else {
                    throw new Error("No data returned from CMS");
                }
            } catch (error: any) {
                console.error("Failed to fetch article details:", error);
                setError(error.message);
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
                return <p key={index} className="mb-6 text-slate-600 leading-relaxed text-lg font-normal">
                    {block.children?.map((child: any, i: number) => (
                        <span key={i} className={cn(child.bold && "font-bold text-slate-900", child.italic && "italic")}>
                            {child.text}
                        </span>
                    ))}
                </p>;
            }
            if (block.type === 'heading') {
                return <h2 key={index} className="text-2xl font-bold mt-10 mb-5 text-slate-900 tracking-tight">
                    {block.children?.[0]?.text}
                </h2>;
            }
            // Fallback for simple text/html blocks
            if (typeof block === 'string') {
                return (
                    <div
                        key={index}
                        className="mb-4"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block) }}
                    />
                );
            }

            return null;
        });
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-muted-foreground font-medium">Loading article content...</p>
            </div>
        );
    }

    if (error || !article) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <p className="text-red-500 font-bold text-xl">Unable to load article</p>
                <p className="text-muted-foreground">{error}</p>
                <Button onClick={() => navigate(role === 'doctor' ? "/doctor/knowledge" : "/knowledge")}>
                    Return to Library
                </Button>
            </div>
        );
    }

    const Icon = categoryIcons[article.category] || BookOpen;

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-20 p-6">
            {/* Top Navigation */}

            <div className="flex items-center justify-between">

                {/* ✅ 1. SHARED HEADER */}
                <PublicHeader />

                <Button
                    variant="ghost"
                    onClick={() => navigate(role === 'doctor' ? "/doctor/knowledge" : "/knowledge")}
                    className="group hover:bg-slate-100 rounded-full px-4"
                >
                    <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                    <span className="font-semibold text-slate-600">Back to Library</span>
                </Button>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-slate-200"><Bookmark className="h-4 w-4 text-slate-600" /></Button>
                    <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-slate-200"><Share2 className="h-4 w-4 text-slate-600" /></Button>
                </div>
            </div>

            <div className="flex items-center justify-between">

                <Button
                    variant="ghost"
                    onClick={() => navigate(role === 'doctor' ? "/doctor/knowledge" : "/knowledge")}
                    className="group hover:bg-slate-100 rounded-full px-4"
                >
                    <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                    <span className="font-semibold text-slate-600">Back to Library</span>
                </Button>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-slate-200"><Bookmark className="h-4 w-4 text-slate-600" /></Button>
                    <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-slate-200"><Share2 className="h-4 w-4 text-slate-600" /></Button>
                </div>
            </div>

            {/* Hero Banner */}
            <div className="relative h-[480px] w-full rounded-[40px] overflow-hidden shadow-2xl group border border-white">
                {article.image ? (
                    <img
                        src={article.image}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        alt={article.title}
                    />
                ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                        <Icon className="h-32 w-32 opacity-10 text-primary" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/20 to-transparent" />

                <div className="absolute bottom-12 left-12 right-12 space-y-4">
                    <Badge className="bg-white/20 backdrop-blur-md text-white border-white/30 px-4 py-1.5 text-xs font-bold uppercase tracking-widest">
                        {article.category}
                    </Badge>
                    <h1 className="text-4xl md:text-6xl font-black text-white leading-[1.1] tracking-tight max-w-3xl drop-shadow-lg">
                        {article.title}
                    </h1>
                </div>
            </div>

            {/* Content Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12 pt-4">

                {/* Main Article Body */}
                <div className="space-y-10">
                    {/* Author Card */}
                    <div className="flex flex-wrap items-center justify-between gap-6 p-6 rounded-3xl bg-white border border-slate-100 shadow-soft">
                        <div className="flex items-center gap-4">
                            <div className="h-14 w-14 rounded-2xl bg-primary/5 flex items-center justify-center border border-primary/10">
                                <UserCheck className="h-7 w-7 text-primary" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                                    MediConnect Medical Board
                                    <ShieldCheck className="h-4 w-4 text-blue-500" />
                                </h4>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Clinical Compliance Reviewer</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="text-center px-4 border-r border-slate-100">
                                <p className="text-[10px] uppercase font-black text-slate-400 mb-1">Updated</p>
                                <p className="text-sm font-bold text-slate-700">{article.publishDate}</p>
                            </div>
                            <div className="text-center px-4">
                                <p className="text-[10px] uppercase font-black text-slate-400 mb-1">Duration</p>
                                <p className="text-sm font-bold text-slate-700">5 min read</p>
                            </div>
                        </div>
                    </div>

                    <article className="prose prose-slate max-w-none">
                        {renderContent(article.content)}
                    </article>

                    {/* Disclaimer */}
                    <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100 mt-12">
                        <div className="flex gap-4">
                            <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-sm flex-shrink-0">
                                <ShieldCheck className="h-5 w-5 text-slate-400" />
                            </div>
                            <div className="space-y-2">
                                <h5 className="font-bold text-slate-900">Medical Disclaimer</h5>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    The information provided in this guide is for educational purposes only and is not intended as medical advice. Always consult with a qualified healthcare provider regarding your health and symptoms.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <aside className="space-y-8">
                    {/* Quick Action Card */}
                    <Card className="border-0 shadow-2xl bg-primary rounded-[32px] overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <MessageSquare className="h-32 w-32 -mr-8 -mt-8" />
                        </div>
                        <CardContent className="p-8 space-y-6 relative z-10">
                            <h4 className="text-2xl font-black text-white leading-tight">Discuss this topic with a doctor?</h4>
                            <p className="text-white/80 text-sm leading-relaxed">
                                Connect with a certified specialist in less than 15 minutes via secure video call.
                            </p>
                            <Button
                                variant="secondary"
                                className="w-full h-14 rounded-2xl font-black text-primary shadow-lg hover:scale-[1.02] transition-transform"
                                onClick={() => navigate("/consultation")}
                            >
                                Book Consultation
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Specialty Info */}
                    <Card className="shadow-soft bg-white rounded-[32px] border border-slate-100">
                        <CardContent className="p-8 space-y-6">
                            <div className="space-y-1">
                                <h5 className="font-bold text-slate-900">Topic Specialty</h5>
                                <p className="text-sm text-slate-500">Related Clinical Area</p>
                            </div>

                            <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center shadow-sm", categoryColors[article.category]?.split(" ")[0])}>
                                    <Icon className={cn("h-6 w-6", categoryColors[article.category]?.split(" ")[1])} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900">{article.category}</p>
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Medical Hub</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </aside>
            </div>
        </div>
    );
}