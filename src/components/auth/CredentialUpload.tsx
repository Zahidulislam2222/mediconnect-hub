import React from "react";
import { FileBadge, ScrollText, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CredentialUploadProps {
  diplomaFile: File | null;
  setDiplomaFile: (file: File | null) => void;
  handleDiplomaUpload: () => void;
  loading: boolean;
  handleSkip: () => void;
}

export const CredentialUpload: React.FC<CredentialUploadProps> = ({
  diplomaFile,
  setDiplomaFile,
  handleDiplomaUpload,
  loading,
  handleSkip
}) => {
  return (
    <Card className="shadow-elevated border-border/50 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardHeader className="text-center pb-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 mx-auto mb-4">
          <FileBadge className="h-8 w-8 text-blue-600" />
        </div>
        <CardTitle className="text-2xl font-bold text-slate-900">Medical Credentials</CardTitle>
        <CardDescription>
          Upload your medical license or degree. Our AI will verify your name and credentials instantly.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* 🟢 File Upload Area */}
        <div className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer group",
          diplomaFile ? "border-blue-500 bg-blue-50/50" : "border-border hover:border-blue-400 hover:bg-slate-50"
        )}>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            id="diploma-upload-input"
            className="hidden"
            onChange={(e) => setDiplomaFile(e.target.files?.[0] || null)}
          />
          <label htmlFor="diploma-upload-input" className="cursor-pointer block">
            {diplomaFile ? (
              <div className="text-blue-700 flex flex-col items-center gap-2">
                <CheckCircle2 className="h-10 w-10 text-blue-600" />
                <div className="space-y-1">
                  <p className="font-bold text-sm truncate max-w-[250px]">{diplomaFile.name}</p>
                  <p className="text-[10px] uppercase font-medium opacity-70">Ready for secure analysis</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-muted-foreground group-hover:text-blue-600 transition-colors">
                <ScrollText className="h-10 w-10 mb-1 opacity-40 group-hover:opacity-100" />
                <div className="space-y-1">
                  <span className="font-semibold text-sm">Select Document</span>
                  <p className="text-[10px] uppercase tracking-tighter opacity-60">Accepted: PDF, JPG, or PNG</p>
                </div>
              </div>
            )}
          </label>
        </div>

        {/* 🟢 HIPAA/GDPR Compliance Note */}
        <p className="text-[10px] text-center text-muted-foreground px-4 leading-relaxed">
          Your documents are encrypted at rest using regional AWS KMS keys and processed strictly within your selected data jurisdiction.
        </p>

        <Button
          onClick={handleDiplomaUpload}
          className="w-full bg-blue-600 hover:bg-blue-700 shadow-md text-white font-semibold py-6"
          disabled={!diplomaFile || loading}
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>AI Analysis in Progress...</span>
            </div>
          ) : (
            "Upload & Finish Verification"
          )}
        </Button>

        {/* 🟢 Demo Mode Escape Hatch */}
        <Button 
          variant="ghost" 
          className="w-full text-muted-foreground text-xs hover:text-blue-600" 
          onClick={handleSkip}
          disabled={loading}
        >
          Skip Verification (Demo Mode)
        </Button>
      </CardContent>
    </Card>
  );
};