import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut, fetchUserAttributes } from 'aws-amplify/auth';
import {
  Heart,
  Activity,
  Droplets,
  Wind,
  Calendar,
  Brain,
  Pill,
  Plus,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { VitalCard } from "@/components/dashboard/VitalCard";
import { AppointmentCard } from "@/components/dashboard/AppointmentCard";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { patientVitals, upcomingAppointments } from "@/lib/mockData";

export default function PatientDashboard() {
  const navigate = useNavigate();

  // State to hold Real User Data
  const [realName, setRealName] = useState("Loading...");
  const [realAvatar, setRealAvatar] = useState("..");

  // 1. Fetch the Real User from AWS Cognito on Load
  useEffect(() => {
    async function getUserData() {
      try {
        const attributes = await fetchUserAttributes();

        // --- FIX: Check for Name FIRST, then Email ---
        const displayName = attributes.name || attributes.email || "Patient";

        setRealName(displayName);
        // Create Initials
        setRealAvatar(displayName.substring(0, 2).toUpperCase());

      } catch (error) {
        console.error("Error fetching user:", error);
        setRealName("Guest User");
      }
    }
    getUserData();
  }, []);

  // 2. Real AWS Logout
  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/auth");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <DashboardLayout
      // --- FIX: Use the full name in the title ---
      title={`Welcome, ${realName}`}
      subtitle="Here's an overview of your health today"
      userRole="patient"
      userName={realName}
      userAvatar={realAvatar}
      onLogout={handleLogout}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Vitals Grid (IoT Simulation) */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Your Vitals (IoT Live Stream)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <VitalCard
              title="Heart Rate"
              value={patientVitals.heartRate.current}
              unit={patientVitals.heartRate.unit}
              status={patientVitals.heartRate.status as any}
              change={patientVitals.heartRate.change}
              trend={patientVitals.heartRate.trend}
              icon={<Heart className="h-5 w-5" />}
              color="red"
            />
            <VitalCard
              title="Blood Pressure"
              value={`${patientVitals.bloodPressure.systolic}/${patientVitals.bloodPressure.diastolic}`}
              unit={patientVitals.bloodPressure.unit}
              status={patientVitals.bloodPressure.status as any}
              change={patientVitals.bloodPressure.change}
              trend={patientVitals.bloodPressure.trend}
              icon={<Activity className="h-5 w-5" />}
              color="blue"
            />
            <VitalCard
              title="Blood Glucose"
              value={patientVitals.glucose.current}
              unit={patientVitals.glucose.unit}
              status={patientVitals.glucose.status as any}
              change={patientVitals.glucose.change}
              trend={patientVitals.glucose.trend}
              icon={<Droplets className="h-5 w-5" />}
              color="purple"
            />
            <VitalCard
              title="Oxygen Saturation"
              value={patientVitals.spO2.current}
              unit={patientVitals.spO2.unit}
              status={patientVitals.spO2.status as any}
              change={patientVitals.spO2.change}
              trend={patientVitals.spO2.trend}
              icon={<Wind className="h-5 w-5" />}
              color="teal"
            />
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Appointments List */}
          <Card className="lg:col-span-2 shadow-card border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Upcoming Appointments</CardTitle>
                <button
                  onClick={() => navigate("/appointments")}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  View all
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingAppointments.map((apt) => (
                <AppointmentCard
                  key={apt.id}
                  doctor={apt.doctor}
                  specialty={apt.specialty}
                  date={apt.date}
                  time={apt.time}
                  type={apt.type as any}
                  avatar={apt.avatar}
                  status={apt.status as any}
                  onJoin={() => navigate("/consultation")}
                />
              ))}
            </CardContent>
          </Card>

          {/* Quick Actions Panel */}
          <Card className="shadow-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <ActionButton
                icon={<Calendar className="h-5 w-5" />}
                label="Book"
                description="Appointment"
                onClick={() => navigate("/appointments")}
                variant="primary"
              />
              <ActionButton
                icon={<Brain className="h-5 w-5" />}
                label="Check"
                description="Symptoms"
                onClick={() => navigate("/symptom-checker")}
                variant="accent"
              />
              <ActionButton
                icon={<Pill className="h-5 w-5" />}
                label="Refill"
                description="Prescription"
                onClick={() => navigate("/pharmacy")}
              />
              <ActionButton
                icon={<Plus className="h-5 w-5" />}
                label="Upload"
                description="Documents"
                onClick={() => navigate("/records")}
              />
            </CardContent>
          </Card>
        </div>

        {/* Marketing/Health Tip Banner */}
        <Card className="medical-gradient text-white shadow-elevated border-0 overflow-hidden">
          <CardContent className="py-6 relative">
            <div className="absolute right-0 top-0 w-64 h-full opacity-10">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                <path
                  fill="currentColor"
                  d="M100,10 L120,40 L160,40 L130,60 L140,100 L100,80 L60,100 L70,60 L40,40 L80,40 Z"
                />
              </svg>
            </div>
            <div className="relative z-10">
              <h3 className="text-xl font-bold mb-2">Stay Healthy This Winter</h3>
              <p className="text-white/90 text-sm max-w-lg">
                Remember to get your flu shot, stay hydrated, and maintain good hand hygiene.
                Check out our Knowledge Base for more health tips.
              </p>
              <button
                onClick={() => navigate("/knowledge")}
                className="mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
              >
                Learn More
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}