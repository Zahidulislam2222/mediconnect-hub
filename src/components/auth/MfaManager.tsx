import React from "react";
import { Shield, Loader2, Copy } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react"; // 🟢 Added import
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface MfaManagerProps {
  authStep: "mfa-setup" | "mfa-verify";
  mfaSetupKey: string;
  email: string; // 🟢 Added email prop
  otpValue: string;
  setOtpValue: (val: string) => void;
  loading: boolean;
  handleMfaSetupConfirm: () => void;
  handleMfaVerifyCode: () => void;
  handleSkip: () => void;
}

export const MfaManager: React.FC<MfaManagerProps> = ({
  authStep,
  mfaSetupKey,
  email,
  otpValue,
  setOtpValue,
  loading,
  handleMfaSetupConfirm,
  handleMfaVerifyCode,
  handleSkip
}) => {
  const { toast } = useToast();
  
  // 🟢 Generate the URI that Authenticator apps scan
  const qrCodeUri = `otpauth://totp/MediConnect:${email || 'User'}?secret=${mfaSetupKey}&issuer=MediConnect`;

  const copyKey = () => {
    navigator.clipboard.writeText(mfaSetupKey);
    toast({ title: "Key Copied", description: "You can now paste it manually." });
  };

  return (
    <div className="animate-in fade-in zoom-in duration-300">
      {/* 🟢 PHASE 1: MFA SETUP (QR CODE ADDED HERE) */}
      {authStep === "mfa-setup" && (
        <Card className="shadow-elevated border-border/50">
          <CardHeader className="text-center pb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mx-auto mb-4">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl font-bold">Secure Your Account</CardTitle>
            <CardDescription className="text-xs">
              Scan this QR code in Google Authenticator or Authy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* 🟢 QR CODE SECTION */}
            <div className="flex flex-col items-center justify-center bg-white p-4 rounded-xl border-2 border-slate-100 shadow-inner mx-auto w-fit">
              <QRCodeCanvas 
                value={qrCodeUri} 
                size={180} 
                level="H" 
                includeMargin={true}
              />
            </div>

            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground text-center uppercase font-bold tracking-tighter">
                Or manual setup key:
              </p>
              <div 
                onClick={copyKey}
                className="group relative p-2 bg-slate-50 rounded text-[9px] font-mono break-all text-center border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
              >
                {mfaSetupKey}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-slate-100/90 rounded transition-opacity">
                   <Copy className="h-3 w-3 mr-1" /> Copy Key
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-3">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                Verification Code
              </span>
              <InputOTP 
                maxLength={6} 
                value={otpValue} 
                onChange={setOtpValue}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                  <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button 
              onClick={handleMfaSetupConfirm} 
              className="w-full bg-primary hover:bg-primary/90 shadow-md" 
              disabled={loading || otpValue.length !== 6}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verify & Enable MFA"}
            </Button>

            <Button variant="ghost" className="w-full text-muted-foreground text-[10px]" onClick={handleSkip}>
              Skip Verification (Demo Mode)
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 🟢 PHASE 2: MFA VERIFY (Unchanged) */}
      {authStep === "mfa-verify" && (
        <Card className="shadow-elevated border-border/50">
          <CardHeader className="text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mx-auto mb-4">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl font-bold">Two-Factor Auth</CardTitle>
            <CardDescription>
              Open your authenticator app and enter the code.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center py-2">
              <InputOTP 
                maxLength={6} 
                value={otpValue} 
                onChange={setOtpValue}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                  <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button 
              onClick={handleMfaVerifyCode} 
              className="w-full bg-primary hover:bg-primary/90 shadow-md" 
              disabled={loading || otpValue.length !== 6}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sign In Securely"}
            </Button>

            <Button variant="ghost" className="w-full text-muted-foreground text-[10px]" onClick={handleSkip}>
              Skip Verification (Demo Mode)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};