
import { discoverBusinesses, DiscoveredBusiness } from './apify.js';
import { findFounderInfo, quickEnrich } from './serper.js';
import { captureScreenshot } from './screenshot.js';
import { generateOutreachMessage } from './outreach.js';
import { saveLead, savePreview, generateSlug } from './persistence.js';

export interface PipelineResult {
    business: DiscoveredBusiness;
    contact: any;
    slug: string;
    previewUrl: string;
    outreachMessage: string;
    audit: any;
    status: 'success' | 'error';
    error?: string;
}

export const processLead = async (biz: DiscoveredBusiness, projectId?: string, templateType: string = 'medspa'): Promise<PipelineResult> => {
    try {
        console.log(`[Pipeline] Processing: ${biz.name}`);

        // A. Enrichment
        const founderInfo = await findFounderInfo(biz.name, biz.address);

        // A.1 Verify WhatsApp (Now handled asynchronously via UI Bulk Checks)
        let isWhatsAppVerified = false;

        // B. Audit (Screenshot)
        let screenshotBase64 = null;
        let speedScore = 0;
        if (biz.website) {
            try {
                const shot = await captureScreenshot({ url: biz.website, view: 'desktop', waitMs: 2000 });
                screenshotBase64 = shot.base64Image;
                // Mock speed score for now (Puppeteer performance API takes extra work)
                // Random score inversely proportional to load time would be better, but random is okay for MVP
                speedScore = Math.floor(40 + Math.random() * 50);
            } catch (e) {
                console.error(`Screenshot failed for ${biz.website}`, e);
            }
        }

        // C. Personalization (Supabase)
        const slug = biz.website ? generateSlug(biz.website) : generateSlug(biz.name + (biz.address || ''));
        const TEMPLATE_URLS: Record<string, string> = {
            medspa: process.env.MEDSPA_TEMPLATE_URL || 'https://medspa-website.vercel.app',
            fitness: process.env.FITNESS_TEMPLATE_URL || 'https://fitnessformula.vercel.app'
        };
        const baseUrl = TEMPLATE_URLS[templateType.toLowerCase()] || TEMPLATE_URLS['medspa'];
        const previewUrl = `${baseUrl}/preview/${slug}`;

        // Upsert Preview Data
        await savePreview({
            slug,
            business_name: biz.name,
            contact_info: { ...founderInfo, phone: biz.phone, address: biz.address },
            logo_url: biz.imageUrl, // Apify often gives a photo or logo
            website_url: biz.website
        });

        // D. Outreach Generation
        const contactName = founderInfo.founderName || "Owner";
        const missingFeatures = ["Mobile Responsiveness", "Clear CTA", "Modern Design"]; // Mock analysis results
        const message = await generateOutreachMessage(
            biz.name,
            contactName,
            biz.website || "",
            undefined,
            speedScore,
            missingFeatures
        );

        // E. Save to Leads Table (Persistence)
        const leadData = {
            business_name: biz.name,
            original_url: biz.website,
            address: biz.address,
            rating: biz.rating,
            review_count: biz.reviewCount,
            contact_info: { ...founderInfo, phone: biz.phone },
            audit_data: {
                speed_score: speedScore,
                screenshot_url: "stored_locally", // We don't save base64 to DB to save space
                issues: missingFeatures
            },
            whatsapp_verified: isWhatsAppVerified,
            slug,
            preview_url: previewUrl,
            outreach_message: message,
            status: 'processed',
            project_id: projectId
        };


        const savedLead = await saveLead(leadData);

        // F. Return success result
        return {
            business: biz,
            contact: founderInfo,
            slug,
            previewUrl,
            outreachMessage: message,
            audit: { speedScore, screenshot: screenshotBase64 }, // Send base64 to frontend for immediate display
            status: 'success'
        };

    } catch (error: any) {
        console.error(`Failed to process ${biz.name}:`, error);
        return {
            business: biz,
            contact: {},
            slug: '',
            previewUrl: '',
            outreachMessage: '',
            audit: {},
            status: 'error',
            error: error.message
        };
    }
};

export const runPipeline = async (keyword: string, location: string, maxResults: number = 5, projectId?: string, templateType: string = 'medspa'): Promise<PipelineResult[]> => {
    console.log(`[Pipeline] Starting for "${keyword}" in "${location}" (Project: ${projectId || 'None'}) using template: ${templateType}`);

    // 1. Discover
    let businesses: DiscoveredBusiness[] = [];
    try {
        businesses = await discoverBusinesses({ query: keyword, location, maxResults });
    } catch (e) {
        console.error("Discovery failed", e);
        throw e;
    }

    const results: PipelineResult[] = [];

    // 2. Process each lead
    // (In production, use P-Queue or Promise.allLimit. Here, standard for-of loop to avoid rate limits)
    for (const biz of businesses) {
        const result = await processLead(biz, projectId, templateType);
        results.push(result);
    }

    return results;
};
