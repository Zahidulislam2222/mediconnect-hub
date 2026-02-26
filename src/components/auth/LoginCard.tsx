import React from "react";
import { User, Building2, ArrowRight, Loader2, Globe } from "lucide-react"; // 🟢 Added Globe
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Region = "US" | "EU"; // 🟢 Added Type

interface LoginCardProps {
  userType: "patient" | "provider";
  setUserType: (val: "patient" | "provider") => void;
  // 🟢 ADDED: Region Props
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
  // 🟢 Destructure new props
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
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      {/* 🟢 ADDED: Region Selector (Same as SignupCard for consistency) */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600 pl-2">
          <Globe className="h-4 w-4 text-primary" /> 
          <span>Login Region</span>
        </div>
        <Tabs value={selectedRegion} onValueChange={(v) => setSelectedRegion(v as Region)} className="w-[140px]">
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="US" className="text-xs">US</TabsTrigger>
            <TabsTrigger value="EU" className="text-xs">EU</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="shadow-elevated border-border/50">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold tracking-tight">Welcome Back</CardTitle>
          <CardDescription>Sign in to your secure medical account</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Role Selector */}
          <Tabs 
            value={userType} 
            onValueChange={(v) => setUserType(v as any)} 
            className="mb-6"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="patient" className="gap-2">
                <User className="h-4 w-4" /> Patient
              </TabsTrigger>
              <TabsTrigger value="provider" className="gap-2">
                <Building2 className="h-4 w-4" /> Doctor
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input 
                id="email"
                type="email" 
                placeholder="name@example.com"
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                className="bg-slate-50/50"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button 
                  type="button" 
                  onClick={() => setAuthStep('forgot-password')} 
                  className="text-xs text-primary hover:underline font-medium"
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
                className="bg-slate-50/50"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary/90 shadow-md transition-all active:scale-[0.98]" 
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
              className="text-primary font-semibold hover:underline"
            >
              Create one now
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};