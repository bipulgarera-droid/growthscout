import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Load environment variables from parent directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5010;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ============ STATIC FILE SERVING (PRODUCTION) ============
const distPath = path.resolve(__dirname, '../dist');
const isProduction = fs.existsSync(distPath);
if (isProduction) {
    console.log('📦 Production mode: serving static files from dist/');
    app.use(express.static(distPath));
}

// Root route with helpful info (only in dev mode when no dist/ exists)
if (!isProduction) {
    app.get('/', (req, res) => {
        const slidesAuthorized = isAuthorized();
        res.send(`
            <html>
            <head><title>GrowthScout API</title><style>body{font-family:system-ui;padding:40px;max-width:600px;margin:0 auto}a{color:#2563eb}code{background:#f1f5f9;padding:2px 6px;border-radius:4px}.status{display:inline-block;padding:4px 12px;border-radius:99px;font-size:14px}.ok{background:#dcfce7;color:#166534}.pending{background:#fef3c7;color:#92400e}</style></head>
            <body>
                <h1>🚀 GrowthScout API</h1>
                <h3>Status</h3>
                <ul>
                    <li>Server: <span class="status ok">Running</span></li>
                    <li>Google Slides: <span class="status ${slidesAuthorized ? 'ok' : 'pending'}">${slidesAuthorized ? 'Authorized' : 'Not Authorized'}</span>
                        ${!slidesAuthorized ? `<br><a href="/api/slides/auth-url">→ Click to get auth URL</a>` : ''}
                    </li>
                </ul>
                <h3>Endpoints</h3>
                <ul>
                    <li><code>POST /api/screenshot</code> - Capture website screenshot</li>
                    <li><code>POST /api/slides</code> - Generate Google Slides proposal</li>
                    <li><code>POST /api/discover</code> - Discover businesses via Apify</li>
                </ul>
            </body>
            </html>
        `);
    });
}

// Basic health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'GrowthScout Backend is running' });
});

// ============ SCREENSHOT SERVICE ============
import { captureScreenshot } from './services/screenshot.js';

