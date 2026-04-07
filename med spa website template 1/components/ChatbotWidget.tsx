"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Icons inline to avoid extra dependencies if missing
const MessageIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
);

const XIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
);

interface ChatbotWidgetProps {
    slug: string;
    businessName: string;
    primaryColor?: string;
    active?: boolean;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

export default function ChatbotWidget({ slug, businessName, primaryColor = '#000000', active = false }: ChatbotWidgetProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'assistant', content: `Hi there! Welcome to ${businessName}. How can I help you today?` }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isOpen]);

    // If disabled via backend CRM toggle, do not render
    if (!active) return null;

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        
        if (!input.trim()) return;
        
        const userMessage = input.trim();
        setInput('');
        
        // Add user msg
        const newMessages = [...messages, { id: Date.now().toString(), role: 'user' as const, content: userMessage }];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            // Push to GrowthScout fulfillment API
            const response = await fetch('https://growthscout-production.up.railway.app/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug,
                    message: userMessage,
                    history: messages.slice(1) // Skip the hardcoded greeting
                })
            });

            if (!response.ok) throw new Error('API Error');

            const data = await response.json();
            
            setMessages([...newMessages, { 
                id: Date.now().toString(), 
                role: 'assistant', 
                content: data.response 
            }]);
            
        } catch (error) {
            console.error("Chat error:", error);
            setMessages([...newMessages, { 
                id: Date.now().toString(), 
                role: 'assistant', 
                content: "I'm sorry, I'm having trouble connecting right now. Please call us directly!" 
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="bg-white pointer-events-auto rounded-2xl shadow-2xl overflow-hidden w-[350px] mb-4 border border-gray-100 flex flex-col h-[500px]"
                    >
                        {/* Header */}
                        <div 
                            className="text-white p-4 flex justify-between items-center"
                            style={{ backgroundColor: primaryColor }}
                        >
                            <div>
                                <h3 className="font-bold text-sm tracking-wide">{businessName} Support</h3>
                                <p className="text-white/70 text-xs mt-1">We typically reply instantly</p>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-white hover:text-white/70 transition-colors">
                                <XIcon />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div 
                                        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user' ? 'text-white rounded-br-sm' : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm'}`}
                                        style={msg.role === 'user' ? { backgroundColor: primaryColor } : {}}
                                    >
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white shadow-sm border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                                        <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-3 bg-white border-t border-gray-100">
                            <form onSubmit={handleSend} className="relative flex items-center">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Type a message..."
                                    className="w-full bg-gray-50 border-none rounded-xl pr-12 pl-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-gray-200"
                                    disabled={isLoading}
                                />
                                <button 
                                    type="submit"
                                    disabled={!input.trim() || isLoading}
                                    className="absolute right-2 p-2 rounded-lg text-white disabled:opacity-50 transition-colors"
                                    style={{ backgroundColor: primaryColor }}
                                >
                                    <SendIcon />
                                </button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all pointer-events-auto"
                style={{ backgroundColor: primaryColor }}
            >
                {isOpen ? <XIcon /> : <MessageIcon />}
            </button>
        </div>
    );
}
