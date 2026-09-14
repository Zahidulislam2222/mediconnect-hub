import { fetchAuthSession } from 'aws-amplify/auth';
import { getUser } from './secure-storage';
import { publicEnv, optionalBackupUrl, requestTimeout } from '@/config/env';
import apiErrors from '@/content/api-errors.json';


function getServiceConfig(endpoint: string) {
    const userRegion = localStorage.getItem('userRegion') || 'US';

    // ─── SECURE STORAGE FIX: Read user role from encrypted storage ───
    let userRole = '';
    try {
        const user = getUser();
        if (user) {
            userRole = user.role || '';
        }
    } catch (e) {
        console.error("Failed to parse user session for routing");
    }

    const isEU = userRegion === 'EU';
    const isDoctorRole = userRole.toLowerCase() === 'doctor' || userRole.toLowerCase() === 'practitioner';

    let primary = '';
    let backup = '';

    // 🟢 1. SHARED UPLOAD ROUTE (Decision based on Role)
    if (endpoint.startsWith('/upload-scan')) {
        if (isDoctorRole) {
            primary = isEU ? publicEnv("VITE_DOCTOR_SERVICE_URL_EU") : publicEnv("VITE_DOCTOR_SERVICE_URL_US");
            backup = isEU ? optionalBackupUrl("VITE_DOCTOR_SERVICE_URL_EU_BACKUP") : optionalBackupUrl("VITE_DOCTOR_SERVICE_URL_US_BACKUP");
        } else {
            primary = isEU ? publicEnv("VITE_PATIENT_SERVICE_URL_EU") : publicEnv("VITE_PATIENT_SERVICE_URL_US");
            backup = isEU ? optionalBackupUrl("VITE_PATIENT_SERVICE_URL_EU_BACKUP") : optionalBackupUrl("VITE_PATIENT_SERVICE_URL_US_BACKUP");
        }
    }
    // 2a. Public Health ELR → doctor-service
    else if (endpoint.startsWith('/public-health/elr')) {
        primary = isEU ? publicEnv("VITE_DOCTOR_SERVICE_URL_EU") : publicEnv("VITE_DOCTOR_SERVICE_URL_US");
        backup = isEU ? optionalBackupUrl("VITE_DOCTOR_SERVICE_URL_EU_BACKUP") : optionalBackupUrl("VITE_DOCTOR_SERVICE_URL_US_BACKUP");
    }
    // 2b. Referrals + Med Reconciliation → doctor-service
    else if (endpoint.startsWith('/referrals') || endpoint.startsWith('/med-reconciliation')) {
        primary = isEU ? publicEnv("VITE_DOCTOR_SERVICE_URL_EU") : publicEnv("VITE_DOCTOR_SERVICE_URL_US");
        backup = isEU ? optionalBackupUrl("VITE_DOCTOR_SERVICE_URL_EU_BACKUP") : optionalBackupUrl("VITE_DOCTOR_SERVICE_URL_US_BACKUP");
    }
    // 2c. Prior Auth + Eligibility → booking-service
    else if (endpoint.startsWith('/prior-auth') || endpoint.startsWith('/eligibility')) {
        primary = isEU ? publicEnv("VITE_BOOKING_SERVICE_URL_EU") : publicEnv("VITE_BOOKING_SERVICE_URL_US");
        backup = isEU ? optionalBackupUrl("VITE_BOOKING_SERVICE_URL_EU_BACKUP") : optionalBackupUrl("VITE_BOOKING_SERVICE_URL_US_BACKUP");
    }
    // 2. Patient & IoT Service
    else if (
        endpoint.startsWith('/patients') ||
        endpoint.startsWith('/register-patient') ||
        endpoint.startsWith('/public') || endpoint.startsWith('/me') ||
        endpoint.startsWith('/vitals') || endpoint.startsWith('/emergency') || endpoint.startsWith('/stats') || endpoint.startsWith('/search') ||
        endpoint.startsWith('/hl7') || endpoint.startsWith('/allergies') || endpoint.startsWith('/immunizations') ||
        endpoint.startsWith('/public-health') ||
        endpoint.startsWith('/fhir') || endpoint.startsWith('/sdoh') || endpoint.startsWith('/mpi') ||
        endpoint.startsWith('/care-plans') || endpoint.startsWith('/bluebutton')
    ) {
        primary = isEU ? publicEnv("VITE_PATIENT_SERVICE_URL_EU") : publicEnv("VITE_PATIENT_SERVICE_URL_US");
        backup = isEU ? optionalBackupUrl("VITE_PATIENT_SERVICE_URL_EU_BACKUP") : optionalBackupUrl("VITE_PATIENT_SERVICE_URL_US_BACKUP");
    }
    // 3. Doctor & Clinical Service
    else if (
        endpoint.startsWith('/doctors') ||
        endpoint.startsWith('/register-doctor') ||
        endpoint.startsWith('/prescription') || endpoint.startsWith('/prescriptions') ||
        endpoint.startsWith('/pharmacy') || endpoint.startsWith('/ehr') || endpoint.startsWith('/relationships') ||
        endpoint.startsWith('/drugs') || endpoint.startsWith('/terminology') ||
        endpoint.startsWith('/cds-hooks') || endpoint.startsWith('/lab')
    ) {
        primary = isEU ? publicEnv("VITE_DOCTOR_SERVICE_URL_EU") : publicEnv("VITE_DOCTOR_SERVICE_URL_US");
        backup = isEU ? optionalBackupUrl("VITE_DOCTOR_SERVICE_URL_EU_BACKUP") : optionalBackupUrl("VITE_DOCTOR_SERVICE_URL_US_BACKUP");
    }
    // 4. Booking, Billing & Subscription Service
    else if (
        endpoint.startsWith('/appointments') ||
        endpoint.startsWith('/analytics') || endpoint.startsWith('/billing') || endpoint.startsWith('/system') ||
        endpoint.startsWith('/subscriptions')
    ) {
        primary = isEU ? publicEnv("VITE_BOOKING_SERVICE_URL_EU") : publicEnv("VITE_BOOKING_SERVICE_URL_US");
        backup = isEU ? optionalBackupUrl("VITE_BOOKING_SERVICE_URL_EU_BACKUP") : optionalBackupUrl("VITE_BOOKING_SERVICE_URL_US_BACKUP");
    }
    // 5. Communication, AI & Chatbot Service
    else if (
        endpoint.startsWith('/chat') || endpoint.startsWith('/video') ||
        endpoint.startsWith('/ai') || endpoint.startsWith('/chatbot')
    ) {
        primary = isEU ? publicEnv("VITE_COMMUNICATION_SERVICE_URL_EU") : publicEnv("VITE_COMMUNICATION_SERVICE_URL_US");
        backup = isEU ? optionalBackupUrl("VITE_COMMUNICATION_SERVICE_URL_EU_BACKUP") : optionalBackupUrl("VITE_COMMUNICATION_SERVICE_URL_US_BACKUP");
    }
    // 6. Admin Service
    else if (endpoint.startsWith('/api/v1/admin')) {
        primary = isEU ? publicEnv("VITE_ADMIN_SERVICE_URL_EU") : publicEnv("VITE_ADMIN_SERVICE_URL_US");
        backup = isEU ? optionalBackupUrl("VITE_ADMIN_SERVICE_URL_EU_BACKUP") : optionalBackupUrl("VITE_ADMIN_SERVICE_URL_US_BACKUP");
    }
    // 7. Staff Service
    else if (
        endpoint.startsWith('/shifts') || endpoint.startsWith('/tasks') ||
        endpoint.startsWith('/announcements') || endpoint.startsWith('/directory')
    ) {
        primary = isEU ? publicEnv("VITE_STAFF_SERVICE_URL_EU") : publicEnv("VITE_STAFF_SERVICE_URL_US");
        backup = isEU ? optionalBackupUrl("VITE_STAFF_SERVICE_URL_EU_BACKUP") : optionalBackupUrl("VITE_STAFF_SERVICE_URL_US_BACKUP");
    }
    // Fallback
    else {
        primary = isEU ? publicEnv("VITE_PATIENT_SERVICE_URL_EU") : publicEnv("VITE_PATIENT_SERVICE_URL_US");
        backup = isEU ? optionalBackupUrl("VITE_PATIENT_SERVICE_URL_EU_BACKUP") : optionalBackupUrl("VITE_PATIENT_SERVICE_URL_US_BACKUP");
    }

    return { primary, backup };
}

