import { z } from "zod";
import httpDefaults from "./http-defaults.json";
import appointmentRoutes from "./appointment-routing.json";

const applicationPath = z.string().regex(/^\/[A-Za-z0-9/_-]+$/).refine(value => !value.includes('//'));
export const appointmentRouting = z.object({
  checkIn: applicationPath, cancel: applicationPath, consultation: applicationPath,
  book: applicationPath, availability: applicationPath, doctors: applicationPath, schedule: applicationPath,
}).parse(appointmentRoutes);

export const PUBLIC_ENV_NAMES = [
  "VITE_API_PRIMARY_TIMEOUT_MS",
  "VITE_API_BACKUP_TIMEOUT_MS",
  "VITE_API_AI_TIMEOUT_MS",
  "VITE_ADMIN_SERVICE_URL_EU",
  "VITE_ADMIN_SERVICE_URL_EU_BACKUP",
  "VITE_ADMIN_SERVICE_URL_US",
  "VITE_ADMIN_SERVICE_URL_US_BACKUP",
  "VITE_AWS_REGION_EU",
  "VITE_AWS_REGION_US",
  "VITE_BOOKING_SERVICE_URL_EU",
  "VITE_BOOKING_SERVICE_URL_EU_BACKUP",
  "VITE_BOOKING_SERVICE_URL_US",
  "VITE_BOOKING_SERVICE_URL_US_BACKUP",
  "VITE_COGNITO_CLIENT_ADMIN_EU",
  "VITE_COGNITO_CLIENT_ADMIN_US",
  "VITE_COGNITO_CLIENT_DOCTOR_EU",
  "VITE_COGNITO_CLIENT_DOCTOR_US",
  "VITE_COGNITO_CLIENT_PATIENT_EU",
  "VITE_COGNITO_CLIENT_PATIENT_US",
  "VITE_COGNITO_CLIENT_STAFF_EU",
  "VITE_COGNITO_CLIENT_STAFF_US",
  "VITE_COGNITO_IDENTITY_POOL_ID_EU",
  "VITE_COGNITO_IDENTITY_POOL_ID_US",
  "VITE_COGNITO_USER_POOL_ID_EU",
  "VITE_COGNITO_USER_POOL_ID_US",
  "VITE_COMMUNICATION_SERVICE_URL_EU",
  "VITE_COMMUNICATION_SERVICE_URL_EU_BACKUP",
  "VITE_COMMUNICATION_SERVICE_URL_US",
  "VITE_COMMUNICATION_SERVICE_URL_US_BACKUP",
  "VITE_COMMUNICATION_WS_URL_EU",
  "VITE_COMMUNICATION_WS_URL_US",
  "VITE_DOCTOR_SERVICE_URL_EU",
  "VITE_DOCTOR_SERVICE_URL_EU_BACKUP",
  "VITE_DOCTOR_SERVICE_URL_US",
  "VITE_DOCTOR_SERVICE_URL_US_BACKUP",
  "VITE_MONITORING_SOCKET_URL_US",
  "VITE_MONITORING_SOCKET_URL_EU",
  "VITE_PATIENT_SERVICE_URL",
  "VITE_PATIENT_SERVICE_URL_EU",
  "VITE_PATIENT_SERVICE_URL_EU_BACKUP",
  "VITE_PATIENT_SERVICE_URL_US",
  "VITE_PATIENT_SERVICE_URL_US_BACKUP",
  "VITE_S3_DOCTOR_DATA_BUCKET_EU",
  "VITE_S3_DOCTOR_DATA_BUCKET_US",
  "VITE_S3_EHR_RECORDS_BUCKET_EU",
  "VITE_S3_EHR_RECORDS_BUCKET_US",
  "VITE_S3_PATIENT_DATA_BUCKET_EU",
  "VITE_S3_PATIENT_DATA_BUCKET_US",
  "VITE_STAFF_SERVICE_URL_EU",
  "VITE_STAFF_SERVICE_URL_EU_BACKUP",
  "VITE_STAFF_SERVICE_URL_US",
  "VITE_STAFF_SERVICE_URL_US_BACKUP",
  "VITE_STRAPI_API_URL",
  "VITE_STRIPE_PUBLISHABLE_KEY",
] as const;

export type PublicEnvironmentName = (typeof PUBLIC_ENV_NAMES)[number];