app.post('/api/screenshot', async (req, res) => {
    try {
        const { url, view, fullPage } = req.body;
        if (!url) {
            res.status(400).json({ error: 'URL is required' });
            return;
        }
        const result = await captureScreenshot({ url, view, fullPage });
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============ SLIDES SERVICE (OAuth2) ============
import { createSlides, getAuthUrl, handleOAuthCallback, isAuthorized } from './services/slides.js';

// Check if Google Slides is authorized
app.get('/api/slides/auth-status', (req, res) => {
    res.json({ authorized: isAuthorized() });
});

// Get Google OAuth URL for user authorization
app.get('/api/slides/auth-url', (req, res) => {
    const url = getAuthUrl();
    if (!url) {
        res.status(500).json({ error: 'Missing credentials.json' });
        return;
    }
    res.json({ authUrl: url });
});

// OAuth2 callback endpoint
app.get('/oauth2callback', async (req, res) => {
    const { code } = req.query;
    if (!code || typeof code !== 'string') {
        res.status(400).send('Missing authorization code');
        return;
    }
    try {
        await handleOAuthCallback(code);
        res.send('<html><body><h1>✅ Authorization successful!</h1><p>You can close this window and return to the app.</p><script>window.close();</script></body></html>');
    } catch (error: any) {
        res.status(500).send(`Authorization failed: ${error.message}`);
    }
});

// Create slides (requires authorization)
app.post('/api/slides', async (req, res) => {
    try {
        const result = await createSlides(req.body);
        res.json(result);
    } catch (error: any) {
        if (error.message === 'NOT_AUTHORIZED') {
            const authUrl = getAuthUrl();
            res.status(401).json({
                error: 'Google Slides not authorized',
                authUrl,
                needsAuth: true
            });
            return;
        }
        console.error(error);
        res.status(500).json({ error: error.message || "Failed to create slides" });
    }
});

// ============ APIFY BUSINESS DISCOVERY ============
import { discoverBusinesses } from './services/apify.js';

app.post('/api/discover', async (req, res) => {
    try {
        const { query, location, maxResults } = req.body;
        if (!query) {
            res.status(400).json({ error: 'Query is required' });
            return;
        }
        const businesses = await discoverBusinesses({ query, location, maxResults });
        res.json({ businesses });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// ============ ENRICHMENT ============
import { findFounderInfo, quickEnrich } from './services/serper.js';
import { scrapeContactInfoApify } from './services/apifyEnrichment.js';

app.post('/api/enrich', async (req, res) => {
    try {
        const { businessName, location, website, quick } = req.body;
        if (!businessName) {
            res.status(400).json({ error: 'Business name is required' });
            return;
        }

        // 1. Run Serper (Google Search) FIRST
        console.log(`\n[Enrich API] Starting Serper enrich for ${businessName} - ${location}`);
        let serperData: any = {};
        if (quick) {
            serperData = await quickEnrich(businessName, website);
        } else {
            serperData = await findFounderInfo(businessName, location);
        }

        // 2. Check for Email Presence
        const hasEmail = !!serperData.email;

        let apifyData: any = {};

        // 3. Run Apify Contact Scraper (Google Maps Actor) ONLY as Fallback
        if (hasEmail) {
            console.log(`[Enrich API] Email found by Serper (${serperData.email}). Skipping Apify Maps.`);
        } else {
            console.log(`[Enrich API] No email found from Serper. Falling back to Apify Maps Scraper...`);
            apifyData = await scrapeContactInfoApify(businessName, location, website);
        }

        // 4. Smart Merge (Combine all found emails and phones instead of overwriting)
        const mergeStrings = (str1: string | undefined, str2: string | undefined) => {
            const arr = new Set<string>();
            if (str1) str1.split(',').forEach(s => arr.add(s.trim()));
            if (str2) str2.split(',').forEach(s => arr.add(s.trim()));
            if (arr.size === 0) return undefined;
            return Array.from(arr).join(', ');
        };

        const mergedInfo = {
            founderName: undefined, // Explicitly removed per user request
            email: mergeStrings(apifyData.email, serperData.email),
            phone: mergeStrings(apifyData.phone, serperData.phone),
            linkedin: apifyData.linkedin || serperData.linkedin,
            instagram: apifyData.instagram || serperData.instagram,
            facebook: apifyData.facebook || serperData.facebook,
            twitter: apifyData.twitter || serperData.twitter,
            sources: Array.from(new Set([...(apifyData.sources || []), ...(serperData.sources || [])]))
        };

        console.log('[Enrich API] Returning Merged Info:', JSON.stringify(mergedInfo, null, 2));
        res.json(mergedInfo);

    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});
// ============ PIPELINE AUTOMATION ============
import { runPipeline } from './services/pipeline.js';
import { getLeads } from './services/persistence.js';

app.post('/api/pipeline/start', async (req, res) => {
    try {
        const { keyword, location, maxResults, projectId, templateType } = req.body;
        if (!keyword) {
            res.status(400).json({ error: 'Keyword is required' });
            return;
        }

        // Run the full pipeline
        // Note: This might take time, so for large requests we should return a job ID.
        // For MVP (max 5 leads), we await it.
        const results = await runPipeline(keyword, location, maxResults || 3, projectId, templateType);

        res.json({ success: true, results });
    } catch (error: any) {
        console.error("Pipeline Error:", error);
        res.status(500).json({ error: error.message });
    }
});


app.get('/api/leads', async (req, res) => {
    try {
        const projectId = req.query.projectId as string | undefined;
        const leads = await getLeads(projectId);
        res.json({ success: true, leads });
    } catch (error: any) {
        console.error("Fetch Leads Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ============ SUPABASE PERSISTENCE ============
import { bulkSaveBusinesses, updateBusinessField, saveBusiness, getProjects, createProject } from './services/persistence.js';

// Get Projects
app.get('/api/projects', async (req, res) => {
    try {
        const projects = await getProjects();
        res.json({ success: true, projects });
    } catch (error: any) {
        console.error("Fetch Projects Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Create Project
app.post('/api/projects', async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Project name is required' });

        const project = await createProject(name);
        res.json({ success: true, project });
    } catch (error: any) {
        console.error("Create Project Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Bulk sync businesses to Supabase
app.post('/api/leads/sync', async (req, res) => {
    try {
        const { businesses } = req.body;
        if (!businesses || !Array.isArray(businesses)) {
            return res.status(400).json({ error: 'businesses array required' });
        }

        console.log(`[API] Syncing ${businesses.length} businesses to Supabase...`);
        const result = await bulkSaveBusinesses(businesses);
        res.json({ success: true, ...result });
    } catch (error: any) {
        console.error("Sync Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Save single business
app.post('/api/leads/save', async (req, res) => {
    try {
        const { business } = req.body;
        if (!business) {
            return res.status(400).json({ error: 'business object required' });
        }

        const success = await saveBusiness(business);
        res.json({ success });
    } catch (error: any) {
        console.error("Save Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Update a single lead field
app.patch('/api/leads/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const success = await updateBusinessField(id, updates);
        res.json({ success });
    } catch (error: any) {
        console.error("Update Error:", error);
        res.status(500).json({ error: error.message });
    }
});


// ============ WHATSAPP VALIDATION ============
import { verifyWhatsAppBulk, verifyWhatsAppDirect } from './services/whatsappValidator.js';

app.post('/api/pipeline/verify-whatsapp', async (req, res) => {
    try {
        const { leads } = req.body;
        if (!leads || !Array.isArray(leads)) {
            return res.status(400).json({ error: 'leads array required' });
        }
        const results = await verifyWhatsAppDirect(leads);
        res.json({ results });
    } catch (error: any) {
        console.error("Pipeline Verify WA Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/leads/verify-whatsapp', async (req, res) => {
    try {
        const { leadIds } = req.body;
        if (!leadIds || !Array.isArray(leadIds)) {
            return res.status(400).json({ error: 'leadIds array required' });
        }

        // Trigger async operation - we don't await this so the UI doesn't hang for 15 seconds.
        // It'll run in the background and update Supabase directly.
        verifyWhatsAppBulk(leadIds).catch(err => {
            console.error('[Verify WA API] Background validation failed:', err);
        });

        // Immediately return success so UI can show a "checking..." state
        res.json({ success: true, message: `Started verifying ${leadIds.length} numbers via Apify.` });
    } catch (error: any) {
        console.error("Verify WA Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ============ ANALYSIS SERVICE ============
import { analyzeWebsite, bulkAnalyze, extractLogo } from './services/analysis.js';

// Analyze a single website
app.post('/api/analyze', async (req, res) => {
    try {
        const { url, businessName } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        const result = await analyzeWebsite(url, businessName || 'Business');
        res.json({ success: true, ...result });
    } catch (error: any) {
        console.error('Analysis Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Bulk analyze multiple websites
app.post('/api/pipeline/analyze', async (req, res) => {
    try {
        const { leads } = req.body; // Array of { id, url, name }
        if (!leads || !Array.isArray(leads)) {
            return res.status(400).json({ error: 'leads array required' });
        }

        const results = await bulkAnalyze(leads);
        const resultsObject = Object.fromEntries(results);
        res.json({ success: true, results: resultsObject });
    } catch (error: any) {
        console.error('Bulk Analysis Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============ BULK ENRICH ============
// Manual Pipeline Run (Single Lead by URL)
import { processLead } from './services/pipeline.js';

app.post('/api/pipeline/manual', async (req, res) => {
    try {
        const { url, name, city, projectId, templateType } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Construct DiscoveredBusiness from manual input
        const business = {
            name: name || new URL(url).hostname.replace('www.', ''),
            address: city || 'Unknown Location',
            website: url,
            phone: '', // Will be enriched
            rating: 0,
            reviewCount: 0,
            category: 'Manual Lead'
        };

        console.log(`[Pipeline-Manual] Processing ${business.name} (${url})`);
        const result = await processLead(business, projectId, templateType);

        res.json(result);

    } catch (error: any) {
        console.error('Manual Pipeline Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============ BULK ENRICH ============

app.post('/api/pipeline/enrich', async (req, res) => {
    try {
        const { leads } = req.body; // Array of { id, name, address, website }
        if (!leads || !Array.isArray(leads)) {
            return res.status(400).json({ error: 'leads array required' });
        }

        const results: Record<string, any> = {};
        for (const lead of leads) {
            try {
                const enriched = await findFounderInfo(lead.name, lead.address);
                results[lead.id] = enriched;
                // Add a deliberate 1-second delay after every lead to respect Serper 60rpm rate limit
                await new Promise(r => setTimeout(r, 1000));
            } catch (e) {
                console.error(`Enrich failed for ${lead.name}:`, e);
                results[lead.id] = { error: 'Enrichment failed' };
            }
        }

        res.json({ success: true, results });
    } catch (error: any) {
        console.error('Bulk Enrich Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============ BULK GENERATE MESSAGES ============
import { generateAllMessages, LeadOutreachInput } from './services/outreach.js';

app.post('/api/pipeline/generate', async (req, res) => {
    try {
        const { leads } = req.body; // Array of LeadOutreachInput
        if (!leads || !Array.isArray(leads)) {
            return res.status(400).json({ error: 'leads array required' });
        }

        const results: Record<string, any> = {};
        for (const lead of leads as LeadOutreachInput[]) {
            try {
                const messages = await generateAllMessages(lead);
                results[lead.businessName] = messages;
            } catch (e) {
                console.error(`Generate failed for ${lead.businessName}:`, e);
                results[lead.businessName] = { error: 'Generation failed' };
            }
        }

        res.json({ success: true, results });
    } catch (error: any) {
        console.error('Bulk Generate Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============ BULK OUTREACH STATUS ============
app.post('/api/pipeline/outreach', async (req, res) => {
    try {
        const { leadIds, method } = req.body; // Array of lead IDs and method (email/linkedin/instagram)
        if (!leadIds || !Array.isArray(leadIds)) {
            return res.status(400).json({ error: 'leadIds array required' });
        }

        // In a real app, this would trigger the email sending service or actual automation.
        // For now, it just acknowledges the request so frontend can update status.

        console.log(`[Outreach] Sending ${method} to ${leadIds.length} leads: ${leadIds.join(', ')}`);

        // Simulate processing time
        await new Promise(r => setTimeout(r, 1000));

        res.json({ success: true, count: leadIds.length, status: 'contacted' });
    } catch (error: any) {
        console.error('Bulk Outreach Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============ SITE GENERATION ============
import { generateWebsite, bulkGenerateWebsites } from './services/siteGen.js';

app.post('/api/pipeline/site-gen', async (req, res) => {
    try {
        const business = req.body;
        // Normalize input
        const input = {
            ...business,
            businessName: business.name || business.businessName,
            website: business.website || business.website_url
        };

        const result = await generateWebsite(input);
        res.json(result);
    } catch (error: any) {
        console.error('Site Gen Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/pipeline/site-gen-bulk', async (req, res) => {
    try {
        const { leads } = req.body; // Array of SiteGenInput
        if (!leads || !Array.isArray(leads)) {
            return res.status(400).json({ error: 'leads array required' });
        }

        console.log(`[SiteGen-Bulk] Processing ${leads.length} leads...`);
        const resultsMap = await bulkGenerateWebsites(leads);
        const results = Object.fromEntries(resultsMap); // Map to Object

        res.json({ success: true, results });
    } catch (error: any) {
        console.error('Bulk Site Gen Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============ RANK TRACKER ============
import { searchRankings } from './services/rankTracker.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

app.post('/api/rankings/search', async (req, res) => {
    try {
        const { keyword, city, maxResults } = req.body;
        if (!keyword || !city) {
            return res.status(400).json({ error: 'keyword and city are required' });
        }

        const result = await searchRankings(keyword, city, maxResults || 100);
        res.json(result);
    } catch (error: any) {
        console.error('Rank Tracker Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/rankings/save', async (req, res) => {
    try {
        const { keyword, city, results } = req.body;
        if (!keyword || !city || !results || !Array.isArray(results)) {
            return res.status(400).json({ error: 'keyword, city, and results array required' });
        }

        // Map frontend shapes to the DB columns
        const rows = results.map((r: any) => ({
            keyword: keyword.trim().toLowerCase(),
            city: city.trim().toLowerCase(),
            rank: r.rank,
            name: r.name,
            address: r.address,
            phone: r.phone,
            website: r.website,
            rating: r.rating,
            review_count: r.reviewCount,
            category: r.category,
            place_id: r.placeId,
            image_url: r.imageUrl,
            is_claimed: r.isClaimed,
            added_to_pipeline: false
        }));

        // Use upsert to prevent duplicates if user clicks search multiple times
        const { error } = await supabase
            .from('ranked_leads')
            .upsert(rows, { onConflict: 'keyword,city,name' }) // Ensure this conflict behavior works or just insert 
            // Actually rank/name is safer, but standard insert is fine for now
            // Let's just do a clean insert but delete previous ones for this keyword+city first to avoid massive dupes
            ;

        // Better approach: Delete old search for this exact keyword+city, then insert fresh
        await supabase
            .from('ranked_leads')
            .delete()
            .match({ keyword: keyword.trim().toLowerCase(), city: city.trim().toLowerCase() });

        const { data, error: insertError } = await supabase
            .from('ranked_leads')
            .insert(rows)
            .select();

        if (insertError) throw insertError;

        res.json({ success: true, count: data?.length || 0 });
    } catch (error: any) {
        console.error('Rank Tracker Save Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/rankings/history', async (req, res) => {
    try {
        const { keyword, city } = req.query;
        if (!keyword || !city) {
            return res.status(400).json({ error: 'keyword and city required' });
        }

        const { data, error } = await supabase
            .from('ranked_leads')
            .select('*')
            .eq('keyword', (keyword as string).trim().toLowerCase())
            .eq('city', (city as string).trim().toLowerCase())
            .order('rank', { ascending: true });

        if (error) throw error;

        // Map back to camelCase for frontend
        const results = (data || []).map(r => ({
            id: r.id, // Supabase UUID
            rank: r.rank,
            name: r.name,
            address: r.address,
            phone: r.phone,
            website: r.website,
            rating: r.rating,
            reviewCount: r.review_count,
            category: r.category,
            placeId: r.place_id,
            imageUrl: r.image_url,
            isClaimed: r.is_claimed,
            addedToPipeline: r.added_to_pipeline
        }));

        res.json({ results });
    } catch (error: any) {
        console.error('Rank Tracker History Error:', error);
        res.status(500).json({ error: error.message });
    }
});


// ============ PUSH TO OUTREACH ============
const OUTREACH_API_URL = process.env.OUTREACH_API_URL || '';

// Get Outreach projects (proxy to Outreach API)
app.get('/api/outreach/projects', async (req, res) => {
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
app.post('/api/push-to-outreach', async (req, res) => {
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
                }
            };
        });

        // POST to Outreach's import endpoint
        const response = await fetch(`${OUTREACH_API_URL}/api/import-leads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

// ============ LOGO UPLOAD ============
app.post('/api/leads/:id/upload-logo', async (req, res) => {
    try {
        const leadId = req.params.id;
        const { logoUrl } = req.body;

        if (!logoUrl) {
            return res.status(400).json({ error: 'logoUrl is required' });
        }

        // Update local Supabase leads table
        const { error: dbError } = await supabase
            .from('leads')
            .update({ logo_url: logoUrl })
            .eq('id', leadId);

        if (dbError) throw dbError;

        res.json({ success: true, logoUrl, message: 'Logo URL updated successfully. Re-generate website to apply.' });
    } catch (error: any) {
        console.error('Logo Upload Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============ SPA CATCH-ALL (must be LAST route) ============
// In production, serve index.html for any non-API route (client-side routing)
const distIndexPath = path.resolve(__dirname, '../dist/index.html');
if (fs.existsSync(distIndexPath)) {
    app.get('*', (req, res) => {
        res.sendFile(distIndexPath);
    });
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`OAuth callback: http://localhost:${PORT}/oauth2callback`);
});
