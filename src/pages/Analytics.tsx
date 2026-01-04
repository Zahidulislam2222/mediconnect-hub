import { useNavigate } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from "recharts";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { revenueData, currentDoctor } from "@/lib/mockData";

export default function Analytics() {
    const navigate = useNavigate();

    const handleLogout = () => {
        navigate("/");
    };

    const demographicData = [
        { name: '18-30', value: 20 },
        { name: '31-50', value: 45 },
        { name: '51-70', value: 25 },
        { name: '70+', value: 10 },
    ];

    const COLORS = ['#8884d8', '#00C49F', '#FFBB28', '#FF8042'];

    return (
        <DashboardLayout
            title="Analytics"
            subtitle="Performance metrics and insights"
            userRole="doctor"
            userName={currentDoctor.name}
            userAvatar={currentDoctor.avatar}
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
                    <Card className="shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">$42,500.00</div>
                            <p className="text-xs text-success mt-1">+20.1% from last month</p>
                        </CardContent>
                    </Card>
                    <Card className="shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Consultations</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">+2350</div>
                            <p className="text-xs text-success mt-1">+180.1% from last month</p>
                        </CardContent>
                    </Card>
                    <Card className="shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Patient Satisfaction</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">4.9/5.0</div>
                            <p className="text-xs text-muted-foreground mt-1">Based on 456 reviews</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="shadow-card border-border/50">
                        <CardHeader>
                            <CardTitle>Revenue Trend</CardTitle>
                            <CardDescription>Monthly revenue over the last 6 months</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px]">
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
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-card border-border/50">
                        <CardHeader>
                            <CardTitle>Patient Demographics</CardTitle>
                            <CardDescription>Age distribution of treated patients</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px] flex items-center justify-center">
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
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
