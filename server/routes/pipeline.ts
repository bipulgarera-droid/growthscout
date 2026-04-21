import { Router } from 'express';


const router = Router();
import { supabase } from '../supabaseClient.js';

import { runScrapingPipeline } from '../services/pipeline.js';

router.get('/api/pipeline/stream', async (req, res) => {
    const service = req.query.service as string;
    const city = req.query.city as string;
    const projectId = req.query.projectId as string;
    const targetCount = parseInt(req.query.targetCount as string) || 100;
    const customCodesRaw = req.query.customPostalCodes as string;
    const customPostalCodes = customCodesRaw ? customCodesRaw.split(',').map(c => c.trim()).filter(Boolean) : undefined;
    
    if (!service || (!city && (!customPostalCodes || customPostalCodes.length === 0))) {
        res.status(400).json({ error: 'Service and either city or custom postal codes required.' });
        return;
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    // Send headers immediately to bypass first byte proxy timeout
    res.write(':ok\n\n');

    // Railway standard proxy timeout is usually 100s. A 15-second ping keeps it open indefinitely.
    const ping = setInterval(() => res.write(':ping\n\n'), 15000); 

    try {
        const result = await runScrapingPipeline(service, city, targetCount, projectId, (chunk) => {
             res.write(`data: ${JSON.stringify({ type: 'log', message: chunk })}\n\n`);
        }, customPostalCodes);

        clearInterval(ping);

        if (result.success && result.records && result.records.length > 0) {
            try {
                // Instantly persist data to Supabase on the backend before relying on frontend
                res.write(`data: ${JSON.stringify({ type: 'log', message: 'Saving leads to Supabase...' })}\n\n`);
                
                // We need to map it slightly to fit the DB schema expectations like the frontend did
                // CRITICAL: place_id from Google Maps is NOT a UUID — must generate proper UUIDs
                const { randomUUID } = await import('crypto');
                const bRecords = result.records
                    .filter((r: any) => r.name && r.name.trim().length > 0)
                    .map((r: any) => ({
                    id: randomUUID(),
                    name: r.name,
                    address: r.address,
                    website: r.website || '',
                    phone: r.phone || '',
                    rating: r.score || 0,
                    reviewCount: r.reviews || 0,
                    category: r.niche || service,
                    contactEmail: r.email || '',
                    status: 'new',
                    qualityScore: 0,      // PageSpeed analysis sets this later
                    projectId: projectId || undefined,
                    source: 'pipeline',
                    searchQuery: service as string,
                    searchLocation: city as string,
                }));
                
                const { bulkSaveBusinesses } = await import('../services/persistence.js');
                await bulkSaveBusinesses(bRecords);
                
                res.write(`data: ${JSON.stringify({ type: 'log', message: 'Successfully synced to database.' })}\n\n`);
            } catch (saveErr) {
                console.error("Backend persistence failed:", saveErr);
                res.write(`data: ${JSON.stringify({ type: 'log', message: 'Warning: Failed to save to database natively.' })}\n\n`);
            }
        }

        res.write(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`);
        res.end();
    } catch (err: any) {
        clearInterval(ping);
        res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
        res.end();
    }
});

import { verifyWhatsAppBulk, verifyWhatsAppDirect } from '../services/whatsappValidator.js';

router.post('/api/pipeline/verify-whatsapp', async (req, res) => {
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

router.post('/api/leads/verify-whatsapp', async (req, res) => {
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

import { analyzeWebsite, bulkAnalyze, extractLogo } from '../services/analysis.js';

// Analyze a single website
router.post('/api/analyze', async (req, res) => {
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
router.post('/api/pipeline/analyze', async (req, res) => {
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

// Left blank for future extraction logic
    }
});

import { findFounderInfo, isRunningGoogleAds } from '../services/serper.js';
import { scrapeContactInfoApify } from '../services/apifyEnrichment.js';
import { extractEmailJina, detectAdsFromHTML } from '../services/analysis.js';

// Specific endpoint: Trigger Google Ads check
router.post('/api/pipeline/check-ads', async (req, res) => {
    try {
        const { leads } = req.body;
        if (!leads || !Array.isArray(leads)) {
            return res.status(400).json({ error: 'leads array required' });
        }

        const results: Record<string, boolean> = {};
        for (const lead of leads) {
            try {
                results[lead.id] = await isRunningGoogleAds(lead.name, lead.city || '');
            } catch (err) {
                console.error(`Check ads failed for ${lead.name}:`, err);
                results[lead.id] = false;
            }
        }
        res.json({ success: true, results });
    } catch (error: any) {
        console.error('Check Ads Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Specific endpoint: Trigger Gemini Email Fallback
router.post('/api/pipeline/fallback-email', async (req, res) => {
    try {
        const { leads } = req.body;
        if (!leads || !Array.isArray(leads)) {
            return res.status(400).json({ error: 'leads array required' });
        }

        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
        const results: Record<string, string | null> = {};
        for (const lead of leads) {
            try {
                if (!lead.website) {
                    results[lead.id] = null;
                    continue;
                }
                const email = await extractEmailJina(lead.website);
                results[lead.id] = email;
                // Polite delay to avoid Jina AI rate limiting on large batches
                await sleep(600);
            } catch (err) {
                console.error(`Fallback email failed for ${lead.website}:`, err);
                results[lead.id] = null;
            }
        }
        res.json({ success: true, results });

    } catch (error: any) {
        console.error('Fallback Email Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== SERVER-SIDE BACKGROUND JINA QUEUE =====
// Fire-and-forget: browser sends all lead IDs once, server processes in background.
// User can close their laptop — Railway keeps crunching.

interface JinaJob {
    id: string;
    status: 'running' | 'done' | 'error';
    total: number;
    processed: number;
    found: number;
    startedAt: string;
    finishedAt?: string;
    error?: string;
}

// In-memory job store (survives as long as Railway container is up)
const jinaJobs: Map<string, JinaJob> = new Map();

router.post('/api/pipeline/jina-queue', async (req, res) => {
    try {
        const { leads } = req.body; // Array of { id, website }
        if (!leads || !Array.isArray(leads) || leads.length === 0) {
            return res.status(400).json({ error: 'leads array required' });
        }

        // Generate a simple job ID
        const jobId = `jina_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        
        const job: JinaJob = {
            id: jobId,
            status: 'running',
            total: leads.length,
            processed: 0,
            found: 0,
            startedAt: new Date().toISOString(),
        };
        jinaJobs.set(jobId, job);

        // Respond immediately — the browser can close now
        res.json({ success: true, jobId, message: `Queued ${leads.length} leads for background processing.` });

        // ===== BACKGROUND PROCESSING (runs after response is sent) =====
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

        (async () => {
            console.log(`[Jina Queue] Job ${jobId}: Starting background processing of ${leads.length} leads...`);
            
            for (let i = 0; i < leads.length; i++) {
                const lead = leads[i];
                try {
                    if (!lead.website) {
                        job.processed++;
                        continue;
                    }

                    const email = await extractEmailJina(lead.website);
                    
                    // Persist directly to Supabase
                    // IMPORTANT: serper_searched lives INSIDE audit_data JSONB, NOT as a standalone column
                    if (supabase && lead.id) {
                        // Fetch current audit_data to merge into it
                        const { data: existing } = await supabase
                            .from('leads')
                            .select('audit_data')
                            .eq('id', lead.id)
                            .single();
                        
                        const currentAuditData = existing?.audit_data || {};
                        const patch: any = {
                            audit_data: { ...currentAuditData, serper_searched: true },
                        };
                        if (email && email !== 'NULL') {
                            patch.contact_email = email;
                            job.found++;
                        }
                        const { error: updateErr } = await supabase.from('leads').update(patch).eq('id', lead.id);
                        if (updateErr) {
                            console.error(`[Jina Queue] DB update FAILED for ${lead.id}:`, updateErr.message);
                        }
                    }

                    job.processed++;
                    
                    // Log progress every 10 leads
                    if (job.processed % 10 === 0 || job.processed === job.total) {
                        console.log(`[Jina Queue] Job ${jobId}: ${job.processed}/${job.total} processed, ${job.found} emails found`);
                    }

                    // Polite delay between domains to respect Jina free tier
                    await sleep(800);
                    
                } catch (err) {
                    console.error(`[Jina Queue] Job ${jobId}: Failed for ${lead.website}:`, err);
                    job.processed++;
                    // Continue processing — don't let one failure kill the whole batch
                }
            }

            job.status = 'done';
            job.finishedAt = new Date().toISOString();
            console.log(`[Jina Queue] Job ${jobId}: COMPLETE! ${job.found}/${job.total} emails found.`);
            
            // Clean up old jobs after 1 hour to prevent memory leaks
            setTimeout(() => jinaJobs.delete(jobId), 60 * 60 * 1000);
        })().catch(err => {
            console.error(`[Jina Queue] Job ${jobId}: Fatal error:`, err);
            job.status = 'error';
            job.error = err.message;
        });

    } catch (error: any) {
        console.error('Jina Queue Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Status polling endpoint — check progress when you reopen your laptop
router.get('/api/pipeline/jina-queue/status', (req, res) => {
    const jobId = req.query.jobId as string;
    
    if (jobId) {
        const job = jinaJobs.get(jobId);
        if (!job) return res.status(404).json({ error: 'Job not found or expired' });
        return res.json(job);
    }
    
    // If no jobId, return the latest active job (convenience)
    const allJobs = Array.from(jinaJobs.values());
    const activeJob = allJobs.find(j => j.status === 'running');
    const latestJob = activeJob || allJobs[allJobs.length - 1];
    
    res.json(latestJob || { status: 'idle', message: 'No active or recent jobs.' });
});

// Deterministic Ad Detection: Scan raw HTML for Google Ads / GTM / AdSense / FB Pixel tags
router.post('/api/pipeline/detect-ads-html', async (req, res) => {
    try {
        const { leads } = req.body;
        if (!leads || !Array.isArray(leads)) {
            return res.status(400).json({ error: 'leads array required' });
        }

        const results: Record<string, { runningAds: boolean; adTags: string[] }> = {};
        for (const lead of leads) {
            try {
                if (!lead.website) {
                    results[lead.id] = { runningAds: false, adTags: [] };
                    continue;
                }
                results[lead.id] = await detectAdsFromHTML(lead.website);
            } catch (err) {
                console.error(`HTML ad detection failed for ${lead.website}:`, err);
                results[lead.id] = { runningAds: false, adTags: [] };
            }
        }
        res.json({ success: true, results });
    } catch (error: any) {
        console.error('HTML Ad Detection Error:', error);
        res.status(500).json({ error: error.message });
    }
});


import { serperEmailByDomain, serperEmailByNameAndLocation } from '../services/serper.js';

// Email discovery via Serper: queries Google for `domain "email"` and extracts from snippets
router.post('/api/pipeline/serper-email', async (req, res) => {
    try {
        const { leads } = req.body;
        if (!leads || !Array.isArray(leads)) {
            return res.status(400).json({ error: 'leads array required' });
        }

        const results: Record<string, string | null> = {};
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
        const { supabase } = await import('../services/persistence.js');

        for (const lead of leads) {
            try {
                let foundEmail: string | null = null;

                if (lead.website) {
                    foundEmail = await serperEmailByDomain(lead.website, lead.name, lead.niche, lead.location);
                } else if (lead.name) {
                    foundEmail = await serperEmailByNameAndLocation(lead.name, lead.location, lead.niche);
                }

                results[lead.id] = foundEmail;

                // ✅ Persist directly to Supabase — do not rely on the frontend to relay this back
                if (supabase && lead.id) {
                    const { data: existing } = await supabase
                        .from('leads')
                        .select('audit_data')
                        .eq('id', lead.id)
                        .single();
                    
                    const currentAuditData = existing?.audit_data || {};
                    const patch: any = {
                        audit_data: { ...currentAuditData, serper_searched: true },
                    };
                    if (foundEmail && foundEmail !== 'NULL') {
                        patch.contact_email = foundEmail;
                    }
                    const { error: updateErr } = await supabase.from('leads').update(patch).eq('id', lead.id);
                    if (updateErr) {
                        console.error(`[Serper] DB update FAILED for ${lead.id}:`, updateErr.message);
                    }
                }

            } catch (e) {
                console.error(`Serper email failed for ${lead.name || lead.website}:`, e);
                results[lead.id] = null;
            }
            // Small delay to avoid Serper rate limits
            await sleep(300);
        }

        res.json({ success: true, results });
    } catch (error: any) {
        console.error('Serper Email Error:', error);
        res.status(500).json({ error: error.message });
    }
});

import { execFile } from 'child_process';
import path from 'path';

// Email discovery via DuckDuckGo: spawns Python script
router.post('/api/pipeline/ddg-email', async (req, res) => {
    try {
        const { leads } = req.body;
        if (!leads || !Array.isArray(leads)) {
            return res.status(400).json({ error: 'leads array required' });
        }

        const results: Record<string, string | null> = {};
        const { supabase } = await import('../services/persistence.js');
        const scriptPath = path.join(process.cwd(), 'execution', 'ddg_email_search.py');

        for (const lead of leads) {
            try {
                let foundEmail: string | null = null;
                
                if (lead.website) {
                    const payload = JSON.stringify({ website: lead.website, name: lead.name, location: lead.location });
                    const emailResult: string = await new Promise((resolve, reject) => {
                        execFile('python3', [scriptPath, payload], { timeout: 30000 }, (error, stdout, stderr) => {
                            if (error) {
                                console.error('DDG script error:', stderr);
                                resolve('NULL');
                                return;
                            }
                            try {
                                const parsed = JSON.parse(stdout);
                                resolve(parsed.success && parsed.email ? parsed.email : 'NULL');
                            } catch(e) {
                                resolve('NULL');
                            }
                        });
                    });
                    
                    if (emailResult !== 'NULL') foundEmail = emailResult;
                }

                results[lead.id] = foundEmail;

                // Persist directly to Supabase
                if (supabase && lead.id) {
                    const patch: any = {};
                    if (foundEmail && foundEmail !== 'NULL') {
                        patch.contact_email = foundEmail;
                    }
                    if (Object.keys(patch).length > 0) {
                        await supabase.from('leads').update(patch).eq('id', lead.id);
                    }
                }

            } catch (e) {
                console.error(`DDG email failed for ${lead.name || lead.website}:`, e);
                results[lead.id] = null;
            }
            
            // Artificial delay to prevent DDG blocking
            await new Promise(r => setTimeout(r, 1500));
        }

        res.json({ success: true, results });
    } catch (error: any) {
        console.error('DDG Email Error:', error);
        res.status(500).json({ error: error.message });
    }
});



import { generateAllMessages, LeadOutreachInput } from '../services/outreach.js';


router.post('/api/pipeline/generate', async (req, res) => {
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

router.post('/api/pipeline/outreach', async (req, res) => {
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

import { generateWebsite, bulkGenerateWebsites } from '../services/siteGen.js';

router.post('/api/pipeline/site-gen', async (req, res) => {
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

router.post('/api/pipeline/site-gen-bulk', async (req, res) => {
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

router.delete('/api/pipeline/leads', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'ids array required' });
        }

        const { error } = await supabase
            .from('leads')
            .delete()
            .in('id', ids);

        if (error) throw error;
        
        res.json({ success: true, count: ids.length });
    } catch (error: any) {
        console.error('Bulk Delete Error:', error);
        res.status(500).json({ error: error.message });
    }
});


// ===== AUTOMATED DAILY SCRAPING CRON =====
// Railway cron hits this endpoint on schedule (e.g., 0 6 * * * = 6AM daily).
// Picks random city + niche → scrapes via Gosom → saves to DB → queues Jina emails.

// Config: real target locations and service niches
const AUTO_SCRAPE_CONFIG = {
    cities: [
        // Tier 1 — Sun Belt growth cities (high response probability)
        'Austin, TX',
        'Dallas, TX',
        'Nashville, TN',
        'Phoenix, AZ',
        'Tampa, FL',
        'Charlotte, NC',
        'Denver, CO',
        'Atlanta, GA',
        // Tier 2 — Lower agency saturation, solid response
        'Raleigh, NC',
        'Salt Lake City, UT',
        'San Antonio, TX',
        'Jacksonville, FL',
        'Columbus, OH',
        'Boise, ID',
    ],
    niches: [
        'dentists',
        'med spas',
        'roofing contractors',
        'HVAC contractors',
        'landscaping companies',
        'real estate agents',
        'chiropractors',
        'plumbers',
        'auto repair shops',
        'personal injury lawyers',
    ],
    targetCount: 1000,
    notificationEmail: '', // Set via env CRON_NOTIFY_EMAIL or request body
};

router.post('/api/pipeline/auto-daily', async (req, res) => {
    // Protect with a secret so only Railway cron (or you) can trigger it
    const cronSecret = req.headers['x-cron-secret'] || req.query.secret;
    const expectedSecret = process.env.CRON_SECRET || 'growthscout-auto-2026';
    if (cronSecret !== expectedSecret) {
        return res.status(401).json({ error: 'Unauthorized. Set x-cron-secret header.' });
    }

    // Allow overrides via request body, otherwise use config
    const cities = req.body.cities || AUTO_SCRAPE_CONFIG.cities;
    const niches = req.body.niches || AUTO_SCRAPE_CONFIG.niches;
    const targetCount = req.body.targetCount || AUTO_SCRAPE_CONFIG.targetCount;
    const notificationEmail = req.body.notificationEmail || AUTO_SCRAPE_CONFIG.notificationEmail || process.env.CRON_NOTIFY_EMAIL || '';

    if (!cities.length || !niches.length) {
        return res.status(400).json({ error: 'No cities or niches configured.' });
    }

    // Pick random city and niche
    const city = cities[Math.floor(Math.random() * cities.length)];
    const niche = niches[Math.floor(Math.random() * niches.length)];

    const jobSummary = {
        city,
        niche,
        targetCount,
        projectId: '' as string,
        startedAt: new Date().toISOString(),
        status: 'started',
        leadsScraped: 0,
        jinaJobId: null as string | null,
        error: null as string | null,
    };

    // Respond immediately so Railway cron doesn't timeout
    res.json({ success: true, message: `Auto-scrape started: ${niche} in ${city}`, job: jobSummary });

    // ===== BACKGROUND: Create Project → Scrape → Save → Queue Jina =====
    (async () => {
        const logs: string[] = [];
        const log = (msg: string) => { console.log(`[AutoDaily] ${msg}`); logs.push(msg); };
        
        try {
            // Step 0: Auto-create a new GrowthScout project for this run
            const { randomUUID } = await import('crypto');
            const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const projectName = `[Auto] ${niche} in ${city} - ${dateStr}`;
            const newProjectId = randomUUID();

            log(`Creating project: "${projectName}"...`);
            const { error: projErr } = await supabase.from('projects').insert({
                id: newProjectId,
                name: projectName,
                status: 'active',
            });

            if (projErr) {
                log(`Failed to create project: ${projErr.message}`);
                jobSummary.status = 'failed';
                jobSummary.error = `Project creation failed: ${projErr.message}`;
                await sendAutoNotification(notificationEmail, jobSummary, logs);
                return;
            }

            const projectId = newProjectId;
            jobSummary.projectId = projectId;
            log(`Project created: ${projectName} (${projectId})`);

            log(`Starting: ${niche} in ${city} (target: ${targetCount})`);

            // Step 1: Run Gosom scraping pipeline
            const result = await runScrapingPipeline(niche, city, targetCount, projectId || undefined, (chunk) => {
                log(chunk);
            });

            if (!result.success || !result.records || result.records.length === 0) {
                log('Gosom scraping returned 0 results. Aborting.');
                jobSummary.status = 'failed';
                jobSummary.error = 'No results from scraper';
                await sendAutoNotification(notificationEmail, jobSummary, logs);
                return;
            }

            log(`Gosom found ${result.records.length} raw records. Saving to Supabase...`);

            // Step 2: Save leads to Supabase (same logic as /stream endpoint)
            const bRecords = result.records
                .filter((r: any) => r.name && r.name.trim().length > 0)
                .map((r: any) => ({
                    id: randomUUID(),
                    name: r.name,
                    address: r.address,
                    website: r.website || '',
                    phone: r.phone || '',
                    rating: r.score || 0,
                    reviewCount: r.reviews || 0,
                    category: r.niche || niche,
                    contactEmail: r.email || '',
                    status: 'new',
                    qualityScore: 0,
                    projectId: projectId || undefined,
                    source: 'auto-daily',
                    searchQuery: niche,
                    searchLocation: city,
                }));

            const { bulkSaveBusinesses } = await import('../services/persistence.js');
            await bulkSaveBusinesses(bRecords);
            jobSummary.leadsScraped = bRecords.length;
            log(`Saved ${bRecords.length} leads to Supabase.`);

            // Step 3: Queue leads with websites for Jina email extraction
            const jinaPayload = bRecords
                .filter((r: any) => r.website && r.website.length > 5)
                .filter((r: any) => {
                    const junkDomains = ['facebook.com', 'instagram.com', 'twitter.com', 'yelp.com', 'thumbtack.com', 'angi.com'];
                    return !junkDomains.some(d => r.website.includes(d));
                })
                .map((r: any) => ({ id: r.id, website: r.website }));

            if (jinaPayload.length > 0) {
                log(`Queuing ${jinaPayload.length} leads for Jina email extraction...`);
                
                // Reuse the same background queue logic
                const jinaJobId = `jina_auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                const jinaJob: JinaJob = {
                    id: jinaJobId,
                    status: 'running',
                    total: jinaPayload.length,
                    processed: 0,
                    found: 0,
                    startedAt: new Date().toISOString(),
                };
                jinaJobs.set(jinaJobId, jinaJob);
                jobSummary.jinaJobId = jinaJobId;

                // Fire Jina processing in parallel (don't await — let it run)
                const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
                (async () => {
                    for (const lead of jinaPayload) {
                        try {
                            if (!lead.website) { jinaJob.processed++; continue; }
                            const email = await extractEmailJina(lead.website);
                            
                            if (supabase && lead.id) {
                                const { data: existing } = await supabase
                                    .from('leads')
                                    .select('audit_data')
                                    .eq('id', lead.id)
                                    .single();
                                
                                const currentAuditData = existing?.audit_data || {};
                                const patch: any = {
                                    audit_data: { ...currentAuditData, serper_searched: true },
                                };
                                if (email && email !== 'NULL') {
                                    patch.contact_email = email;
                                    jinaJob.found++;
                                }
                                const { error: updateErr } = await supabase.from('leads').update(patch).eq('id', lead.id);
                                if (updateErr) console.error(`[AutoDaily Jina] DB update FAILED for ${lead.id}:`, updateErr.message);
                            }
                            jinaJob.processed++;
                            if (jinaJob.processed % 25 === 0) {
                                log(`Jina progress: ${jinaJob.processed}/${jinaJob.total}, ${jinaJob.found} emails found`);
                            }
                            await sleep(800);
                        } catch (err) {
                            jinaJob.processed++;
                        }
                    }
                    jinaJob.status = 'done';
                    jinaJob.finishedAt = new Date().toISOString();
                    log(`Jina COMPLETE: ${jinaJob.found}/${jinaJob.total} emails found.`);
                    
                    // Send final notification after Jina finishes
                    jobSummary.status = 'complete';
                    await sendAutoNotification(notificationEmail, jobSummary, logs);
                    
                    setTimeout(() => jinaJobs.delete(jinaJobId), 60 * 60 * 1000);
                })();
            } else {
                log('No leads with valid websites for Jina. Skipping email extraction.');
                jobSummary.status = 'complete';
                await sendAutoNotification(notificationEmail, jobSummary, logs);
            }

        } catch (err: any) {
            log(`FATAL ERROR: ${err.message}`);
            jobSummary.status = 'failed';
            jobSummary.error = err.message;
            await sendAutoNotification(notificationEmail, jobSummary, logs);
        }
    })();
});

// Simple email notification via Resend or fallback console log
async function sendAutoNotification(email: string, summary: any, logs: string[]) {
    const subject = summary.status === 'complete' 
        ? `✅ GrowthScout Auto: ${summary.leadsScraped} ${summary.niche} scraped in ${summary.city}`
        : `❌ GrowthScout Auto Failed: ${summary.niche} in ${summary.city}`;
    
    const body = [
        `Status: ${summary.status}`,
        `City: ${summary.city}`,
        `Niche: ${summary.niche}`,
        `Leads Scraped: ${summary.leadsScraped}`,
        summary.jinaJobId ? `Jina Job: ${summary.jinaJobId} (emails processing in background)` : '',
        summary.error ? `Error: ${summary.error}` : '',
        '',
        '--- Logs ---',
        ...logs.slice(-20), // Last 20 log lines
    ].filter(Boolean).join('\n');

    console.log(`[AutoDaily Notification] ${subject}\n${body}`);

    // If RESEND_API_KEY is set, send a real email
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey && email) {
        try {
            await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${resendKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: 'GrowthScout <onboarding@resend.dev>',
                    to: [email],
                    subject,
                    text: body,
                }),
            });
            console.log(`[AutoDaily] Email notification sent to ${email}`);
        } catch (e) {
            console.error('[AutoDaily] Email notification failed:', e);
        }
    }
}

export default router;
