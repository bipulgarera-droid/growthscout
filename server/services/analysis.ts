import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveMx } from 'dns/promises';
import { captureScreenshot } from './screenshot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const PAGESPEED_API_KEY = process.env.PAGESPEED_API_KEY;

// Detailed PageSpeed metrics for mobile and desktop
export interface PageSpeedMetrics {
    mobile: {
        performance: number;
        accessibility: number;
        bestPractices: number;
        seo: number;
        lcp?: string;
        cls?: string;
    };
    desktop: {
        performance: number;
        accessibility: number;
        bestPractices: number;
        seo: number;
    };
}

export interface AnalysisResult {
    screenshotBase64: string; // Single Full-Page Screenshot
    pageSpeed: PageSpeedMetrics;
    designScore: number; // "Outdated Score" (Higher = More Outdated/Qualified)
    overallScore: number;
    isQualified: boolean;
    analysisBullets: string[]; // Reasons why it's outdated
}

const getDetailedPageSpeed = async (url: string): Promise<PageSpeedMetrics> => {
    const fetchMetric = async (strategy: 'mobile' | 'desktop') => {
        let attempts = 0;
        while (attempts < 2) {
            try {
                const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}${PAGESPEED_API_KEY ? `&key=${PAGESPEED_API_KEY}` : ''}`;
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    // Retry on 500 errors or rate limits
                    if (response.status >= 500 && attempts === 0) {
                        console.warn(`PageSpeed ${strategy} ${response.status} error. Retrying...`);
                        attempts++;
                        await new Promise(r => setTimeout(r, 1500));
                        continue;
                    }
                    console.warn(`PageSpeed ${strategy} failed: ${response.status} ${response.statusText}`);
                    throw new Error('API failed');
                }
                const data = await response.json();

                const cats = data.lighthouseResult?.categories || {};
                const audits = data.lighthouseResult?.audits || {};

                return {
                    performance: Math.round((cats.performance?.score || 0) * 100),
                    accessibility: Math.round((cats.accessibility?.score || 0) * 100),
                    bestPractices: Math.round((cats['best-practices']?.score || 0) * 100),
                    seo: Math.round((cats.seo?.score || 0) * 100),
                    lcp: audits['largest-contentful-paint']?.displayValue,
                    cls: audits['cumulative-layout-shift']?.displayValue
                };
            } catch (e) {
                if (attempts === 1) {
                    console.error(`PageSpeed ${strategy} fetch failed after retry:`, e);
                    return { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 };
                }
                attempts++;
            }
        }
        return { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 };
    };

    const [mobile, desktop] = await Promise.all([
        fetchMetric('mobile'),
        fetchMetric('desktop')
    ]);

    return { mobile, desktop };
};

// Extract logo using Logo.dev API
export const extractLogo = async (url: string): Promise<string | null> => {
    try {
        // Use Logo.dev with the publishable key from env
        const publishableKey = process.env.LOGO_DEV_PUBLISHABLE_KEY || 'pk_TEHZtkjsRwWMucvOXSlEIg'; // Fallback just in case

        // Ensure we have a clean hostname for Logo.dev
        let hostname = url;
        try {
            hostname = new URL(url).hostname;
        } catch (e) {
            // If it fails to parse (e.g., missing http://), just pass the raw string
            hostname = url.replace(/(^\w+:|^)\/\//, '').split('/')[0];
        }

        // Logo.dev is extremely sensitive to www. prefixes on free tier
        // Bodysculptstudios.com has a logo, www.bodysculptstudios.com might not.
        hostname = hostname.replace(/^www\./i, '');

        const logoDevUrl = `https://img.logo.dev/${hostname}?token=${publishableKey}&size=512`;

        // Ping the API explicitly from the server backend to guarantee usage tracking is triggered
        // and to verify the logo exists before blindly returning it.
        const response = await fetch(logoDevUrl, { method: 'HEAD' });

        if (response.ok) {
            return logoDevUrl;
        } else {
            // Fallback to GET if HEAD isn't allowed by their CDN
            const getResponse = await fetch(logoDevUrl, { method: 'GET' });
            if (getResponse.ok) {
                return logoDevUrl;
            }
        }

        console.log(`[Logo.dev] Logo not found or failed to fetch for ${hostname}`);
        return null;

    } catch (e) {
        console.error('Logo extraction failed:', e);
        return null;
    }
};

// Extract contact info (Maintained)
export const extractContactInfo = async (url: string): Promise<{ email?: string; phone?: string }> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) return {};
        const html = await response.text();

        let email: string | undefined;
        let phone: string | undefined;

        const emailPatterns = [
            /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
            /["']([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})["']/gi,
            /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/gi
        ];

        for (const pattern of emailPatterns) {
            const match = pattern.exec(html);
            if (match && match[1]) {
                const found = match[1].toLowerCase();
                if (!found.includes('example.com') && !found.includes('sentry') && !found.includes('webpack')) {
                    email = match[1];
                    break;
                }
            }
        }

        const phonePatterns = [
            /tel:([+]?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/gi,
            /href=["']tel:([^"']+)["']/gi,
            /\((\d{3})\)\s*(\d{3})[-.]?(\d{4})/g,
            /(\d{3})[-.](\d{3})[-.](\d{4})/g
        ];

        for (const pattern of phonePatterns) {
            const match = pattern.exec(html);
            if (match) {
                if (match[1] && match[2] && match[3]) {
                    phone = `(${match[1]}) ${match[2]}-${match[3]}`;
                } else if (match[1]) {
                    phone = match[1].replace(/[^\d+]/g, '');
                    if (phone.length >= 10) {
                        const digits = phone.replace(/\D/g, '').slice(-10);
                        phone = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
                    }
                }
                if (phone) break;
            }
        }
        return { email, phone };
    } catch (e) {
        console.error('Contact extraction failed:', e);
        return {};
    }
};

