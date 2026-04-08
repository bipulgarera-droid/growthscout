import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define path to the downloaded binary
const BINARY_PATH = path.resolve(__dirname, '../bin/scraper/google_maps_scraper');
const TEMP_DIR = path.resolve(__dirname, '../.tmp/pipeline');

/**
 * Generates an automated list of keywords to feed into the scraper.
 */
function generateKeywords(service: string, city: string): string[] {
    // A more advanced engine would fetch actual JSON suburbs for the city.
    // For now we use cardinal directions and permutations.
    const modifiers = ['best', 'residential', 'commercial', 'emergency', 'affordable'];
    const areas = ['North', 'South', 'East', 'West', 'Downtown'];
    
    const queries = [];
    // Base exact queries
    queries.push(`${service} in ${city}`);
    queries.push(`${service} contractors ${city}`);
    
    // Sub-areas
    for (const area of areas) {
        queries.push(`${service} in ${area} ${city}`);
    }

    // Modifiers
    for (const mod of modifiers) {
        queries.push(`${mod} ${service} in ${city}`);
    }

    return queries;
}

export async function runScrapingPipeline(service: string, city: string, onData?: (chunk: string) => void) {
    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    const runId = Date.now().toString();
    const queryFile = path.resolve(TEMP_DIR, `queries_${runId}.txt`);
    const resultsFile = path.resolve(TEMP_DIR, `results_${runId}.csv`);

    const queries = generateKeywords(service, city);
    fs.writeFileSync(queryFile, queries.join('\n'), 'utf-8');

    console.log(`[Pipeline] Staring run ${runId} with ${queries.length} queries targeting ${service} in ${city}`);

    return new Promise((resolve, reject) => {
        // google-maps-scraper -input queries.txt -c 1 -depth 10 -email -results output.csv
        const scraperProcess = spawn(BINARY_PATH, [
            '-input', queryFile,
            '-c', '1',
            '-depth', '10',
            '-email',
            '-results', resultsFile
        ], {
            cwd: path.dirname(BINARY_PATH)
        });

        scraperProcess.stdout.on('data', (data) => {
            const line = data.toString();
            console.log(`[Pipeline]`, line);
            if (onData) onData(line);
        });

        scraperProcess.stderr.on('data', (data) => {
            console.error(`[Pipeline ERR]`, data.toString());
        });

        scraperProcess.on('close', (code) => {
            console.log(`[Pipeline] Completed run ${runId} with exit code ${code}`);
            
            // Output is ready in resultsFile
            if (fs.existsSync(resultsFile)) {
                const csvData = fs.readFileSync(resultsFile, 'utf-8');
                // We'll parse this on the frontend or backend later.
                resolve({ success: true, csvFilePath: resultsFile, records: [] });
            } else {
                reject(new Error("Results file not generated"));
            }
        });

        scraperProcess.on('error', (err) => {
            console.error(`[Pipeline] Failed to start scraper:`, err);
            reject(err);
        });
    });
}
