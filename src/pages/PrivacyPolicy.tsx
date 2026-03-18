import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivacyPolicy() {
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
                            <Shield className="h-5 w-5" />
                        </div>
                        <h1 className="text-3xl font-bold">Privacy Policy</h1>
                    </div>
                    <p className="text-muted-foreground">Last updated: January 1, 2026</p>
                </div>

                <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
                    <section>
                        <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
                        <p className="text-muted-foreground">
                            We collect information you provide directly to us, such as when you create an account, update your profile, request customer support, or communicate with us. This may include your name, email address, phone number, and health-related information necessary for providing our services.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
                        <p className="text-muted-foreground mb-2">We use the information we collect to:</p>
                        <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                            <li>Provide, maintain, and improve our services.</li>
                            <li>Process transactions and send related information.</li>
                            <li>Send you technical notices, updates, security alerts, and support messages.</li>
                            <li>Respond to your comments, questions, and requests.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3">3. Data Security</h2>
                        <p className="text-muted-foreground">
                            We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access, disclosure, alteration and destruction. All health data is encrypted in transit and at rest in compliance with HIPAA regulations.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3">4. Sharing of Information</h2>
                        <p className="text-muted-foreground">
                            We do not share your personal information with third parties except as described in this privacy policy, such as with healthcare providers you choose to consult with, or when required by law.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3">5. Your GDPR Rights (EU Residents)</h2>
                        <p className="text-muted-foreground mb-2">Under the General Data Protection Regulation (GDPR), you have the right to:</p>
                        <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                            <li><strong>Access</strong> — Request a copy of all personal data we hold about you.</li>
                            <li><strong>Rectification</strong> — Request correction of inaccurate personal data.</li>
                            <li><strong>Erasure ("Right to be Forgotten")</strong> — Request deletion of your personal data, subject to legal retention requirements.</li>
                            <li><strong>Data Portability</strong> — Receive your data in a structured, machine-readable format (JSON/FHIR R4).</li>
                            <li><strong>Restrict Processing</strong> — Request limitation of how we process your data.</li>
                            <li><strong>Withdraw Consent</strong> — Withdraw previously given consent at any time via your account settings.</li>
                        </ul>
                        <p className="text-muted-foreground mt-2">
                            You can exercise your data export and deletion rights directly from your <strong>Account Settings</strong> page, or by contacting our Data Protection Officer.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3">6. Data Retention</h2>
                        <p className="text-muted-foreground">
                            We retain your personal data only for as long as necessary to provide our services and comply with legal obligations.
                            Medical records and audit logs are retained for a minimum of 7 years as required by HIPAA.
                            Upon account deletion, personal identifiers are erased and clinical data is anonymized.
                        </p>
                    </section>

                    <section className="p-6 border rounded-xl bg-card">
                        <h2 className="text-xl font-semibold mb-3">Data Protection Officer (DPO)</h2>
                        <p className="text-muted-foreground mb-2">
                            For any privacy-related inquiries, data access requests, or to exercise your GDPR rights, contact our DPO:
                        </p>
                        <div className="text-muted-foreground space-y-1">
                            <p><strong>Email:</strong> <a href="mailto:dpo@mediconnect.health" className="text-primary underline">dpo@mediconnect.health</a></p>
                            <p><strong>Response Time:</strong> Within 30 days as required by GDPR Art. 12</p>
                        </div>
                    </section>
                </div>
            </main>

            <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
                © 2026 MediConnect. All rights reserved.
            </footer>
        </div>
    );
}
