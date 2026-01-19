import { useNavigate } from "react-router-dom";
import { Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from 'aws-amplify/auth'; // 1. Import Amplify Auth

export function PublicHeader() {
    const navigate = useNavigate();

    // 2. Create the "Smart Redirect" function
    const handleGetStarted = async () => {
        try {
            // Check if there is an active session
            await getCurrentUser();

            // If the above line doesn't throw an error, a user is logged in.
            // Now, check their role from the profile saved in localStorage.
            const savedUser = localStorage.getItem('user');
            const profile = savedUser ? JSON.parse(savedUser) : null;

            // Check if the role is doctor or provider (case-insensitive)
            if (profile && ['doctor', 'provider'].includes((profile.role || '').toLowerCase())) {
                navigate('/doctor-dashboard'); // Go to Doctor Portal
            } else {
                navigate('/dashboard'); // Default to Patient Portal
            }
        } catch (error) {
            // This error means no user is signed in (Guest).
            navigate('/auth'); // Go to the Login/Sign Up page
        }
    };

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
            <div className="container mx-auto px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3" onClick={() => navigate("/")} style={{ cursor: 'pointer' }}>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl medical-gradient">
                        <Stethoscope className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xl font-bold">MediConnect</span>
                </div>

                <div className="hidden md:flex items-center gap-8">
                    <a href="/#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        Features
                    </a>
                    <a href="/#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        How It Works
                    </a>
                    <a href="/#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        Testimonials
                    </a>
                    <button onClick={() => navigate("/knowledge")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        Knowledge Base
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    {/* 3. Update the onClick handler to use the new smart function */}
                    <Button onClick={handleGetStarted} className="bg-primary hover:bg-primary/90">
                        Get Started
                    </Button>
                </div>
            </div>
        </nav>
    );
}