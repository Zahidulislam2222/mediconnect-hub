import { fetchAuthSession } from 'aws-amplify/auth';
import { getUser } from './secure-storage';

const CONFIG = {
    PRIMARY_TIMEOUT_MS: 5000,
    BACKUP_TIMEOUT_MS: 15000, // Longer timeout for Cloud Run "Cold Starts"
};

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
            primary = isEU ? import.meta.env.VITE_DOCTOR_SERVICE_URL_EU : import.meta.env.VITE_DOCTOR_SERVICE_URL_US;
            backup = isEU ? import.meta.env.VITE_DOCTOR_SERVICE_URL_EU_BACKUP : import.meta.env.VITE_DOCTOR_SERVICE_URL_US_BACKUP;
        } else {
            primary = isEU ? import.meta.env.VITE_PATIENT_SERVICE_URL_EU : import.meta.env.VITE_PATIENT_SERVICE_URL_US;
            backup = isEU ? import.meta.env.VITE_PATIENT_SERVICE_URL_EU_BACKUP : import.meta.env.VITE_PATIENT_SERVICE_URL_US_BACKUP;
        }
    }
    // 2a. Public Health ELR → doctor-service
    else if (endpoint.startsWith('/public-health/elr')) {
        primary = isEU ? import.meta.env.VITE_DOCTOR_SERVICE_URL_EU : import.meta.env.VITE_DOCTOR_SERVICE_URL_US;
        backup = isEU ? import.meta.env.VITE_DOCTOR_SERVICE_URL_EU_BACKUP : import.meta.env.VITE_DOCTOR_SERVICE_URL_US_BACKUP;
    }
    // 2b. Referrals + Med Reconciliation → doctor-service
    else if (endpoint.startsWith('/referrals') || endpoint.startsWith('/med-reconciliation')) {
        primary = isEU ? import.meta.env.VITE_DOCTOR_SERVICE_URL_EU : import.meta.env.VITE_DOCTOR_SERVICE_URL_US;
        backup = isEU ? import.meta.env.VITE_DOCTOR_SERVICE_URL_EU_BACKUP : import.meta.env.VITE_DOCTOR_SERVICE_URL_US_BACKUP;
    }
    // 2c. Prior Auth + Eligibility → booking-service
    else if (endpoint.startsWith('/prior-auth') || endpoint.startsWith('/eligibility')) {
        primary = isEU ? import.meta.env.VITE_BOOKING_SERVICE_URL_EU : import.meta.env.VITE_BOOKING_SERVICE_URL_US;
        backup = isEU ? import.meta.env.VITE_BOOKING_SERVICE_URL_EU_BACKUP : import.meta.env.VITE_BOOKING_SERVICE_URL_US_BACKUP;
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
        primary = isEU ? import.meta.env.VITE_PATIENT_SERVICE_URL_EU : import.meta.env.VITE_PATIENT_SERVICE_URL_US;
        backup = isEU ? import.meta.env.VITE_PATIENT_SERVICE_URL_EU_BACKUP : import.meta.env.VITE_PATIENT_SERVICE_URL_US_BACKUP;
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
        primary = isEU ? import.meta.env.VITE_DOCTOR_SERVICE_URL_EU : import.meta.env.VITE_DOCTOR_SERVICE_URL_US;
        backup = isEU ? import.meta.env.VITE_DOCTOR_SERVICE_URL_EU_BACKUP : import.meta.env.VITE_DOCTOR_SERVICE_URL_US_BACKUP;
    }
    // 4. Booking & Billing Service
    else if (
        endpoint.startsWith('/appointments') || endpoint.startsWith('/book-appointment') ||
        endpoint.startsWith('/analytics') || endpoint.startsWith('/billing') || endpoint.startsWith('/system')
    ) {
        primary = isEU ? import.meta.env.VITE_BOOKING_SERVICE_URL_EU : import.meta.env.VITE_BOOKING_SERVICE_URL_US;
        backup = isEU ? import.meta.env.VITE_BOOKING_SERVICE_URL_EU_BACKUP : import.meta.env.VITE_BOOKING_SERVICE_URL_US_BACKUP;
    }
    // 5. Communication & AI Service
    else if (
        endpoint.startsWith('/chat') || endpoint.startsWith('/video') ||
        endpoint.startsWith('/ai')
    ) {
        primary = isEU ? import.meta.env.VITE_COMMUNICATION_SERVICE_URL_EU : import.meta.env.VITE_COMMUNICATION_SERVICE_URL_US;
        backup = isEU ? import.meta.env.VITE_COMMUNICATION_SERVICE_URL_EU_BACKUP : import.meta.env.VITE_COMMUNICATION_SERVICE_URL_US_BACKUP;
    }
    // 6. Admin Service
    else if (endpoint.startsWith('/api/v1/admin')) {
        primary = isEU ? import.meta.env.VITE_ADMIN_SERVICE_URL_EU : import.meta.env.VITE_ADMIN_SERVICE_URL_US;
        backup = isEU ? import.meta.env.VITE_ADMIN_SERVICE_URL_EU_BACKUP : import.meta.env.VITE_ADMIN_SERVICE_URL_US_BACKUP;
    }
    // 7. Staff Service
    else if (
        endpoint.startsWith('/shifts') || endpoint.startsWith('/tasks') ||
        endpoint.startsWith('/announcements') || endpoint.startsWith('/directory')
    ) {
        primary = isEU ? import.meta.env.VITE_STAFF_SERVICE_URL_EU : import.meta.env.VITE_STAFF_SERVICE_URL_US;
        backup = isEU ? import.meta.env.VITE_STAFF_SERVICE_URL_EU_BACKUP : import.meta.env.VITE_STAFF_SERVICE_URL_US_BACKUP;
    }
    // Fallback
    else {
        primary = isEU ? import.meta.env.VITE_PATIENT_SERVICE_URL_EU : import.meta.env.VITE_PATIENT_SERVICE_URL_US;
        backup = isEU ? import.meta.env.VITE_PATIENT_SERVICE_URL_EU_BACKUP : import.meta.env.VITE_PATIENT_SERVICE_URL_US_BACKUP;
    }

    return { primary, backup };
}

