import { fetchAuthSession } from 'aws-amplify/auth';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * A wrapper around the native fetch API that handles:
 * 1. Base URL prefixing
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

        // 4. Make the request
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        // 5. Handle Errors
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