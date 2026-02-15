import { fetchAuthSession } from 'aws-amplify/auth';

function getServiceUrl(endpoint: string): string {
    // 1. Patient & IoT Service (Port 8081)
    if (
        endpoint.startsWith('/patients') ||
        endpoint.startsWith('/register-patient') ||
        endpoint.startsWith('/verify-identity') ||
        endpoint.startsWith('/public/knowledge') ||
        endpoint.startsWith('/vitals') ||     // 🟢 MOVED: Integrated into Patient Service
        endpoint.startsWith('/emergency')      // 🟢 MOVED: Integrated into Patient Service
    ) {
        return import.meta.env.VITE_PATIENT_SERVICE_URL;
    }

    // 2. Doctor Service (Port 8082)
    if (
        endpoint.startsWith('/doctors') || 
        endpoint.startsWith('/register-doctor') ||
        endpoint.startsWith('/prescription') ||
        endpoint.startsWith('/prescriptions') ||
        endpoint.startsWith('/pharmacy') ||
        endpoint.startsWith('/ehr') ||
        endpoint.startsWith('/relationships')
    ) {
        return import.meta.env.VITE_DOCTOR_SERVICE_URL;
    }

    // 3. Booking Service (Port 8083)
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
        return import.meta.env.VITE_BOOKING_SERVICE_URL;
    }

    // 4. Communication Service (Port 8084)
    if (
        endpoint.startsWith('/chat') ||
        endpoint.startsWith('/video') ||
        endpoint.startsWith('/predict-health') ||
        endpoint.startsWith('/analyze-image')
    ) {
        // 🟢 FIXED: Variable name now matches docker-compose.yml
        return import.meta.env.VITE_COMMUNICATION_SERVICE_URL;
    }

    // Default Fallback
    console.error(`CRITICAL: Unknown Service Route - ${endpoint}`);
    return import.meta.env.VITE_PATIENT_SERVICE_URL;
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
        } catch (e) {
            // Guest access - No token added, this is fine for /knowledge
            console.log("Requesting as Guest user");
        }

        const serviceUrl = getServiceUrl(endpoint);

        // Safety check
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
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `API Error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`API Request Failed: ${endpoint}`, error);
        throw error;
    }
}