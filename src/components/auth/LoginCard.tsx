import React from "react";
import { User, Building2, ArrowRight, Loader2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Region = "US" | "EU";

interface LoginCardProps {
  userType: "patient" | "provider";
  setUserType: (val: "patient" | "provider") => void;
  selectedRegion: Region;
  setSelectedRegion: (val: Region) => void;
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  loading: boolean;
  handleLogin: (e: React.FormEvent) => void;
  setAuthStep: (step: any) => void;
}

export const LoginCard: React.FC<LoginCardProps> = ({
  userType,
  setUserType,
  selectedRegion,
  setSelectedRegion,
  email,
  setEmail,
  password,
  setPassword,
  loading,
  handleLogin,
  setAuthStep
}) => {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Region Selector */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/50 p-2.5 px-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Globe className="h-4 w-4 text-primary" />
          <span>Region</span>
        </div>
        <Tabs value={selectedRegion} onValueChange={(v) => setSelectedRegion(v as Region)} className="w-[130px]">
          <TabsList className="grid w-full grid-cols-2 h-8 rounded-lg bg-background">
            <TabsTrigger value="US" className="text-xs rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">US</TabsTrigger>
            <TabsTrigger value="EU" className="text-xs rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">EU</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="shadow-elevated border-border/60 rounded-2xl overflow-hidden">
        <CardHeader className="text-center pb-2 pt-8">
          <CardTitle className="font-display text-2xl font-bold tracking-tight">Welcome Back</CardTitle>
          <CardDescription className="text-muted-foreground">Sign in to your secure medical account</CardDescription>
        </CardHeader>
        <CardContent className="px-7 pb-8">
          {/* Role Selector */}
          <Tabs
            value={userType}
            onValueChange={(v) => setUserType(v as any)}
            className="mb-6"
          >
            <TabsList className="grid w-full grid-cols-2 rounded-xl h-11 bg-secondary/70">
              <TabsTrigger value="patient" className="gap-2 rounded-lg text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <User className="h-4 w-4" /> Patient
              </TabsTrigger>
              <TabsTrigger value="provider" className="gap-2 rounded-lg text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Building2 className="h-4 w-4" /> Doctor
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="h-11 rounded-xl bg-secondary/30 border-border focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <button
                  type="button"
                  onClick={() => setAuthStep('forgot-password')}
                  className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="h-11 rounded-xl bg-secondary/30 border-border focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-colors"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-all duration-200 active:scale-[0.98] text-sm font-semibold"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <>Sign In <ArrowRight className="h-4 w-4 ml-2" /></>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <button
              onClick={() => setAuthStep("signup")}
              className="text-primary font-semibold hover:text-primary/80 transition-colors"
            >
              Create one now
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
