import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from 'aws-amplify/auth';
import {
  Users,
  UserCheck,
  Stethoscope,
  DollarSign,
  Calendar,
  Activity,
  ShieldCheck,
  TrendingUp
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { getUser, clearAllSensitive } from "@/lib/secure-storage";

// --- Types ---

interface OverviewData {
  patients: { total: number; verified: number; unverified: number };
  doctors: { total: number; approved: number; pending: number; suspended: number };
  appointments: { total: number };
}

interface RevenueData {
  totalRevenue: number;
  totalRefunds: number;
  netRevenue: number;
  transactionCount: number;
}

interface AppointmentAnalytics {
  total: number;
  byStatus: Record<string, number>;
}

type RevenuePeriod = "7d" | "30d" | "90d" | "1y" | "all";

// --- Skeleton ---

const SkeletonMetric = () => (
  <div className="animate-pulse space-y-2">
    <div className="h-8 w-24 bg-slate-200 rounded"></div>
    <div className="h-4 w-32 bg-slate-100 rounded"></div>
  </div>
);

const SkeletonCard = () => (
  <Card className="shadow-card border-border/50">
    <CardHeader className="pb-2">
      <div className="h-4 w-28 bg-slate-100 rounded animate-pulse"></div>
    </CardHeader>
    <CardContent>
      <SkeletonMetric />
    </CardContent>
  </Card>
);

const SkeletonTable = () => (
  <div className="animate-pulse space-y-3">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="flex justify-between items-center py-2">
        <div className="h-4 w-24 bg-slate-100 rounded"></div>
        <div className="h-4 w-12 bg-slate-200 rounded"></div>
      </div>
    ))}
  </div>
);

// --- Helpers ---

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat("en-US").format(value);
};

const PERIOD_LABELS: Record<RevenuePeriod, string> = {
  "7d": "7 Days",
  "30d": "30 Days",
  "90d": "90 Days",
  "1y": "1 Year",
  "all": "All Time",
};

const STATUS_LABELS: Record<string, string> = {
  BOOKED: "Booked",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
  IN_PROGRESS: "In Progress",
  REJECTED: "Rejected",
};

const STATUS_COLORS: Record<string, string> = {
  BOOKED: "bg-blue-100 text-blue-800",
  CONFIRMED: "bg-indigo-100 text-indigo-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-red-100 text-red-800",
  NO_SHOW: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-violet-100 text-violet-800",
  REJECTED: "bg-gray-100 text-gray-800",
};

