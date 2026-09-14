import { describe, expect, it } from 'vitest';
import { monitoringFreshness, monitoringSettings, parseMonitoringReading } from '../monitoring-data';

describe('monitoring data integrity', () => {
  const timestamp = '2026-01-01T00:00:00Z';
  it.each([undefined, null, '', false, 'invalid'])('does not invent a reading for %s', heartRate => {
    expect(parseMonitoringReading({ timestamp, heartRate })).toBeNull();
  });
  it('preserves actual zero and does not infer a clinical assessment from a number', () => {
    expect(parseMonitoringReading({ timestamp, heartRate: 0, temperature: 0 })).toEqual({ timestamp, heartRate: 0, temperature: 0, status: 'UNKNOWN' });
    expect(parseMonitoringReading({ timestamp, heartRate: 160 })?.status).toBe('UNKNOWN');
    expect(parseMonitoringReading({ timestamp, heartRate: 80, status: 'WARNING' })?.status).toBe('WARNING');
  });
  it('requires an actual valid timestamp and reports empty, stale and future data honestly', () => {
    expect(parseMonitoringReading({ heartRate: 70 })).toBeNull();
    expect(parseMonitoringReading({ timestamp: 'invalid', heartRate: 70 })).toBeNull();
    const reading = parseMonitoringReading({ timestamp, heartRate: 70 })!;
    const observed = Date.parse(timestamp);
    expect(monitoringFreshness([])).toBe('DISCONNECTED');
    expect(monitoringFreshness([reading], observed)).toBe('CONNECTED');
    expect(monitoringFreshness([reading], observed + monitoringSettings.freshnessMaxAgeMs + 1)).toBe('STALE');
    expect(monitoringFreshness([reading], observed - 1)).toBe('STALE');
  });
});
