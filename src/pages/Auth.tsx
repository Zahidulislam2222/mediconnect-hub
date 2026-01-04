import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

type AuthStep = "login" | "mfa" | "identity";

export default function Auth() {
  const navigate = useNavigate();
  const [userType, setUserType] = useState<"patient" | "provider">("patient");
  const [authStep, setAuthStep] = useState<AuthStep>("login");
  const [otpValue, setOtpValue] = useState("");
  const [idUploaded, setIdUploaded] = useState(false);
  const [selfieUploaded, setSelfieUploaded] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthStep("mfa");
  };

  const handleMfaVerify = () => {
    if (otpValue.length === 6) {
      setAuthStep("identity");
    }
  };

  const handleIdentityComplete = () => {
    if (userType === "patient") {
      navigate("/dashboard");
    } else {
      navigate("/doctor-dashboard");
    }
  };

  const handleSkipVerification = () => {
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

          <h1 className="text-4xl font-bold text-white mb-6">
            Healthcare at Your Fingertips
          </h1>
          <p className="text-xl text-white/80 max-w-md">
            Connect with world-class healthcare providers from anywhere. Secure, private, and HIPAA-compliant.
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-medium text-white">HIPAA Compliant</p>
              <p className="text-sm text-white/70">Your data is encrypted and secure</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-medium text-white">Verified Providers</p>
              <p className="text-sm text-white/70">All doctors are credential-verified</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Forms */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl medical-gradient">
              <Stethoscope className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold">MediConnect</span>
          </div>

          {authStep === "login" && (
            <Card className="shadow-elevated border-border/50">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl">Welcome Back</CardTitle>
                <CardDescription>Sign in to your account to continue</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={userType} onValueChange={(v) => setUserType(v as any)} className="mb-6">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="patient" className="gap-2">
                      <User className="h-4 w-4" />
                      Patient
                    </TabsTrigger>
                    <TabsTrigger value="provider" className="gap-2">
                      <Building2 className="h-4 w-4" />
                      Provider
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        className="pl-10"
                        defaultValue="alex.thompson@email.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                        defaultValue="password123"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-border" />
                      <span className="text-muted-foreground">Remember me</span>
                    </label>
                    <button type="button" className="text-primary hover:underline">
                      Forgot password?
                    </button>
                  </div>

                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90">
                    Sign In
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </form>

                <div className="mt-6 text-center text-sm text-muted-foreground">
                  Don't have an account?{" "}
                  <button className="text-primary hover:underline font-medium">
                    Sign up
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {authStep === "mfa" && (
            <Card className="shadow-elevated border-border/50">
              <CardHeader className="text-center pb-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto mb-4">
                  <Phone className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Verify Your Identity</CardTitle>
                <CardDescription>
                  Enter the 6-digit code sent to your phone ending in ****7890
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center mb-6">
                  <InputOTP
                    maxLength={6}
                    value={otpValue}
                    onChange={(value) => setOtpValue(value)}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <Button
                  onClick={handleMfaVerify}
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={otpValue.length !== 6}
                >
                  Verify Code
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>

                <div className="mt-4 text-center text-sm text-muted-foreground">
                  Didn't receive a code?{" "}
                  <button className="text-primary hover:underline">Resend</button>
                </div>
              </CardContent>
            </Card>
          )}

          {authStep === "identity" && (
            <Card className="shadow-elevated border-border/50">
              <CardHeader className="text-center pb-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto mb-4">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Identity Verification</CardTitle>
                <CardDescription>
                  For your security, please verify your identity using AWS Rekognition
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* ID Upload */}
                <div
                  onClick={() => setIdUploaded(true)}
                  className={cn(
                    "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
                    idUploaded
                      ? "border-success bg-success/5"
                      : "border-border hover:border-primary/50 hover:bg-primary/5"
                  )}
                >
                  {idUploaded ? (
                    <div className="flex items-center justify-center gap-2 text-success">
                      <CheckCircle2 className="h-6 w-6" />
                      <span className="font-medium">ID Uploaded Successfully</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="font-medium">Upload Government ID</p>
                      <p className="text-sm text-muted-foreground">
                        Driver's license, passport, or state ID
                      </p>
                    </>
                  )}
                </div>

                {/* Selfie */}
                <div
                  onClick={() => setSelfieUploaded(true)}
                  className={cn(
                    "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
                    selfieUploaded
                      ? "border-success bg-success/5"
                      : "border-border hover:border-primary/50 hover:bg-primary/5"
                  )}
                >
                  {selfieUploaded ? (
                    <div className="flex items-center justify-center gap-2 text-success">
                      <CheckCircle2 className="h-6 w-6" />
                      <span className="font-medium">Selfie Captured Successfully</span>
                    </div>
                  ) : (
                    <>
                      <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="font-medium">Take a Selfie</p>
                      <p className="text-sm text-muted-foreground">
                        We'll match it with your ID photo
                      </p>
                    </>
                  )}
                </div>

                <Button
                  onClick={handleIdentityComplete}
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={!idUploaded || !selfieUploaded}
                >
                  Complete Verification
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>

                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={handleSkipVerification}
                >
                  Skip for now (Demo)
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
