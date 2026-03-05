import { WebsiteAudit, Business } from "../types";

// Use VITE_GEMINI_API_KEY from .env for frontend access
const apiKey = import.meta.env?.VITE_GEMINI_API_KEY || '';

if (!apiKey) {
  console.warn('WARNING: VITE_GEMINI_API_KEY is not set. Audit features will not work.');
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// 1. Audit Screenshot for Design Flaws
export const analyzeDesignQuality = async (base64Image: string): Promise<WebsiteAudit> => {
  try {
    const response = await fetch(`${GEMINI_API_BASE}/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
            {
              text: `Act as a harsh UI/UX Critic and Sales Qualifier for a Web Design Agency.
              Analyze this website screenshot.
              
              Determine if this lead is "Qualified" (i.e., the design is bad/outdated, giving us an opportunity to sell a redesign).
              
              Return JSON:
              - isBadDesign: boolean (true if outdated, non-responsive, ugly, or poor UX)
              - qualificationReason: string (e.g., "Qualified: Site looks like it was built in 2010, likely losing customers.")
              - designFlaws: string[] (List 3 specific visual/UX failures)
              - brandAssetsDetected: string[] (List colors/elements seen, e.g., "Red and Black palette", "Serif logo")
              - summary: string (Professional summary of the audit)
              - actionItems: array of objects { title, description, priority (High/Medium), costEstimate, expectedImpact, category (Design/Conversion) }
                (Focus action items on how a REDESIGN would fix money problems, e.g., "Mobile Responsive Redesign" -> "Capture 50% more mobile traffic")`
            }
          ]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) return JSON.parse(text) as WebsiteAudit;
    throw new Error("No response from AI");
  } catch (error) {
    console.error("Design analysis failed", error);
    throw error;
  }
};

// 2. Find Contacts (Enrichment)
export const findContactInfo = async (businessName: string, location: string) => {
  try {
    const response = await fetch(`${GEMINI_API_BASE}/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Find the official Instagram profile URL, LinkedIn company page URL, and a public contact email for "${businessName}" located in "${location}".
            
            If you find them, extract the direct links.
            Return JSON only: { instagram: string | null, linkedin: string | null, email: string | null }`
          }]
        }],
        tools: [{ googleSearch: {} }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) return JSON.parse(text);
    return { instagram: null, linkedin: null, email: null };
  } catch (error) {
    console.error("Enrichment failed", error);
    return { instagram: null, linkedin: null, email: null };
  }
};

// 2b. Find Founder (Specific Enrichment)
export const findFounderInfo = async (businessName: string, location: string) => {
  try {
    const response = await fetch(`${GEMINI_API_BASE}/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Who is the owner or founder of "${businessName}" in "${location}"?
            Find their name, their personal LinkedIn profile URL (or the business LinkedIn), and a contact email.
            
            Return JSON:
            { founderName: string | null, linkedin: string | null, email: string | null }`
          }]
        }],
        tools: [{ googleSearch: {} }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) return JSON.parse(text);
    return { founderName: null, linkedin: null, email: null };
  } catch (error) {
    console.error("Founder enrichment failed", error);
    return { founderName: null, linkedin: null, email: null };
  }
};

// 3. Generate Visual Pitch (Redesign)
// Helper: The Architect (Generates the Unified Style Guide)
interface StyleGuide {
  brandColors: string[];
  logoDescription: string;
  logoText: string; // New: Strict text
  typography: string;
  visualStyle: string;
  keyImagery: string; // New: Specific imagery to retain
  serviceList: string[]; // New: Strict services
  masterPrompt: string;
}

const generateStyleGuide = async (base64: string, businessType: string, style: string, mimeType: string = 'image/png'): Promise<StyleGuide> => {
  const promptResponse = await fetch(`${GEMINI_API_BASE}/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inlineData: { data: base64, mimeType: mimeType } },
          {
            text: `You are a world-class Design Director (The Architect).
            
            Goal: Perform a surgical analysis of the brand DNA in the provided screenshot.
            
            Input Context:
            - Business Type: ${businessType}
            - Target Style: ${style}
            
            TASK: Extract the exact literal strings and visual assets.
            
            OUTPUT: A valid JSON object ONLY.
            
            Structure:
            {
              "brandColors": ["#hex", "#hex"], 
              "logoDescription": "PIXEL-LEVEL visual description of the logo icon/graphic.",
              "logoText": "The ABSOLUTELY EXACT string of text in the logo (e.g. 'VINTAGE ROCK HAIR STUDIO'). Check for case sensitivity.",
              "typography": "The font family and weight used in the original logo and hero.",
              "visualStyle": "Keywords (e.g. 'Retro-Modern', 'High-Contrast').",
              "keyImagery": "EXTREMLY DETAILED description of the specific hero image/person (e.g. 'Retro-styled woman with red lipstick, looking through her fingers, sepia tone').",
              "serviceList": ["Service 1", "Service 2"], (Extract EVERY single service name found in the navigation or service section. DO NOT SUMMARIZE. e.g. 'Spray Tanning', 'Massage Therapy').,
              "masterPrompt": "A single paragraph describing the master layout strategy."
            }`
          }
        ]
      }]
    })
  });

  const data = await promptResponse.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  try {
    const cleanJson = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("Failed to parse Style Guide JSON", e);
    return {
      brandColors: [],
      logoDescription: "Existing Logo",
      logoText: "Company Name",
      typography: "Modern Sans-serif",
      visualStyle: "Clean Professional",
      keyImagery: "Professional photography.",
      serviceList: ["Our Services"],
      masterPrompt: "A high-fidelity website redesign."
    };
  }
};

