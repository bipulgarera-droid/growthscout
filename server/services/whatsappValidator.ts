import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);
const APIFY_TOKEN = process.env.APIFY_API_KEY;

function formatPhoneNumber(phone: string, location: string): string {
    let cleanPhone = phone.replace(/\D/g, '');
    const locLower = (location || '').toLowerCase();

    // Smart Country Formatting Heuristics
    if (locLower.includes('uk') || locLower.includes('united kingdom') || locLower.includes('london') || locLower.includes('england')) {
        if (cleanPhone.length === 10 && cleanPhone.startsWith('7')) return '44' + cleanPhone;
        if (cleanPhone.startsWith('0')) return '44' + cleanPhone.slice(1);
        if (!cleanPhone.startsWith('44')) return '44' + cleanPhone;
    } else if (locLower.includes('in') || locLower.includes('india')) {
        if (cleanPhone.length === 10) return '91' + cleanPhone;
        if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) return '91' + cleanPhone.slice(1);
    } else {
        // Default to US/Canada logic (most generic expectation for GrowthScout default)
        if (cleanPhone.length === 10) return '1' + cleanPhone;
        // If it already has the 1, keep it.
        if (cleanPhone.length > 10 && cleanPhone.startsWith('1')) return cleanPhone;
    }

    return cleanPhone; // Fallback
}

export const verifyWhatsAppBulk = async (leadIds: string[]) => {
    console.log(`[WhatsApp Validator] Starting bulk check for ${leadIds.length} leads...`);

    if (!APIFY_TOKEN) {
        console.error("[WhatsApp Validator] Missing APIFY_API_KEY");
        return { success: false, error: "Missing API Key" };
    }

    // Fetch leads
    const { data: leads, error } = await supabase
        .from('leads')
        .select('id, business_name, phone, search_location')
        .in('id', leadIds)
        .not('phone', 'is', 'null')
        .neq('phone', '');

    if (error || !leads || leads.length === 0) {
        console.error("[WhatsApp Validator] Fetch failed or no valid phones found.", error);
        return { success: false, checkedCount: 0 };
    }

    // Execute concurrently using Promise.all to bypass the "1 run at a time" limit of the actor design
    const promises = leads.map(async (lead) => {
        try {
            const formattedPhone = formatPhoneNumber(lead.phone, lead.search_location);
            console.log(`[WhatsApp Validator] Translating ${lead.phone} -> ${formattedPhone} for Apify`);

            const runUrl = `https://api.apify.com/v2/acts/devscrapper~whatsapp-number-validator/runs?token=${APIFY_TOKEN}`;
            const runRes = await fetch(runUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: formattedPhone })
            });

            if (!runRes.ok) {
                console.error(`[WhatsApp Validator] Failed to start Apify for ${lead.business_name} (Status: ${runRes.status})`);
                return;
            }

            const runResult = await runRes.json();
            const datasetId = runResult.data.defaultDatasetId;
            const runId = runResult.data.id;

            // Poll for completion (Expected ~3-7 seconds based on test logs)
            let isFinished = false;
            let retries = 0;
            while (!isFinished && retries < 15) {
                await new Promise(r => setTimeout(r, 2000));
                const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
                const statusData = await statusRes.json();
                const status = statusData.data.status;

                if (status === 'SUCCEEDED') isFinished = true;
                if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
                    console.error(`[WhatsApp Validator] Actor failed for ${lead.business_name}. Status: ${status}`);
                    break;
                }
                retries++;
            }

            if (!isFinished) return;

            const datasetRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
            const items = await datasetRes.json();

            if (items && items.length > 0) {
                const waExists = items[0].exists === true;

                // Update Supabase Database
                await supabase
                    .from('leads')
                    .update({ whatsapp_verified: waExists })
                    .eq('id', lead.id);

                console.log(`[WhatsApp Validator] ✔️ Updated ${lead.business_name} -> WA Exists: ${waExists}`);
            }

        } catch (e) {
            console.error(`[WhatsApp Validator] Error processing ${lead.business_name}:`, e);
        }
    });

    // Wait for all the parallel checks to complete
    await Promise.all(promises);

    console.log(`[WhatsApp Validator] Finished bulk checking batch of ${leads.length}`);
    return { success: true, checkedCount: leads.length };
};

export const verifyWhatsAppDirect = async (leads: { id: string; phone: string; location?: string }[]) => {
    console.log(`[WhatsApp Validator] Starting direct bulk check for ${leads.length} leads...`);

    if (!APIFY_TOKEN) {
        console.error("[WhatsApp Validator] Missing APIFY_API_KEY");
        throw new Error("Missing API Key");
    }

    const results: Record<string, boolean> = {};

    // Chunk size of 8 to respect Apify concurrent worker limits on standard accounts
    const CHUNK_SIZE = 8;
    console.log(`[WhatsApp Validator] Chunking ${leads.length} leads into batches of ${CHUNK_SIZE} to respect Apify limits`);

    for (let i = 0; i < leads.length; i += CHUNK_SIZE) {
        const chunk = leads.slice(i, i + CHUNK_SIZE);
        console.log(`[WhatsApp Validator] Processing batch ${Math.floor(i / CHUNK_SIZE) + 1} of ${Math.ceil(leads.length / CHUNK_SIZE)}`);

        const promises = chunk.map(async (lead) => {
            if (!lead.phone) return;
            try {
                const formattedPhone = formatPhoneNumber(lead.phone, lead.location || '');
                const runUrl = `https://api.apify.com/v2/acts/devscrapper~whatsapp-number-validator/runs?token=${APIFY_TOKEN}`;
                const runRes = await fetch(runUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phoneNumber: formattedPhone })
                });

                if (!runRes.ok) {
                    console.error(`[WhatsApp Validator] Failed to start Apify for ${lead.phone} (HTTP ${runRes.status})`);
                    return;
                }

                const runResult = await runRes.json();
                const datasetId = runResult.data.defaultDatasetId;
                const runId = runResult.data.id;

                let isFinished = false;
                let retries = 0;
                while (!isFinished && retries < 20) { // Timeout 40s
                    await new Promise(r => setTimeout(r, 2000));
                    const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
                    const statusData = await statusRes.json();
                    const status = statusData.data.status;

                    if (status === 'SUCCEEDED') isFinished = true;
                    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) break;
                    retries++;
                }

                if (!isFinished) {
                    console.log(`[WhatsApp Validator] Timeout or failed for ${lead.phone}`);
                    return;
                }

                const datasetRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
                const items = await datasetRes.json();

                if (items && items.length > 0) {
                    results[lead.id] = items[0].exists === true;
                }
            } catch (e) {
                console.error(`[WhatsApp Validator] Error processing ${lead.phone}:`, e);
            }
        });

        // Wait for this chunk to completely finish before starting the next chunk
        await Promise.all(promises);
    }

    console.log(`[WhatsApp Validator] Completed all batches. Found validation results for ${Object.keys(results).length} leads.`);
    return results;
};
