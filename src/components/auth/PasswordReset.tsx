import React from "react";
import { KeyRound, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PasswordResetProps {
  authStep: "forgot-password" | "reset-password";
  email: string;
  setEmail: (val: string) => void;
  otpValue: string;
  setOtpValue: (val: string) => void;
  newPassword: string;
  setNewPassword: (val: string) => void;
  loading: boolean;
  handleForgotPassword: () => void;
  handleResetSubmit: () => void;
  setAuthStep: (step: any) => void;
}

export const PasswordReset: React.FC<PasswordResetProps> = ({
  authStep,
  email,
  setEmail,
  otpValue,
  setOtpValue,
  newPassword,
  setNewPassword,
  loading,
  handleForgotPassword,
  handleResetSubmit,
  setAuthStep
}) => {
  return (
    <div className="animate-in fade-in zoom-in duration-300">
      {/* 🟢 PHASE 1: REQUEST RESET CODE */}
      {authStep === "forgot-password" && (
        <Card className="shadow-elevated border-border/50">
          <CardHeader className="text-center pb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mx-auto mb-4">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
            <CardDescription>
              Enter your registered email address and we'll send you a 6-digit recovery code.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email Address</Label>
              <Input 
                id="reset-email"
                type="email" 
                placeholder="name@example.com"
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                className="bg-slate-50/50"
              />
            </div>
            
            <Button 
              onClick={handleForgotPassword} 
              className="w-full bg-primary hover:bg-primary/90 shadow-md" 
              disabled={loading || !email}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Send Recovery Code"}
            </Button>
            
            <Button 
              variant="link" 
              className="w-full text-xs text-muted-foreground" 
              onClick={() => setAuthStep("login")}
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 🟢 PHASE 2: CONFIRM RESET & SET NEW PASSWORD */}
      {authStep === "reset-password" && (
        <Card className="shadow-elevated border-border/50">
          <CardHeader className="text-center pb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 mx-auto mb-4">
              <KeyRound className="h-6 w-6 text-emerald-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">New Password</CardTitle>
            <CardDescription>
              Enter the verification code sent to <span className="font-semibold text-slate-900">{email}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center gap-3">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Verification Code</Label>
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

            <div className="space-y-2">
              <Label htmlFor="new-password">Enter New Password</Label>
              <Input 
                id="new-password"
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                required 
                className="bg-slate-50/50"
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-3">
              <Button 
                onClick={handleResetSubmit} 
                className="w-full bg-primary hover:bg-primary/90 shadow-md" 
                disabled={loading || otpValue.length !== 6 || !newPassword}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Update Password"}
              </Button>
              
              <Button 
                variant="ghost" 
                className="w-full text-xs text-muted-foreground" 
                onClick={() => setAuthStep("login")}
              >
                Cancel and return to login
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};