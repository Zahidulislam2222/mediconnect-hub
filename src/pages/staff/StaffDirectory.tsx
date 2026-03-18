import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from 'aws-amplify/auth';
import { Users, Search } from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { getUser, clearAllSensitive } from "@/lib/secure-storage";

interface StaffMember {
    id: string;
    name: string;
    department: string;
    status: string;
}

export default function StaffDirectory() {
    const navigate = useNavigate();
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(true);
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [userProfile] = useState(() => {
        const saved = getUser();
        return saved || { name: "Staff", avatar: null, role: "staff" };
    });

    const loadDirectory = async () => {
        try {
            setIsLoading(true);
            const res = await api.get("/directory");
            setStaff(res.staff || []);
        } catch (err: any) {
            const msg = err?.message || String(err);
            if (msg.includes('401')) {
                clearAllSensitive();
                navigate("/auth");
            } else {
                toast({ variant: "destructive", title: "Error", description: msg });
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadDirectory(); }, []);

    const handleLogout = async () => {
        await signOut();
        clearAllSensitive();
        navigate("/auth");
    };

    const filtered = staff.filter(s =>
        s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.department?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const SkeletonRow = () => (
        <TableRow>
            {[1,2,3].map(i => (
                <TableCell key={i}><div className="animate-pulse h-4 w-24 bg-slate-200 rounded" /></TableCell>
            ))}
        </TableRow>
    );

    return (
        <DashboardLayout
            title="Staff Directory"
            subtitle="Clinical staff and practitioners"
            userRole="staff"
            userName={userProfile.name}
            userAvatar={userProfile.avatar}
            onLogout={handleLogout}
        >
            <div className="space-y-6 animate-fade-in pb-10">
                <Card className="shadow-card border-border/50">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5 text-primary" />
                                Directory ({filtered.length})
                            </CardTitle>
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name or department..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                                ) : filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                            No staff members found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filtered.map((member) => (
                                        <TableRow key={member.id}>
                                            <TableCell className="font-medium">{member.name}</TableCell>
                                            <TableCell>{member.department}</TableCell>
                                            <TableCell>
                                                <Badge className={
                                                    member.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" :
                                                    member.status === "PENDING" ? "bg-amber-100 text-amber-700" :
                                                    member.status === "SUSPENDED" ? "bg-red-100 text-red-700" :
                                                    "bg-slate-100 text-slate-600"
                                                }>
                                                    {member.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