export interface ApiRequestOptions { signal?: AbortSignal }
export const api = {
    get: (endpoint: string, options?: ApiRequestOptions) => request(endpoint, 'GET', undefined, options),
    post: (endpoint: string, body: any, options?: ApiRequestOptions) => request(endpoint, 'POST', body, options),
    put: (endpoint: string, body: any, options?: ApiRequestOptions) => request(endpoint, 'PUT', body, options),
    delete: (endpoint: string, body?: any, options?: ApiRequestOptions) => request(endpoint, 'DELETE', body, options),
};

class RetryableReadError extends Error {}
export class HttpResponseError extends Error {
    constructor(message: string, readonly status: number) { super(message); }
}

export class MutationOutcomeUnknownError extends Error {
    readonly code = 'OUTCOME_UNKNOWN';
    constructor() { super(apiErrors.outcomeUnknown); }
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
    const caller = options.signal;
    caller?.throwIfAborted();
    const controller = new AbortController();
    let onAbort: (() => void) | undefined;
    const cancelled = new Promise<never>((_resolve, reject) => {
        if (caller) {
            onAbort = () => { controller.abort(); reject(caller.reason); };
            caller.addEventListener('abort', onAbort, { once: true });
        }
    });
    let status: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
            // A known 4xx must not become a failover-eligible transport error.
            reject(status !== undefined && status >= 400 && status < 500
                ? new HttpResponseError(`API Error: ${status}`, status)
                : new RetryableReadError(apiErrors.requestTimeout));
            controller.abort();
        }, timeoutMs);
    });
    const read = async () => {
        let response: Response;
        try {
            caller?.throwIfAborted();
            response = await fetch(url, { ...options, signal: controller.signal });
        } catch {
            caller?.throwIfAborted();
            throw new RetryableReadError('REQUEST_TRANSPORT_FAILED');
        }
        caller?.throwIfAborted();
        status = response.status;
        if (status >= 500 && status < 600) {
            controller.abort();
            throw new RetryableReadError(`API Error: ${status}`);
        }
        // Keep the deadline active through body consumption and JSON parsing.
        return await handleResponse(response);
    };
    try {
        return await Promise.race([read(), deadline, cancelled]);
    } finally {
        clearTimeout(timer);
        if (onAbort) caller?.removeEventListener('abort', onAbort);
    }
}

