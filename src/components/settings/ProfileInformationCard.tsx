import React from "react";
import { User, Mail, Phone, MapPin, Camera, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ProfileInformationCardProps {
  formData: {
    name: string;
    email: string;
    phone: string;
    address: string;
    avatar: string;
  };
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  userRole: "patient" | "doctor";
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ProfileInformationCard: React.FC<ProfileInformationCardProps> = ({
  formData,
  setFormData,
  userRole,
  fileInputRef,
  handleFileChange,
}) => {
  
  // FHIR-compliant Initials Helper
  const getInitials = (name: string) => {
    if (!name) return userRole === "doctor" ? "DR" : "PT";
    const parts = name.trim().split(" ");
    return parts.length === 1 
      ? name.substring(0, 2).toUpperCase() 
      : (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
  };

  return (
    <Card className="shadow-card border-border/50 bg-card animate-in fade-in slide-in-from-bottom-2 duration-500">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>
              Update your personal details and public profile photo
            </CardDescription>
          </div>
          <Badge variant={userRole === "doctor" ? "default" : "secondary"} className="uppercase tracking-wider">
            {userRole} Account
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* AVATAR SECTION - HIPAA/GDPR Secure Upload Gate */}
        <div className="flex items-center gap-6 pb-6 border-b border-border/40">
          <div className="relative group">
            <Avatar className="h-24 w-24 border-4 border-background shadow-sm ring-2 ring-muted transition-all group-hover:ring-primary/50">
              <AvatarImage src={formData.avatar} className="object-cover" />
              <AvatarFallback className="text-xl bg-primary/10 text-primary font-bold">
                {getInitials(formData.name)}
              </AvatarFallback>
            </Avatar>
            <div
              className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full shadow-md cursor-pointer hover:bg-primary/90 transition-transform active:scale-95 z-10"
              onClick={() => fileInputRef.current?.click()}
              title="Change Photo"
            >
              <Camera className="h-4 w-4" />
            </div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/jpeg,image/png"
              onChange={handleFileChange}
            />
          </div>
          <div className="space-y-1">
            <h3 className="font-medium text-lg">Profile Picture</h3>
            <p className="text-sm text-muted-foreground">
              JPG or PNG. Max size 2MB. <br />
              <span className="text-xs italic text-primary/70">Secure regional storage active.</span>
            </p>
          </div>
        </div>

        {/* FORM GRID - FHIR Standard Mapping */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Full Name - FHIR: Patient.name / Practitioner.name */}
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="name"
                className="pl-9 focus-visible:ring-primary"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
          </div>

          {/* Email - IMMUTABLE (Security/GDPR Guard) */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative group">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                className="pl-9 pr-9 bg-muted/50 cursor-not-allowed text-muted-foreground border-dashed"
                value={formData.email}
                readOnly
              />
              <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground/50" />
            </div>
          </div>

          {/* Phone - FHIR: Telecom */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                className="pl-9 focus-visible:ring-primary"
                placeholder="+1 (555) 000-0000"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          {/* Address - FHIR: Address */}
          <div className="space-y-2">
            <Label htmlFor="address">
              {userRole === "doctor" ? "Clinic Address" : "Home Address"}
            </Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="address"
                className="pl-9 focus-visible:ring-primary"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder={userRole === "doctor" ? "Medical Center Plaza" : "123 Street Ave"}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};