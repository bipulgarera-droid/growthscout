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
 * Dynamically fetches all ZIP codes for a given city and state.
 * Expected input for city: "Dallas" or "Dallas, TX" or "Texas"
 * If state is missing, we try to parse it or default to a broad approach.
 */
async function fetchZipCodes(cityString: string, onData?: (chunk: string) => void): Promise<string[]> {
    try {
        // Simple heuristic: if cityString is "Dallas, TX", we extract "TX"
        const parts = cityString.split(',').map(s => s.trim());
        const city = parts[0];
        // Default to TX since growthscout is heavily TX based for now, but handle provided state if exists.
        const state = parts.length > 1 ? parts[1] : 'tx'; 
        
        if (onData) onData(`[Zip Engine] Fetching zip codes for ${city}, ${state.toUpperCase()} from Zippopotam...`);
        const res = await fetch(`https://api.zippopotam.us/us/${state.toLowerCase()}/${encodeURIComponent(city.toLowerCase())}`);
        if (!res.ok) {
            throw new Error(`Failed to fetch zips: ${res.status}`);
        }
        const data = await res.json();
        const zips = data.places.map((p: any) => p['post code']);
        if (onData) onData(`[Zip Engine] Discovered ${zips.length} ZIP codes for ${city}.`);
        return zips;
    } catch (err: any) {
        if (onData) onData(`[Zip Engine] Error fetching zip codes: ${err.message}. Falling back to standard queries.`);
        return [];
    }
}

/**
 * Generates an automated list of keywords to feed into the scraper.
 */
