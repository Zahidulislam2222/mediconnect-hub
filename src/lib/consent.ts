import { z } from 'zod';
import content from '@/content/consent.json';

export const consentContent = z.object({ policyVersion: z.string().min(1), missingTitle: z.string(),
  missingDescription: z.string(), signupDescription: z.string(), termsPath: z.string(), privacyPath: z.string(),
}).parse(content);
const preferenceSchema = z.object({ essential: z.literal(true), functional: z.boolean(), analytics: z.boolean(), timestamp: z.string().datetime() });
const acceptanceSchema = z.object({ agreedToTerms: z.literal(true), policyVersion: z.literal(consentContent.policyVersion), timestamp: z.string().datetime() });
export type GdprConsent = z.infer<typeof preferenceSchema>;

export function getGdprConsent(): GdprConsent | null {
  try {
    const value = preferenceSchema.safeParse(JSON.parse(localStorage.getItem('gdpr_consent') ?? 'null'));
    return value.success ? value.data : null;
  } catch { return null; }
}
export function getPendingAcceptance() {
  try {
    const value = acceptanceSchema.safeParse(JSON.parse(localStorage.getItem('pending_consent') ?? 'null'));
    return value.success ? value.data : null;
  } catch { return null; }
}
export function recordTermsAcceptance(): void {
  localStorage.setItem('pending_consent', JSON.stringify({ agreedToTerms: true,
    policyVersion: consentContent.policyVersion, timestamp: new Date().toISOString() }));
}
