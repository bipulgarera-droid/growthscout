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
 * Uses the lukaskrivka/google-maps-with-contact-details Apify actor to
 * aggressively extract contact information from Google Maps listings.
 */
export const scrapeContactInfoApify = async (businessName: string, location: string = '', websiteUrl: string = ''): Promise<ApifyContactResult> => {
    // The actor accepts a Google Maps URL or search keywords.
    // We'll pass the exact business name + address as a search string.
    const searchString = `${businessName} ${location}`;
    console.log(`[Apify Scraper] Starting contact extraction for: ${searchString}`);
    const result: ApifyContactResult = { sources: [] };

    if (!APIFY_TOKEN) {
        console.error("[Apify Scraper] Missing APIFY_API_KEY");
        return result;
    }

    try {
        const runUrl = `https://api.apify.com/v2/acts/lukaskrivka~google-maps-with-contact-details/runs?token=${APIFY_TOKEN}`;

        // Configuration for the new Google Maps Scraper
        const runRes = await fetch(runUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                searchStringsArray: [searchString],
                maxCrawledPlacesPerSearch: 1, // Only get the exact matching business
                scrapeContactDetails: true,    // CRITICAL: Tells actor to scrape for emails
                language: "en"
            })
        });

        if (!runRes.ok) {
            console.error(`[Apify Scraper] Failed to start run (Status: ${runRes.status})`);
            return result;
        }

        const runData = await runRes.json();
        const datasetId = runData.data.defaultDatasetId;
        const runId = runData.data.id;

        // Poll for completion
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
            console.log(`[Apify Scraper] Run timed out or failed for ${searchString}`);
            return result;
        }

        // Fetch Results
        const datasetRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
        const items = await datasetRes.json();

        if (items && items.length > 0) {
            const item = items[0]; // Assuming best match is the first item

            if (item.emails && item.emails.length > 0) {
                // Filter generic emails
                const filteredEmails = item.emails.filter((e: string) =>
                    !e.includes('example') &&
                    !e.includes('noreply') &&
                    !e.includes('godaddy') &&
                    !e.includes('wix')
                );
                result.email = filteredEmails.length > 0 ? filteredEmails[0] : item.emails[0];
            }

            if (item.phoneUnformatted || item.phone) result.phone = item.phoneUnformatted || item.phone;
            if (item.linkedin) result.linkedin = item.linkedin;
            if (item.instagram) result.instagram = item.instagram;
            if (item.facebook) result.facebook = item.facebook;
            if (item.twitter) result.twitter = item.twitter;

            // Add the website or Gmaps URL as the source if available
            if (item.website) result.sources.push(item.website);
            else if (item.url) result.sources.push(item.url);
            else if (websiteUrl) result.sources.push(websiteUrl);

            console.log(`[Apify Scraper] Successfully extracted data from maps for ${searchString}:`, {
                email: result.email ? '✅' : '❌',
                phone: result.phone ? '✅' : '❌',
                linkedin: result.linkedin ? '✅' : '❌',
                instagram: result.instagram ? '✅' : '❌',
            });
        } else {
            console.log(`[Apify Scraper] No contact data found on Maps for ${searchString}`);
        }

    } catch (error) {
        console.error(`[Apify Scraper] Error scraping ${searchString}:`, error);
    }

    return result;
};
