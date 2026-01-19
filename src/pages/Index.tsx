import { useNavigate } from "react-router-dom";
import {
  Stethoscope,
  Video,
  Shield,
  Brain,
  Calendar,
  FileText,
  ArrowRight,
  CheckCircle2,
  Star,
  Users,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicHeader } from "@/components/PublicHeader"; // ✅ The new shared header

export default function Index() {
  const navigate = useNavigate();

  const features = [
    {
      icon: Video,
      title: "HD Video Consultations",
      description: "Crystal-clear video calls with doctors, powered by AWS Chime SDK",
    },
    {
      icon: Brain,
      title: "AI Symptom Checker",
      description: "Get instant health insights using Bedrock & Vertex AI diagnostics",
    },
    {
      icon: Shield,
      title: "HIPAA Compliant",
      description: "Your health data is encrypted and protected at every step",
    },
    {
      icon: Calendar,
      title: "Easy Scheduling",
      description: "Book appointments in seconds with real-time availability",
    },
    {
      icon: FileText,
      title: "Digital Health Records",
      description: "Access your complete medical history anytime, anywhere",
    },
    {
      icon: Clock,
      title: "24/7 Care Access",
      description: "Get medical advice round the clock from certified providers",
    },
  ];

  const stats = [
    { value: "50K+", label: "Patients Served" },
    { value: "500+", label: "Verified Doctors" },
    { value: "4.9", label: "App Rating", icon: Star },
    { value: "< 5 min", label: "Avg Wait Time" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* ✅ 1. SHARED HEADER */}
      <PublicHeader />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/30 px-4 py-1">
              Trusted by 50,000+ patients worldwide
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
              Healthcare Made Simple,
              <br />
              <span className="bg-clip-text text-transparent medical-gradient">
                Accessible, and Secure
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Connect with certified healthcare providers through secure video consultations,
              AI-powered diagnostics, and comprehensive health management tools.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="bg-primary hover:bg-primary/90 text-lg px-8 h-14"
              >
                Start Your Visit
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/auth")}
                className="text-lg px-8 h-14"
              >
                For Providers
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16">
            {stats.map((stat, idx) => (
              <Card key={idx} className="shadow-soft border-border/50 text-center">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span className="text-3xl font-bold text-foreground">{stat.value}</span>
                    {stat.icon && <Star className="h-5 w-5 text-warning fill-warning" />}
                  </div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-secondary/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything You Need for Better Health
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A comprehensive telehealth platform designed for the modern healthcare experience
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <Card
                key={idx}
                className="shadow-card border-border/50 hover:shadow-elevated transition-all duration-300 hover:-translate-y-1"
              >
                <CardContent className="pt-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Get Care in 3 Simple Steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Create Account",
                description: "Sign up with secure identity verification in minutes",
              },
              {
                step: "02",
                title: "Book Appointment",
                description: "Choose your provider and schedule a convenient time",
              },
              {
                step: "03",
                title: "Start Consultation",
                description: "Connect via video and receive personalized care",
              },
            ].map((item, idx) => (
              <div key={idx} className="text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full medical-gradient text-white text-2xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-4xl">
          <Card className="medical-gradient border-0 shadow-elevated overflow-hidden">
            <CardContent className="py-12 text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Ready to Transform Your Healthcare Experience?
              </h2>
              <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
                Join thousands of patients who have already discovered a better way to access quality healthcare.
              </p>
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="bg-white text-primary hover:bg-white/90 text-lg px-8 h-14"
              >
                Get Started for Free
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl medical-gradient">
                <Stethoscope className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">MediConnect</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <button onClick={() => navigate("/privacy-policy")} className="hover:text-foreground transition-colors">Privacy Policy</button>
              <button onClick={() => navigate("/terms-of-service")} className="hover:text-foreground transition-colors">Terms of Service</button>
              <button onClick={() => navigate("/hipaa-compliance")} className="hover:text-foreground transition-colors">HIPAA Compliance</button>
              <button onClick={() => navigate("/contact")} className="hover:text-foreground transition-colors">Contact</button>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
            © 2026 MediConnect. All rights reserved. Powered by AWS, GCP & Strapi.
          </div>
        </div>
      </footer>
    </div>
  );
}
