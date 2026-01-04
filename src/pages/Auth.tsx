import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
// AWS Imports
import { signIn, signUp, confirmSignUp, getCurrentUser } from 'aws-amplify/auth';

import {
  Stethoscope,
  Mail,
  Lock,
  User,
  Building2,
  Shield,
  Camera,
  Upload,
  CheckCircle2,
  ArrowRight,
  Phone,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type AuthStep = "login" | "signup" | "confirm-signup" | "mfa" | "identity";

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [userType, setUserType] = useState<"patient" | "provider">("patient");
  const [authStep, setAuthStep] = useState<AuthStep>("login");
  const [loading, setLoading] = useState(false);

  // Form States
  const [name, setName] = useState(""); // ADDED: Name State
  const [email, setEmail] = useState("alex.thompson@email.com");
  const [password, setPassword] = useState("MediConnect@2025"); // Updated default to strong password
  const [otpValue, setOtpValue] = useState("");

  // Identity Verification Mock States
  const [idUploaded, setIdUploaded] = useState(false);
  const [selfieUploaded, setSelfieUploaded] = useState(false);

  // --- 1. CHECK IF ALREADY LOGGED IN ---
  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const user = await getCurrentUser();
      if (user) {
        // If already logged in, go straight to dashboard
        if (userType === 'patient') navigate("/dashboard");
        else navigate("/doctor-dashboard");
      }
    } catch (error) {
      // Not logged in, stay here
    }
  }

  // --- AWS COGNITO FUNCTIONS ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { isSignedIn, nextStep } = await signIn({ username: email, password });

      if (isSignedIn) {
        setAuthStep("identity");
      } else if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
        setAuthStep("confirm-signup");
        toast({ title: "Account not verified", description: "Please enter the code sent to your email." });
      }
    } catch (error: any) {
      console.error(error);
      // Handle "Already Signed In" explicitly
      if (error.name === "UserAlreadyAuthenticatedException") {
        navigate(userType === 'patient' ? "/dashboard" : "/doctor-dashboard");
        return;
      }
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            name, // ADDED: Saving the name to AWS
          }
        }
      });
      setAuthStep("confirm-signup");
      toast({ title: "Account Created", description: "Please check your email for the verification code." });
    } catch (error: any) {
      console.error(error);
      toast({ variant: "destructive", title: "Signup Failed", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async () => {
    setLoading(true);
    try {
      await confirmSignUp({ username: email, confirmationCode: otpValue });
      toast({ title: "Verified!", description: "You can now log in." });
      setAuthStep("login");
      setOtpValue("");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Verification Failed", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  // --- UI HANDLERS ---

  const handleIdentityComplete = () => {
    if (userType === "patient") {
      navigate("/dashboard");
    } else {
      navigate("/doctor-dashboard");
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 medical-gradient p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
              <Stethoscope className="h-7 w-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">MediConnect</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-6">Healthcare at Your Fingertips</h1>
          <p className="text-xl text-white/80 max-w-md">Connect with world-class healthcare providers from anywhere. Secure, private, and HIPAA-compliant.</p>
        </div>
      </div>

      {/* Right Panel - Auth Forms */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">

          {/* LOGIN VIEW */}
          {authStep === "login" && (
            <Card className="shadow-elevated border-border/50">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl">Welcome Back</CardTitle>
                <CardDescription>Sign in to your account to continue</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={userType} onValueChange={(v) => setUserType(v as any)} className="mb-6">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="patient" className="gap-2"><User className="h-4 w-4" /> Patient</TabsTrigger>
                    <TabsTrigger value="provider" className="gap-2"><Building2 className="h-4 w-4" /> Provider</TabsTrigger>
                  </TabsList>
                </Tabs>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
                  </div>

                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Sign In <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </form>

                <div className="mt-6 text-center text-sm text-muted-foreground">
                  Don't have an account?{" "}
                  <button onClick={() => setAuthStep("signup")} className="text-primary hover:underline font-medium">Sign up</button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SIGNUP VIEW */}
          {authStep === "signup" && (
            <Card className="shadow-elevated border-border/50">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl">Create Account</CardTitle>
                <CardDescription>Join MediConnect today</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignUp} className="space-y-4">
                  {/* ADDED: Full Name Field */}
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full bg-primary" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create Account
                  </Button>
                </form>
                <div className="mt-4 text-center text-sm">
                  Already have an account? <button onClick={() => setAuthStep("login")} className="text-primary underline">Sign in</button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* VERIFICATION (OTP) VIEW */}
          {(authStep === "confirm-signup" || authStep === "mfa") && (
            <Card className="shadow-elevated border-border/50">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl">Verify Email</CardTitle>
                <CardDescription>Enter the code sent to {email}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center mb-6">
                  <InputOTP maxLength={6} value={otpValue} onChange={setOtpValue}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                      <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button onClick={handleVerification} className="w-full bg-primary" disabled={otpValue.length !== 6 || loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verify Code"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* IDENTITY VERIFICATION */}
          {authStep === "identity" && (
            <Card className="shadow-elevated border-border/50">
              <CardHeader className="text-center pb-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto mb-4">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Identity Verification</CardTitle>
                <CardDescription>Verify your identity using AWS Rekognition</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div onClick={() => setIdUploaded(true)} className={cn("border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors", idUploaded ? "border-success bg-success/5" : "border-border hover:border-primary/50")}>
                  {idUploaded ? <div className="text-success flex justify-center gap-2"><CheckCircle2 /> ID Uploaded</div> : <><Upload className="mx-auto h-8 w-8 mb-2" /><p>Upload ID</p></>}
                </div>
                <div onClick={() => setSelfieUploaded(true)} className={cn("border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors", selfieUploaded ? "border-success bg-success/5" : "border-border hover:border-primary/50")}>
                  {selfieUploaded ? <div className="text-success flex justify-center gap-2"><CheckCircle2 /> Selfie Captured</div> : <><Camera className="mx-auto h-8 w-8 mb-2" /><p>Take Selfie</p></>}
                </div>
                <Button onClick={handleIdentityComplete} className="w-full bg-primary" disabled={!idUploaded || !selfieUploaded}>Complete Verification</Button>
                <Button variant="ghost" className="w-full" onClick={handleIdentityComplete}>Skip for now (Demo)</Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}