// Pivot: Analyze OUTDATEDness with Gemini (Single Full Page)
const analyzeWithGemini = async (screenshotBase64: string, businessName: string): Promise<{ designScore: number; isQualified: boolean; analysisBullets: string[] }> => {
    if (!GEMINI_API_KEY) {
        return {
            designScore: 50,
            isQualified: false,
            analysisBullets: ["• API Key Missing → Cannot analyze"]
        };
    }

    // New Prompt: Outdated = Qualified
    const prompt = `You are a Lead Qualification AI for a Web Design Agency. 
Your goal is to identify OUTDATED, UGLY, or BROKEN websites that need a redesign.
We are looking for "Low Hanging Fruit" - businesses that have money but an ABANDONED, AMATEUR, or NON-RESPONSIVE website.

PROSPECT WEBSITE: [Full Page Screenshot attached] for "${businessName}"

Analyze the website design based on these strict criteria.

CRITICAL INSTRUCTIONS:
1. **LUXURY CAP**: If the site looks "High-End", "Luxury", or "Stylized" (even if you dislike the contrast), the score MUST be under 30. It is NOT a lead for us.
2. **IGNORE CONTENT**: Do NOT factor in "Old Blog Posts" or "Copyright Date" as major design flaws. We are analyzing VISUAL LAYOUT.
3. **DARK MODE**: Dark mode is a valid, modern choice. Do not penalize it.

SCORING CRITERIA (Outdated Score, 0-100):
- 80-100 (QUALIFIED): 
    - Broken layout, overlapping text, missing images.
    - Non-responsive (desktop view on mobile).
    - "Times New Roman" defaults, bevelled buttons, hit counters.
    - Truly ugly / amateur DIY attempts.
- 50-79 (MEDIOCRE): 
    - Functional but incredibly boring / generic template.
    - Poor whitespace, cluttered menus.
- 0-49 (UNQUALIFIED - DO NOT PITCH): 
    - Professional, Polished, Modern.
    - "Luxury" or "High-End" aesthetics.
    - Intentional artistic choices (even if subjective).

DECISION:
- isQualified: TRUE if score > 70 (Must be demonstrably bad).
- isQualified: FALSE if score <= 70 (Even mediocre sites are hard to sell).

OUTPUT:
Provide EXACTLY 4 bullet points explaining visual flaws.
If the site is Modern/Luxury, your bullets should praise the aesthetic to explain why we SKIP it (e.g. "Professional luxury aesthetic", "Modern layout usage").

Format as JSON:
{
  "bullets": [
    "• [Point 1]",
    "• [Point 2]",
    "• [Point 3]",
    "• [Point 4]"
  ],
  "designScore": <0-100>, // Higher means MORE OUTDATED
  "isQualified": true/false
}`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            {
                                inlineData: {
                                    mimeType: 'image/png',
                                    data: screenshotBase64.replace(/^data:image\/png;base64,/, '')
                                }
                            }
                        ]
                    }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 1024 }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API Error Status:', response.status);
            console.error('Gemini API Error Body:', errorText);

            let uiError = 'Analysis failed';
            if (response.status === 400) uiError = 'Invalid Request (400) - Image too large?';
            if (response.status === 401 || response.status === 403) uiError = 'API Key Error';
            if (response.status === 429) uiError = 'Rate Limit Exceeded';

            return {
                designScore: 0,
                isQualified: false,
                analysisBullets: [`• ${uiError} → Check logs`]
            };
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                designScore: parsed.designScore || 0,
                isQualified: parsed.isQualified !== false,
                analysisBullets: parsed.bullets || []
            };
        }
        throw new Error('Failed to parse JSON');
    } catch (e) {
        console.error('Gemini analysis failed:', e);
        return {
            designScore: 0,
            isQualified: false,
            analysisBullets: ["• Analysis failed → Please retry"]
        };
    }
};

