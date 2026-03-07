import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const APIFY_TOKEN = process.env.APIFY_API_KEY;

export interface ApifyContactResult {
    email?: string;
    phone?: string;
    linkedin?: string;
    instagram?: string;
    facebook?: string;
    twitter?: string;
    sources: string[];
}

/**
 * Uses the vdrmota/contact-info-scraper Apify actor to aggressively scrape
 * contact information directly from a business website.
 */
export const scrapeContactInfoApify = async (websiteUrl: string): Promise<ApifyContactResult> => {
    console.log(`[Apify Scraper] Starting contact extraction for: ${websiteUrl}`);
    const result: ApifyContactResult = { sources: [] };

    if (!APIFY_TOKEN) {
        console.error("[Apify Scraper] Missing APIFY_API_KEY");
        return result;
    }

    try {
        const runUrl = `https://api.apify.com/v2/acts/vdrmota~contact-info-scraper/runs?token=${APIFY_TOKEN}`;

        // Configuration for the scraper (keep maxDepth shallow to save time/cost)
        const runRes = await fetch(runUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                startUrls: [{ url: websiteUrl }],
                maxDepth: 1, // Only check homepage and 1 click deep (like /contact)
                limit: 10,  // Max pages to scrape
                considerChildFrames: false,
                useBrowser: true // Render JS
            })
        });

        if (!runRes.ok) {
            console.error(`[Apify Scraper] Failed to start run (Status: ${runRes.status})`);
            return result;
        }

        const runData = await runRes.json();
        const datasetId = runData.data.defaultDatasetId;
        const runId = runData.data.id;

        // Poll for completion (Wait up to 60s since full browser scrape is slow)
        let isFinished = false;
        let retries = 0;
        while (!isFinished && retries < 30) {
            await new Promise(r => setTimeout(r, 2000));
            const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
            const statusData = await statusRes.json();
            const status = statusData.data.status;

            if (status === 'SUCCEEDED') isFinished = true;
            if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
                console.error(`[Apify Scraper] Actor failed. Status: ${status}`);
                break;
            }
            retries++;
        }

        if (!isFinished) {
            console.log(`[Apify Scraper] Run timed out or failed for ${websiteUrl}`);
            return result;
        }

        // Fetch Results
        const datasetRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
        const items = await datasetRes.json();

        if (items && items.length > 0) {
            // Merge all found items (different pages might have different contacts)
            const allEmails = new Set<string>();
            const allPhones = new Set<string>();

            for (const item of items) {
                // Emails
                if (item.emails) {
                    item.emails.forEach((e: string) => allEmails.add(e));
                }

                // Phones
                if (item.phones) {
                    item.phones.forEach((p: string) => allPhones.add(p));
                }

                // Social profiles
                if (item.linkedin && !result.linkedin) result.linkedin = Array.isArray(item.linkedin) ? item.linkedin[0] : item.linkedin;
                if (item.instagram && !result.instagram) result.instagram = Array.isArray(item.instagram) ? item.instagram[0] : item.instagram;
                if (item.facebook && !result.facebook) result.facebook = Array.isArray(item.facebook) ? item.facebook[0] : item.facebook;
                if (item.twitter && !result.twitter) result.twitter = Array.isArray(item.twitter) ? item.twitter[0] : item.twitter;
            }

            // Clean & filter generic emails out
            const filteredEmails = Array.from(allEmails).filter(e =>
                !e.includes('example') &&
                !e.includes('noreply') &&
                !e.includes('godaddy') &&
                !e.includes('wix')
            );

            if (filteredEmails.length > 0) result.email = filteredEmails[0];
            if (allPhones.size > 0) result.phone = Array.from(allPhones)[0];

            result.sources.push(websiteUrl);

            console.log(`[Apify Scraper] Successfully extracted data for ${websiteUrl}:`, {
                email: result.email ? '✅' : '❌',
                phone: result.phone ? '✅' : '❌',
                linkedin: result.linkedin ? '✅' : '❌',
                instagram: result.instagram ? '✅' : '❌',
            });
        } else {
            console.log(`[Apify Scraper] No contact data found on ${websiteUrl}`);
        }

    } catch (error) {
        console.error(`[Apify Scraper] Error scraping ${websiteUrl}:`, error);
    }

    return result;
};
