import { Router } from 'express';
import { supabase } from '../supabaseClient.js';

const router = Router();

const OUTREACH_API_URL = process.env.OUTREACH_API_URL || '';

// Get Outreach projects (proxy to Outreach API)
router.get('/api/outreach/projects', async (req, res) => {
    if (!OUTREACH_API_URL) {
        return res.status(500).json({ error: 'OUTREACH_API_URL not configured. Set it in environment variables.' });
    }
    try {
        const response = await fetch(`${OUTREACH_API_URL}/api/projects`);
        const data = await response.json();
        res.json(data);
    } catch (error: any) {
        console.error('Outreach Projects Fetch Error:', error);
        res.status(500).json({ error: `Cannot reach Outreach app: ${error.message}` });
    }
});

// Push selected leads to Outreach
router.post('/api/push-to-outreach', async (req, res) => {
    if (!OUTREACH_API_URL) {
        return res.status(500).json({ error: 'OUTREACH_API_URL not configured. Set it in environment variables.' });
    }
    try {
        const { leadIds: rawLeadIds, outreachProjectId } = req.body;
        if (!rawLeadIds || !Array.isArray(rawLeadIds) || rawLeadIds.length === 0) {
            return res.status(400).json({ error: 'leadIds array required' });
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const leadIds = rawLeadIds.filter(id => uuidRegex.test(id));

        if (leadIds.length === 0) {
            return res.status(400).json({ error: 'No valid UUIDs provided. Please ensure your leads are synced to the database first.' });
        }
        if (!outreachProjectId) {
            return res.status(400).json({ error: 'outreachProjectId required' });
        }

        // Fetch full lead data from our Supabase IN BATCHES
        // PostgREST encodes .in() filter in URL — 665 UUIDs = ~24KB URL which exceeds limits
        const FETCH_BATCH = 100;
        let leads: any[] = [];
        for (let i = 0; i < leadIds.length; i += FETCH_BATCH) {
            const idBatch = leadIds.slice(i, i + FETCH_BATCH);
            const { data, error: fetchError } = await supabase
                .from('leads')
                .select('*')
                .in('id', idBatch);
            if (fetchError) throw fetchError;
            if (data) leads = leads.concat(data);
        }

        if (leads.length === 0) {
            return res.status(404).json({ error: 'No leads found for the given IDs' });
        }

        // Map GrowthScout lead fields → Outreach contact format
        const mappedLeads = leads.map((lead: any) => {
            // Smart name resolution
            const founderName = lead.founder_name && lead.founder_name !== 'Not Found' ? lead.founder_name : null;
            let name: string;

            if (founderName) {
                // Real person name — use as-is
                name = founderName;
            } else if (lead.business_name) {
                // No founder — create a casual team name from the business name
                // e.g. "Blouberg Wellness Center" → "Blouberg Team"
                // e.g. "Dr. Smith's Family Dentistry LLC" → "Smith Team"
                const noise = ['llc', 'inc', 'corp', 'ltd', 'co', 'company', 'group', 'services',
                    'solutions', 'center', 'centre', 'clinic', 'spa', 'studio', 'salon',
                    'agency', 'associates', 'enterprises', 'international', 'the', 'and',
                    'of', 'for', 'at', 'by', '&', 'pvt', 'private', 'limited'];
                const words = lead.business_name
                    .replace(/[.,'"()]/g, '')   // strip punctuation
                    .replace(/dr\.\s*/i, '')     // strip "Dr."
                    .replace(/'s\b/g, '')        // strip possessives
                    .split(/\s+/)
                    .filter((w: string) => w.length > 0 && !noise.includes(w.toLowerCase()));

                // Take first 1-2 meaningful words
                const shortName = words.slice(0, 2).join(' ') || lead.business_name.split(/\s+/)[0];
                name = `${shortName} Team`;
            } else {
                name = 'Unknown';
            }

            // Prefer contact_email, fall back to email
            const email = lead.contact_email || lead.email || '';
            // Build bio from analysis bullets
            const bio = Array.isArray(lead.analysis_bullets)
                ? lead.analysis_bullets.join(' • ')
                : (lead.analysis_bullets || '');

            return {
                name,
                email,
                company: lead.business_name || '',
                linkedin: lead.linkedin || null,
                instagram: lead.instagram || null,
                phone: lead.phone || null,
                website: lead.website || lead.original_url || null,
                category: lead.category || 'Unknown',
                location: lead.search_location || lead.address || null,
                niche: lead.category || null,
                rating: lead.rating || null,
                review_count: lead.review_count || null,
                review_url: lead.review_url || null,
                bio,
                pagespeed_mobile: lead.pagespeed_mobile || null,
                pagespeed_desktop: lead.pagespeed_desktop || null,
                audit_data: lead.audit_data || null,
                analysis_bullets: lead.analysis_bullets || null,
                enrichment_data: {
                    source_app: 'growthscout',
                    quality_score: lead.quality_score,
                    digital_score: lead.digital_score,
                    seo_score: lead.seo_score,
                    whatsapp_verified: lead.whatsapp_verified,
                    search_query: lead.search_query,
                    search_location: lead.search_location,
                    category: lead.category,
                    niche: lead.category,
                    rating: lead.rating || null,
                    review_count: lead.review_count || null,
                    // If the email was found via Serper (Google indexed it), it's already OSINT-verified.
                    // QuickReach's send_emails.py reads this flag to skip redundant OSINT on risky contacts.
                    ...(lead.audit_data?.serper_searched ? { serper_verified: true } : {}),
                }
            };
        });

        // POST to Outreach's import endpoint IN BATCHES to avoid payload size limits
        // 665 leads with full audit_data can exceed Railway/Gunicorn body limit
        const BATCH_SIZE = 100;
        let totalImported = 0;
        let totalSkipped = 0;
        let totalErrors = 0;

        for (let i = 0; i < mappedLeads.length; i += BATCH_SIZE) {
            const batch = mappedLeads.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(mappedLeads.length / BATCH_SIZE);
            console.log(`[Push to Outreach] Sending batch ${batchNum}/${totalBatches} (${batch.length} leads)...`);
            
            const response = await fetch(`${OUTREACH_API_URL}/api/import-leads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: outreachProjectId,
                    leads: batch
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error(`[Push to Outreach] Batch ${batchNum} failed (${response.status}): ${errText}`);
                totalErrors += batch.length;
                continue; // Don't abort entire push for one failed batch
            }

            const batchResult = await response.json();
            totalImported += batchResult.imported || 0;
            totalSkipped += batchResult.skipped || 0;
        }

        res.json({
            success: true,
            imported: totalImported,
            skipped: totalSkipped,
            errors: totalErrors,
            message: `Pushed ${totalImported} leads to Outreach (${totalSkipped} skipped as duplicates${totalErrors ? `, ${totalErrors} errors` : ''})`
        });

    } catch (error: any) {
        console.error('Push to Outreach Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
