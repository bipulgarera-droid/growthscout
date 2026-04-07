import { GoogleGenAI } from '@google/genai';
import { supabase } from './persistence.js'; // Ensure correct import logic from persistence.js context

const apiKey = process.env.GEMINI_API_KEY;
// Initialize the v3 GenAI SDK
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const executeChatbot = async (slug: string, userMessage: string, history: any[] = []): Promise<string> => {
    if (!ai) {
        throw new Error('GEMINI_API_KEY is not configured on the server.');
    }

    // 1. Fetch the business details & RAG instructions
    const { data: business, error } = await supabase
        .from('leads')
        .select('*')
        .eq('slug', slug)
        .single();

    if (error || !business) {
        throw new Error('Business not found or invalid slug.');
    }

    // 2. Extract Business Info and RAG Configuration
    const businessName = business.business_name;
    const ragKnowledge = business.rag_knowledge_base || "No specific instructions provided.";
    
    // 3. Build System Prompt
    const systemInstruction = `You are a helpful customer service AI designed specifically for ${businessName}.
Your goal is to answer customer questions accurately based on the business's provided knowledge base, and to collect their contact information (like phone number) if they want an appointment.

=== BUSINESS KNOWLEDGE BASE / INSTRUCTIONS ===
${ragKnowledge}
=== END KNOWLEDGE BASE ===

Rules:
1. Always be polite, professional, and concise. Be helpful.
2. Only use the facts provided in the knowledge base. If the user asks something you do not know, say "I don't have that information right now, but if you leave your number, a human from our team will text you back!"
3. NEVER make up prices or services unless explicitly listed in the knowledge base.
4. Try to guide them towards booking an appointment or leaving their contact details.
`;

    try {
        // Convert the history array (role: 'user' | 'model', parts: [{text}])
        // Note: With the new @google/genai SDK, we construct GenerateContentConfig
        
        // Convert existing UI history format to Gemini format if needed
        const contents = history.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));
        
        // Append the latest user message
        contents.push({
            role: 'user',
            parts: [{ text: userMessage }]
        });

        // 4. Call Gemini
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: {
                systemInstruction: {
                     role: "system",
                     parts: [{ text: systemInstruction }]
                },
                temperature: 0.3,
            }
        });

        return response.text() || "I'm having trouble responding right now.";
    } catch (e: any) {
        console.error("Chatbot Generation Error:", e);
        throw new Error("Failed to generate a chatbot response.");
    }
};
