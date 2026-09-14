export const emptyVitals = () => ({ temp: null as number | null, heartRate: null as number | null, bpSys: null as number | null, age: null as number | null });

export function clinicalNumber(value: unknown): number | null {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function parseMeasuredVitals(value: unknown) {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return { temp: clinicalNumber(data.temperature), heartRate: clinicalNumber(data.heartRate), bpSys: clinicalNumber(data.bloodPressureSys) };
}

export function ageFromBirthDate(value: unknown, now = new Date()): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const birth = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(birth.getTime()) || birth.toISOString().slice(0, 10) !== value || birth > now) return null;
  const beforeBirthday = now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  return now.getUTCFullYear() - birth.getUTCFullYear() - Number(beforeBirthday);
}

export function completeVitals(value: ReturnType<typeof emptyVitals>) {
  return Object.values(value).every(number => typeof number === 'number' && Number.isFinite(number) && number >= 0);
}