export const api = {
    get: (endpoint: string) => request(endpoint, 'GET'),
    post: (endpoint: string, body: any) => request(endpoint, 'POST', body),
    put: (endpoint: string, body: any) => request(endpoint, 'PUT', body),
    delete: (endpoint: string, body?: any) => request(endpoint, 'DELETE', body),
};

async function fetchWithTimeout(url: string, options: any, timeoutMs: number) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

async function request(endpoint: string, method: string, body?: any) {
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

    const { primary, backup } = getServiceConfig(endpoint);
    if (!primary) throw new Error("Primary URL missing");

    const cleanEndpoint = endpoint.replace(/^\//, '');
    const primaryUrl = `${primary.replace(/\/$/, '')}/${cleanEndpoint}`;
    
    const isAiRoute = endpoint.startsWith('/ai') || endpoint.startsWith('/upload-scan');
    const primaryTimeout = isAiRoute ? 30000 : CONFIG.PRIMARY_TIMEOUT_MS; // 🟢 Increased timeout for heavy DICOMs

    const fetchOptions = {
        method,
        headers,
        body: isFormData ? body : (body ? JSON.stringify(body) : undefined), 
    };

    try {
        // 1. Attempt Primary (AWS/Azure)
        const response = await fetchWithTimeout(primaryUrl, fetchOptions, primaryTimeout);

        // 🟢 FAILOVER TRIGGER: Any 5xx error
        if (response.status >= 500 && response.status < 600) {
            throw new Error(`Primary Server Error: ${response.status}`);
        }
        
        return handleResponse(response);

    } catch (error: any) {
 
        if (backup) {
            console.warn(`⚠️ Primary Unreachable (${error.message}). Switching to Backup...`);
            
            const backupUrl = `${backup.replace(/\/$/, '')}/${cleanEndpoint}`;
            try {
                // 2. Attempt Backup (Google Cloud Run)
                // Use longer timeout for Cold Starts
                const backupResponse = await fetchWithTimeout(backupUrl, fetchOptions, CONFIG.BACKUP_TIMEOUT_MS);
                return handleResponse(backupResponse);
            } catch (backupError: any) {
                console.error("❌ CRITICAL: Both Primary and Backup Failed.");
                throw backupError; // Propagate error to UI
            }
        }

        throw error; // No backup available, throw original error
    }
}

async function handleResponse(response: Response) {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 404) throw new Error("404_NOT_FOUND");
        
        if (response.status === 401) throw new Error("401 Unauthorized");

        if (response.status === 403) throw new Error(errorData.error || errorData.message || "403 Forbidden");

        throw new Error(errorData.error || errorData.message || `API Error: ${response.status}`);
    }
    return await response.json();
}