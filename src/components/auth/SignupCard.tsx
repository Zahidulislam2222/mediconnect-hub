import React from "react";
import { User, Building2, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Region = "US" | "EU";

interface SignupCardProps {
  userType: "patient" | "provider";
  setUserType: (val: "patient" | "provider") => void;
  selectedRegion: Region;
  setSelectedRegion: (val: Region) => void;
  name: string;
  setName: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  loading: boolean;
  handleSignUp: (e: React.FormEvent) => void;
  setAuthStep: (step: any) => void;
}

export const SignupCard: React.FC<SignupCardProps> = ({
  userType,
  setUserType,
  selectedRegion,
  setSelectedRegion,
  name,
  setName,
  email,
  setEmail,
  password,
  setPassword,
  loading,
  handleSignUp,
  setAuthStep
}) => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* 🟢 GDPR JURISDICTION SELECTOR (Silo Enforcement) */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600 pl-2">
          <Globe className="h-4 w-4 text-primary" /> 
          <span>Data Region</span>
        </div>
        <Tabs 
          value={selectedRegion} 
          onValueChange={(v) => setSelectedRegion(v as Region)} 
          className="w-[140px]"
        >
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="US" className="text-xs">US</TabsTrigger>
            <TabsTrigger value="EU" className="text-xs">EU</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="shadow-elevated border-border/50">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
          <CardDescription>
            Join as a <span className="font-semibold text-primary">{userType === 'patient' ? 'Patient' : 'Medical Doctor'}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Role Selector */}
          <Tabs value={userType} onValueChange={(v) => setUserType(v as any)} className="mb-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="patient" className="gap-2"><User className="h-4 w-4" /> Patient</TabsTrigger>
              <TabsTrigger value="provider" className="gap-2"><Building2 className="h-4 w-4" /> Doctor</TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-name">Full Name</Label>
              <Input 
                id="signup-name"
                type="text" 
                placeholder="John Doe" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                required 
                className="bg-slate-50/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email Address</Label>
              <Input 
                id="signup-email"
                type="email" 
                placeholder="name@example.com"
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                className="bg-slate-50/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <Input 
                id="signup-password"
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                className="bg-slate-50/50"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Must contain at least 8 characters, one uppercase, and one number.
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary/90 shadow-md mt-2" 
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Create Secure Account"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            Already have an account?{" "}
            <button 
              onClick={() => setAuthStep("login")} 
              className="text-primary font-medium hover:underline"
            >
              Sign in
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};