// --- Component ---

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [appointmentAnalytics, setAppointmentAnalytics] = useState<AppointmentAnalytics | null>(null);
  const [revenuePeriod, setRevenuePeriod] = useState<RevenuePeriod>("30d");
  const [isLoading, setIsLoading] = useState(true);
  const [isRevenueLoading, setIsRevenueLoading] = useState(false);

  const [adminProfile] = useState(() => {
    const saved = getUser();
    return saved || { name: "Admin", role: "admin", avatar: "" };
  });

  // --- Initial Data Load ---

  useEffect(() => {
    loadDashboardData();
  }, []);

  // --- Revenue Period Change ---

  useEffect(() => {
    if (!isLoading) {
      loadRevenue(revenuePeriod);
    }
  }, [revenuePeriod]);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      const [overviewData, revenueData, appointmentData] = await Promise.all([
        api.get("/api/v1/admin/analytics/overview"),
        api.get(`/api/v1/admin/analytics/revenue?period=${revenuePeriod}`),
        api.get("/api/v1/admin/analytics/appointments"),
      ]);

      setOverview(overviewData);
      setRevenue(revenueData);
      setAppointmentAnalytics(appointmentData);
    } catch (error: any) {
      handleApiError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRevenue = async (period: RevenuePeriod) => {
    try {
      setIsRevenueLoading(true);
      const revenueData = await api.get(`/api/v1/admin/analytics/revenue?period=${period}`);
      setRevenue(revenueData);
    } catch (error: any) {
      handleApiError(error);
    } finally {
      setIsRevenueLoading(false);
    }
  };

  const handleApiError = (error: any) => {
    console.error("Admin Dashboard Error:", error);
    const msg = error?.message || String(error);

    if (msg.includes("401")) {
      clearAllSensitive();
      navigate("/auth");
    } else {
      toast({ variant: "destructive", title: "Error", description: msg });
    }
  };

  const handleLogout = async () => {
    await signOut();
    clearAllSensitive();
    navigate("/auth");
  };

  // --- KPI Card Component ---

  const KpiCard = ({
    title,
    value,
    subtitle,
    icon: Icon,
    iconColor = "text-blue-600",
    iconBg = "bg-blue-50",
    loading: cardLoading,
  }: {
    title: string;
    value: string;
    subtitle: string;
    icon: React.ElementType;
    iconColor?: string;
    iconBg?: string;
    loading: boolean;
  }) => (
    <Card className="shadow-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
          {title}
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {cardLoading ? (
          <SkeletonMetric />
        ) : (
          <>
            <div className="text-3xl font-bold text-slate-900">{value}</div>
            <div className={`flex items-center text-xs ${iconColor} mt-2 font-medium ${iconBg} w-fit px-2 py-1 rounded-full`}>
              {subtitle}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout
      title={`Welcome, ${adminProfile.name}`}
      subtitle="Platform administration overview"
      userRole="admin"
      userName={adminProfile.name}
      userAvatar={adminProfile.avatar || ""}
      onLogout={handleLogout}
    >
      <div className="space-y-6 animate-fade-in pb-10">

        {/* 1. KPI METRICS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total Patients"
            value={overview ? formatNumber(overview.patients.total) : "0"}
            subtitle={overview ? `${formatNumber(overview.patients.unverified)} unverified` : "Loading..."}
            icon={Users}
            iconColor="text-blue-600"
            iconBg="bg-blue-50"
            loading={isLoading}
          />
          <KpiCard
            title="Verified Patients"
            value={overview ? formatNumber(overview.patients.verified) : "0"}
            subtitle="Identity confirmed"
            icon={UserCheck}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50"
            loading={isLoading}
          />
          <KpiCard
            title="Total Doctors"
            value={overview ? formatNumber(overview.doctors.total) : "0"}
            subtitle={overview ? `${formatNumber(overview.doctors.suspended)} suspended` : "Loading..."}
            icon={Stethoscope}
            iconColor="text-violet-600"
            iconBg="bg-violet-50"
            loading={isLoading}
          />
          <KpiCard
            title="Approved Doctors"
            value={overview ? formatNumber(overview.doctors.approved) : "0"}
            subtitle="Credentialed & active"
            icon={ShieldCheck}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50"
            loading={isLoading}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Pending Doctors"
            value={overview ? formatNumber(overview.doctors.pending) : "0"}
            subtitle="Awaiting approval"
            icon={Activity}
            iconColor="text-amber-600"
            iconBg="bg-amber-50"
            loading={isLoading}
          />
          <KpiCard
            title="Total Appointments"
            value={overview ? formatNumber(overview.appointments.total) : "0"}
            subtitle="All time"
            icon={Calendar}
            iconColor="text-indigo-600"
            iconBg="bg-indigo-50"
            loading={isLoading}
          />
          <KpiCard
            title="Net Revenue"
            value={revenue ? formatCurrency(revenue.netRevenue) : "$0.00"}
            subtitle={`Period: ${PERIOD_LABELS[revenuePeriod]}`}
            icon={DollarSign}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50"
            loading={isLoading}
          />
          <KpiCard
            title="Transaction Count"
            value={revenue ? formatNumber(revenue.transactionCount) : "0"}
            subtitle={`Period: ${PERIOD_LABELS[revenuePeriod]}`}
            icon={TrendingUp}
            iconColor="text-blue-600"
            iconBg="bg-blue-50"
            loading={isLoading}
          />
        </div>

        {/* 2. DETAILED SECTIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Revenue Breakdown */}
          <Card className="shadow-card border-border/50">
            <CardHeader className="pb-3 border-b mb-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-emerald-600" />
                    Revenue Breakdown
                  </CardTitle>
                  <CardDescription>Financial summary for the selected period</CardDescription>
                </div>
                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                  {(Object.keys(PERIOD_LABELS) as RevenuePeriod[]).map((period) => (
                    <button
                      key={period}
                      onClick={() => setRevenuePeriod(period)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        revenuePeriod === period
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-muted-foreground hover:text-slate-900"
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading || isRevenueLoading ? (
                <SkeletonTable />
              ) : revenue ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Total Revenue</span>
                    <span className="text-sm font-semibold text-slate-900">
                      {formatCurrency(revenue.totalRevenue)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Total Refunds</span>
                    <span className="text-sm font-semibold text-red-600">
                      -{formatCurrency(revenue.totalRefunds)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Net Revenue</span>
                    <span className="text-lg font-bold text-emerald-600">
                      {formatCurrency(revenue.netRevenue)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-muted-foreground">Transactions</span>
                    <span className="text-sm font-semibold text-slate-900">
                      {formatNumber(revenue.transactionCount)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p>No revenue data available.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Appointment Status Breakdown */}
          <Card className="shadow-card border-border/50">
            <CardHeader className="pb-3 border-b mb-3">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-600" />
                  Appointment Breakdown
                </CardTitle>
                <CardDescription>Distribution by current status</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <SkeletonTable />
              ) : appointmentAnalytics && appointmentAnalytics.byStatus ? (
                <div className="space-y-3">
                  {Object.entries(appointmentAnalytics.byStatus)
                    .sort(([, a], [, b]) => b - a)
                    .map(([status, count]) => {
                      const total = appointmentAnalytics.total || 1;
                      const percentage = ((count / total) * 100).toFixed(1);
                      const colorClass = STATUS_COLORS[status] || "bg-gray-100 text-gray-800";

                      return (
                        <div key={status} className="flex items-center justify-between py-2 border-b border-border/50 last:border-b-0">
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colorClass}`}>
                              {STATUS_LABELS[status] || status}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-slate-400 rounded-full transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-semibold text-slate-900 w-12 text-right">
                              {formatNumber(count)}
                            </span>
                            <span className="text-xs text-muted-foreground w-14 text-right">
                              {percentage}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  <div className="flex justify-between items-center pt-3 mt-2 border-t border-border">
                    <span className="text-sm font-medium text-slate-900">Total</span>
                    <span className="text-sm font-bold text-slate-900">
                      {formatNumber(appointmentAnalytics.total)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p>No appointment data available.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
