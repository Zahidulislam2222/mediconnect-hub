import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
// AWS Imports
import { signIn, signUp, confirmSignUp, getCurrentUser, fetchAuthSession, signOut } from 'aws-amplify/auth';
// AWS SDK Imports
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

import {
  Stethoscope,
  User,
  Building2,
  Shield,
  Camera,
  CheckCircle2,
  ArrowRight,
  Loader2,
  AlertTriangle,
  FileBadge,
  ScrollText,
  ScanLine,
  UploadCloud
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
import { api } from "@/lib/api";

// Env Variables
const CREDENTIALS_BUCKET = import.meta.env.VITE_S3_CREDENTIALS_BUCKET;

type AuthStep = "login" | "signup" | "confirm-signup" | "mfa" | "identity" | "diploma-upload";

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [userType, setUserType] = useState<"patient" | "provider">("patient");
  const [authStep, setAuthStep] = useState<AuthStep>("login");
  const [loading, setLoading] = useState(false);

  // 🟢 NEW: Session Check State
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const [imageProcessing, setImageProcessing] = useState(false);

  // Form States
  const [name, setName] = useState("");
  const [email, setEmail] = useState("alex.thompson@email.com");
  const [password, setPassword] = useState("MediConnect@2025");
  const [otpValue, setOtpValue] = useState("");

  // Identity States
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [idImage, setIdImage] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "verifying" | "success" | "failed">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  // Diploma State
  const [diplomaFile, setDiplomaFile] = useState<File | null>(null);

  // --- 1. CHECK SESSION ON MOUNT ---
  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const user = await getCurrentUser();
      if (user) {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();

        const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
        const roleToCheck = savedUser.role === 'doctor' ? 'provider' : 'patient';

        setUserType(roleToCheck);

        if (token) {
          await strictVerifyAndRedirect(user.userId, token, roleToCheck);
        }
      }
    } catch (error) {
      // If error (not logged in), clear user
      localStorage.removeItem('user');
    } finally {
      // 🟢 NEW: Stop loading regardless of success or failure
      setIsCheckingSession(false);
    }
  }

  // --- HELPER: STRICT DB CHECK ---
  const strictVerifyAndRedirect = async (userId: string, token: string, currentTab: "patient" | "provider") => {
    try {
      let profile: any = null;
      let roleKey = "";

      if (currentTab === 'patient') {
        try {
          const data = await api.get(`/patients/${userId}`);
          const p = data.Item || data;
          if (p && (p.patientId === userId || p.userId === userId || p.id === userId)) {
            profile = p;
            roleKey = "patient";
          }
        } catch (e: any) {
          // Allow 404 (Not Found) but re-throw 401 (Auth Failed)
          if (e.message.includes('401')) throw e;
          // Ignore other errors (assume not found)
        }
      } else {
        try {
          const data = await api.get(`/doctors/${userId}`);

          // 🟢 PROFESSIONAL FIX: Check for both 'doctorId' and 'id'
          if (data.doctors && Array.isArray(data.doctors)) {
            profile = data.doctors.find((d: any) => (d.doctorId === userId || d.id === userId));
          } else if (data.doctorId === userId || data.id === userId) {
            profile = data;
          }

          if (profile) roleKey = "doctor";
        } catch (e: any) {
          if (e.message.includes('401')) throw e;
        }
      }

      if (!profile) {
        console.warn(`User authenticated (${userId}) but not found in ${currentTab} database.`);
        return false;
      }

      if (profile.isEmailVerified === false) {
        const endpoint = currentTab === 'patient' ? `/patients/${userId}` : `/doctors/${userId}`;
        // Fire and forget
        api.put(endpoint, { isEmailVerified: true }).catch(console.error);
      }

      // 3. LOGIC FLOW CONTROL
      if (roleKey === 'doctor') {
        // Step A: Identity (Face Match)
        if (!profile.isIdentityVerified && profile.verificationStatus !== 'APPROVED') {
          setAuthStep('identity');
          setStatusMessage("Identity Verification Required");
          return true;
        }

        // Step B: Diploma Upload (Check if DB has URL)
        if (!profile.diplomaUrl && profile.verificationStatus !== 'APPROVED') {
          setAuthStep('diploma-upload');
          return true;
        }
      } else {
        // Patient Logic
        const iStatus = profile.identityStatus;
        const boolIdentity = profile.isIdentityVerified === true;
        const boolGeneric = profile.isVerified === true;
        const isVerified = (iStatus === 'VERIFIED' || boolIdentity || boolGeneric);

        if (!isVerified) {
          setAuthStep('identity');
          setStatusMessage(`Identity Status: ${iStatus || "UNVERIFIED"}`);
          return true;
        }
      }

      // 4. Success -> Redirect
      localStorage.setItem('user', JSON.stringify({
        name: profile.name || email.split('@')[0],
        email: email,
        role: roleKey,
        ...profile
      }));

      if (roleKey === 'doctor') navigate("/doctor-dashboard");
      else navigate("/patient-dashboard");

      return true;

    } catch (e) {
      console.error("Strict Verification Failed", e);
      return false;
    }
  };

  // --- IMAGE PROCESSING ---
  const processImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 800;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          resolve(dataUrl.split(',')[1]);
        };
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'selfie' | 'id') => {
    if (e.target.files && e.target.files[0]) {
      setImageProcessing(true);
      try {
        const base64 = await processImage(e.target.files[0]);
        if (type === 'selfie') setSelfieImage(base64);
        else setIdImage(base64);
      } catch (err) {
        toast({ variant: "destructive", title: "Image Error", description: "Try a smaller file." });
      } finally {
        setImageProcessing(false);
      }
    }
  };

  // --- LOGIN ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { isSignedIn, nextStep } = await signIn({ username: email, password });

      if (isSignedIn) {
        const user = await getCurrentUser();
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();

        if (token && user) {
          const handled = await strictVerifyAndRedirect(user.userId, token, userType);

          if (!handled) {
            await signOut();
            toast({
              variant: "destructive",
              title: "Access Denied",
              description: `No ${userType} account found. Please check your role selection.`
            });
          }
        } else {
          setAuthStep("identity");
        }
      } else if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
        setAuthStep("confirm-signup");
        toast({ title: "Account not verified", description: "Please enter the code sent to your email." });
      }
    } catch (error: any) {
      console.error(error);
      toast({ variant: "destructive", title: "Login Failed", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  // --- SIGNUP ---
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { userId } = await signUp({
        username: email,
        password,
        options: { userAttributes: { email, name } }
      });

      if (userType === 'provider') {
        // 1. Create ONLY in GCP PostgreSQL
        await api.post('/doctors', {
          doctorId: userId,
          name: name,
          email: email,
          role: 'doctor',
          specialization: 'General Practice',
          licenseNumber: 'PENDING-VERIFICATION'
        });
        // DO NOT call api.post('/patients', ...) for doctors here anymore.
      } else {
        // 2. Patients ONLY in AWS DynamoDB
        await api.post('/patients', {
          userId: userId,
          name: name,
          email: email,
          role: 'patient'
        });
      }
      setAuthStep("confirm-signup");
      toast({ title: "Account Created", description: "Check email for code." });
    } catch (error: any) {
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

  // --- IDENTITY SUBMISSION ---
  const handleSubmitIdentity = async () => {
    setLoading(true);
    setVerificationStatus("verifying");

    try {
      const user = await getCurrentUser();
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      if (!token) throw new Error("Session expired.");

      const payload = {
        userId: user.userId,
        role: userType === 'provider' ? 'doctor' : 'patient',
        selfieImage: selfieImage,
        idImage: idImage
      };

      const data = await api.post('/patients/identity/verify', payload);

      if (data.verified) {
        setVerificationStatus("success");
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        if (data.photoUrl) currentUser.avatar = data.photoUrl;

        currentUser.isIdentityVerified = true;
        localStorage.setItem('user', JSON.stringify(currentUser));

        if (userType === 'provider') {
          // DOCTORS: Move to Diploma Upload
          toast({ title: "Identity Verified", description: "Please upload your medical credential next." });
          setTimeout(() => {
            setAuthStep("diploma-upload");
            setVerificationStatus("idle");
            setLoading(false);
          }, 1000);
        } else {
          // PATIENTS: Go to Dashboard
          currentUser.identityStatus = 'VERIFIED';
          localStorage.setItem('user', JSON.stringify(currentUser));
          toast({ title: "Identity Verified", description: `Success!` });
          setTimeout(() => {
            navigate("/patient-dashboard");
          }, 1000);
        }

      } else {
        setVerificationStatus("failed");
        toast({ variant: "destructive", title: "Verification Failed", description: data.message });
        setLoading(false);
      }

    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "System Error", description: "Service unavailable." });
      setVerificationStatus("failed");
      setLoading(false);
    }
  };

  // --- DIPLOMA UPLOAD (DOCTOR ONLY) ---
  const handleDiplomaUpload = async () => {
    if (!diplomaFile) return;
    setLoading(true);

    try {
      const user = await getCurrentUser();
      const session = await fetchAuthSession();
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const registeredName = currentUser.name || "Doctor";

      if (!session.credentials) throw new Error("No AWS credentials found.");

      const s3Client = new S3Client({
        region: "us-east-1",
        credentials: session.credentials
      });

      const fileExt = diplomaFile.name.split('.').pop();
      const fileName = `doctors/${user.userId}/diploma.${fileExt}`;

      // 🟢 PROFESSIONAL FIX: Convert File to ArrayBuffer to prevent "readableStream" error
      const arrayBuffer = await diplomaFile.arrayBuffer();
      const fileBuffer = new Uint8Array(arrayBuffer);

      // 1. Upload to S3
      await s3Client.send(new PutObjectCommand({
        Bucket: CREDENTIALS_BUCKET,
        Key: fileName,
        Body: fileBuffer, // Use the converted buffer here
        ContentType: diplomaFile.type
      }));

      console.log('Upload success to:', CREDENTIALS_BUCKET);
      toast({ title: "Scanning", description: "AI is checking your name on the document..." });

      // 2. Trigger the Strict AI Scan on the Backend
      const response = await api.post(`/doctors/${user.userId}/verify-diploma`, {
        s3Key: fileName,
        bucketName: CREDENTIALS_BUCKET,
        expectedName: registeredName
      });

      if (response.verified) {
        toast({ title: "AI Verified", description: "Identity and Credentials match! Welcome." });
        navigate("/doctor-dashboard");
      } else {
        toast({
          variant: "destructive",
          title: "AI Match Failed",
          description: "The name on the diploma does not match your account name."
        });
      }

    } catch (error: any) {
      console.error("Upload/Verify failed", error);
      toast({
        variant: "destructive",
        title: "Verification Error",
        description: error.message || "Could not complete verification."
      });
    } finally {
      setLoading(false);
    }
  };

  // --- SKIP / DEMO FUNCTION ---
  const handleSkip = () => {
    const role = userType === 'provider' ? 'doctor' : 'patient';

    // 1. Mock the user in LocalStorage so the Dashboard doesn't kick you out
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    localStorage.setItem('user', JSON.stringify({
      ...currentUser,
      name: name || email.split('@')[0],
      email: email,
      role: role,
      // Add fake verification flags for the demo
      isIdentityVerified: true,
      identityStatus: 'VERIFIED',
      diplomaUrl: 'demo-skip-url',
      verificationStatus: 'PENDING'
    }));

    // 2. LOGIC: If Doctor is on Identity Step -> Go to Diploma Step
    if (role === 'doctor' && authStep === 'identity') {
      setAuthStep("diploma-upload");
      toast({ title: "Demo Step", description: "Identity skipped. Now on Diploma step." });
      return;
    }

    // 3. LOGIC: If Patient OR (Doctor on Diploma Step) -> Go to Dashboard
    if (role === 'doctor') navigate("/doctor-dashboard");
    else navigate("/patient-dashboard");
  };

  // 🟢 NEW: Full Screen Loading State
  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // --- UI RENDER ---
  return (
    <div className="min-h-screen flex">
      <PublicHeader />
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
        <div className="flex gap-4 text-white/60 text-sm">
          <span>© 2025 MediConnect</span>
          <span>Privacy Policy</span>
          <span>Terms of Service</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-24 bg-background">
        <div className="w-full max-w-md">

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
                    <TabsTrigger value="provider" className="gap-2"><Building2 className="h-4 w-4" /> Doctor</TabsTrigger>
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

          {authStep === "signup" && (
            <Card className="shadow-elevated border-border/50">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl">Create Account</CardTitle>
                <CardDescription>
                  Join as a <span className="font-semibold text-primary">{userType === 'patient' ? 'Patient' : 'Doctor'}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={userType} onValueChange={(v) => setUserType(v as any)} className="mb-6">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="patient" className="gap-2"><User className="h-4 w-4" /> Patient</TabsTrigger>
                    <TabsTrigger value="provider" className="gap-2"><Building2 className="h-4 w-4" /> Doctor</TabsTrigger>
                  </TabsList>
                </Tabs>

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

          {authStep === "identity" && (
            <Card className="shadow-elevated border-border/50">
              <CardHeader className="text-center pb-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto mb-4">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Identity Verification</CardTitle>
                <CardDescription>
                  We need to verify your face matches your ID.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">

                {statusMessage && (
                  <div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg text-sm text-center font-medium border border-yellow-200">
                    {statusMessage}
                  </div>
                )}

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
                        <span className="font-medium">Take a Selfie</span>
                        <span className="text-xs">Used for face matching</span>
                      </div>
                    )}
                  </label>
                </div>

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
                        <span className="font-semibold">Document Uploaded</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground hover:text-primary">
                        <ScanLine className="h-8 w-8 mb-2" />
                        <span className="font-medium">Upload Government ID</span>
                        <span className="text-xs">Passport, Driver's License or National ID</span>
                      </div>
                    )}
                  </label>
                </div>

                {imageProcessing && (
                  <div className="text-xs text-center text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Processing image...
                  </div>
                )}

                {verificationStatus === 'success' && (
                  <div className="p-3 bg-green-100 text-green-800 rounded-lg flex items-center justify-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4" /> Identity Verified!
                  </div>
                )}
                {verificationStatus === 'failed' && (
                  <div className="p-3 bg-red-100 text-red-800 rounded-lg flex items-center justify-center gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4" /> Verification Failed.
                  </div>
                )}

                <Button
                  onClick={handleSubmitIdentity}
                  className="w-full bg-primary"
                  disabled={loading || imageProcessing || !selfieImage || !idImage}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verify Identity"}
                </Button>

                <Button variant="ghost" className="w-full text-muted-foreground text-xs" onClick={handleSkip}>
                  Skip Verification (Dev Only)
                </Button>
              </CardContent>
            </Card>
          )}

          {/* DIPLOMA UPLOAD (Doctors Only) */}
          {authStep === "diploma-upload" && (
            <Card className="shadow-elevated border-border/50">
              <CardHeader className="text-center pb-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 mx-auto mb-4">
                  <FileBadge className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="text-2xl">Medical Credentials</CardTitle>
                <CardDescription>
                  Upload your medical license or diploma to complete verification.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">

                <div className={cn("border-2 border-dashed rounded-xl p-6 text-center transition-colors", diplomaFile ? "border-blue-500 bg-blue-50" : "border-border")}>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    id="diploma-upload-input"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setDiplomaFile(e.target.files[0]);
                    }}
                  />
                  <label htmlFor="diploma-upload-input" className="cursor-pointer block">
                    {diplomaFile ? (
                      <div className="text-blue-700 flex flex-col items-center gap-2">
                        <CheckCircle2 className="h-8 w-8" />
                        <span className="font-semibold">{diplomaFile.name}</span>
                        <span className="text-xs">Ready to upload</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground hover:text-blue-600">
                        <ScrollText className="h-8 w-8 mb-2" />
                        <span className="font-medium">Select Document</span>
                        <span className="text-xs">PDF, JPG, or PNG</span>
                      </div>
                    )}
                  </label>
                </div>

                <Button
                  onClick={handleDiplomaUpload}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={!diplomaFile || loading}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Upload & Finish"}
                </Button>

                {/* 🟢 NEW: Added Skip button to Diploma section */}
                <Button variant="ghost" className="w-full text-muted-foreground text-xs" onClick={handleSkip}>
                  Skip Verification (Dev Only)
                </Button>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}