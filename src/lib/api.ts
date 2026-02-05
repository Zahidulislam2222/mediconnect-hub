import { fetchAuthSession } from 'aws-amplify/auth';

/**
 * Helper to determine the correct microservice URL based on the endpoint prefix.
 * Throws an error if the prefix is not recognized.
 */
function getServiceUrl(endpoint: string): string {
    // Ensure endpoint has leading slash for consistent matching, although we expect input to have it.
    // We will strip it later when joining if needed, or just be careful.
    // The user instruction: "strip leading slashes from endpoints to prevent double-slashes"
    // implies we should handle the join carefully.

    if (endpoint.startsWith('/patients') || endpoint.startsWith('/register-patient')) {
        return import.meta.env.VITE_PATIENT_SERVICE_URL;
    }
    if (endpoint.startsWith('/doctors') || endpoint.startsWith('/register-doctor')) {
        return import.meta.env.VITE_DOCTOR_SERVICE_URL;
    }
    if (endpoint.startsWith('/appointments')) {
        return import.meta.env.VITE_BOOKING_SERVICE_URL;
    }
    if (endpoint.startsWith('/chat') || endpoint.startsWith('/video')) {
        return import.meta.env.VITE_COMMUNICATION_URL;
    }
    if (endpoint.startsWith('/prescriptions') || endpoint.startsWith('/ehr')) {
        return import.meta.env.VITE_CLINICAL_URL;
    }
    if (endpoint.startsWith('/vitals')) {
        return import.meta.env.VITE_IOT_SERVICE_URL;
    }

    throw new Error(`CRITICAL: Unknown Service Route - ${endpoint}`);
}

/**
 * A wrapper around the native fetch API that handles:
 * 1. Base URL determination based on endpoint prefix
 * 2. Automatic Authentication (attaching JWT tokens)
 * 3. Error handling
 */
export const api = {
    get: (endpoint: string) => request(endpoint, 'GET'),
    post: (endpoint: string, body: any) => request(endpoint, 'POST', body),
    put: (endpoint: string, body: any) => request(endpoint, 'PUT', body),
    delete: (endpoint: string) => request(endpoint, 'DELETE'),
};

async function request(endpoint: string, method: string, body?: any) {
    try {
        // 1. Get the current user's session (tokens)
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();

        // 2. Prepare headers
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        // 3. Attach the token if the user is logged in
        if (token) {
            headers['Authorization'] = `Bearer ${token}`; // Authorization: Bearer <token>
        }

        // 4. Determine Service URL
        const serviceUrl = getServiceUrl(endpoint);

        // Strip leading slash from endpoint to avoid double slash if serviceUrl ends with /
        // However, standard VITE vars usually don't have trailing slash, but let's be robust.
        // Actually, user said: "Clean Prefixes: Ensure that if an endpoint is passed as /patients/123, 
        // the router correctly joins it with the Service URL without double slashes"

        // Safer join: remove trailing slash from serviceUrl (if any) and leading slash from endpoint (if any)
        const cleanServiceUrl = serviceUrl.replace(/\/$/, '');
        const cleanEndpoint = endpoint.replace(/^\//, '');
        const finalUrl = `${cleanServiceUrl}/${cleanEndpoint}`;

        // 5. Make the request
        const response = await fetch(finalUrl, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        // 6. Handle Errors
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