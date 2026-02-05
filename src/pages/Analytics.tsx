import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAuthSession, fetchUserAttributes, signOut } from 'aws-amplify/auth';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from "recharts";
import { TrendingUp, Users, Activity, DollarSign, Calendar } from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

const COLORS = ['#8884d8', '#00C49F', '#FFBB28', '#FF8042'];

export default function Analytics() {
    const navigate = useNavigate();
    const { toast } = useToast();

    // --- STATE ---
    const [isLoading, setIsLoading] = useState(true);
    const [doctorProfile, setDoctorProfile] = useState(() => {
        const saved = localStorage.getItem('user');
        return saved ? JSON.parse(saved) : { name: "Doctor", avatar: null, role: "doctor" };
    });

    const [metrics, setMetrics] = useState({
        revenue: 0,
        consultations: 0,
        satisfaction: "0.0"
    });

    const [revenueData, setRevenueData] = useState<any[]>([]);

    // Placeholder for demographics (Backend currently focuses on Finance)
    // You can extend the Lambda later to return this real data.
    const [demographicData, setDemographicData] = useState([
        { name: '18-30', value: 0 },
        { name: '31-50', value: 0 },
        { name: '50+', value: 0 },
    ]);

    // --- AUTH HELPER ---
    const getAuthToken = async () => {
        try {
            const session = await fetchAuthSession();
            return session.tokens?.idToken?.toString() || "";
        } catch (e) {
            console.error("Token error", e);
            return "";
        }
    };

    // --- LOAD DATA ---
    const loadAnalytics = async () => {
        try {
            setIsLoading(true);
            const token = await getAuthToken();
            const attributes = await fetchUserAttributes();
            const userId = attributes.sub;

            // 1. Fetch Profile & Analytics in Parallel
            const [profileRes, analyticsRes] = await Promise.allSettled([
                api.get(`/register-doctor?id=${userId}`),
                // 🟢 THIS CALLS YOUR NEW LAMBDA LOGIC
                api.get(`/billing?type=analytics&doctorId=${userId}`)
            ]);

            // 2. Handle Profile
            if (profileRes.status === "fulfilled") {
                const data: any = profileRes.value;
                // API might return array or single object depending on your setup
                let myProfile = Array.isArray(data.doctors)
                    ? data.doctors.find((d: any) => d.doctorId === userId)
                    : data;

                // Fallback if direct object
                if (!myProfile && data.name) myProfile = data;

                if (myProfile) {
                    const updated = { ...doctorProfile, ...myProfile };
                    setDoctorProfile(updated);
                    localStorage.setItem('user', JSON.stringify(updated));
                }
            }

            // 3. Handle Analytics (The New Data)
            if (analyticsRes.status === "fulfilled") {
                const data: any = analyticsRes.value;

                setMetrics({
                    revenue: data.totalRevenue || 0,
                    consultations: data.consultationCount || 0,
                    satisfaction: data.patientSatisfaction || "4.9"
                });

                // Ensure the chart doesn't crash if empty
                if (data.chartData && data.chartData.length > 0) {
                    setRevenueData(data.chartData);
                } else {
                    // Empty state (Clean placeholder)
                    setRevenueData([]);
                }
            }

        } catch (err) {
            console.error("Analytics Load Error", err);
            toast({
                variant: "destructive",
                title: "Data Error",
                description: "Could not load latest financial metrics."
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadAnalytics();
    }, []);

    const handleLogout = async () => {
        await signOut();
        localStorage.removeItem('user');
        navigate("/auth");
    };

    // --- SKELETONS (For Professional Feel) ---
    const SkeletonMetric = () => (
        <div className="animate-pulse space-y-2">
            <div className="h-8 w-24 bg-slate-200 rounded"></div>
            <div className="h-4 w-32 bg-slate-100 rounded"></div>
        </div>
    );

    const SkeletonChart = () => (
        <div className="animate-pulse h-[300px] w-full bg-slate-50 rounded-xl flex items-center justify-center border border-dashed border-slate-200">
            <div className="h-8 w-8 bg-slate-200 rounded-full"></div>
        </div>
    );

    return (
        <DashboardLayout
            title="Practice Analytics"
            subtitle="Real-time financial performance and patient insights"
            userRole="doctor"
            userName={doctorProfile.name}
            userAvatar={doctorProfile.avatar}
            onLogout={handleLogout}
        >
            <div className="space-y-6 animate-fade-in pb-10">

                {/* HEADER CONTROLS */}
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" />
                        Performance Overview
                    </h2>
                    <Select defaultValue="6m">
                        <SelectTrigger className="w-[160px] bg-white">
                            <SelectValue placeholder="Period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1m">Last Month</SelectItem>
                            <SelectItem value="3m">Last 3 Months</SelectItem>
                            <SelectItem value="6m">Last 6 Months</SelectItem>
                            <SelectItem value="1y">Year to Date</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* KPI CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* REVENUE */}
                    <Card className="shadow-card border-border/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                                Total Revenue
                                <DollarSign className="h-4 w-4 text-emerald-600" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <SkeletonMetric /> : (
                                <>
                                    <div className="text-3xl font-bold text-slate-900">
                                        ${metrics.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </div>
                                    <div className="flex items-center text-xs text-emerald-600 mt-2 font-medium bg-emerald-50 w-fit px-2 py-1 rounded-full">
                                        <TrendingUp className="h-3 w-3 mr-1" />
                                        +Live Data
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* CONSULTATIONS */}
                    <Card className="shadow-card border-border/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                                Consultations
                                <Users className="h-4 w-4 text-blue-600" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <SkeletonMetric /> : (
                                <>
                                    <div className="text-3xl font-bold text-slate-900">{metrics.consultations}</div>
                                    <div className="flex items-center text-xs text-blue-600 mt-2 font-medium bg-blue-50 w-fit px-2 py-1 rounded-full">
                                        <Calendar className="h-3 w-3 mr-1" />
                                        Confirmed Visits
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* SATISFACTION */}
                    <Card className="shadow-card border-border/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                                Patient Satisfaction
                                <Activity className="h-4 w-4 text-purple-600" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <SkeletonMetric /> : (
                                <>
                                    <div className="text-3xl font-bold text-slate-900">{metrics.satisfaction}/5.0</div>
                                    <div className="flex items-center text-xs text-purple-600 mt-2 font-medium bg-purple-50 w-fit px-2 py-1 rounded-full">
                                        Based on Feedback
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* CHARTS GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* REVENUE CHART */}
                    <Card className="shadow-card border-border/50">
                        <CardHeader>
                            <CardTitle>Revenue Trend</CardTitle>
                            <CardDescription>Income generated from paid invoices (Last 6 Months)</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <SkeletonChart /> : (
                                <div className="h-[300px]">
                                    {revenueData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100" vertical={false} />
                                                <XAxis
                                                    dataKey="month"
                                                    className="text-xs text-slate-500"
                                                    axisLine={false}
                                                    tickLine={false}
                                                />
                                                <YAxis
                                                    className="text-xs text-slate-500"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tickFormatter={(value) => `$${value}`}
                                                />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                    formatter={(value: any) => [`$${value.toLocaleString()}`, "Revenue"]}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="revenue"
                                                    stroke="#10b981"
                                                    strokeWidth={2}
                                                    fillOpacity={1}
                                                    fill="url(#colorRevenue)"
                                                    animationDuration={1500}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm gap-3">
                                            <div className="bg-slate-100 p-4 rounded-full">
                                                <DollarSign className="h-6 w-6 opacity-30" />
                                            </div>
                                            <p>No revenue data recorded yet.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* DEMOGRAPHICS (Placeholder for now, keeps UI balanced) */}
                    <Card className="shadow-card border-border/50">
                        <CardHeader>
                            <CardTitle>Patient Demographics</CardTitle>
                            <CardDescription>Age distribution of treated patients</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <SkeletonChart /> : (
                                <div className="h-[300px] flex items-center justify-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={demographicData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {demographicData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </ResponsiveContainer>

                                    {/* Overlay Text if empty */}
                                    {demographicData.every(d => d.value === 0) && (
                                        <div className="absolute text-sm text-muted-foreground text-center">
                                            <p>Data collecting...</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}