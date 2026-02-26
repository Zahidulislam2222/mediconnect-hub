import React, { useState } from "react";
import { Shield, Camera, CheckCircle2, ScanLine, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox"; 
import { Label } from "@/components/ui/label"; 

interface IdentityVerificationProps {
  selfieImage: string | null;
  idImage: string | null;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>, type: 'selfie' | 'id') => void;
  handleSubmitIdentity: () => void;
  loading: boolean;
  imageProcessing: boolean;
  verificationStatus: "idle" | "verifying" | "success" | "failed";
  statusMessage: string;
  handleSkip: () => void;
}

export const IdentityVerification: React.FC<IdentityVerificationProps> = ({
  
  selfieImage,
  idImage,
  handleFileChange,
  handleSubmitIdentity,
  loading,
  imageProcessing,
  verificationStatus,
  statusMessage,
  handleSkip
}) => {
  const [biometricConsent, setBiometricConsent] = useState(false);
  return (
    <Card className="shadow-elevated border-border/50 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardHeader className="text-center pb-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto mb-4">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold">Identity Verification</CardTitle>
        <CardDescription>
          We need to verify that your face matches your government-issued ID.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Dynamic Status Feedback */}
        {statusMessage && (
          <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-xs text-center font-medium border border-blue-100">
            {statusMessage}
          </div>
        )}

        {/* 1. Selfie Upload Slot */}
        <div className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer",
          selfieImage ? "border-success bg-success/5" : "border-border hover:border-primary hover:bg-slate-50"
        )}>
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
                <span className="font-semibold text-sm">Selfie Captured</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Camera className="h-8 w-8 mb-1" />
                <span className="font-medium text-sm">Take a Live Selfie</span>
                <span className="text-[10px] uppercase tracking-wider">Face must be clearly visible</span>
              </div>
            )}
          </label>
        </div>

        {/* 2. ID Card Upload Slot */}
        <div className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer",
          idImage ? "border-success bg-success/5" : "border-border hover:border-primary hover:bg-slate-50"
        )}>
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
                <span className="font-semibold text-sm">Document Uploaded</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <ScanLine className="h-8 w-8 mb-1" />
                <span className="font-medium text-sm">Upload Government ID</span>
                <span className="text-[10px] uppercase tracking-wider">Passport or License</span>
              </div>
            )}
          </label>
        </div>

        {/* 🟢 NEW: Explicit Biometric Consent Checkbox */}
        {(selfieImage && idImage) && (
          <div className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-slate-50 mt-4 shadow-sm">
            <Checkbox 
              id="biometric-consent" 
              checked={biometricConsent} 
              onCheckedChange={(c) => setBiometricConsent(c as boolean)} 
            />
            <div className="space-y-1 leading-none">
              <Label htmlFor="biometric-consent" className="text-sm font-medium leading-none cursor-pointer">
                I consent to AI Biometric Processing
              </Label>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                I explicitly agree to let MediConnect use AI facial recognition to compare my selfie and ID. I understand my ID image will be permanently deleted after 24 hours.
              </p>
            </div>
          </div>
        )}

        {/* Processing Indicator */}
        {imageProcessing && (
          <div className="text-xs text-center text-muted-foreground flex items-center justify-center gap-2 py-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Optimizing image for AI scan...
          </div>
        )}

        {/* Status Badges */}
        {verificationStatus === 'success' && (
          <div className="p-3 bg-green-100 text-green-800 rounded-lg flex items-center justify-center gap-2 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" /> Identity Verified Successfully!
          </div>
        )}
        {verificationStatus === 'failed' && (
          <div className="p-3 bg-red-100 text-red-800 rounded-lg flex items-center justify-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-4 w-4" /> Verification Failed. Please retry.
          </div>
        )}

        <Button
          onClick={handleSubmitIdentity}
          className="w-full bg-primary hover:bg-primary/90 shadow-md"
          disabled={loading || imageProcessing || !selfieImage || !idImage || !biometricConsent} 
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> 
              <span>Analyzing Biometrics...</span>
            </div>
          ) : (
            "Verify Identity"
          )}
        </Button>

        <Button 
          variant="ghost" 
          className="w-full text-muted-foreground text-xs" 
          onClick={handleSkip}
          disabled={loading}
        >
          Skip Verification (Demo Mode)
        </Button>
      </CardContent>
    </Card>
  );
};