// Keep every Vite access statically analyzable so production builds replace the
// values at compile time. Application code consumes only publicEnv().
const rawPublicEnvironment: Record<PublicEnvironmentName, unknown> = {
  VITE_API_PRIMARY_TIMEOUT_MS: import.meta.env.VITE_API_PRIMARY_TIMEOUT_MS,
  VITE_API_BACKUP_TIMEOUT_MS: import.meta.env.VITE_API_BACKUP_TIMEOUT_MS,
  VITE_API_AI_TIMEOUT_MS: import.meta.env.VITE_API_AI_TIMEOUT_MS,
  VITE_ADMIN_SERVICE_URL_EU: import.meta.env.VITE_ADMIN_SERVICE_URL_EU,
  VITE_ADMIN_SERVICE_URL_EU_BACKUP: import.meta.env.VITE_ADMIN_SERVICE_URL_EU_BACKUP,
  VITE_ADMIN_SERVICE_URL_US: import.meta.env.VITE_ADMIN_SERVICE_URL_US,
  VITE_ADMIN_SERVICE_URL_US_BACKUP: import.meta.env.VITE_ADMIN_SERVICE_URL_US_BACKUP,
  VITE_AWS_REGION_EU: import.meta.env.VITE_AWS_REGION_EU,
  VITE_AWS_REGION_US: import.meta.env.VITE_AWS_REGION_US,
  VITE_BOOKING_SERVICE_URL_EU: import.meta.env.VITE_BOOKING_SERVICE_URL_EU,
  VITE_BOOKING_SERVICE_URL_EU_BACKUP: import.meta.env.VITE_BOOKING_SERVICE_URL_EU_BACKUP,
  VITE_BOOKING_SERVICE_URL_US: import.meta.env.VITE_BOOKING_SERVICE_URL_US,
  VITE_BOOKING_SERVICE_URL_US_BACKUP: import.meta.env.VITE_BOOKING_SERVICE_URL_US_BACKUP,
  VITE_COGNITO_CLIENT_ADMIN_EU: import.meta.env.VITE_COGNITO_CLIENT_ADMIN_EU,
  VITE_COGNITO_CLIENT_ADMIN_US: import.meta.env.VITE_COGNITO_CLIENT_ADMIN_US,
  VITE_COGNITO_CLIENT_DOCTOR_EU: import.meta.env.VITE_COGNITO_CLIENT_DOCTOR_EU,
  VITE_COGNITO_CLIENT_DOCTOR_US: import.meta.env.VITE_COGNITO_CLIENT_DOCTOR_US,
  VITE_COGNITO_CLIENT_PATIENT_EU: import.meta.env.VITE_COGNITO_CLIENT_PATIENT_EU,
  VITE_COGNITO_CLIENT_PATIENT_US: import.meta.env.VITE_COGNITO_CLIENT_PATIENT_US,
  VITE_COGNITO_CLIENT_STAFF_EU: import.meta.env.VITE_COGNITO_CLIENT_STAFF_EU,
  VITE_COGNITO_CLIENT_STAFF_US: import.meta.env.VITE_COGNITO_CLIENT_STAFF_US,
  VITE_COGNITO_IDENTITY_POOL_ID_EU: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID_EU,
  VITE_COGNITO_IDENTITY_POOL_ID_US: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID_US,
  VITE_COGNITO_USER_POOL_ID_EU: import.meta.env.VITE_COGNITO_USER_POOL_ID_EU,
  VITE_COGNITO_USER_POOL_ID_US: import.meta.env.VITE_COGNITO_USER_POOL_ID_US,
  VITE_COMMUNICATION_SERVICE_URL_EU: import.meta.env.VITE_COMMUNICATION_SERVICE_URL_EU,
  VITE_COMMUNICATION_SERVICE_URL_EU_BACKUP: import.meta.env.VITE_COMMUNICATION_SERVICE_URL_EU_BACKUP,
  VITE_COMMUNICATION_SERVICE_URL_US: import.meta.env.VITE_COMMUNICATION_SERVICE_URL_US,
  VITE_COMMUNICATION_SERVICE_URL_US_BACKUP: import.meta.env.VITE_COMMUNICATION_SERVICE_URL_US_BACKUP,
  VITE_COMMUNICATION_WS_URL_EU: import.meta.env.VITE_COMMUNICATION_WS_URL_EU,
  VITE_COMMUNICATION_WS_URL_US: import.meta.env.VITE_COMMUNICATION_WS_URL_US,
  VITE_DOCTOR_SERVICE_URL_EU: import.meta.env.VITE_DOCTOR_SERVICE_URL_EU,
  VITE_DOCTOR_SERVICE_URL_EU_BACKUP: import.meta.env.VITE_DOCTOR_SERVICE_URL_EU_BACKUP,
  VITE_DOCTOR_SERVICE_URL_US: import.meta.env.VITE_DOCTOR_SERVICE_URL_US,
  VITE_DOCTOR_SERVICE_URL_US_BACKUP: import.meta.env.VITE_DOCTOR_SERVICE_URL_US_BACKUP,
  VITE_MONITORING_SOCKET_URL_US: import.meta.env.VITE_MONITORING_SOCKET_URL_US,
  VITE_MONITORING_SOCKET_URL_EU: import.meta.env.VITE_MONITORING_SOCKET_URL_EU,
  VITE_PATIENT_SERVICE_URL: import.meta.env.VITE_PATIENT_SERVICE_URL,
  VITE_PATIENT_SERVICE_URL_EU: import.meta.env.VITE_PATIENT_SERVICE_URL_EU,
  VITE_PATIENT_SERVICE_URL_EU_BACKUP: import.meta.env.VITE_PATIENT_SERVICE_URL_EU_BACKUP,
  VITE_PATIENT_SERVICE_URL_US: import.meta.env.VITE_PATIENT_SERVICE_URL_US,
  VITE_PATIENT_SERVICE_URL_US_BACKUP: import.meta.env.VITE_PATIENT_SERVICE_URL_US_BACKUP,
  VITE_S3_DOCTOR_DATA_BUCKET_EU: import.meta.env.VITE_S3_DOCTOR_DATA_BUCKET_EU,
  VITE_S3_DOCTOR_DATA_BUCKET_US: import.meta.env.VITE_S3_DOCTOR_DATA_BUCKET_US,
  VITE_S3_EHR_RECORDS_BUCKET_EU: import.meta.env.VITE_S3_EHR_RECORDS_BUCKET_EU,
  VITE_S3_EHR_RECORDS_BUCKET_US: import.meta.env.VITE_S3_EHR_RECORDS_BUCKET_US,
  VITE_S3_PATIENT_DATA_BUCKET_EU: import.meta.env.VITE_S3_PATIENT_DATA_BUCKET_EU,
  VITE_S3_PATIENT_DATA_BUCKET_US: import.meta.env.VITE_S3_PATIENT_DATA_BUCKET_US,
  VITE_STAFF_SERVICE_URL_EU: import.meta.env.VITE_STAFF_SERVICE_URL_EU,
  VITE_STAFF_SERVICE_URL_EU_BACKUP: import.meta.env.VITE_STAFF_SERVICE_URL_EU_BACKUP,
  VITE_STAFF_SERVICE_URL_US: import.meta.env.VITE_STAFF_SERVICE_URL_US,
  VITE_STAFF_SERVICE_URL_US_BACKUP: import.meta.env.VITE_STAFF_SERVICE_URL_US_BACKUP,
  VITE_STRAPI_API_URL: import.meta.env.VITE_STRAPI_API_URL,
  VITE_STRIPE_PUBLISHABLE_KEY: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
};

