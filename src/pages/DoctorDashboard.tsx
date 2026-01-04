import { useNavigate } from "react-router-dom";
import {
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  Shield,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PatientQueueCard } from "@/components/dashboard/PatientQueueCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { patientQueue, revenueData, currentDoctor } from "@/lib/mockData";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

export default function DoctorDashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate("/");
  };

  const todayStats = {
    patientsToday: 12,
    completed: 8,
    pending: 4,
    avgWaitTime: "14 min",
  };

  const totalRevenue = revenueData.reduce((sum, item) => sum + item.revenue, 0);
  const totalConsultations = revenueData.reduce((sum, item) => sum + item.consultations, 0);

  return (
    <DashboardLayout
      title="Provider Dashboard"
      subtitle="Welcome back, Dr. Chen"
      userRole="doctor"
      userName={currentDoctor.name}
      userAvatar={currentDoctor.avatar}
      onLogout={handleLogout}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-card border-border/50">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Patients Today</p>
                  <p className="text-3xl font-bold text-foreground">{todayStats.patientsToday}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="flex items-center gap-1 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  {todayStats.completed} completed
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">{todayStats.pending} pending</span>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-border/50">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Wait Time</p>
                  <p className="text-3xl font-bold text-foreground">{todayStats.avgWaitTime}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
                  <Clock className="h-6 w-6 text-accent" />
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Target: under 15 min
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card border-border/50">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                  <p className="text-3xl font-bold text-foreground">
                    ${(totalRevenue / 1000).toFixed(1)}k
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                  <DollarSign className="h-6 w-6 text-success" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-sm text-success">
                <TrendingUp className="h-4 w-4" />
                +12.5% vs last quarter
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-border/50">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Credential Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="bg-success/10 text-success border-success/30">
                      <Shield className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  </div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                  <Shield className="h-6 w-6 text-success" />
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                License: {currentDoctor.licenseNumber}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Patient Queue */}
          <Card className="shadow-card border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Patient Queue</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {patientQueue.length} waiting
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin">
              {patientQueue.map((patient) => (
                <PatientQueueCard
                  key={patient.id}
                  name={patient.name}
                  age={patient.age}
                  condition={patient.condition}
                  waitTime={patient.waitTime}
                  priority={patient.priority as any}
                  avatar={patient.avatar}
                  vitals={patient.vitals}
                  onStartConsultation={() => navigate("/consultation")}
                />
              ))}
            </CardContent>
          </Card>

          {/* Revenue Analytics */}
          <Card className="shadow-card border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Revenue Analytics</CardTitle>
                <span className="text-sm text-muted-foreground">Last 6 months</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs fill-muted-foreground" />
                    <YAxis
                      className="text-xs fill-muted-foreground"
                      tickFormatter={(val) => `$${val / 1000}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#revenueGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="h-[150px]">
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  Consultations per Month
                </p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs fill-muted-foreground" />
                    <YAxis className="text-xs fill-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="consultations" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
