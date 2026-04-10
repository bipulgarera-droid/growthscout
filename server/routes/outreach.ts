import { Router } from 'express';
import { supabase } from '../supabaseClient.js';

const router = Router();

const OUTREACH_API_URL = process.env.OUTREACH_API_URL || '';

// Get Outreach projects (proxy to Outreach API)
router.get('/api/outreach/projects', async (req, res) => {
    if (!OUTREACH_API_URL) {
        return res.status(500).json({ error: 'OUTREACH_API_URL not configured. Set it in environment variables.' });
    }
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Missing Authorization header in request' });
    }
    try {
        const response = await fetch(`${OUTREACH_API_URL}/api/projects`, {
            headers: { 'Authorization': authHeader }
        });
        const data = await response.json();
        res.status(response.status).json(data);
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

        // Fetch full lead data from our Supabase
        const { data: leads, error: fetchError } = await supabase
            .from('leads')
            .select('*')
            .in('id', leadIds);

        if (fetchError) throw fetchError;
        if (!leads || leads.length === 0) {
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
                    // If the email was found via Serper (Google indexed it), it's already OSINT-verified.
                    // QuickReach's send_emails.py reads this flag to skip redundant OSINT on risky contacts.
                    ...(lead.audit_data?.serper_searched ? { serper_verified: true } : {}),
                }
            };
        });

        // POST to Outreach's import endpoint
        const response = await fetch(`${OUTREACH_API_URL}/api/import-leads`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': req.headers.authorization || ''
            },
            body: JSON.stringify({
                project_id: outreachProjectId,
                leads: mappedLeads
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Outreach API error (${response.status}): ${errText}`);
        }

        const result = await response.json();

        res.json({
            success: true,
            ...result,
            message: `Pushed ${result.imported || 0} leads to Outreach (${result.skipped || 0} skipped as duplicates)`
        });

    } catch (error: any) {
        console.error('Push to Outreach Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
