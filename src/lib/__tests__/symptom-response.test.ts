import { describe, expect, it } from 'vitest';
import { parseSymptomResponse } from '../symptom-response';
import safety from '../../content/symptom-safety.json';

describe('Symptom assessment safety boundary', () => {
  it.each([undefined, null, {}, { analysis: {} }, { analysis: { risk: 'Error', reason: 'failed' } },
    { analysis: { risk: 'Low', reason: '' } }, { analysis: { risk: 'Low', reason: '  ' } },
    { analysis: { risk: 'Low' } }, { analysis: { risk: 0, reason: 'test' } },
    { analysis: { risk: 'unrecognised', reason: 'test' } }])('rejects invalid assessment %# without manufacturing a score', (value) => {
    const response = value && typeof value === 'object' ? { success: true, status: 'available', ...value } : value;
    expect(() => parseSymptomResponse(response)).toThrow();
  });
  it('does not invent the provider', () => {
    expect(parseSymptomResponse({ success: true, status: 'available', analysis: { risk: 'Unknown', reason: 'Insufficient information' } }).provider).toBeUndefined();
  });
  it.each(['Low', 'Medium', 'High', 'Critical', 'Unknown'])('accepts contract risk %s without clinical endorsement', (risk) => {
    expect(parseSymptomResponse({ success: true, status: 'available', analysis: { risk, reason: 'Synthetic response' } }).analysis.risk).toBe(risk);
  });
  it('has no simulated risk or invented quota diagnosis in the unavailable copy', () => {
    expect(safety.unavailable).toContain('risk level is unknown');
    expect(safety.unavailable).toContain('emergency services');
    expect(safety.unavailable).not.toMatch(/Risk: Low|hydration|Daily Quota/);
  });
  it.each(['Analysis partial.', 'AI Clinical Service is temporarily degraded. Standard protocols suggest immediate clinical review.'])('rejects historical backend fallback without the new available contract', (reason) => {
    expect(() => parseSymptomResponse({ success: true, analysis: { risk: 'Medium', reason }, pdfBase64: 'test-pdf' })).toThrow();
  });
  it('rejects unavailable responses even when an analysis is attached', () => {
    expect(() => parseSymptomResponse({ success: false, status: 'unavailable', analysis: { risk: 'Low', reason: 'Synthetic test' } })).toThrow();
  });
});
