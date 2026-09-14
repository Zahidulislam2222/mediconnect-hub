import { describe, expect, it } from 'vitest';
import { isJourneyApplicationPath, journeyRouting } from '../journey-routing';

describe('accepted public design route ownership', () => {
  it.each(['/', '/demo/patient', '/demo/doctor', '/demo/staff', '/demo/knowledge', '/demo/knowledge/prepare-for-your-visit', '/blog', '/blog/example', '/storyboard'])('owns the public journey route %s', path => {
    expect(isJourneyApplicationPath(path)).toBe(true);
  });
  it.each(['/auth', '/admin-auth', '/knowledge', '/knowledge/example', '/appointments', '/patient-dashboard', '/doctor-dashboard', '/admin/dashboard', '/blogger', '/demo/patient/private'])('does not replace the real or unrelated route %s', path => {
    expect(isJourneyApplicationPath(path)).toBe(false);
  });
  it('keeps preview sample URLs stable and application login destinations real', () => {
    expect(journeyRouting.preview.knowledge).toBe('/knowledge');
    expect(journeyRouting.application.knowledge).toBe('/demo/knowledge');
    expect(journeyRouting.application.auth).toBe('/auth');
    expect(journeyRouting.application.adminAuth).toBe('/admin-auth');
  });
});
