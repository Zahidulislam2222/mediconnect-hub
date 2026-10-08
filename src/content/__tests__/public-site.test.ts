import { describe, expect, it } from 'vitest';
import { publicSite, publicSiteSchema } from '../public-site';

describe('public website content', () => {
  it('provides substantive destinations and valid related-page links', () => {
    for (const page of Object.values(publicSite.pages)) {
      expect(page.sections.length).toBeGreaterThanOrEqual(3);
      expect(publicSite.pages[page.related]).toBeDefined();
    }
  });
  it('rejects missing pages, duplicate navigation and unavailable related pages', () => {
    expect(publicSiteSchema.safeParse({ ...publicSite, pages: { ...publicSite.pages, help: undefined } }).success).toBe(false);
    expect(publicSiteSchema.safeParse({ ...publicSite, navigation: [publicSite.navigation[0], publicSite.navigation[0]] }).success).toBe(false);
    expect(publicSiteSchema.safeParse({ ...publicSite, pages: { ...publicSite.pages, about: { ...publicSite.pages.about, related: 'missing' } } }).success).toBe(false);
  });
  it('states actual availability and does not invent contact details', () => {
    expect(publicSite.status).toContain('currently unavailable');
    expect(publicSite.pages.contact.intro).toContain('not been configured');
    expect(JSON.stringify(publicSite)).not.toMatch(/\b(?:demo(?:nstrat\w*)?|preview|sample|fictional|portfolio|mockup|simulation|concept)\b/i);
    expect(JSON.stringify(publicSite.pages.contact)).not.toMatch(/@[a-z0-9.-]+\.[a-z]+|\+\d[\d ()-]{7,}/i);
  });
});
