import { useNavigate } from "react-router-dom";
import { Calendar as CalendarIcon, Clock, Video, MapPin, Plus } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { currentUser, upcomingAppointments } from "@/lib/mockData";

export default function Appointments() {
    const navigate = useNavigate();

    const handleLogout = () => {
        navigate("/");
    };

    return (
        <DashboardLayout
            title="Appointments"
            subtitle="Manage your scheduled visits"
            userRole="patient"
            userName={currentUser.name}
            userAvatar={currentUser.avatar}
            onLogout={handleLogout}
        >
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">My Appointments</h2>
                    <Button onClick={() => navigate("/consultation")} className="bg-primary text-white">
                        <Plus className="h-4 w-4 mr-2" />
                        Book New
                    </Button>
                </div>

                <Tabs defaultValue="upcoming" className="w-full">
                    <TabsList className="grid w-full max-w-md grid-cols-2">
                        <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                        <TabsTrigger value="past">Past History</TabsTrigger>
                    </TabsList>

                    <TabsContent value="upcoming" className="mt-6 space-y-4">
                        {upcomingAppointments.length > 0 ? (
                            upcomingAppointments.map((apt) => (
                                <Card key={apt.id} className="shadow-soft hover:shadow-card transition-shadow cursor-pointer">
                                    <CardContent className="p-6">
                                        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                                            <div className="flex gap-4">
                                                <div className="hidden md:flex flex-col items-center justify-center min-w-[3.5rem] h-14 bg-primary/10 rounded-lg text-primary">
                                                    <span className="text-xs uppercase font-bold">
                                                        {apt.date.includes(" ") ? apt.date.split(' ')[0] : "UP"}
                                                    </span>
                                                    <span className="text-xl font-bold">
                                                        {apt.date.includes(" ") ? apt.date.split(' ')[1].replace(',', '') : "NEXT"}
                                                    </span>
                                                </div>

                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="font-semibold text-lg">{apt.doctor}</h3>
                                                        <Badge variant={apt.type === 'Video' ? 'default' : 'secondary'} className="text-xs">
                                                            {apt.type}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-muted-foreground text-sm mb-2">{apt.specialty}</p>
                                                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                                        <span className="flex items-center gap-1">
                                                            <CalendarIcon className="h-4 w-4" />
                                                            {apt.date}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-4 w-4" />
                                                            {apt.time}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <Button
                                                onClick={() => navigate("/consultation")}
                                                variant={apt.status === 'Confirmed' ? "default" : "outline"}
                                            >
                                                {apt.type === 'Video' ? <Video className="h-4 w-4 mr-2" /> : <MapPin className="h-4 w-4 mr-2" />}
                                                {apt.status === 'Confirmed' ? 'Join Call' : 'Details'}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        ) : (
                            <Card className="text-center py-12">
                                <CardContent>
                                    <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                    <h3 className="text-lg font-medium">No upcoming appointments</h3>
                                    <p className="text-muted-foreground mb-6">Schedule a consultation with one of our specialists.</p>
                                    <Button onClick={() => navigate("/consultation")}>Find a Doctor</Button>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="past" className="mt-6">
                        <Card className="text-center py-12">
                            <CardContent>
                                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                                    <Clock className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-medium">No past appointments found</h3>
                                <p className="text-muted-foreground">Your appointment history will appear here.</p>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
}
