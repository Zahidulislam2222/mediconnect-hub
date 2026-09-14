import { z } from 'zod';
import data from '@/content/monitoring.json';
import { clinicalNumber } from './clinical-inputs';

export const monitoringSettings = z.object({
  historyPoints: z.number().int().positive(), freshnessMaxAgeMs: z.number().int().positive(),
  connectionStatus: z.object({ CONNECTED: z.string(), STALE: z.string(), DISCONNECTED: z.string(), POLLING: z.string() }),
  deviceStatus: z.object({ NORMAL: z.string(), WARNING: z.string(), CRITICAL: z.string(), UNKNOWN: z.string() }),
}).parse(data);
const deviceStatus = z.enum(['NORMAL', 'WARNING', 'CRITICAL']);
export interface MonitoringReading {
  timestamp: string;
  heartRate: number;
  temperature?: number;
  status: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
}

export function parseMonitoringReading(value: unknown): MonitoringReading | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const heartRate = clinicalNumber(record.heartRate);
  const timestamp = z.string().datetime({ offset: true }).safeParse(record.timestamp);
  if (heartRate === null || !timestamp.success) return null;
  const temperature = clinicalNumber(record.temperature);
  const status = deviceStatus.safeParse(record.status);
  return { timestamp: timestamp.data, heartRate, ...(temperature === null ? {} : { temperature }),
    status: status.success ? status.data : 'UNKNOWN' };
}

export function monitoringFreshness(readings: MonitoringReading[], now = Date.now()) {
  if (!readings.length) return 'DISCONNECTED' as const;
  const time = Math.max(...readings.map(reading => Date.parse(reading.timestamp)));
  return !Number.isFinite(time) || time > now || now - time > monitoringSettings.freshnessMaxAgeMs ? 'STALE' as const : 'CONNECTED' as const;
}
