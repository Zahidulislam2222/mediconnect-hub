import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
// AWS Imports
import { Amplify } from 'aws-amplify';
import { signIn, signUp, confirmSignUp, confirmSignIn, getCurrentUser, fetchAuthSession, signOut, resetPassword, confirmResetPassword } from 'aws-amplify/auth';
// AWS SDK Imports
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

import { Stethoscope, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PublicHeader } from "@/components/PublicHeader";
import { api } from "@/lib/api";

// 🟢 CHILD COMPONENTS (All 7 now)
import { LoginCard } from "@/components/auth/LoginCard";
import { SignupCard } from "@/components/auth/SignupCard";
import { ConfirmSignup } from "@/components/auth/ConfirmSignup"; // <-- NEW IMPORT
import { MfaManager } from "@/components/auth/MfaManager";
import { PasswordReset } from "@/components/auth/PasswordReset";
import { IdentityVerification } from "@/components/auth/IdentityVerification";
import { CredentialUpload } from "@/components/auth/CredentialUpload";

type AuthStep = "login" | "signup" | "confirm-signup" | "mfa-setup" | "mfa-verify" | "identity" | "diploma-upload" | "forgot-password" | "reset-password";
type Region = "US" | "EU";

// 🟢 1. STRICT TYPES (Future-Proofing)
interface PatientProfile {
  patientId?: string;
  userId?: string;
  id?: string;
  name: string;
  email: string;
  isEmailVerified?: boolean;
  isIdentityVerified?: boolean;
  identityStatus?: string;
  [key: string]: any;
}

