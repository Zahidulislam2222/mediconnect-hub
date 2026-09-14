import { describe, it, expect } from 'vitest';
import { ageFromBirthDate, clinicalNumber, completeVitals, emptyVitals, parseMeasuredVitals } from '../clinical-inputs';

describe('clinical input absence', () => {
  it.each([undefined, null, '', ' ', NaN, Infinity, 'bad', false, {}])('rejects absent or invalid measurement %j', value => {
    expect(clinicalNumber(value)).toBeNull();
  });
  it('never invents values for missing telemetry', () => {
    expect(parseMeasuredVitals({ heartRate: '81' })).toEqual({ heartRate: 81, temp: null, bpSys: null });
    expect(completeVitals(emptyVitals())).toBe(false);
  });
  it('does not replace an actual zero with a healthy default', () => expect(clinicalNumber(0)).toBe(0));
  it('calculates age across birthday and rejects invalid dates', () => {
    expect(ageFromBirthDate('2000-09-10', new Date('2026-09-09'))).toBe(25);
    expect(ageFromBirthDate('2000-09-10', new Date('2026-09-10'))).toBe(26);
    expect(ageFromBirthDate('2000-02-31')).toBeNull();
    expect(ageFromBirthDate('2999-01-01')).toBeNull();
  });
});
