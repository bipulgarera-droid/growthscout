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

export async function runScrapingPipeline(service: string, city: string, targetCount: number, onData?: (chunk: string) => void) {
    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    const runId = Date.now().toString();
    const queries = generateKeywords(service, city);
    let allRecords: any[] = [];
    let currentResultsFile = path.resolve(TEMP_DIR, `results_${runId}.csv`);

    console.log(`[Pipeline] Staring partitioned run ${runId} targeting ${targetCount} max records.`);

    // Simple robust CSV parser
    const parseLine = (line: string) => {
        const result = [];
        let inQuotes = false;
        let currentVal = '';
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) {
                result.push(currentVal.replace(/^"|"$/g, '').trim());
                currentVal = '';
            } else { currentVal += char; }
        }
        result.push(currentVal.replace(/^"|"$/g, '').trim());
        return result;
    };

    for (let index = 0; index < queries.length; index++) {
        if (allRecords.length >= targetCount) {
            if (onData) onData(`Target quota of ${targetCount} reached. Halting query spread.`);
            break;
        }

        const query = queries[index];
        const queryFile = path.resolve(TEMP_DIR, `query_${runId}_${index}.txt`);
        fs.writeFileSync(queryFile, query, 'utf-8');

        if (onData) onData(`[Query ${index+1}/${queries.length}] Scaling target matrix => "${query}" (Current: ${allRecords.length}/${targetCount})`);

        await new Promise((resolve, reject) => {
            const scraperProcess = spawn(BINARY_PATH, [
                '-input', queryFile,
                '-c', '1',
                '-depth', '10',
                '-results', currentResultsFile
            ], { cwd: path.dirname(BINARY_PATH) });

            scraperProcess.stdout.on('data', (data) => {
                const line = data.toString();
                if (onData) onData(line);
            });

            scraperProcess.stderr.on('data', (data) => {
                console.error(`[Pipeline ERR]`, data.toString());
            });

            scraperProcess.on('close', (code) => {
                if (fs.existsSync(currentResultsFile)) {
                    try {
                        const csvData = fs.readFileSync(currentResultsFile, 'utf-8');
                        const lines = csvData.split('\n').filter((l: string) => l.trim().length > 0);
                        
                        if (lines.length > 0) {
                            const headers = lines[0].split(',').map((h: string) => h.trim().toLowerCase());
                            for (let i = 1; i < lines.length; i++) {
                                const values = parseLine(lines[i]);
                                const record: any = {};
                                headers.forEach((h: string, idx: number) => { record[h] = values[idx]; });
                                
                                // Prevent duplicate accumulation in same file output
                                if (!allRecords.find(r => r.place_id === record.place_id)) {
                                    allRecords.push({
                                        place_id: record.place_id,
                                        name: record.name,
                                        phone: record.phone || record.phones,
                                        website: record.website,
                                        email: record.emails ? record.emails.split(',')[0] : null,
                                        ads: false,
                                        score: 0,
                                        address: record.address,
                                        niche: record.main_category,
                                        reviews: parseInt(record.reviews) || 0
                                    });
                                }
                            }
                        }
                        // Delete CSV so next iteration starts fresh
                        fs.unlinkSync(currentResultsFile);
                    } catch (e: any) {
                        console.error("Failed to parse CSV shard", e);
                    }
                }
                resolve(true);
            });

            scraperProcess.on('error', (err) => resolve(false));
        });
    }

    return { 
        success: true, 
        csvFilePath: 'In-Memory Sharded Run', 
        records: allRecords.slice(0, targetCount) 
    };
}
