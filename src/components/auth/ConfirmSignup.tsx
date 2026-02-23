import React from "react";
import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ConfirmSignupProps {
  email: string;
  otpValue: string;
  setOtpValue: (val: string) => void;
  handleVerification: () => void;
  loading: boolean;
  handleSkip: () => void;
}

export const ConfirmSignup: React.FC<ConfirmSignupProps> = ({
  email,
  otpValue,
  setOtpValue,
  handleVerification,
  loading,
  handleSkip
}) => {
  return (
    <Card className="shadow-elevated border-border/50 animate-in fade-in slide-in-from-right-4 duration-500">
      <CardHeader className="text-center pb-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mx-auto mb-4">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold">Verify Email</CardTitle>
        <CardDescription>
          We sent a 6-digit code to <span className="font-semibold text-slate-900">{email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center">
          <InputOTP maxLength={6} value={otpValue} onChange={setOtpValue}>
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

        <div className="space-y-2">
          <Button 
            onClick={handleVerification} 
            className="w-full bg-primary hover:bg-primary/90 shadow-md" 
            disabled={otpValue.length !== 6 || loading}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verify Account"}
          </Button>

          {/* 🟢 DEMO SKIP BUTTON */}
          <Button 
            variant="ghost" 
            className="w-full text-muted-foreground text-xs" 
            onClick={handleSkip}
          >
            Skip Verification (Demo Mode)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};