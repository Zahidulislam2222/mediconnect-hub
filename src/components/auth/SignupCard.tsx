import React, { useState } from "react";
import { User, Building2, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

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
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [consentError, setConsentError] = useState(false);

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) {
      setConsentError(true);
      return;
    }
    setConsentError(false);
    localStorage.setItem('pending_consent', JSON.stringify({
      agreedToTerms: true,
      policyVersion: "v1.0",
      timestamp: new Date().toISOString()
    }));
    handleSignUp(e);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Region Selector */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/50 p-2.5 px-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Globe className="h-4 w-4 text-primary" />
          <span>Data Region</span>
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
          <CardTitle className="font-display text-2xl font-bold">Create Account</CardTitle>
          <CardDescription>
            Join as a <span className="font-semibold text-primary">{userType === 'patient' ? 'Patient' : 'Medical Doctor'}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="px-7 pb-8">
          <Tabs value={userType} onValueChange={(v) => setUserType(v as any)} className="mb-6">
            <TabsList className="grid w-full grid-cols-2 rounded-xl h-11 bg-secondary/70">
              <TabsTrigger value="patient" className="gap-2 rounded-lg text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <User className="h-4 w-4" /> Patient
              </TabsTrigger>
              <TabsTrigger value="provider" className="gap-2 rounded-lg text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Building2 className="h-4 w-4" /> Doctor
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={onFormSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-name" className="text-sm font-medium">Full Name</Label>
              <Input id="signup-name" type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required className="h-11 rounded-xl bg-secondary/30 border-border focus-visible:ring-primary/30 focus-visible:border-primary/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email" className="text-sm font-medium">Email Address</Label>
              <Input id="signup-email" type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} required className="h-11 rounded-xl bg-secondary/30 border-border focus-visible:ring-primary/30 focus-visible:border-primary/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password" className="text-sm font-medium">Password</Label>
              <Input id="signup-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className="h-11 rounded-xl bg-secondary/30 border-border focus-visible:ring-primary/30 focus-visible:border-primary/50" />
              <p className="text-[10px] text-muted-foreground mt-1">Must contain at least 8 characters, one uppercase, and one number.</p>
            </div>

            {/* Consent Checkbox */}
            <div className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border border-border p-4 bg-secondary/20">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => {
                  setAgreedToTerms(checked as boolean);
                  if (checked) setConsentError(false);
                }}
                className="mt-0.5"
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="terms" className="text-sm font-medium leading-none cursor-pointer">
                  Accept Terms & Privacy Policy
                </Label>
                <p className="text-xs text-muted-foreground">
                  I agree to the processing of my medical data in accordance with HIPAA/GDPR policies.
                </p>
                {consentError && <p className="text-xs text-destructive font-semibold mt-1">You must accept the terms to register.</p>}
              </div>
            </div>

            <Button type="submit" className="w-full h-12 rounded-xl medical-gradient text-white border-0 shadow-sm hover:shadow-glow transition-all duration-300 active:scale-[0.98] text-sm font-semibold mt-2" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Create Secure Account"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <button onClick={() => setAuthStep("login")} className="text-primary font-semibold hover:text-primary/80 transition-colors">Sign in</button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