// 3. Generate Visual Pitch (Redesign) - The Artist
export const generateRedesignPreview = async (
  originalScreenshotBase64: string,
  businessType: string,
  templateId: string = '1',
  belowFoldScreenshotBase64?: string,
  mimeType: string = 'image/png'
): Promise<{ top: string; bottom?: string }> => {
  try {
    const templatePrompts: Record<string, string> = {
      '1': "Modern Minimalist: Clean white background, airy layout, 'Stripe-like' quality.",
      '2': "Corporate Professional: Trustworthy blues/greys, structured grid.",
      '3': "Dark Luxury: Dark background, bright accents, 'Apple-style' dark mode.",
      '4': "Vibrant Creative: Bold colors, dynamic shapes, 'Dribbble' style.",
      '5': "High Conversion SaaS: Clear value prop, trust badges, bright CTA."
    };

    const selectedStyle = templatePrompts[templateId] || templatePrompts['1'];

    // Step 1: The Architect (Generate Unified Style Guide ONCE)
    console.log("[Architect] Generating Unified Style Guide...");
    const styleGuide = await generateStyleGuide(originalScreenshotBase64, businessType, selectedStyle, mimeType);
    console.log("[Architect] Guide Created:", styleGuide);

    // LOGIC: ALWAYS Generate Single Tall Image (3:4)
    const modelAspectRatio = "3:4";

    console.log(`[Artist] Generating Single Shot (${modelAspectRatio})...`);

    const imageParts = [{ inlineData: { data: originalScreenshotBase64, mimeType: mimeType } }];
    if (belowFoldScreenshotBase64) {
      imageParts.push({ inlineData: { data: belowFoldScreenshotBase64, mimeType: mimeType } });
    }

    const response = await fetch(`${GEMINI_API_BASE}/gemini-3-pro-image-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            ...imageParts,
            {
              text: `YOU ARE A WORLD-CLASS WEB DESIGNER creating a premium website redesign.

BRAND DNA (EXTRACT FROM REFERENCE IMAGE - DO NOT CHANGE):
- LOGO: ${styleGuide.logoDescription} with text "${styleGuide.logoText}"
- HERO SUBJECT: ${styleGuide.keyImagery}
- SERVICES: ${styleGuide.serviceList.join(' | ')}
- BRAND COLORS: ${styleGuide.brandColors.join(', ')}

⚠️ CRITICAL LOGO REQUIREMENT:
The logo in the reference image is a distinctive brand asset. You MUST:
1. COPY the exact logo graphic/icon from the reference image
2. Do NOT redesign or reimagine the logo
3. Do NOT just use plain text - include the logo ICON/GRAPHIC as shown
4. Place it prominently in the header

DESIGN MANDATE (INNOVATE LAYOUT - RETAIN BRAND ASSETS):
Create a FRESH, PREMIUM layout from scratch (Apple/Stripe/Vercel style).
But KEEP these exact assets: Logo icon, Hero person/image, Service names.

MASTER STRUCTURE (Hook → Value → Proof → CTA):
1. HERO SECTION (Top 30%):
   - EXACT logo graphic from reference image + "${styleGuide.logoText}"
   - Bold headline (use their existing tagline or improve it)
   - Premium hero image featuring: ${styleGuide.keyImagery}
   - Single bright CTA button
   - LOTS of whitespace

2. VALUE SECTION (Middle 40%):
   - Heading: "Our Services" or similar
   - Modern card grid showing EXACTLY these services: ${styleGuide.serviceList.join(', ')}
   - Each card: Icon + Service Name + Brief description
   - Clean, minimal aesthetic

3. PROOF SECTION (Next 20%):
   - Heading: "Client Love" or "What Our Clients Say" (NEVER "Social Proof")
   - 2-3 testimonial cards with photos and quotes
   - Trust badges if applicable

4. FOOTER/CTA (Bottom 10%):
   - Final call to action
   - Contact info
   - Brand colors as accent

CRITICAL RULES:
- Use generous whitespace (premium feel)
- One message per fold
- Typography: ${styleGuide.typography}
- Style: ${styleGuide.visualStyle}

OUTPUT: 2K resolution, vertical full-page website mockup.`
            }
          ]
        }],
        generationConfig: {
          imageConfig: {
            imageSize: "2K",
            aspectRatio: modelAspectRatio
          }
        }
      })
    });

    const data = await response.json();
    let generatedImage = "";
    for (const part of data.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        generatedImage = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!generatedImage) throw new Error("No image generated");

    // ALWAYS return the same tall image for both slots.
    // Frontend handles cropping for "Top".
    return { top: generatedImage, bottom: generatedImage };

  } catch (error) {
    console.error("Redesign generation failed", error);
    throw error;
  }
};

// 4. Generate Outreach Message
export const generateOutreachMessage = async (business: Business, audit: WebsiteAudit, platform: 'Email' | 'Instagram' | 'LinkedIn') => {
  try {
    const response = await fetch(`${GEMINI_API_BASE}/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Write a short, punchy, high-converting cold outreach message for ${platform}.
      
      Sender: A premium web design agency.
      Recipient: "${business.name}" (Category: ${business.category}).
      
      Context: We analyzed their website and found these issues: ${audit.designFlaws.join(', ')}.
      We have already prepared a mock-up redesign for them.
      
      Goal: Get them to reply to see the redesign.
      
      Tone: Professional, helpful, not spammy.
      Length: Short (under 100 words).
      `
          }]
        }],
        generationConfig: {
          temperature: 0.7
        }
      })
    });

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Could not generate message.";
  } catch (error) {
    return "Error generating message.";
  }
};