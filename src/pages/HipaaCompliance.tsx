import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HipaaCompliance() {
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
                <div className="mb-10 text-center">
                    <div className="h-16 w-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6">
                        <Lock className="h-8 w-8" />
                    </div>
                    <h1 className="text-3xl font-bold mb-4">HIPAA Compliance</h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        We are committed to protecting your health information with the highest standards of security and privacy.
                    </p>
                </div>

                <div className="grid gap-8 md:grid-cols-2 mb-12">
                    <div className="p-6 border rounded-xl bg-card">
                        <h3 className="text-lg font-semibold mb-2">Encryption at Rest & Transit</h3>
                        <p className="text-sm text-muted-foreground">
                            All sensitive data is encrypted using AES-256 encryption. We use TLS 1.2+ for all data in transit to ensure that your information is secure during transmission.
                        </p>
                    </div>
                    <div className="p-6 border rounded-xl bg-card">
                        <h3 className="text-lg font-semibold mb-2">Access Controls</h3>
                        <p className="text-sm text-muted-foreground">
                            Strict role-based access controls ensure that only authorized personnel and healthcare providers involved in your care can access your protected health information (PHI).
                        </p>
                    </div>
                    <div className="p-6 border rounded-xl bg-card">
                        <h3 className="text-lg font-semibold mb-2">Audit Logs</h3>
                        <p className="text-sm text-muted-foreground">
                            We maintain comprehensive audit logs of all system activity, tracking who accessed what data and when, to ensure accountability and traceability.
                        </p>
                    </div>
                    <div className="p-6 border rounded-xl bg-card">
                        <h3 className="text-lg font-semibold mb-2">Business Associate Agreements</h3>
                        <p className="text-sm text-muted-foreground">
                            We have signed Business Associate Agreements (BAAs) with all our third-party vendors who handle PHI, ensuring they adhere to the same strict HIPAA standards.
                        </p>
                    </div>
                </div>

                <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-4">
                        If you have any questions about our security practices or HIPAA compliance, please contact our Data Protection Officer.
                    </p>
                    <Button variant="outline" onClick={() => navigate("/contact")}>Contact Security Team</Button>
                </div>
            </main>

            <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
                © 2026 MediConnect. All rights reserved.
            </footer>
        </div>
    );
}
