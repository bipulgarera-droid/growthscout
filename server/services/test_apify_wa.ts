import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const APIFY_TOKEN = process.env.APIFY_API_KEY;

async function runTest() {
    console.log("Fetching 5 leads from Supabase...");
    const { data: leads, error } = await supabase
        .from('leads')
        .select('id, business_name, phone')
        .not('phone', 'is', 'null')
        .neq('phone', '')
        .limit(5);

    if (error || !leads || leads.length === 0) {
        console.error("Failed to fetch leads", error);
        return;
    }

    for (const lead of leads) {
        // Strip non-digits
        let phoneStr = lead.phone.replace(/\D/g, '');

        // Very basic US formatting for MVP test
        if (phoneStr.length === 10) phoneStr = '1' + phoneStr;

        console.log(`\nTesting ${lead.business_name}: ${phoneStr}`);

        // The exact input JSON format specified in your screenshot for the devscrapper actor
        const inputData = { "phoneNumber": phoneStr };

        try {
            console.log(`Calling devscrapper/whatsapp-number-validator...`);

            // Step 1: Run Actor synchronously 
            // Apify Synchronous Run Endpoint: POST /v2/acts/{actId}/runs
            const runUrl = `https://api.apify.com/v2/acts/devscrapper~whatsapp-number-validator/runs?token=${APIFY_TOKEN}`;

            const runRes = await fetch(runUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(inputData)
            });

            if (!runRes.ok) {
                console.error("Failed to start actor", await runRes.text());
                continue;
            }

            const runResult = await runRes.json();
            const datasetId = runResult.data.defaultDatasetId;
            const runId = runResult.data.id;

            console.log(`Actor started (Run ID: ${runId}). Waiting for completion...`);

            // Step 2: Poll for completion
            let isFinished = false;
            while (!isFinished) {
                await new Promise(r => setTimeout(r, 3000));
                const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
                const statusData = await statusRes.json();
                const status = statusData.data.status;

                if (status === 'SUCCEEDED') isFinished = true;
                if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
                    console.error("Actor failed with status:", status);
                    break;
                }
            }

            if (!isFinished) continue;

            // Step 3: Fetch Dataset results
            const datasetRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
            const datasetItems = await datasetRes.json();

            console.log("Result:", JSON.stringify(datasetItems, null, 2));

        } catch (e) {
            console.error("Error during Apify call:", e);
        }
    }
    console.log("\n✅ Test Complete");
}

runTest();
