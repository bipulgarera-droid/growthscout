import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve the binary path installed by scripts/install-scraper.js
const binExt = os.platform() === 'win32' ? '.exe' : '';
const BINARY_PATH = path.resolve(__dirname, '../bin/scraper/google_maps_scraper' + binExt);

/**
 * Uses the gosom google_maps_scraper binary with -email flag to scrape emails
 * from a specific website by doing a deep recursive crawl.
 * 
 * This is far more thorough than Jina AI because it follows internal links recursively.
 * It will find emails buried in /about, /contact, /team, /staff, etc.
 */
export const scrapeEmailGosom = async (websiteUrl: string): Promise<string | null> => {
    if (!fs.existsSync(BINARY_PATH)) {
        console.warn(`[Gosom] Binary not found at ${BINARY_PATH}. Run npm install to trigger postinstall.`);
        return null;
    }

    // Junk domains that gosom can't meaningfully process
    const junkDomains = ['facebook.com', 'instagram.com', 'twitter.com', 'yelp.com', 
                         'lawnlove.com', 'thumbtack.com', 'angi.com', 'homeadvisor.com'];
    if (junkDomains.some(d => websiteUrl.includes(d))) {
        return null;
    }

    const tmpOutput = path.join(os.tmpdir(), `gosom_email_${Date.now()}.csv`);

    return new Promise((resolve) => {
        console.log(`[Gosom] Deep email scrape: ${websiteUrl}`);

        const timeout = setTimeout(() => {
            child.kill('SIGTERM');
            console.log(`[Gosom] Timed out for ${websiteUrl}`);
            if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
            resolve(null);
        }, 25000); // 25 second hard timeout per site

        // gosom flags:
        // -email          : enable email extraction from crawled pages
        // -depth 2        : crawl 2 levels deep (homepage + linked pages)
        // -c 1            : 1 concurrent worker (polite, avoids rate limits)
        // -input-urls     : provide the URL directly from stdin
        // -results-file   : write CSV output to temp file
        const child = spawn(BINARY_PATH, [
            '-email',
            '-depth', '2',
            '-c', '1',
            '-input-urls', '-',   // read URLs from stdin
            '-results-file', tmpOutput,
        ]);

        // Write the URL to stdin and close the stream
        child.stdin.write(websiteUrl + '\n');
        child.stdin.end();

        child.on('close', (code) => {
            clearTimeout(timeout);

            if (!fs.existsSync(tmpOutput)) {
                console.log(`[Gosom] No output file for ${websiteUrl}`);
                resolve(null);
                return;
            }

            try {
                const csv = fs.readFileSync(tmpOutput, 'utf8');
                fs.unlinkSync(tmpOutput); // Clean up temp file

                // Parse CSV: gosom outputs columns including 'emails'
                // Header row example: title,link,category,...,emails,...
                const lines = csv.trim().split('\n');
                if (lines.length < 2) {
                    resolve(null);
                    return;
                }

                const headers = lines[0].toLowerCase().split(',');
                const emailColIdx = headers.findIndex(h => h.includes('email'));

                if (emailColIdx === -1) {
                    console.log(`[Gosom] No email column found in output for ${websiteUrl}`);
                    resolve(null);
                    return;
                }

                // Scan all data rows for any email value
                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(',');
                    const emailField = cols[emailColIdx]?.trim().replace(/^"|"$/g, '');
                    
                    if (emailField && emailField.includes('@') && emailField.includes('.')) {
                        // Basic sanity check
                        const emailRegex = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                        if (emailRegex.test(emailField)) {
                            console.log(`[Gosom] Found email for ${websiteUrl}: ${emailField}`);
                            resolve(emailField.toLowerCase());
                            return;
                        }
                    }
                }

                console.log(`[Gosom] No valid email in output for ${websiteUrl}`);
                resolve(null);

            } catch (e) {
                console.error(`[Gosom] Error parsing output for ${websiteUrl}:`, e);
                if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
                resolve(null);
            }
        });

        child.on('error', (err) => {
            clearTimeout(timeout);
            console.error(`[Gosom] Process error for ${websiteUrl}:`, err.message);
            if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
            resolve(null);
        });
    });
};

/**
 * Bulk gosom email scraper - processes websites one at a time with concurrency control
 */
export const bulkScrapeEmailGosom = async (
    leads: Array<{ id: string; website: string }>,
    concurrency = 3
): Promise<Record<string, string | null>> => {
    const results: Record<string, string | null> = {};
    
    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < leads.length; i += concurrency) {
        const batch = leads.slice(i, i + concurrency);
        const batchResults = await Promise.allSettled(
            batch.map(async (lead) => {
                const email = await scrapeEmailGosom(lead.website);
                return { id: lead.id, email };
            })
        );

        for (const result of batchResults) {
            if (result.status === 'fulfilled') {
                results[result.value.id] = result.value.email;
            }
        }
    }

    return results;
};