export const analyzeWebsite = async (url: string, businessName: string): Promise<AnalysisResult> => {
    console.log(`🔍 Analyzing website: ${url}`);

    // Capture Single Full-Page Screenshot
    // Note: We intentionally revert to single full-page capture as requested.
    const screenshot = await captureScreenshot({
        url,
        view: 'desktop',
        fullPage: true // Capture entire height
    });

    const [pageSpeed, geminiResult] = await Promise.all([
        getDetailedPageSpeed(url),
        analyzeWithGemini(screenshot.base64Image, businessName)
    ]);

    // Overall Score logic:
    // If we want "Outdatedness", we want Low Performance + High Outdated Score.
    // Let's just use the Gemini Design Score as the main indicator for now.
    const overallScore = geminiResult.designScore;

    console.log(`✅ Analysis complete: OutdatedScore=${overallScore}, Qualified=${geminiResult.isQualified}`);

    return {
        screenshotBase64: screenshot.base64Image,
        pageSpeed,
        designScore: geminiResult.designScore,
        overallScore,
        isQualified: geminiResult.isQualified,
        analysisBullets: geminiResult.analysisBullets
    };
};

export const bulkAnalyze = async (leads: { id: string; url: string; name: string }[]): Promise<Map<string, AnalysisResult>> => {
    const results = new Map<string, AnalysisResult>();
    for (const lead of leads) {
        try {
            const result = await analyzeWebsite(lead.url, lead.name);
            results.set(lead.id, result);
        } catch (e) {
            console.error(`Failed to analyze ${lead.name}:`, e);
            results.set(lead.id, {
                designScore: 0,
                overallScore: 0,
                isQualified: false,
                analysisBullets: ["Analysis failed"],
                screenshotBase64: '',
                pageSpeed: {
                    mobile: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 },
                    desktop: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 }
                }
            });
        }
    }
    return results;
};

