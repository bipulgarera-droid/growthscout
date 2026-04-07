
import { createClient } from '@supabase/supabase-js';
import { extractLogo, extractContactInfo } from './analysis.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
// Vercel Template DB (Hardcoded/Env)
const VERCEL_DB_URL = 'https://gouevxvwapnpykvhasgl.supabase.co';
const VERCEL_DB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvdWV2eHZ3YXBucHlrdmhhc2dsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ1MDYwNCwiZXhwIjoyMDg1MDI2NjA0fQ.LeMsmw17vnbdZQr5TFDd5R480SQ8xekD-Wievfiraro';

const websiteSupabase = createClient(VERCEL_DB_URL, VERCEL_DB_KEY);

export interface SiteGenInput {
    id?: string;
    businessName: string; // or name
    phone?: string;
    email?: string;
    contactEmail?: string;
    address?: string;
    logoUrl?: string;
    website?: string; // or website_url
    templateType?: string;
    themeTagline?: string;
    themeHeroPhrases?: string[];
    themeColorPalette?: string;
    themeServices?: string[];
}

export const generateWebsite = async (business: SiteGenInput): Promise<{ success: boolean; previewUrl: string }> => {
    const businessName = business.businessName;
    console.log(`[SiteGen] Generating site for ${businessName}...`);

    const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // ALWAYS Upsert (Insert or Update) to support "Regenerate"
    const contactInfo = {
        phone: business.phone,
        email: business.contactEmail || business.email,
        address: business.address
    };

    // If the user already provided a logoUrl (e.g. via manual upload), use it.
    let finalLogoUrl = business.logoUrl;
    const websiteUrl = business.website;

    if (websiteUrl) {
        console.log(`[SiteGen] Extraction requested for ${businessName} from ${websiteUrl}...`);
        try {
            // 1. Only extract logo if we don't already have one
            if (!finalLogoUrl) {
                const extracted = await extractLogo(websiteUrl);
                if (extracted) {
                    finalLogoUrl = extracted;
                    console.log(`[SiteGen] 🎯 Freshly extracted logo: ${finalLogoUrl}`);
                } else {
                    console.log(`[SiteGen] Extraction returned nothing. Using text fallback.`);
                }
            } else {
                console.log(`[SiteGen] Using existing provided logoUrl: ${finalLogoUrl}`);
            }

            // 2. Extract contact info if missing
            if (!contactInfo.email || !contactInfo.phone) {
                const scrapedContact = await extractContactInfo(websiteUrl);
                if (!contactInfo.email && scrapedContact.email) {
                    contactInfo.email = scrapedContact.email;
                    console.log(`[SiteGen] 📧 Extracted email: ${contactInfo.email}`);
                }
                if (!contactInfo.phone && scrapedContact.phone) {
                    contactInfo.phone = scrapedContact.phone;
                    console.log(`[SiteGen] 📞 Extracted phone: ${contactInfo.phone}`);
                }
            }
        } catch (e) {
            console.warn('[SiteGen] Extraction failed:', e);
        }
    }

    const { error: upsertError } = await websiteSupabase
        .from('personalized_previews')
        .upsert({
            slug,
            business_name: businessName,
            logo_url: finalLogoUrl || null,
            contact_info: contactInfo,
            theme_settings: {
                tagline: business.themeTagline,
                heroPhrases: business.themeHeroPhrases,
                colorPalette: business.themeColorPalette,
                services: business.themeServices
            }
        }, { onConflict: 'slug' });

    if (upsertError) {
        console.error('Supabase Upsert Error (Vercel DB):', upsertError);
        throw new Error(`Failed to save to Vercel DB: ${upsertError.message}`);
    }

    // Point to Live Vercel Template
    const templateType = business.templateType || 'medspa';
    const TEMPLATE_URLS: Record<string, string> = {
        medspa: process.env.MEDSPA_TEMPLATE_URL || 'https://medspa-website.vercel.app',
        fitness: process.env.FITNESS_TEMPLATE_URL || 'https://fitnessformula.vercel.app'
    };
    const baseUrl = TEMPLATE_URLS[templateType.toLowerCase()] || TEMPLATE_URLS['medspa'];
    const previewUrl = `${baseUrl}/preview/${slug}`;

    return { success: true, previewUrl };
};

export const bulkGenerateWebsites = async (leads: SiteGenInput[]): Promise<Map<string, { success: boolean; previewUrl: string; error?: string }>> => {
    const results = new Map<string, { success: boolean; previewUrl: string; error?: string }>();

    // Process in chunks of 3 to avoid rate limits
    const CHUNK_SIZE = 3;
    for (let i = 0; i < leads.length; i += CHUNK_SIZE) {
        const chunk = leads.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (lead) => {
            try {
                // Ensure name/businessName compatibility
                const input = {
                    ...lead,
                    businessName: lead.businessName // Ensure this field exists
                };
                const result = await generateWebsite(input);
                results.set(lead.businessName, result);
            } catch (e: any) {
                console.error(`Failed to generate site for ${lead.businessName}:`, e);
                results.set(lead.businessName, { success: false, previewUrl: '', error: e.message });
            }
        }));
    }

    return results;
};