async function request(endpoint: string, method: string, body?: any, options?: ApiRequestOptions) {
    options?.signal?.throwIfAborted();
    // 🟢 PROFESSIONAL FIX: Support binary file uploads (FormData) vs JSON
    const isFormData = body instanceof FormData;
    const headers: HeadersInit = isFormData ? {} : { 'Content-Type': 'application/json' };
    
    try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const userRegion = localStorage.getItem('userRegion') || 'US';
        headers['x-user-region'] = userRegion;
    } catch (e) {
        // Guest mode
    }
    // Authentication retrieval can outlive navigation or signout. Recheck before dispatch.
    options?.signal?.throwIfAborted();

    const { primary, backup } = getServiceConfig(endpoint);
    if (!primary) throw new Error("Primary URL missing");

    const cleanEndpoint = endpoint.replace(/^\//, '');
    const primaryUrl = `${primary.replace(/\/$/, '')}/${cleanEndpoint}`;
    
    const isAiRoute = endpoint.startsWith('/ai') || endpoint.startsWith('/upload-scan');
    const primaryTimeout = requestTimeout(isAiRoute ? 'VITE_API_AI_TIMEOUT_MS' : 'VITE_API_PRIMARY_TIMEOUT_MS');

    const fetchOptions = {
        method,
        headers,
        body: isFormData ? body : (body ? JSON.stringify(body) : undefined), 
        signal: options?.signal,
    };

    try {
        return await fetchWithTimeout(primaryUrl, fetchOptions, primaryTimeout);
    } catch (error: unknown) {
        if (method !== 'GET') {
            if (error instanceof HttpResponseError) throw error;
            // A timeout, malformed acknowledgement, or 5xx can follow a committed write.
            throw new MutationOutcomeUnknownError();
        }
        options?.signal?.throwIfAborted();
        if (backup && error instanceof RetryableReadError) {
            const backupUrl = `${backup.replace(/\/$/, '')}/${cleanEndpoint}`;
            return await fetchWithTimeout(backupUrl, fetchOptions, requestTimeout('VITE_API_BACKUP_TIMEOUT_MS'));
        }
        throw error;
    }
}

async function handleResponse(response: Response) {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 404) throw new HttpResponseError("404_NOT_FOUND", response.status);
        
        if (response.status === 401) throw new HttpResponseError("401 Unauthorized", response.status);

        if (response.status === 403) throw new HttpResponseError(errorData.error || errorData.message || "403 Forbidden", response.status);

        throw new HttpResponseError(errorData.error || errorData.message || `API Error: ${response.status}`, response.status);
    }
    return await response.json();
}
