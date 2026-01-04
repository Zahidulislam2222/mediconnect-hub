import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TermsOfService() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
                <div className="container mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
                        <span className="text-xl font-bold">MediConnect</span>
                    </div>
                    <Button variant="ghost" onClick={() => navigate("/")}>Back to Home</Button>
                </div>
            </nav>

            <main className="flex-1 container mx-auto px-6 py-12 max-w-4xl">
                <div className="mb-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <FileText className="h-5 w-5" />
                        </div>
                        <h1 className="text-3xl font-bold">Terms of Service</h1>
                    </div>
                    <p className="text-muted-foreground">Last updated: January 1, 2026</p>
                </div>

                <div className="space-y-8 text-muted-foreground">
                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
                        <p>
                            By accessing or using our services, you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use our services.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-3">2. Description of Service</h2>
                        <p>
                            MediConnect provides a platform for connecting patients with healthcare providers, managing health records, and accessing health information (the "Service"). You acknowledge that MediConnect is not a healthcare provider and does not provide medical advice.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-3">3. User Accounts</h2>
                        <p>
                            You are responsible for maintaining the confidentiality of your account password and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-3">4. Medical Disclaimer</h2>
                        <p className="mb-2">
                            THE SERVICES PROVIDED ARE NOT A SUBSTITUTE FOR PROFESSIONAL MEDICAL ADVICE, DIAGNOSIS, OR TREATMENT. ALWAYS SEEK THE ADVICE OF YOUR PHYSICIAN OR OTHER QUALIFIED HEALTH PROVIDER WITH ANY QUESTIONS YOU MAY HAVE REGARDING A MEDICAL CONDITION.
                        </p>
                        <p>
                            IF YOU THINK YOU MAY HAVE A MEDICAL EMERGENCY, CALL YOUR DOCTOR OR 911 IMMEDIATELY.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-3">5. Termination</h2>
                        <p>
                            We reserve the right to suspend or terminate your account at our sole discretion, without notice, for conduct that we believe violates these Terms of Service or is harmful to other users of the Service, us, or third parties, or for any other reason.
                        </p>
                    </section>
                </div>
            </main>

            <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
                © 2026 MediConnect. All rights reserved.
            </footer>
        </div>
    );
}