// Extractor logic for Email extraction via Deterministic Jina AI Scraping + Pure Regex Extraction
export const extractEmailJina = async (websiteUrl: string): Promise<{ email: string | null, content: string | null }> => {

    // Skip URLs that are social media or directory sites
    const junkDomains = ['facebook.com', 'instagram.com', 'twitter.com', 'yelp.com', 'lawnlove.com', 'thumbtack.com', 'angi.com', 'homeadvisor.com', 'houzz.com'];
    if (junkDomains.some(d => websiteUrl.includes(d))) {
        console.log(`[Email Fallback] Skipping directory/social URL: ${websiteUrl}`);
        return { email: null, content: null };
    }

    try {
        console.log(`[Email Fallback] Scraping website natively via Jina AI: ${websiteUrl}...`);
        
        // Jina free-tier optimized headers: strip images, return markdown text only
        const jinaHeaders: Record<string, string> = {
            'X-Return-Format': 'markdown',
            'X-Retain-Images': 'none',
            'Accept': 'text/plain',
        };
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
        
        // Smart rate-limit protection for 20 RPM Free Tier
        const jinaFetch = async (url: string, retries = 2): Promise<Response> => {
            for (let i = 0; i < retries; i++) {
                const resp = await fetch(url, { headers: jinaHeaders });
                if (resp.status === 429) {
                    console.log(`[Jina Rate Limit] 429 Too Many Requests. Cooling down for 30 seconds... (Attempt ${i+1}/${retries})`);
                    await sleep(30000);
                    continue;
                }
                return resp;
            }
            return fetch(url, { headers: jinaHeaders });
        };
        
        let pageContent = '';
        try {
            const rawBase = websiteUrl.endsWith('/') ? websiteUrl.slice(0, -1) : websiteUrl;
            const urlObj = new URL(rawBase);
            const cleanBase = urlObj.origin + urlObj.pathname.replace(/\/$/, '');

            // Base standard paths, but we will dynamically discover weird ones
            const contactPaths = new Set(['/contact', '/contact-us']);
            const aboutPaths = new Set(['/about', '/about-us', '/our-story', '/team', '/who-we-are']);
            
            // First fetch the homepage via Jina to look for emails AND dynamic contact/about links
            try {
                const homeResp = await jinaFetch(`https://r.jina.ai/${cleanBase}`);
                if (homeResp.ok) {
                    const homeText = await homeResp.text();
                    if (homeText && homeText.length > 20) {
                        pageContent += '\n\n' + homeText;
                        
                        // Extract Markdown links (e.g. [Let's Connect](/reach-out) )
                        const linkRegex = /\]\(([^)]+)\)/g;
                        let match;
                        while ((match = linkRegex.exec(homeText)) !== null) {
                            const href = match[1].toLowerCase().trim();
                            if (href.startsWith('mailto:') || href.startsWith('tel:')) continue;

                            let parsedRoute = '';
                            if (href.startsWith('http')) {
                                if (href.includes(urlObj.hostname)) {
                                    try { parsedRoute = new URL(href).pathname; } catch(e){}
                                }
                            } else if (href.startsWith('/')) {
                                parsedRoute = href;
                            } else {
                                parsedRoute = '/' + href;
                            }

                            if (!parsedRoute || parsedRoute === '/') continue;

                            if (href.includes('about') || href.includes('story') || href.includes('team') || href.includes('who-we-are') || href.includes('history') || href.includes('mission')) {
                                aboutPaths.add(parsedRoute);
                            } else if (href.includes('contact') || href.includes('connect') || href.includes('reach') || href.includes('hello')) {
                                contactPaths.add(parsedRoute);
                            }
                        }
                    }
                }
            } catch (_) { /* Skip if homepage totally fails */ }

            let emailFound = /[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+/.test(pageContent);

            // 1. Only traverse contact paths if we haven't already found an email on the homepage
            if (!emailFound) {
                for (const p of Array.from(contactPaths)) {
                    await sleep(1500); // Respect 20 RPM free limit
                    try {
                        const resp = await jinaFetch(`https://r.jina.ai/${cleanBase}${p}`);
                        if (resp.ok) {
                            const text = await resp.text();
                            if (text && text.length > 50) {
                                pageContent += '\n\n' + text;
                                emailFound = /[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+/.test(pageContent);
                                if (emailFound) break; // found it, stop crawling contact pages
                            }
                        }
                    } catch (_) { /* skip failed sub-paths */ }
                }
            }

            // 2. ALWAYS traverse one 'About' path strictly to enrich the AI Icebreaker Payload
            // We only need ONE successful about page fetch, so break immediately if text > 100 chars
            for (const p of Array.from(aboutPaths)) {
                await sleep(1500); // Respect 20 RPM free limit
                try {
                    const resp = await jinaFetch(`https://r.jina.ai/${cleanBase}${p}`);
                    if (resp.ok) {
                        const text = await resp.text();
                        if (text && text.length > 100) {
                            pageContent += '\n\n' + text;
                            break; // Got the company background story, stop crawling about pages
                        }
                    }
                } catch (_) { /* skip failed about paths */ }
            }
        } catch (e) {
            console.error(`[Email Fallback] Jina Scrape failed for ${websiteUrl}:`, e);
        }

        if (!pageContent || pageContent.length < 50) {
            console.log(`[Email Fallback] Jina insufficient for ${websiteUrl} — trying direct HTTP fetch...`);
            try {
                const urlObj2 = new URL(websiteUrl);
                const cleanBase2 = urlObj2.origin + urlObj2.pathname.replace(/\/$/, '');
                // Basic fallbacks for direct fetch
                const directPaths = ['', '/contact', '/contact-us', '/about', '/connect'];
                const emailRegexDirect = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/gi;
                const browserHeaders = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                };
                for (const p of directPaths) {
                    try {
                        const resp = await fetch(`${cleanBase2}${p}`, { 
                            headers: browserHeaders,
                            signal: AbortSignal.timeout(8000),
                            redirect: 'follow'
                        });
                        if (resp.ok) {
                            const html = await resp.text();
                            const directMatches = html.match(emailRegexDirect) || [];
                            const cleaned = [...new Set(directMatches)]
                                .map(e => e.toLowerCase())
                                .filter(e => !e.includes('sentry') && !e.includes('example.com') && !e.includes('wixpress') && !e.endsWith('.png') && !e.endsWith('.jpg') && !e.endsWith('.css') && !e.endsWith('.js') && e.includes('.') && e.split('@')[1]?.length > 3);
                            if (cleaned.length > 0) {
                                console.log(`[Email Fallback] Direct HTTP found email for ${websiteUrl}: ${cleaned[0]}`);
                                return { email: cleaned[0], content: html };
                            }
                        }
                    } catch (_) { /* skip blocked paths */ }
                }
            } catch (_) { /* skip if URL is unparseable */ }
            
            console.log(`[Email Fallback] Insufficient text and no direct email for ${websiteUrl}.`);
            return { email: null, content: pageContent || null };
        }


        // Deterministic Regex extraction
        // Matches typical email formats while avoiding image extensions (e.g. logo.png@2x) and CSS
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
        const matches = pageContent.match(emailRegex);

        if (!matches || matches.length === 0) {
            console.log(`[Email Fallback] No email found via regex on ${websiteUrl}`);
            return { email: null, content: pageContent };
        }

        // Clean up and filter out false positives (e.g., sentry@..., example.com, wixpress)
        const uniqueEmails = [...new Set(matches)]
            .map(e => e.toLowerCase().trim())
            .filter(e => 
                !e.includes('sentry') && 
                !e.includes('example.com') && 
                !e.includes('wixpress') &&
                !e.endsWith('.png') && 
                !e.endsWith('.jpg') && 
                !e.endsWith('.jpeg') && 
                !e.endsWith('.gif') &&
                !e.endsWith('.webp')
            );

        if (uniqueEmails.length === 0) return { email: null, content: pageContent };

        // Just return the first matched and cleaned email without external DNS verification
        console.log(`[Email Fallback] Successfully scraped regex email: ${uniqueEmails[0]}`);
        return { email: uniqueEmails[0], content: pageContent };
        
    } catch (e) {
        console.error(`[Email Fallback] Error on ${websiteUrl}:`, e);
        return { email: null, content: typeof pageContent !== 'undefined' ? pageContent : null };
    }
};