function generateKeywords(service: string, city: string): string[] {
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

export async function runScrapingPipeline(service: string, city: string, targetCount: number, projectId?: string, onData?: (chunk: string) => void, customPostalCodes?: string[]) {
    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    const runId = Date.now().toString();
    
    // 1. Fetch Supabase completed zips state if a project ID is provided
    let completedZips: string[] = [];
    const { supabase } = await import('./persistence.js');
    if (projectId && supabase) {
        const { data, error } = await supabase
            .from('projects')
            .select('completed_zip_codes')
            .eq('id', projectId)
            .single();
            
        if (!error && data?.completed_zip_codes) {
            completedZips = Array.isArray(data.completed_zip_codes) ? data.completed_zip_codes : [];
            if (onData) onData(`[Supabase] Loaded ${completedZips.length} previously completed ZIP codes for this project.`);
        }
    }

    // 2. Map ZIP/Postal Codes
    let queries: string[] = [];
    let isZipMode = false;

    if (customPostalCodes && customPostalCodes.length > 0) {
        // ✅ User provided custom postal codes — skip Zippopotam entirely
        isZipMode = true;
        const remainingCodes = customPostalCodes.filter(z => !completedZips.includes(z));
        if (onData) onData(`[Custom Codes] Processing ${remainingCodes.length} custom postal codes... (${customPostalCodes.length - remainingCodes.length} skipped as already completed)`);
        
        queries = remainingCodes.map(code => `${service} ${code}`);
        
        if (queries.length === 0) {
            if (onData) onData(`[Custom Codes] NOTICE: All provided postal codes have already been scraped for this project.`);
            queries = generateKeywords(service, city);
            isZipMode = false;
        }
    } else {
        // Default: US-only Zippopotam lookup
        const allCityZips = await fetchZipCodes(city, onData);
    
        if (allCityZips.length > 0) {
            isZipMode = true;
            const remainingZips = allCityZips.filter(z => !completedZips.includes(z));
            if (onData) onData(`[Zip Engine] Processing ${remainingZips.length} remaining ZIP codes... (${completedZips.length} skipped)`);
            
            queries = remainingZips.map(zip => `${service} ${zip}`);
            
            if (queries.length === 0) {
                if (onData) onData(`[Zip Engine] NOTICE: You have already exhausted all ZIP codes in ${city} for this project.`);
                queries = generateKeywords(service, city);
                isZipMode = false;
            }
        } else {
            queries = generateKeywords(service, city);
        }
    }
    
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

    let newlyCompletedZips: string[] = [];

    for (let index = 0; index < queries.length; index++) {
        if (allRecords.length >= targetCount) {
            if (onData) onData(`Target quota of ${targetCount} reached. Halting query spread.`);
            break;
        }

        const query = queries[index];
        const queryFile = path.resolve(TEMP_DIR, `query_${runId}_${index}.txt`);
        fs.writeFileSync(queryFile, query, 'utf-8');

        if (onData) onData(`[Query ${index+1}/${queries.length}] Targeting => "${query}"`);

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
                console.log(`[Pipeline] Scraper process exited with code ${code}. Checking for CSV at: ${currentResultsFile}`);
                if (fs.existsSync(currentResultsFile)) {
                    try {
                        const csvData = fs.readFileSync(currentResultsFile, 'utf-8');
                        const lines = csvData.split('\n').filter((l: string) => l.trim().length > 0);
                        
                        console.log(`[Pipeline] CSV has ${lines.length} lines. First line (headers): ${lines[0]?.substring(0, 200)}`);
                        
                        if (lines.length > 1) {
                            // Use parseLine for headers too — naive split fails on quoted headers
                            const headers = parseLine(lines[0]).map((h: string) => h.trim().toLowerCase());
                            console.log(`[Pipeline] Parsed headers: ${JSON.stringify(headers)}`);
                            
                            for (let i = 1; i < lines.length; i++) {
                                const values = parseLine(lines[i]);
                                const record: any = {};
                                headers.forEach((h: string, idx: number) => { record[h] = values[idx]; });
                                
                                // Prevent duplicate accumulation in same file output
                                if (!allRecords.find(r => r.place_id === record.place_id)) {
                                    allRecords.push({
                                        place_id: record.place_id,
                                        name: record.name || record.title,
                                        phone: record.phone || record.phones,
                                        website: record.website,
                                        email: record.emails ? record.emails.split(',')[0] : null,
                                        ads: false,
                                        score: parseFloat(record.review_rating) || 0,   // gosom: review_rating
                                        address: record.address || record.full_address,
                                        niche: record.main_category || record.category,
                                        reviews: parseInt(record.review_count) || 0,    // gosom: review_count
                                        searchLocation: city  // Always store the city used for this scrape
                                    });
                                }
                            }
                            console.log(`[Pipeline] After parsing this shard: ${allRecords.length} total records`);
                        } else {
                            console.log(`[Pipeline] CSV has only header or is empty: ${lines.length} lines`);
                        }
                        // Delete CSV so next iteration starts fresh
                        fs.unlinkSync(currentResultsFile);
                    } catch (e: any) {
                        console.error("Failed to parse CSV shard", e);
                    }
                } else {
                    console.log(`[Pipeline] WARNING: CSV file does NOT exist at ${currentResultsFile}`);
                }
                resolve(true);
            });

            scraperProcess.on('error', (err) => resolve(false));
        });

        // Add to completed zips tracking array if this was a ZIP-based search
        if (isZipMode) {
            const zipMatch = query.match(/\d{5}$/);
            if (zipMatch) newlyCompletedZips.push(zipMatch[0]);
        }
    }

    // 3. Save completed zips back to Supabase
    if (isZipMode && projectId && newlyCompletedZips.length > 0 && supabase) {
        const mergedZips = Array.from(new Set([...completedZips, ...newlyCompletedZips]));
        if (onData) onData(`[Supabase] Saving state... Marking ${newlyCompletedZips.length} new ZIP codes as permanently drained.`);
        
        await supabase
            .from('projects')
            .update({ completed_zip_codes: mergedZips })
            .eq('id', projectId);
    }

    return { 
        success: true, 
        csvFilePath: 'In-Memory Sharded Run', 
        records: allRecords 
    };
}
