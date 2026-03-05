import { fetchAuthSession } from 'aws-amplify/auth';

const CONFIG = {
    PRIMARY_TIMEOUT_MS: 5000, 
    BACKUP_TIMEOUT_MS: 15000, 
};

function getServiceConfig(endpoint: string) {
    const userRegion = localStorage.getItem('userRegion') || 'US';
    const isEU = userRegion === 'EU';

    let primary = '';
    let backup = '';

    // 1. Patient & IoT Service
    if (
        endpoint.startsWith('/patients') || endpoint.startsWith('/register-patient') ||
        endpoint.startsWith('/verify-identity') || endpoint.startsWith('/public/knowledge') ||
        endpoint.startsWith('/vitals') || endpoint.startsWith('/emergency') || endpoint.startsWith('/stats')
    ) {
        primary = isEU ? import.meta.env.VITE_PATIENT_SERVICE_URL_EU : import.meta.env.VITE_PATIENT_SERVICE_URL_US;
        backup = isEU ? import.meta.env.VITE_PATIENT_SERVICE_URL_EU_BACKUP : import.meta.env.VITE_PATIENT_SERVICE_URL_US_BACKUP;
    }
    // 2. Doctor & Clinical Service
    else if (
        endpoint.startsWith('/doctors') || endpoint.startsWith('/register-doctor') ||
        endpoint.startsWith('/prescription') || endpoint.startsWith('/prescriptions') || 
        endpoint.startsWith('/pharmacy') || endpoint.startsWith('/ehr') || endpoint.startsWith('/relationships')
    ) {
        primary = isEU ? import.meta.env.VITE_DOCTOR_SERVICE_URL_EU : import.meta.env.VITE_DOCTOR_SERVICE_URL_US;
        backup = isEU ? import.meta.env.VITE_DOCTOR_SERVICE_URL_EU_BACKUP : import.meta.env.VITE_DOCTOR_SERVICE_URL_US_BACKUP;
    }
    // 3. Booking & Billing Service
    else if (
        endpoint.startsWith('/appointments') || endpoint.startsWith('/book-appointment') ||
        endpoint.startsWith('/doctor-appointments') || endpoint.startsWith('/cancel-appointment') ||
        endpoint.startsWith('/analytics') || endpoint.startsWith('/billing') ||
        endpoint.startsWith('/pay-bill') || endpoint.startsWith('/receipt')
    ) {
        primary = isEU ? import.meta.env.VITE_BOOKING_SERVICE_URL_EU : import.meta.env.VITE_BOOKING_SERVICE_URL_US;
        backup = isEU ? import.meta.env.VITE_BOOKING_SERVICE_URL_EU_BACKUP : import.meta.env.VITE_BOOKING_SERVICE_URL_US_BACKUP;
    }
    // 4. Communication & AI Service
    else if (
        endpoint.startsWith('/chat') || endpoint.startsWith('/video') ||
        endpoint.startsWith('/ai') ||
        endpoint.startsWith('/analyze-image') || endpoint.startsWith('/predict-health')
    ) {
        primary = isEU ? import.meta.env.VITE_COMMUNICATION_SERVICE_URL_EU : import.meta.env.VITE_COMMUNICATION_SERVICE_URL_US;
        backup = isEU ? import.meta.env.VITE_COMMUNICATION_SERVICE_URL_EU_BACKUP : import.meta.env.VITE_COMMUNICATION_SERVICE_URL_US_BACKUP;
    }
    // Fallback
    else {
        console.warn(`⚠️ Unknown Route: ${endpoint}. Defaulting to Patient Service.`);
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
    // 1. Prepare Headers & Token
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const userRegion = localStorage.getItem('userRegion') || 'US';
        headers['x-user-region'] = userRegion;
    } catch (e) {
        console.log("Requesting as Guest user");
    }

    // 2. Resolve URLs
    const { primary, backup } = getServiceConfig(endpoint);
    if (!primary) throw new Error("Primary Service URL is undefined. Check .env files.");

    const cleanEndpoint = endpoint.replace(/^\//, '');
    const primaryUrl = `${primary.replace(/\/$/, '')}/${cleanEndpoint}`;
    const backupUrl = backup ? `${backup.replace(/\/$/, '')}/${cleanEndpoint}` : null;
    
    const fetchOptions = {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    };

    try {

        const isAiRoute = endpoint.startsWith('/ai') || endpoint.startsWith('/analyze-image');
        const timeoutLimit = isAiRoute ? 20000 : CONFIG.PRIMARY_TIMEOUT_MS;

        const response = await fetchWithTimeout(primaryUrl, fetchOptions, timeoutLimit);

        if (response.status >= 500 && response.status < 600) {
            throw new Error(`Primary Server Error: ${response.status}`);
        }
        
        return handleResponse(response);

    } catch (error: any) {
        if (backupUrl && (error.name === 'AbortError' || error.message.includes('Primary Server Error') || error.message.includes('Failed to fetch'))) {
            
            console.warn(`⚠️ Primary Cluster Unreachable (${error.message}). Failing over to GCP Backup...`);
            
            try {
                const backupResponse = await fetchWithTimeout(backupUrl, fetchOptions, CONFIG.BACKUP_TIMEOUT_MS);
                return handleResponse(backupResponse);
            } catch (backupError: any) {
                console.error("❌ CRITICAL: Both Primary and Backup Failed.");
                throw backupError;
            }
        }

        throw error;
    }
}

async function handleResponse(response: Response) {
    if (!response.ok) {
        if (response.status === 404) throw new Error("404_NOT_FOUND");
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) console.error("🔒 Auth Error: Token invalid.");
        throw new Error(errorData.message || `API Error: ${response.status}`);
    }
    return await response.json();
}