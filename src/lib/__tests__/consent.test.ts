import { beforeEach, describe, expect, it } from 'vitest';
import { getGdprConsent, getPendingAcceptance, recordTermsAcceptance } from '../consent';

describe('Explicit consent evidence', () => {
  beforeEach(() => localStorage.clear());
  it.each(['true', '{}', '{"essential":true,"functional":true,"analytics":true}', 'invalid'])('does not invent permissions from %s', value => {
    localStorage.setItem('gdpr_consent', value);
    expect(getGdprConsent()).toBeNull();
  });
  it('preserves an explicit refusal of optional processing', () => {
    const value = { essential: true, functional: false, analytics: false, timestamp: new Date().toISOString() };
    localStorage.setItem('gdpr_consent', JSON.stringify(value));
    expect(getGdprConsent()).toEqual(value);
  });
  it('requires recorded terms acceptance independently of cookie preferences', () => {
    expect(getPendingAcceptance()).toBeNull();
    recordTermsAcceptance();
    expect(getPendingAcceptance()?.agreedToTerms).toBe(true);
    expect(getGdprConsent()).toBeNull();
  });
});
