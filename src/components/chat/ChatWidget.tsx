/**
 * ChatWidget — Floating AI chatbot bubble
 *
 * EU AI Act Art 52: First message identifies as AI
 * HIPAA: No PHI displayed in chat (backend handles scrubbing)
 * Rate limiting: Shows remaining messages count
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, X, Send, Loader2, Bot, User } from 'lucide-react';
import { chatbotApi, ChatMessage, ChatResponse } from '@/lib/chatbot';

export function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [remaining, setRemaining] = useState<number | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);

    // Load initial greeting when opened for first time
    const handleOpen = async () => {
        setIsOpen(true);
        if (messages.length === 0) {
            setLoading(true);
            try {
                const response = await chatbotApi.sendMessage(null);
                setSessionId(response.sessionId);
                setRemaining(response.remaining);
                setMessages([{ role: 'assistant', content: response.message }]);
            } catch {
                setMessages([{
                    role: 'assistant',
                    content: "Hi! I'm MediConnect's AI assistant. How can I help you today?",
                }]);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setLoading(true);

        try {
            const response: ChatResponse = await chatbotApi.sendMessage(userMessage, sessionId || undefined);
            setSessionId(response.sessionId);
            setRemaining(response.remaining);
            setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
        } catch (err: any) {
            const errorMessage = err?.message?.includes('429')
                ? "You've reached your daily message limit. Upgrade your plan for more messages."
                : "Sorry, I couldn't process your message. Please try again.";
            setMessages(prev => [...prev, { role: 'assistant', content: errorMessage }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isOpen) {
        return (
            <Button
                onClick={handleOpen}
                className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-elevated medical-gradient text-white z-50 hover:scale-105 transition-transform"
                size="icon"
            >
                <MessageCircle className="h-6 w-6" />
            </Button>
        );
    }

    return (
        <Card className="fixed bottom-6 right-6 w-[380px] h-[520px] rounded-2xl shadow-elevated z-50 flex flex-col overflow-hidden border-border">
            {/* Header */}
            <div className="medical-gradient text-white p-4 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    <div>
                        <p className="font-display font-semibold text-sm">AI Health Assistant</p>
                        <p className="text-xs text-white/70">Powered by MediConnect</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {remaining !== null && (
                        <Badge className="bg-white/20 text-white text-xs rounded-lg">
                            {remaining} left
                        </Badge>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-white hover:bg-white/20 rounded-xl"
                        onClick={() => setIsOpen(false)}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Bot className="h-4 w-4 text-primary" />
                            </div>
                        )}
                        <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                            msg.role === 'user'
                                ? 'bg-primary text-primary-foreground rounded-br-md'
                                : 'bg-muted text-foreground rounded-bl-md'
                        }`}>
                            {msg.content.split('\n').map((line, j) => (
                                <p key={j} className={j > 0 ? 'mt-1.5' : ''}>{line}</p>
                            ))}
                        </div>
                        {msg.role === 'user' && (
                            <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                                <User className="h-4 w-4 text-primary-foreground" />
                            </div>
                        )}
                    </div>
                ))}
                {loading && (
                    <div className="flex gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Bot className="h-4 w-4 text-primary" />
                        </div>
                        <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border bg-card flex-shrink-0">
                <div className="flex gap-2">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask about appointments, billing, records..."
                        className="rounded-xl text-sm"
                        disabled={loading}
                        maxLength={1500}
                    />
                    <Button
                        onClick={handleSend}
                        disabled={loading || !input.trim()}
                        size="icon"
                        className="rounded-xl flex-shrink-0"
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </Card>
    );
}
