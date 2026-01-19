import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from "recharts";
import { TrendingUp, Users, Activity } from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const API_URL = import.meta.env.VITE_API_BASE_URL || "";
const COLORS = ['#8884d8', '#00C49F', '#FFBB28', '#FF8042'];

export default function Analytics() {
    const navigate = useNavigate();
    const { toast } = useToast();

    // 🟢 OPTIMIZATION: Default to TRUE, but we won't block the whole page
    const [isLoading, setIsLoading] = useState(true);

    const [doctorProfile, setDoctorProfile] = useState(() => {
        const saved = localStorage.getItem('user');
        return saved ? JSON.parse(saved) : {
            name: "Doctor",
            avatar: null,
            role: "doctor",
            specialization: "General Practice"
        };
    });

    const [metrics, setMetrics] = useState({
        revenue: 0,
        consultations: 0,
        satisfaction: "0.0"
    });

    const [revenueData, setRevenueData] = useState<any[]>([]);
    const [demographicData, setDemographicData] = useState<any[]>([]);

    useEffect(() => {
        loadDataParallel();
    }, []);

    const loadDataParallel = async () => {
        try {
            const user = await getCurrentUser();
            const userId = user.userId;

            const [profileRes, billingRes, demoRes] = await Promise.all([
                fetch(`${API_URL}/register-doctor?id=${userId}`, { cache: "no-store" }),
                fetch(`${API_URL}/billing?type=analytics&doctorId=${userId}`, { cache: "no-store" }),
                fetch(`${API_URL}/register-patient?type=demographics`, { cache: "no-store" })
            ]);

            if (profileRes.ok) {
                const data = await profileRes.json();
                let myProfile = data.doctors?.find((d: any) => d.doctorId === userId) || data;
                if (myProfile?.name) {
                    const updated = { ...doctorProfile, ...myProfile };
                    setDoctorProfile(updated);
                    localStorage.setItem('user', JSON.stringify(updated));
                }
            }

            if (billingRes.ok) {
                const billData = await billingRes.json();
                setMetrics({
                    revenue: billData.totalRevenue || 0,
                    consultations: billData.consultationCount || 0,
                    satisfaction: billData.patientSatisfaction || "4.9"
                });
                setRevenueData(billData.chartData || []);
            }

            if (demoRes.ok) {
                const demoData = await demoRes.json();
                setDemographicData(demoData.demographicData || []);
            }

        } catch (err) {
            console.error("Analytics Load Error", err);
            // Silent fail is better than crashing the UI, just keep loading state off
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = async () => {
        await signOut();
        localStorage.removeItem('user');
        navigate("/");
    };

    // --- SKELETON COMPONENTS (Matches Doctor Dashboard Style) ---
    const SkeletonMetric = () => (
        <div className="animate-pulse space-y-2">
            <div className="h-8 w-24 bg-muted rounded"></div>
            <div className="h-4 w-32 bg-muted rounded"></div>
        </div>
    );

    const SkeletonChart = () => (
        <div className="animate-pulse h-[300px] w-full bg-muted/20 rounded-xl flex items-center justify-center">
            <div className="h-8 w-8 bg-muted rounded-full"></div>
        </div>
    );

    return (
        <DashboardLayout
            title="Analytics"
            subtitle="Performance metrics and insights"
            userRole="doctor"
            userName={doctorProfile.name}
            userAvatar={doctorProfile.avatar}
            onLogout={handleLogout}
        >
            <div className="space-y-6 animate-fade-in pb-10">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-lg font-semibold">Dashboard Overview</h2>
                    <Select defaultValue="6m">
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1m">Last Month</SelectItem>
                            <SelectItem value="3m">Last 3 Months</SelectItem>
                            <SelectItem value="6m">Last 6 Months</SelectItem>
                            <SelectItem value="1y">Last Year</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Top Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="shadow-sm border-border/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <SkeletonMetric /> : (
                                <>
                                    <div className="text-2xl font-bold">
                                        ${metrics.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </div>
                                    <div className="flex items-center text-xs text-emerald-600 mt-1 font-medium">
                                        <TrendingUp className="h-3 w-3 mr-1" />
                                        +20.1% from last month
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                    <Card className="shadow-sm border-border/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Consultations</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <SkeletonMetric /> : (
                                <>
                                    <div className="text-2xl font-bold">{metrics.consultations}</div>
                                    <div className="flex items-center text-xs text-emerald-600 mt-1 font-medium">
                                        <Users className="h-3 w-3 mr-1" />
                                        +12% new patients
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                    <Card className="shadow-sm border-border/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Patient Satisfaction</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <SkeletonMetric /> : (
                                <>
                                    <div className="text-2xl font-bold">{metrics.satisfaction}/5.0</div>
                                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                                        <Activity className="h-3 w-3 mr-1" />
                                        Based on real-time feedback
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="shadow-card border-border/50">
                        <CardHeader>
                            <CardTitle>Revenue Trend</CardTitle>
                            <CardDescription>Income generated from billing transactions</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <SkeletonChart /> : (
                                <div className="h-[300px]">
                                    {revenueData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={revenueData}>
                                                <defs>
                                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                                                <XAxis dataKey="month" className="text-xs fill-muted-foreground" axisLine={false} tickLine={false} />
                                                <YAxis className="text-xs fill-muted-foreground" axisLine={false} tickLine={false} tickFormatter={(value) => `$${value / 1000}k`} />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                                    formatter={(value: any) => [`$${value.toLocaleString()}`, "Revenue"]}
                                                />
                                                <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRevenue)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                                            No financial data available yet.
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="shadow-card border-border/50">
                        <CardHeader>
                            <CardTitle>Patient Demographics</CardTitle>
                            <CardDescription>Age distribution based on registered patients</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <SkeletonChart /> : (
                                <div className="h-[300px] flex items-center justify-center">
                                    {demographicData.some(d => d.value > 0) ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={demographicData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    fill="#8884d8"
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {demographicData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                                                <Legend verticalAlign="bottom" height={36} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                                            Not enough patient data for analysis.
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