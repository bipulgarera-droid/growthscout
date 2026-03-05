
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export const generateOutreachMessage = async (
    businessName: string,
    contactName: string | undefined,
    websiteUrl: string,
    screenshotUrl: string | undefined,
    speedScore: number | undefined,
    missingFeatures: string[]
): Promise<string> => {
    if (!GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY missing");
        return "Hey there, I saw your website and thought it could use an update. Let me know if you're interested.";
    }

    const prompt = `
    You are a friendly, helpful web designer. Write a short, high-impact cold outreach message / email.
    
    Recipient: ${contactName || "Owner"} of ${businessName}
    Current Website: ${websiteUrl}
    
    TONE RULES:
    1. **NO CRITICISM**: Do NOT say their current site is "slow", "broken", or "outdated". Do not make them feel small.
    2. **COMPLIMENT FIRST**: Start by saying you came across their business/website and loved what they do.
    3. **SOFT PITCH**: "I built a mockup just in case you're looking for a refresh/upgrade."
    4. **NO EM DASHES**: Do not use "—". Use commas or periods.
    
    The Message should:
    1. Be casual but professional.
    2. Mention that I made a custom demo for them (I will insert the link later).
    3. Ask for feedback.
    4. Keep it under 100 words.
    
    Output ONLY the message body. No subject line.
    `;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            }
        );

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return text || "Error generating message.";

    } catch (error) {
        console.error("Gemini outreach generation failed:", error);
        return "Hey! I built a new website for you. Check it out.";
    }
};

export interface OutreachMessages {
    email: string;
    linkedin: string;
    instagram: string;
    whatsapp: string;
}

export interface LeadOutreachInput {
    businessName: string;
    contactName?: string;
    websiteUrl: string;
    previewUrl: string;
    speedScore?: number;
    flaws?: string[];
}

// Generate all 3 platform messages
export const generateAllMessages = async (lead: LeadOutreachInput): Promise<OutreachMessages> => {
    // Template for Instagram (with proper line breaks)
    const instagramTemplate = `Hey — this might sound random

I made a private demo website for ${lead.businessName} using public info

No signup, no pitch

Link (expires soon): ${lead.previewUrl}

If it's useless, ignore this 🙏`;

    const emailTemplate = `Hi there!

I came across ${lead.businessName} and loved what you're doing.

I put together a quick concept site with modern design, just in case you're considering a refresh.

Check it out here: ${lead.previewUrl}

Let me know what you think!`;

    const linkedinTemplate = `Hey! I came across ${lead.businessName} and built a quick concept site for you.

Take a look if you're curious: ${lead.previewUrl}

No pressure, just thought it might be useful!`;

    const whatsappTemplate = `Hey! I just saw ${lead.businessName} online. Created a quick demo website using public info – check it out: ${lead.previewUrl}

Let me know if you’d like to get this website for a very low price?`;

    // If no API key, return the templates directly (no AI generation)
    if (!GEMINI_API_KEY) {
        console.log('[Outreach] No GEMINI_API_KEY - using template fallback');
        return {
            email: emailTemplate,
            linkedin: linkedinTemplate,
            instagram: instagramTemplate,
            whatsapp: whatsappTemplate
        };
    }
    const prompt = `
    RULE: WHATSAPP FORMAT (paraphrase this template with 10-15% variance but keep the exact same meaning and offer):
    """
    Hey! I just saw ${lead.businessName} online. Created a quick demo website using public info – check it out: ${lead.previewUrl}

    Let me know if you’d like to get this website for a very low price?
    """

    Generate 4 unique outreach messages. Each message MUST include double line breaks between sections.

    LEAD INFO:
    - Business: ${lead.businessName}
    - Demo Link: ${lead.previewUrl}

    INSTAGRAM TEMPLATE(paraphrase this but keep EXACT structure with line breaks):
    """
    Hey — this might sound random

    I made a private demo website for ${lead.businessName} using public info

    No signup, no pitch

Link(expires soon): ${lead.previewUrl}

    If it's useless, ignore this 🙏
"""

    RULES for Instagram:
    1. VARY the opening phrase each time(Hey, Quick one, Random message, etc.)
2. KEEP the line breaks - one empty line between each section
3. KEEP the casual no - pressure tone
4. KEEP the "ignore this" escape clause
5. Max 50 words for Instagram

    EMAIL: Professional but friendly, 2 - 3 short paragraphs.
    LINKEDIN: Shorter, direct, 1 - 2 sentences.
        WHATSAPP: Short conversational text matching the template provided.

    Output ONLY valid JSON:
{
    "email": "...",
        "linkedin": "...",
            "instagram": "...",
                "whatsapp": "..."
}
`;

    try {
        console.log(`[Outreach] Generating messages for ${lead.businessName}...`);
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.9 }
                })
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            console.error('[Outreach] Gemini API error:', response.status, errText);
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log('[Outreach] Raw AI response:', text.substring(0, 200));

        // Extract JSON
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log('[Outreach] Successfully parsed AI response');
            return parsed;
        }

        console.log('[Outreach] Could not parse JSON, using templates');
        return {
            email: emailTemplate,
            linkedin: linkedinTemplate,
            instagram: instagramTemplate,
            whatsapp: whatsappTemplate
        };
    } catch (error) {
        console.error("[Outreach] Generation failed:", error);
        // Return the good templates as fallback
        return {
            email: emailTemplate,
            linkedin: linkedinTemplate,
            instagram: instagramTemplate,
            whatsapp: whatsappTemplate
        };
    }
};

// Bulk generate messages for multiple leads
export const bulkGenerateMessages = async (leads: LeadOutreachInput[]): Promise<Map<string, OutreachMessages>> => {
    const results = new Map<string, OutreachMessages>();

    for (const lead of leads) {
        try {
            const messages = await generateAllMessages(lead);
            results.set(lead.businessName, messages);
        } catch (e) {
            console.error(`Message generation failed for ${lead.businessName}:`, e);
        }
    }

    return results;
};