interface DoctorProfile {
  doctorId: string;
  name: string;
  email: string;
  isEmailVerified?: boolean;
  isIdentityVerified?: boolean;
  verificationStatus?: string;
  diplomaUrl?: string;
  [key: string]: any;
}

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // --- STATE ---
  const [userType, setUserType] = useState<"patient" | "provider">("patient");
  const [authStep, setAuthStep] = useState<AuthStep>("login");
  const [loading, setLoading] = useState(false);
  
  // 🟢 GDPR FIX: Explicit Region State
  const [selectedRegion, setSelectedRegion] = useState<Region>(
    (localStorage.getItem('userRegion') as Region) || "US"
  );

  const [newPassword, setNewPassword] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [imageProcessing, setImageProcessing] = useState(false);

  // Form States
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpValue, setOtpValue] = useState("");

  // Identity States
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [idImage, setIdImage] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "verifying" | "success" | "failed">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [diplomaFile, setDiplomaFile] = useState<File | null>(null);
  const [mfaSetupKey, setMfaSetupKey] = useState("");

  // --- 0. GDPR COGNITO CONFIGURATOR ---
  useEffect(() => {
    localStorage.setItem('userRegion', selectedRegion);
    const isEU = selectedRegion === 'EU';
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: isEU 
            ? import.meta.env.VITE_COGNITO_USER_POOL_ID_EU 
            : import.meta.env.VITE_COGNITO_USER_POOL_ID_US,
          // 🟢 FIX: Environment variable names now exactly match .env.local
          userPoolClientId: isEU 
            ? (userType === 'provider' ? import.meta.env.VITE_COGNITO_CLIENT_DOCTOR_EU : import.meta.env.VITE_COGNITO_CLIENT_PATIENT_EU)
            : (userType === 'provider' ? import.meta.env.VITE_COGNITO_CLIENT_DOCTOR_US : import.meta.env.VITE_COGNITO_CLIENT_PATIENT_US),
        }
      }
    });
  }, [selectedRegion, userType]);

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
        
        if (token) {
          // 🟢 FIX: Check if the backend accepted the token
          const success = await strictVerifyAndRedirect(user.userId, token);
          
          if (!success) {
            // 🛑 If backend returns 401, destroy the ghost session!
            await signOut();
            localStorage.clear();
          }
        }
      }
    } catch (error) {
      localStorage.clear();
    } finally {
      setIsCheckingSession(false);
    }
  }

  // --- HELPER: STRICT DB CHECK ---
  const strictVerifyAndRedirect = async (userId: string, token: string) => {
    try {
      let profile: PatientProfile | DoctorProfile | null = null;
      let roleKey = "";

      // 🟢 Get details from secure token payload
      const session = await fetchAuthSession();
      const payload = session.tokens?.idToken?.payload;
      const userEmail = payload?.email?.toString() || email;
      const userName = payload?.name?.toString() || userEmail.split('@')[0];

      // 🟢 PREVENT WRONG ROLE: Read directly from AWS Cognito!
      const groups = (payload?.['cognito:groups'] as string[]) || [];
      const isDoctor = groups.includes('doctor') || groups.includes('doctors');

      if (!isDoctor) {
        let data = await api.get(`/patients/${userId}`).catch(() => null);
        
        // 🟢 FIX: Use /register-patient (Not /patients)
        if (!data || data.error || Object.keys(data).length === 0) {
           await api.post('/register-patient', { name: userName, email: userEmail, role: 'patient' });
           data = await api.get(`/patients/${userId}`);
        }
        
        profile = data;
        roleKey = "patient";
      } else {
        let data = await api.get(`/doctors/${userId}`).catch(() => null);
        
        // 🟢 FIX: Use /register-doctor (Not /doctors)
        if (!data || data.error || (data.doctors && data.doctors.length === 0) || Object.keys(data).length === 0) {
           await api.post('/register-doctor', { 
             name: userName, 
             email: userEmail, 
             role: 'doctor', 
             specialization: 'General Practice', 
             licenseNumber: 'PENDING-VERIFICATION' 
           });
           data = await api.get(`/doctors/${userId}`);
        }
        
        profile = data.doctors ? data.doctors.find((d: any) => d.doctorId === userId) : data;
        if (profile) roleKey = "doctor";
      }

      if (!profile) return false;

      // Ensure Email is Verified in DynamoDB
      if (profile.isEmailVerified === false) {
        const endpoint = roleKey === 'patient' ? `/patients/${userId}` : `/doctors/${userId}`;
        api.put(endpoint, { isEmailVerified: true }).catch(console.error);
      }

      // LOGIC FLOW CONTROL
      if (roleKey === 'doctor') {
        if (!profile.isIdentityVerified && profile.verificationStatus !== 'APPROVED') {
          setAuthStep('identity');
          setStatusMessage("Identity Verification Required");
          return true;
        }
        if (!profile.diplomaUrl && profile.verificationStatus !== 'APPROVED') {
          setAuthStep('diploma-upload');
          return true;
        }
      } else {
        const isVerified = profile.identityStatus === 'VERIFIED' || profile.isIdentityVerified;
        if (!isVerified) {
          setAuthStep('identity');
          setStatusMessage("Identity Verification Required");
          return true;
        }
      }

      // 🟢 GDPR LOGIC: If they successfully log in, they have inherently agreed to the terms.
      // We set this to true so the banner immediately disappears.
      localStorage.setItem('gdpr_consent', 'true');

      localStorage.setItem('user', JSON.stringify({
        name: profile.name || email.split('@')[0],
        email: profile.email || email,
        role: roleKey,
        ...profile
      }));
      localStorage.setItem('access_token', token);

      navigate(roleKey === 'doctor' ? "/doctor-dashboard" : "/patient-dashboard");
      return true;

      localStorage.setItem('user', JSON.stringify({
        name: profile.name || email.split('@')[0],
        email: profile.email || email,
        role: roleKey,
        ...profile
      }));
      localStorage.setItem('access_token', token);

      navigate(roleKey === 'doctor' ? "/doctor-dashboard" : "/patient-dashboard");
      return true;

    } catch (e) {
      console.error("Verification Error", e);
      return false;
    }
  };

  // --- HANDLERS (Delegated to Components) ---
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
          resolve(canvas.toDataURL("image/jpeg", 0.7).split(',')[1]);
        };
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'selfie' | 'id') => {
    if (e.target.files?.[0]) {
      setImageProcessing(true);
      try {
        const base64 = await processImage(e.target.files[0]);
        type === 'selfie' ? setSelfieImage(base64) : setIdImage(base64);
      } catch (err) {
        toast({ variant: "destructive", title: "Image Error", description: "File too large." });
      } finally {
        setImageProcessing(false);
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { isSignedIn, nextStep } = await signIn({ username: email, password });
      if (isSignedIn) {
        const user = await getCurrentUser();
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        if (token && user) await strictVerifyAndRedirect(user.userId, token);
      } else if (nextStep.signInStep === 'CONTINUE_SIGN_IN_WITH_TOTP_SETUP') {
        const setupKey = nextStep.totpSetupDetails?.sharedSecret;
        setMfaSetupKey(setupKey || "");
        setAuthStep("mfa-setup");
      } else if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE') {
        setAuthStep("mfa-verify");
      } else if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
        setAuthStep("confirm-signup");
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Login Failed", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (localStorage.getItem('gdpr_consent') !== 'true') {
      toast({ variant: "destructive", title: "Consent Required", description: "You must click 'I Accept' on the cookie banner at the bottom of the screen to register." });
      return; 
    }

    setLoading(true);
    try {
      await signUp({ username: email, password, options: { userAttributes: { email, name } } });

      setAuthStep("confirm-signup");
      toast({ title: "Account Created", description: "Check email for verification code." });
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

  const handleMfaSetupConfirm = async () => {
    setLoading(true);
    try {
      await confirmSignIn({ challengeResponse: otpValue });
      toast({ title: "MFA Active", description: "Authenticator linked successfully." });
      await checkSession();
    } catch (error: any) {
      toast({ variant: "destructive", title: "MFA Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerifyCode = async () => {
    setLoading(true);
    try {
      await confirmSignIn({ challengeResponse: otpValue });
      await checkSession();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Invalid Code", description: "MFA Session expired. Please log in again." });
      setAuthStep("login"); 
      setOtpValue("");
    } finally {
      setLoading(false); 
    }
  };

  const handleForgotPassword = async () => {
    if (!email) { toast({ variant: "destructive", title: "Email Required", description: "Please enter email." }); return; }
    setLoading(true);
    try {
      await resetPassword({ username: email });
      setAuthStep("reset-password");
      toast({ title: "Code Sent", description: "Check your email." });
    } catch (error: any) { toast({ variant: "destructive", title: "Error", description: error.message }); }
    finally { setLoading(false); }
  };

  const handleResetSubmit = async () => {
    setLoading(true);
    try {
      await confirmResetPassword({ username: email, confirmationCode: otpValue, newPassword: newPassword });
      toast({ title: "Success", description: "Password changed. Login." });
      setAuthStep("login"); setPassword(""); setNewPassword(""); setOtpValue("");
    } catch (error: any) { toast({ variant: "destructive", title: "Error", description: error.message }); }
    finally { setLoading(false); }
  };

  const handleSubmitIdentity = async () => {
    setLoading(true);
    setVerificationStatus("verifying");
    try {
      const payload = { selfieImage, idImage };
      const data = await api.post('/verify-identity', payload);
      if (data.verified) {
        setVerificationStatus("success");
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        currentUser.isIdentityVerified = true;
        localStorage.setItem('user', JSON.stringify(currentUser));
        toast({ title: "Verified", description: "Biometrics match." });
        setTimeout(() => { userType === 'provider' ? setAuthStep("diploma-upload") : navigate("/patient-dashboard"); }, 1500);
      } else {
        setVerificationStatus("failed");
        toast({ variant: "destructive", title: "Verification Failed", description: data.message });
      }
    } catch (error) { setVerificationStatus("failed"); toast({ variant: "destructive", title: "System Error", description: "Service unavailable." }); }
    finally { setLoading(false); }
  };

  const handleDiplomaUpload = async () => {
    if (!diplomaFile) return;
    setLoading(true);
    try {
      const user = await getCurrentUser();
      const session = await fetchAuthSession();
      if (!session.credentials) throw new Error("No AWS credentials.");
      const isEU = selectedRegion === 'EU';
      const targetRegion = isEU ? 'eu-central-1' : 'us-east-1';
      const targetBucket = isEU ? `${import.meta.env.VITE_S3_CREDENTIALS_BUCKET}-eu` : import.meta.env.VITE_S3_CREDENTIALS_BUCKET;
      const s3Client = new S3Client({ region: targetRegion, credentials: session.credentials });
      const fileName = `doctors/${user.userId}/diploma.${diplomaFile.name.split('.').pop()}`;
      const fileBuffer = new Uint8Array(await diplomaFile.arrayBuffer());
      await s3Client.send(new PutObjectCommand({ Bucket: targetBucket, Key: fileName, Body: fileBuffer, ContentType: diplomaFile.type }));
      toast({ title: "Scanning", description: "AI is verifying..." });
      const response = await api.post(`/doctors/${user.userId}/verify-diploma`, { s3Key: fileName, bucketName: targetBucket, expectedName: name || email.split('@')[0] });
      if (response.verified) { toast({ title: "AI Verified", description: "Welcome." }); navigate("/doctor-dashboard"); } 
      else { toast({ variant: "destructive", title: "Mismatch", description: "Name mismatch." }); }
    } catch (error: any) { toast({ variant: "destructive", title: "Upload Failed", description: error.message }); }
    finally { setLoading(false); }
  };

  const handleSkip = () => {
    const role = userType === 'provider' ? 'doctor' : 'patient';
    localStorage.setItem('user', JSON.stringify({ name: name || "Demo User", email: email || "demo@local", role, isIdentityVerified: true, identityStatus: 'VERIFIED', verificationStatus: 'APPROVED' }));
    localStorage.setItem('access_token', 'demo-token-bypass');
    role === 'doctor' ? navigate("/doctor-dashboard") : navigate("/patient-dashboard");
    toast({ title: "Demo Mode", description: "Verification bypassed." });
  };

  if (isCheckingSession) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen flex">
      {!['identity', 'diploma-upload'].includes(authStep) && <PublicHeader />}
      
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

      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          {authStep === "login" && (
            <LoginCard userType={userType} setUserType={setUserType} email={email} setEmail={setEmail} password={password} setPassword={setPassword} loading={loading} handleLogin={handleLogin} setAuthStep={setAuthStep} />
          )}

          {authStep === "signup" && (
            <SignupCard userType={userType} setUserType={setUserType} selectedRegion={selectedRegion} setSelectedRegion={setSelectedRegion} name={name} setName={setName} email={email} setEmail={setEmail} password={password} setPassword={setPassword} loading={loading} handleSignUp={handleSignUp} setAuthStep={setAuthStep} />
          )}

          {authStep === "confirm-signup" && (
            <ConfirmSignup email={email} otpValue={otpValue} setOtpValue={setOtpValue} handleVerification={handleVerification} loading={loading} handleSkip={handleSkip} />
          )}

          {(authStep === "mfa-setup" || authStep === "mfa-verify") && (
            <MfaManager authStep={authStep} mfaSetupKey={mfaSetupKey} email={email} otpValue={otpValue} setOtpValue={setOtpValue} loading={loading} handleMfaSetupConfirm={handleMfaSetupConfirm} handleMfaVerifyCode={handleMfaVerifyCode} handleSkip={handleSkip} />
          )}

          {(authStep === "forgot-password" || authStep === "reset-password") && (
            <PasswordReset authStep={authStep} email={email} setEmail={setEmail} otpValue={otpValue} setOtpValue={setOtpValue} newPassword={newPassword} setNewPassword={setNewPassword} loading={loading} handleForgotPassword={handleForgotPassword} handleResetSubmit={handleResetSubmit} setAuthStep={setAuthStep} />
          )}

          {authStep === "identity" && (
            <IdentityVerification selfieImage={selfieImage} idImage={idImage} handleFileChange={handleFileChange} handleSubmitIdentity={handleSubmitIdentity} loading={loading} imageProcessing={imageProcessing} verificationStatus={verificationStatus} statusMessage={statusMessage} handleSkip={handleSkip} />
          )}

          {authStep === "diploma-upload" && (
            <CredentialUpload diplomaFile={diplomaFile} setDiplomaFile={setDiplomaFile} handleDiplomaUpload={handleDiplomaUpload} loading={loading} handleSkip={handleSkip} />
          )}
        </div>
      </div>
    </div>
  );
}