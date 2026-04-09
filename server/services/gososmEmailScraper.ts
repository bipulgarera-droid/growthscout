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
 * Uses the gosom google_maps_scraper binary with -email flag.
 * 
 * IMPORTANT: gosom is a Google Maps scraper — it takes search queries like 
 * "plumber in Austin TX", finds business listings, and extracts emails from 
 * each business's own website recursively.
 * 
 * It does NOT accept direct website URLs as input. It crawls GM search results.
 * This makes it great for bulk-finding emails by searching business name + city.
 */
export const scrapeEmailGosom = async (businessName: string, city: string): Promise<string | null> => {
    if (!fs.existsSync(BINARY_PATH)) {
        console.warn(`[Gosom] Binary not found at ${BINARY_PATH}. Run npm install to trigger postinstall.`);
        return null;
    }

    // Build a Google Maps search query from the business name + city
    const query = `${businessName} ${city}`.trim();

    // Write the query to a temp file (gosom requires -input <file>)
    const tmpInput = path.join(os.tmpdir(), `gosom_input_${Date.now()}.txt`);
    const tmpOutput = path.join(os.tmpdir(), `gosom_output_${Date.now()}.csv`);

    fs.writeFileSync(tmpInput, query + '\n', 'utf8');

    return new Promise((resolve) => {
        console.log(`[Gosom] Querying Google Maps for email: "${query}"`);

        const timeout = setTimeout(() => {
            child.kill('SIGTERM');
            console.log(`[Gosom] Timed out for "${query}"`);
            if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput);
            if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
            resolve(null);
        }, 45000); // 45-second timeout (email mode needs more time)

        // gosom flags:
        // -email       : enable email extraction by visiting each business's website
        // -depth 2     : crawl 2 levels deep per website
        // -c 1         : 1 concurrent worker
        // -input       : file containing search queries (one per line)
        // -results-file: output CSV
        // -limit 1     : only grab the top Google Maps result (we only want emails for that specific business)
        const child = spawn(BINARY_PATH, [
            '-email',
            '-depth', '2',
            '-c', '1',
            '-input', tmpInput,
            '-results-file', tmpOutput,
            '-limit', '1',   // Only the top result for this business
        ]);

        let stderr = '';
        child.stderr.on('data', (d) => { stderr += d.toString(); });

        child.on('close', (code) => {
            clearTimeout(timeout);
            if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput);

            if (!fs.existsSync(tmpOutput)) {
                console.log(`[Gosom] No output file for "${query}". Stderr: ${stderr.slice(0, 300)}`);
                resolve(null);
                return;
            }

            try {
                const csv = fs.readFileSync(tmpOutput, 'utf8');
                fs.unlinkSync(tmpOutput);

                const lines = csv.trim().split('\n');
                if (lines.length < 2) {
                    resolve(null);
                    return;
                }

                const headers = lines[0].toLowerCase().split(',');
                const emailColIdx = headers.findIndex(h => h.includes('email'));

                if (emailColIdx === -1) {
                    console.log(`[Gosom] No email column in output for "${query}"`);
                    resolve(null);
                    return;
                }

                // Scan all data rows for any valid email
                const emailRegex = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(',');
                    const emailField = cols[emailColIdx]?.trim().replace(/^"|"$/g, '');
                    if (emailField && emailRegex.test(emailField)) {
                        console.log(`[Gosom] Found email for "${query}": ${emailField}`);
                        resolve(emailField.toLowerCase());
                        return;
                    }
                }

                console.log(`[Gosom] No valid email in output for "${query}"`);
                resolve(null);

            } catch (e) {
                console.error(`[Gosom] Error parsing output for "${query}":`, e);
                if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
                resolve(null);
            }
        });

        child.on('error', (err) => {
            clearTimeout(timeout);
            console.error(`[Gosom] Process error for "${query}":`, err.message);
            if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput);
            if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
            resolve(null);
        });
    });
};

/**
 * Bulk gosom email scraper — uses business name + city to query Google Maps,
 * then extracts email from the top matching result's website.
 * 
 * Input shape now includes businessName and city (extracted from address),
 * plus website used as a fallback label only.
 */
export const bulkScrapeEmailGosom = async (
    leads: Array<{ id: string; name: string; address?: string }>,
    concurrency = 2
): Promise<Record<string, string | null>> => {
    const results: Record<string, string | null> = {};

    // Process in small batches to avoid hammering Google Maps
    for (let i = 0; i < leads.length; i += concurrency) {
        const batch = leads.slice(i, i + concurrency);
        const batchResults = await Promise.allSettled(
            batch.map(async (lead) => {
                // Extract city from address string (e.g. "123 Main St, Austin, TX 78701")
                const cityMatch = lead.address?.match(/,\s*([^,]+),\s*[A-Z]{2}/);
                const city = cityMatch ? cityMatch[1].trim() : '';
                const email = await scrapeEmailGosom(lead.name, city);
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
