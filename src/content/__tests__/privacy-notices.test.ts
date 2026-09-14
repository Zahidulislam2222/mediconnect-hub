import { describe, expect, it } from 'vitest';
import notices from '../privacy-notices.json';

describe('privacy notices reflect verified operating limits', () => {
  it('does not present readiness work or erasure review as certification or blanket deletion', () => {
    expect(notices.securityDescription).toContain('requires additional verification');
    expect(notices.accountErasure).toContain('requires review');
    expect(notices.retainedRecords).toContain('remain');
    expect(Object.values(notices).join(' ')).not.toMatch(/certified|fully compliant|anonymize all|strictly in your region/i);
  });
});
