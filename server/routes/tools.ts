import { Router } from 'express';


const router = Router();

import { captureScreenshot } from '../services/screenshot.js';

router.post('/api/screenshot', async (req, res) => {
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

import { discoverBusinesses } from '../services/apify.js';

router.post('/api/discover', async (req, res) => {
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

import { findFounderInfo, quickEnrich } from '../services/serper.js';
import { scrapeContactInfoApify } from '../services/apifyEnrichment.js';

router.post('/api/enrich', async (req, res) => {
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


import { getLeads } from '../services/persistence.js';

router.get('/api/leads', async (req, res) => {
    try {
        const projectId = req.query.projectId as string | undefined;
        const leads = await getLeads(projectId);
        res.json({ success: true, leads });
    } catch (error: any) {
        console.error("Fetch Leads Error:", error);
        res.status(500).json({ error: error.message });
    }
});

import { executeChatbot } from '../services/chatbot.js';

router.post('/api/chat', async (req, res) => {
    try {
        const { slug, message, history } = req.body;
        if (!slug || !message) {
            res.status(400).json({ error: 'Slug and message are required.' });
            return;
        }

        const reply = await executeChatbot(slug, message, history || []);
        res.json({ reply });
    } catch (error: any) {
        console.error('Chatbot API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