const nonEmpty = z.string().trim().min(1);
const timeoutSchema = z.coerce.number().int().positive().max(2147483647);

export function requestTimeout(name: keyof typeof httpDefaults): number {
  const result = timeoutSchema.safeParse(rawPublicEnvironment[name] ?? httpDefaults[name]);
  if (!result.success) throw new Error(`Invalid request timeout configuration: ${name}`);
  return result.data;
}
const serviceUrlNames = new Set<PublicEnvironmentName>(
  PUBLIC_ENV_NAMES.filter((name) => name.includes("_URL")),
);

export function publicEnv(name: PublicEnvironmentName): string {
  const raw = rawPublicEnvironment[name];
  const schema = serviceUrlNames.has(name) ? nonEmpty.url() : nonEmpty;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Missing or invalid public configuration: ${name}`);
  }
  return parsed.data;
}

/** Backup service endpoints are optional; nonblank configuration is still validated. */
export function optionalBackupUrl(name: Extract<PublicEnvironmentName, `${string}_URL_${string}_BACKUP`>): string {
  const raw = rawPublicEnvironment[name];
  if (raw === undefined || (typeof raw === 'string' && raw.trim() === '')) return '';
  return publicEnv(name);
}

// Cognito issuer construction is owned by the environment boundary.
export function configuredCognitoIssuer(region: 'US' | 'EU'): string {
  const awsRegion = publicEnv(region === 'EU' ? 'VITE_AWS_REGION_EU' : 'VITE_AWS_REGION_US');
  const pool = publicEnv(region === 'EU' ? 'VITE_COGNITO_USER_POOL_ID_EU' : 'VITE_COGNITO_USER_POOL_ID_US');
  return `https://cognito-idp.${awsRegion}.amazonaws.com/${pool}`;
}
