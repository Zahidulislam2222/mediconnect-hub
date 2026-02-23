import React from "react";
import { User, Building2, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface LoginCardProps {
  userType: "patient" | "provider";
  setUserType: (val: "patient" | "provider") => void;
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
  email,
  setEmail,
  password,
  setPassword,
  loading,
  handleLogin,
  setAuthStep
}) => {
  return (
    <Card className="shadow-elevated border-border/50 animate-in fade-in zoom-in duration-300">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl font-bold tracking-tight">Welcome Back</CardTitle>
        <CardDescription>Sign in to your secure medical account</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Role Selector: Essential for HIPAA Routing */}
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
  );
};