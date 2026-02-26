import { fetchAuthSession } from 'aws-amplify/auth';

function getServiceUrl(endpoint: string): string {
    // 🟢 1. Check the User's Legal Jurisdiction (US or EU)
    // Default to 'US' if not set.
    const userRegion = localStorage.getItem('userRegion') || 'US';
    
    // 2. Patient & IoT Service
    if (
        endpoint.startsWith('/patients') ||
        endpoint.startsWith('/register-patient') ||
        endpoint.startsWith('/verify-identity') ||
        endpoint.startsWith('/public/knowledge') ||
        endpoint.startsWith('/vitals') ||     
        endpoint.startsWith('/emergency') ||
        endpoint.startsWith('/stats')    
    ) {
        return userRegion === 'EU' 
            ? import.meta.env.VITE_PATIENT_SERVICE_URL_EU 
            : import.meta.env.VITE_PATIENT_SERVICE_URL_US;
    }

    // 3. Doctor & Clinical Service
    if (
        endpoint.startsWith('/doctors') || 
        endpoint.startsWith('/register-doctor') ||
        endpoint.startsWith('/prescription') || 
        endpoint.startsWith('/prescriptions') || 
        endpoint.startsWith('/pharmacy') ||
        endpoint.startsWith('/ehr') ||
        endpoint.startsWith('/relationships')
    ) {
        return userRegion === 'EU' 
            ? import.meta.env.VITE_DOCTOR_SERVICE_URL_EU 
            : import.meta.env.VITE_DOCTOR_SERVICE_URL_US;
    }

    // 4. Booking & Billing Service (Money)
    if (
        endpoint.startsWith('/appointments') ||
        endpoint.startsWith('/book-appointment') ||
        endpoint.startsWith('/doctor-appointments') ||
        endpoint.startsWith('/cancel-appointment') ||
        endpoint.startsWith('/analytics') ||
        endpoint.startsWith('/billing') ||
        endpoint.startsWith('/pay-bill') ||
        endpoint.startsWith('/receipt')
    ) {
        return userRegion === 'EU' 
            ? import.meta.env.VITE_BOOKING_SERVICE_URL_EU 
            : import.meta.env.VITE_BOOKING_SERVICE_URL_US;
    }

    // 5. Communication & AI Service
    if (
        endpoint.startsWith('/chat') ||
        endpoint.startsWith('/video') ||
        endpoint.startsWith('/analyze-image') ||
        endpoint.startsWith('/predict-health')
    ) {
        return userRegion === 'EU' 
            ? import.meta.env.VITE_COMMUNICATION_SERVICE_URL_EU 
            : import.meta.env.VITE_COMMUNICATION_SERVICE_URL_US;
    }

    console.error(`CRITICAL: Unknown Service Route - ${endpoint}`);
    // Fallback safely to Patient service matching the user's region
    return userRegion === 'EU' 
        ? import.meta.env.VITE_PATIENT_SERVICE_URL_EU 
        : import.meta.env.VITE_PATIENT_SERVICE_URL_US;
}

export const api = {
    get: (endpoint: string) => request(endpoint, 'GET'),
    post: (endpoint: string, body: any) => request(endpoint, 'POST', body),
    put: (endpoint: string, body: any) => request(endpoint, 'PUT', body),
    delete: (endpoint: string, body?: any) => request(endpoint, 'DELETE', body),
};

async function request(endpoint: string, method: string, body?: any) {
    try {
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

        const serviceUrl = getServiceUrl(endpoint);

        if (!serviceUrl) throw new Error("Service URL is undefined. Check .env files.");

        const cleanServiceUrl = serviceUrl.replace(/\/$/, '');
        const cleanEndpoint = endpoint.replace(/^\//, '');
        const finalUrl = `${cleanServiceUrl}/${cleanEndpoint}`;

        const response = await fetch(finalUrl, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {

            if (response.status === 404) {
                 throw new Error("404_NOT_FOUND");
            }

            const errorData = await response.json().catch(() => ({}));
            
            if (response.status === 401) {
                console.error("🔒 Auth Error: Token invalid or Region mismatch.");
            }
            throw new Error(errorData.message || `API Error: ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {

        if (error.message !== "404_NOT_FOUND") {
            console.error(`API Request Failed: ${endpoint}`, error);
        }

        throw error;
    }
}