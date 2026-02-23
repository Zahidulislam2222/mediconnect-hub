import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface SettingsSkeletonProps {
  userRole: "patient" | "doctor";
}

export const SettingsSkeleton: React.FC<SettingsSkeletonProps> = ({ userRole }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10 animate-pulse">
      {/* 1. Profile Header Skeleton - Matches ProfileInformationCard */}
      <div className="rounded-xl border border-border/50 bg-card p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        
        <div className="flex items-center gap-6 pb-6 border-b border-border/40">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={`profile-field-${i}`} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* 2. Doctor Professional Skeleton - Matches DoctorProfessionalCard */}
      {userRole === 'doctor' && (
        <div className="rounded-xl border border-border/50 bg-card p-6 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
          <Skeleton className="h-32 w-full rounded-md" />
        </div>
      )}

      {/* 3. Schedule Skeleton - Matches DoctorScheduleCard */}
      {userRole === 'doctor' && (
        <div className="rounded-xl border border-border/50 bg-card p-6 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-60" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={`schedule-row-${i}`} className="flex items-center justify-between p-4 border border-border/20 rounded-xl">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-5 w-10 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-28 rounded-md" />
                  <Skeleton className="h-9 w-28 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Notifications/Integrations Skeleton - Matches IntegrationsAndAlertsCard */}
      <div className="space-y-6">
        <div className="rounded-xl border border-border/50 bg-card p-6 space-y-6">
          <Skeleton className="h-6 w-32" />
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-64" /></div>
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
            <div className="flex justify-between items-center">
              <div className="space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-64" /></div>
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
          </div>
        </div>
        
        {userRole === 'doctor' && (
          <div className="rounded-xl border border-border/50 bg-card p-6">
            <div className="flex items-center justify-between p-5 border border-border/20 rounded-xl">
               <div className="flex items-center gap-5">
                  <Skeleton className="h-14 w-14 rounded-full" />
                  <div className="space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-60" /></div>
               </div>
               <Skeleton className="h-10 w-32 rounded-md" />
            </div>
          </div>
        )}
      </div>

      {/* 5. Sticky Action Bar Skeleton */}
      <div className="flex justify-end pt-4 sticky bottom-6 z-10">
        <div className="bg-background/80 backdrop-blur-sm p-2 rounded-xl border border-border/50 flex gap-4">
          <Skeleton className="h-10 w-24 rounded-md" />
          <Skeleton className="h-10 w-40 rounded-md" />
        </div>
      </div>
    </div>
  );
};