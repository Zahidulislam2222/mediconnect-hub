import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Amplify } from 'aws-amplify';
import { signIn, getCurrentUser, fetchAuthSession, signOut, confirmSignIn } from 'aws-amplify/auth';
import {
  ShieldCheck,
  Loader2,
  ArrowRight,
  Globe,
  Lock,
  KeyRound,
  Users,
  Building,
  Stethoscope,
  ArrowLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { setUser, getUser, markAuthenticated, clearAllSensitive } from "@/lib/secure-storage";

type Region = "US" | "EU";
type PortalType = "admin" | "staff";
type AuthStep = "login" | "mfa-verify";

export default function AdminStaffAuth() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [portalType, setPortalType] = useState<PortalType>("admin");
  const [authStep, setAuthStep] = useState<AuthStep>("login");
  const [loading, setLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const [selectedRegion, setSelectedRegion] = useState<Region>(
    (localStorage.getItem('userRegion') as Region) || "US"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpValue, setOtpValue] = useState("");

  // Configure Amplify for admin/staff with dedicated client IDs
  useEffect(() => {
    localStorage.setItem('userRegion', selectedRegion);
    const isEU = selectedRegion === 'EU';

    // Use admin or staff client ID based on selected portal type
    const getClientId = () => {
      if (portalType === 'admin') {
        return isEU
          ? import.meta.env.VITE_COGNITO_CLIENT_ADMIN_EU
          : import.meta.env.VITE_COGNITO_CLIENT_ADMIN_US;
      }
      return isEU
        ? import.meta.env.VITE_COGNITO_CLIENT_STAFF_EU
        : import.meta.env.VITE_COGNITO_CLIENT_STAFF_US;
    };

    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: isEU ? import.meta.env.VITE_COGNITO_USER_POOL_ID_EU : import.meta.env.VITE_COGNITO_USER_POOL_ID_US,
          userPoolClientId: getClientId(),
          identityPoolId: isEU ? import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID_EU : import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID_US,
        }
      }
    });
  }, [selectedRegion, portalType]);

  // Check existing session
  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const user = await getCurrentUser();
      if (user) {
        const session = await fetchAuthSession();
        const payload = session.tokens?.idToken?.payload;
        const groups = (payload?.['cognito:groups'] as string[]) || [];

        if (groups.includes('admin')) {
          navigate('/admin/dashboard', { replace: true });
          return;
        }
        if (groups.includes('staff')) {
          navigate('/staff/dashboard', { replace: true });
          return;
        }
      }
    } catch {
      // No session
    } finally {
      setIsCheckingSession(false);
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { isSignedIn, nextStep } = await signIn({ username: email, password });

      if (nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE') {
        setAuthStep("mfa-verify");
        setLoading(false);
        return;
      }

      if (isSignedIn) {
        await verifyAndRedirect();
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Authentication Failed", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async () => {
    setLoading(true);
    try {
      await confirmSignIn({ challengeResponse: otpValue });
      await verifyAndRedirect();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Invalid Code", description: error.message });
      setAuthStep("login");
      setOtpValue("");
    } finally {
      setLoading(false);
    }
  };

  async function verifyAndRedirect() {
    try {
      const user = await getCurrentUser();
      const session = await fetchAuthSession();
      const payload = session.tokens?.idToken?.payload;
      const groups = (payload?.['cognito:groups'] as string[]) || [];
      const userEmail = payload?.email?.toString() || email;
      const userName = payload?.name?.toString() || userEmail.split('@')[0];

      const isAdmin = groups.includes('admin');
      const isStaff = groups.includes('staff');

      if (!isAdmin && !isStaff) {
        await signOut();
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "This portal is restricted to admin and staff accounts. Please use the main login for patient/doctor access."
        });
        return;
      }

      const role = isAdmin ? 'admin' : 'staff';

      setUser({
        name: userName,
        email: userEmail,
        role,
        id: user.userId,
        groups,
      });
      markAuthenticated();

      toast({ title: `Welcome, ${userName}`, description: `Signed in as ${role.charAt(0).toUpperCase() + role.slice(1)}` });
      navigate(isAdmin ? '/admin/dashboard' : '/staff/dashboard', { replace: true });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Verification Error", description: error.message });
    }
  }

  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0C1222]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-lg">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-white/50" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ backgroundColor: '#0C1222' }}>
      {/* Left Panel — Dark Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0C1222] via-[#131B2E] to-[#1A1040]" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '64px 64px',
          }}
        />
        {/* Accent glows */}
        <div className="absolute top-1/4 left-1/3 w-72 h-72 bg-rose-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-60 h-60 bg-violet-500/10 rounded-full blur-[100px]" />

        <div className="relative z-10 p-16 xl:p-24 flex flex-col justify-between w-full">
          <div>
            <div className="flex items-center gap-3 mb-20">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                <Stethoscope className="h-5 w-5 text-white/80" />
              </div>
              <span className="font-display text-xl font-bold text-white/90">MediConnect</span>
            </div>

            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/10 border border-rose-500/20 px-4 py-1.5 text-sm text-rose-400">
                <ShieldCheck className="h-4 w-4" />
                Operations Portal
              </div>
              <h1 className="font-display text-4xl xl:text-5xl font-bold text-white leading-[1.15]">
                Internal
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-orange-400">
                  Operations Hub
                </span>
              </h1>
              <p className="text-lg text-white/40 max-w-md leading-relaxed">
                Secure access for administrators and staff. Manage users, audit logs, system health, schedules, and facility operations.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm text-white/25">
            <span>Role-Based Access</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span>Audit Logged</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span>MFA Required</span>
          </div>
        </div>
      </div>

      {/* Right Panel — Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        {/* Subtle background */}
        <div className="absolute top-0 right-0 w-60 h-60 bg-rose-500/5 rounded-full blur-[80px]" />

        <div className="w-full max-w-md relative z-10">
          {/* Back to main site */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors mb-8 group"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            Back to MediConnect
          </button>

          {authStep === "login" && (
            <div className="space-y-6 animate-fade-in">
              {/* Region */}
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-2.5 px-4">
                <div className="flex items-center gap-2 text-sm font-medium text-white/50">
                  <Globe className="h-4 w-4" />
                  <span>Region</span>
                </div>
                <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
                  {(["US", "EU"] as Region[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setSelectedRegion(r)}
                      className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                        selectedRegion === r
                          ? 'bg-rose-500 text-white shadow-sm'
                          : 'text-white/50 hover:text-white/70'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden">
                <div className="p-8 pb-3 text-center">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 mb-5 shadow-lg">
                    <ShieldCheck className="h-7 w-7 text-white" />
                  </div>
                  <h2 className="font-display text-2xl font-bold text-white mb-1.5">Operations Portal</h2>
                  <p className="text-sm text-white/40">Sign in with your admin or staff credentials</p>
                </div>

                <div className="px-8 pb-8">
                  {/* Portal Type Toggle */}
                  <div className="flex gap-2 bg-white/5 rounded-xl p-1 mb-6">
                    <button
                      onClick={() => setPortalType("admin")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        portalType === "admin"
                          ? 'bg-white/10 text-white shadow-sm'
                          : 'text-white/40 hover:text-white/60'
                      }`}
                    >
                      <Building className="h-4 w-4" /> Admin
                    </button>
                    <button
                      onClick={() => setPortalType("staff")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        portalType === "staff"
                          ? 'bg-white/10 text-white shadow-sm'
                          : 'text-white/40 hover:text-white/60'
                      }`}
                    >
                      <Users className="h-4 w-4" /> Staff
                    </button>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/60">Email Address</label>
                      <input
                        type="email"
                        placeholder="admin@mediconnect.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/40 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/60">Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/40 transition-all"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 text-white font-semibold text-sm shadow-lg hover:shadow-rose-500/25 hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Lock className="h-4 w-4" />
                          Authenticate
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </form>

                  <div className="mt-6 pt-5 border-t border-white/5 text-center">
                    <p className="text-xs text-white/25">
                      Patient or Doctor? <button onClick={() => navigate("/auth")} className="text-rose-400/70 hover:text-rose-400 transition-colors font-medium">Use the main portal</button>
                    </p>
                  </div>
                </div>
              </div>

              {/* Security notice */}
              <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <Lock className="h-4 w-4 text-white/25 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-white/30 leading-relaxed">
                  All login attempts are recorded in the audit log. Unauthorized access attempts will trigger a security alert via SNS.
                </p>
              </div>
            </div>
          )}

          {authStep === "mfa-verify" && (
            <div className="space-y-6 animate-fade-in">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden p-8">
                <div className="text-center mb-6">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 mb-5 shadow-lg">
                    <KeyRound className="h-7 w-7 text-white" />
                  </div>
                  <h2 className="font-display text-2xl font-bold text-white mb-1.5">MFA Verification</h2>
                  <p className="text-sm text-white/40">Enter the code from your authenticator app</p>
                </div>

                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="000000"
                    value={otpValue}
                    onChange={e => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    className="w-full h-14 rounded-xl bg-white/5 border border-white/10 px-4 text-center text-2xl text-white font-mono tracking-[0.5em] placeholder:text-white/15 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/40 transition-all"
                    autoFocus
                  />
                  <button
                    onClick={handleMfaVerify}
                    disabled={loading || otpValue.length !== 6}
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 text-white font-semibold text-sm shadow-lg hover:shadow-rose-500/25 hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Continue"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
