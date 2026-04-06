/**
 * Chatbot API Client
 */

import { api } from './api';

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    intent?: string;
    cached?: boolean;
    createdAt?: string;
}

export interface ChatResponse {
    sessionId: string;
    message: string;
    intent: string;
    cached: boolean;
    remaining: number;
    responseTimeMs?: number;
}

export interface ChatUsage {
    tier: string;
    messagesUsed: number;
    messagesLimit: number;
    tokensUsed: number;
    tokensLimit: number;
    remaining: number;
}

export const chatbotApi = {
    sendMessage: (message: string | null, sessionId?: string): Promise<ChatResponse> =>
        api.post('/chatbot/message', { message, sessionId }),

    getHistory: (sessionId: string): Promise<{ messages: ChatMessage[] }> =>
        api.get(`/chatbot/history/${sessionId}`),

    getUsage: (): Promise<ChatUsage> =>
        api.get('/chatbot/usage'),
};
