import { describe, expect, it } from 'vitest';
import { homepage, homepageSchema } from '../homepage';
describe('expanded homepage content', () => {
  it('requires complete care, service, clinician, trust, FAQ and closing sections', () => {
    expect(homepage.steps.items).toHaveLength(3);
    expect(homepage.trust.items).toHaveLength(3);
    expect(homepage.faq.items.length).toBeGreaterThanOrEqual(4);
    expect(homepageSchema.safeParse({ ...homepage, clinicians: undefined }).success).toBe(false);
    expect(homepageSchema.safeParse({ ...homepage, faq: { ...homepage.faq, items: [homepage.faq.items[0], homepage.faq.items[0], ...homepage.faq.items] } }).success).toBe(false);
  });
  it('keeps availability, sensitive-information and emergency boundaries explicit', () => {
    expect(homepage.trust.body).toContain('currently unavailable');
    expect(homepage.faq.items.find(item => item.question.includes('health records'))?.answer).toContain('Do not submit');
    expect(homepage.faq.items.find(item => item.question.includes('emergency'))?.answer).toContain('local emergency services');
    expect(JSON.stringify(homepage)).not.toMatch(/HIPAA.certified|\d+\s*(?:patients|clinicians)|five.star|guaranteed/i);
  });
});
