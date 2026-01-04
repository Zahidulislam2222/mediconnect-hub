import { useNavigate } from "react-router-dom";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function Contact() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Simple Header */}
            <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
                <div className="container mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
                        <span className="text-xl font-bold">MediConnect</span>
                    </div>
                    <Button variant="ghost" onClick={() => navigate("/")}>Back to Home</Button>
                </div>
            </nav>

            <main className="flex-1 container mx-auto px-6 py-12 md:py-20 max-w-5xl">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                        We're here to help. Reach out to our team for support, inquiries, or feedback.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    {/* Contact Info */}
                    <div className="space-y-8">
                        <h2 className="text-2xl font-semibold mb-6">Get in Touch</h2>

                        <div className="flex items-start gap-4">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <Mail className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="font-medium mb-1">Email</h3>
                                <p className="text-muted-foreground mb-1">General: support@mediconnect.com</p>
                                <p className="text-muted-foreground">Partners: partners@mediconnect.com</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <Phone className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="font-medium mb-1">Phone</h3>
                                <p className="text-muted-foreground mb-1">+1 (555) 123-4567</p>
                                <p className="text-xs text-muted-foreground">Mon-Fri, 9am - 6pm EST</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <MapPin className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="font-medium mb-1">Office</h3>
                                <p className="text-muted-foreground">
                                    123 Innovation Drive<br />
                                    Tech Valley, CA 94043
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Contact Form */}
                    <Card className="shadow-lg border-border/50">
                        <CardContent className="p-6 md:p-8">
                            <form className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="first-name">First Name</Label>
                                        <Input id="first-name" placeholder="John" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="last-name">Last Name</Label>
                                        <Input id="last-name" placeholder="Doe" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input id="email" type="email" placeholder="john@example.com" />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="subject">Subject</Label>
                                    <Input id="subject" placeholder="How can we help?" />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="message">Message</Label>
                                    <Textarea id="message" placeholder="Type your message here..." className="min-h-[120px]" />
                                </div>

                                <Button className="w-full bg-primary text-white">
                                    <Send className="h-4 w-4 mr-2" />
                                    Send Message
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </main>

            <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
                © 2026 MediConnect. All rights reserved.
            </footer>
        </div>
    );
}
