import React from "react";
import { 
    Stethoscope, 
    BadgeCheck, 
    DollarSign, 
    FileText, 
    Lock 
} from "lucide-react";
import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle, 
    CardDescription 
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface DoctorProfessionalCardProps {
    formData: {
        specialization: string;
        consultationFee: string | number;
        licenseNumber: string;
        bio: string;
    };
    setFormData: React.Dispatch<React.SetStateAction<any>>;
    userRole: "patient" | "doctor";
}

export const DoctorProfessionalCard: React.FC<DoctorProfessionalCardProps> = ({
    formData,
    setFormData,
    userRole
}) => {
    // Safety check: Never render professional medical fields for a patient account
    if (userRole !== "doctor") return null;

    return (
        <Card className="shadow-card border-border/50 animate-in fade-in slide-in-from-bottom-3 duration-600">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Stethoscope className="h-5 w-5 text-primary" />
                    Professional Details
                </CardTitle>
                <CardDescription>
                    Manage your medical credentials and public practice information
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Specialization - FHIR: Practitioner.qualification */}
                    <div className="space-y-2">
                        <Label htmlFor="specialization">Medical Specialization</Label>
                        <div className="relative">
                            <BadgeCheck className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="specialization"
                                className="pl-9 focus-visible:ring-primary"
                                value={formData.specialization}
                                onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                                placeholder="e.g. Cardiology"
                            />
                        </div>
                    </div>

                    {/* Consultation Fee - GDPR Financial Transparency */}
                    <div className="space-y-2">
                        <Label htmlFor="fee">Consultation Fee ($)</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="fee"
                                type="number"
                                className="pl-9 focus-visible:ring-primary"
                                value={formData.consultationFee}
                                onChange={(e) => setFormData({ ...formData, consultationFee: e.target.value })}
                                placeholder="150"
                            />
                        </div>
                    </div>

                    {/* License Number - IMMUTABLE (Security/HIPAA Guard) */}
                    <div className="space-y-2">
                        <Label htmlFor="license">Medical License ID</Label>
                        <div className="relative group">
                            <FileText className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="license"
                                className="pl-9 bg-muted/50 cursor-not-allowed text-muted-foreground border-dashed"
                                value={formData.licenseNumber}
                                readOnly
                                placeholder="VERIFIED_BY_ADMIN"
                            />
                            <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground/50" />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 px-1">
                            Credential modification requires administrative re-verification.
                        </p>
                    </div>
                </div>

                {/* Professional Bio - FHIR Extension Resource */}
                <div className="space-y-2">
                    <Label htmlFor="bio">Professional Bio</Label>
                    <Textarea
                        id="bio"
                        placeholder="Describe your medical experience, education, and clinical focus..."
                        className="min-h-[120px] resize-none focus-visible:ring-primary bg-background/50"
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    />
                    <div className="flex justify-between items-center px-1">
                        <p className="text-xs text-muted-foreground">
                            Visible on your public doctor profile for patients.
                        </p>
                        <span className="text-[10px] uppercase font-semibold text-primary/50 tracking-tighter">
                            FHIR R4 Compliant Field
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};