import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
// AWS Imports
import { signIn, signUp, confirmSignUp, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';

import {
  Stethoscope,
  User,
  Building2,
  Shield,
  Camera,
  Upload,
  CheckCircle2,
  ArrowRight,
  Loader2,
  AlertTriangle,
  FileBadge
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PublicHeader } from "@/components/PublicHeader";

// Env Variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

type AuthStep = "login" | "signup" | "confirm-signup" | "mfa" | "identity";

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [userType, setUserType] = useState<"patient" | "provider">("patient");
  const [authStep, setAuthStep] = useState<AuthStep>("login");
  const [loading, setLoading] = useState(false);

  // Form States
  const [name, setName] = useState("");
  const [email, setEmail] = useState("alex.thompson@email.com");
  const [password, setPassword] = useState("MediConnect@2025");
  const [otpValue, setOtpValue] = useState("");

  // Identity States
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [idImage, setIdImage] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "verifying" | "success" | "failed">("idle");

  // --- 1. CHECK IF ALREADY LOGGED IN ---
  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const user = await getCurrentUser();
      if (user) {
        if (userType === 'patient') navigate("/dashboard");
        else navigate("/doctor-dashboard");
      }
    } catch (error) {
      // Not logged in
    }
  }

  // --- HELPER: COMPRESS & CONVERT IMAGE ---
  const processImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 800; // Resize to max 800px width
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;

          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Compress to JPEG 0.7 quality
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          // Remove header for Lambda
          resolve(dataUrl.split(',')[1]);
        };
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'selfie' | 'id') => {
    if (e.target.files && e.target.files[0]) {
      try {
        const base64 = await processImage(e.target.files[0]);
        if (type === 'selfie') setSelfieImage(base64);
        else setIdImage(base64);
      } catch (err) {
        toast({ variant: "destructive", title: "Image Error", description: "Could not process image." });
      }
    }
  };

  // --- AWS COGNITO FUNCTIONS ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { isSignedIn, nextStep } = await signIn({ username: email, password });

      if (isSignedIn) {
        try {
          const user = await getCurrentUser();
          localStorage.setItem('user', JSON.stringify({
            name: user.username || email,
            email: email,
            role: userType
          }));
        } catch (e) { }

        // Send to Identity Check
        setAuthStep("identity");
      } else if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
        setAuthStep("confirm-signup");
        toast({ title: "Account not verified", description: "Please enter the code sent to your email." });
      }
    } catch (error: any) {
      console.error(error);
      if (error.name === "UserAlreadyAuthenticatedException") {
        setAuthStep("identity");
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
      // 1. Create User in Cognito
      const { userId } = await signUp({
        username: email,
        password,
        options: {
          userAttributes: { email, name }
        }
      });

      // 2. Save Profile to DynamoDB via API Gateway
      if (userId) {
        if (userType === 'patient') {
          // Patient Registration
          await fetch(`${API_BASE_URL}/register-patient`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: userId,
              name: name,
              email: email,
              role: 'patient'
            })
          });
        } else {
          // 🛡️ DOCTOR FIX: Send fields required by mediconnect-create-doctor
          await fetch(`${API_BASE_URL}/register-doctor`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              doctorId: userId,           // FIXED: Send 'doctorId', not 'userId'
              name: name,
              email: email,
              role: 'doctor',             // FIXED: Send 'doctor', not 'provider'
              specialization: 'General Practice', // FIXED: Mandatory field
              licenseNumber: 'PENDING'            // FIXED: Mandatory field
            })
          });
        }
      }

      setAuthStep("confirm-signup");
      toast({ title: "Account Created", description: "Please check your email for the verification code." });
    } catch (error: any) {
      console.error("Signup Error:", error);
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

  const handleSubmitIdentity = async () => {
    setLoading(true);
    setVerificationStatus("verifying");

    try {
      const user = await getCurrentUser();

      // 🛡️ SECURITY FIX: Get the session token
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      const payload = {
        userId: user.userId,
        role: userType === 'provider' ? 'doctor' : 'patient',
        selfieImage: selfieImage,
        idImage: userType === 'provider' ? idImage : null
      };

      // 🛡️ HEADERS FIX: Add Authorization
      const res = await fetch(`${API_BASE_URL}/verify-identity`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token || ""
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.verified) {
        setVerificationStatus("success");

        try {
          const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
          currentUser.avatar = data.photoUrl; // Assumption: backend returns photoUrl if verified
          localStorage.setItem('user', JSON.stringify(currentUser));
        } catch (e) { }

        toast({
          title: "Identity Verified",
          description: `Confidence: ${Math.round(data.confidence || 90)}%. Welcome aboard!`
        });

        setTimeout(() => {
          navigate(userType === 'patient' ? "/dashboard" : "/doctor-dashboard");
        }, 1500);

      } else {
        setVerificationStatus("failed");
        toast({
          variant: "destructive",
          title: "Verification Failed",
          description: data.message || "Face did not match."
        });

        // Development Bypass (Optional - keep if you want to allow failed access during dev)
        setTimeout(() => {
          navigate(userType === 'patient' ? "/dashboard" : "/doctor-dashboard");
        }, 2000);
      }

    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "System Error", description: "Could not contact verification server." });
      setVerificationStatus("failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigate(userType === 'patient' ? "/dashboard" : "/doctor-dashboard");
  };

  return (
    <div className="min-h-screen flex">
      <PublicHeader />
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 medical-gradient p-24 flex-col justify-between">
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
      <div className="flex-1 flex items-center justify-center p-24 bg-background">
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

          {/* IDENTITY VERIFICATION (AWS REKOGNITION) */}
          {authStep === "identity" && (
            <Card className="shadow-elevated border-border/50">
              <CardHeader className="text-center pb-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto mb-4">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Identity Verification</CardTitle>
                <CardDescription>
                  {userType === 'provider' ? "Upload a selfie and your ID card." : "Upload a photo of yourself."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* 1. SELFIE UPLOAD */}
                <div className={cn("border-2 border-dashed rounded-xl p-6 text-center transition-colors", selfieImage ? "border-success bg-success/5" : "border-border")}>
                  <input
                    type="file"
                    accept="image/*"
                    id="selfie-upload"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, 'selfie')}
                  />
                  <label htmlFor="selfie-upload" className="cursor-pointer block">
                    {selfieImage ? (
                      <div className="text-success flex flex-col items-center gap-2">
                        <CheckCircle2 className="h-8 w-8" />
                        <span className="font-semibold">Selfie Uploaded</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground hover:text-primary">
                        <Camera className="h-8 w-8 mb-2" />
                        <span className="font-medium">Upload Selfie</span>
                        <span className="text-xs">Click to select file</span>
                      </div>
                    )}
                  </label>
                </div>

                {/* 2. ID UPLOAD (ONLY FOR PROVIDERS) */}
                {userType === 'provider' && (
                  <div className={cn("border-2 border-dashed rounded-xl p-6 text-center transition-colors", idImage ? "border-success bg-success/5" : "border-border")}>
                    <input
                      type="file"
                      accept="image/*"
                      id="id-upload"
                      className="hidden"
                      onChange={(e) => handleFileChange(e, 'id')}
                    />
                    <label htmlFor="id-upload" className="cursor-pointer block">
                      {idImage ? (
                        <div className="text-success flex flex-col items-center gap-2">
                          <CheckCircle2 className="h-8 w-8" />
                          <span className="font-semibold">ID Card Uploaded</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground hover:text-primary">
                          <FileBadge className="h-8 w-8 mb-2" />
                          <span className="font-medium">Upload ID Card</span>
                          <span className="text-xs">Passport or National ID</span>
                        </div>
                      )}
                    </label>
                  </div>
                )}

                {/* STATUS MESSAGES */}
                {verificationStatus === 'success' && (
                  <div className="p-3 bg-green-100 text-green-800 rounded-lg flex items-center justify-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4" /> Identity Verified Successfully!
                  </div>
                )}
                {verificationStatus === 'failed' && (
                  <div className="p-3 bg-red-100 text-red-800 rounded-lg flex items-center justify-center gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4" /> Verification Failed. Proceeding anyway...
                  </div>
                )}

                {/* ACTION BUTTONS */}
                <Button
                  onClick={handleSubmitIdentity}
                  className="w-full bg-primary"
                  disabled={
                    loading ||
                    !selfieImage ||
                    (userType === 'provider' && !idImage)
                  }
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verify Identity"}
                </Button>

                <Button variant="ghost" className="w-full text-muted-foreground" onClick={handleSkip}>
                  Skip Verification (Development)
                </Button>

              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}