// Deterministic Ad Detection via raw HTML script tag scanning
// Checks for Google Ads conversion tracking, GTM, and AdSense tags
export const detectAdsFromHTML = async (websiteUrl: string): Promise<{ runningAds: boolean; adTags: string[] }> => {
    const junkDomains = ['facebook.com', 'instagram.com', 'twitter.com', 'yelp.com'];
    if (junkDomains.some(d => websiteUrl.includes(d))) {
        return { runningAds: false, adTags: [] };
    }

    try {
        console.log(`[Ad Detection] Scanning HTML tags on: ${websiteUrl}`);
        const response = await fetch(websiteUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GrowthScout/1.0)' },
            redirect: 'follow',
            signal: AbortSignal.timeout(10000) // 10s timeout
        });

        if (!response.ok) {
            console.log(`[Ad Detection] HTTP ${response.status} for ${websiteUrl}`);
            return { runningAds: false, adTags: [] };
        }

        const html = await response.text();
        const detectedTags: string[] = [];

        // Google Ads conversion tracking (AW-XXXXXXXXX)
        if (/googletagmanager\.com\/gtag\/js\?id=AW-/i.test(html)) {
            detectedTags.push('Google Ads (gtag AW-)');
        }

        // Older Google Ads conversion script
        if (/googleadservices\.com\/pagead\/conversion/i.test(html)) {
            detectedTags.push('Google Ads (legacy conversion.js)');
        }

        // Google Tag Manager (often contains Ads tags)
        if (/googletagmanager\.com\/gtm\.js\?id=GTM-/i.test(html)) {
            detectedTags.push('Google Tag Manager (GTM)');
        }

        // Google AdSense (display ads ON their site)
        if (/googlesyndication\.com\/pagead\/js\/adsbygoogle/i.test(html)) {
            detectedTags.push('Google AdSense');
        }

        // Facebook Pixel (bonus — indicates they run FB ads)
        if (/connect\.facebook\.net\/.*\/fbevents\.js/i.test(html)) {
            detectedTags.push('Facebook Pixel');
        }

        const runningAds = detectedTags.length > 0;
        console.log(`[Ad Detection] ${websiteUrl}: ${runningAds ? detectedTags.join(', ') : 'No ad tags found'}`);
        return { runningAds, adTags: detectedTags };
    } catch (e) {
        console.error(`[Ad Detection] Error scanning ${websiteUrl}:`, e);
        return { runningAds: false, adTags: [] };
    }
};

