import dotenv from 'dotenv';
import path from 'path';
import { ApifyClient } from 'apify-client';
import { createClient } from '@supabase/supabase-js';

// 1. Initialize Supabase
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// 2. Initialize Apify
const client = new ApifyClient({ token: process.env.APIFY_API_KEY });

async function run() {
    try {
        console.log("Fetching 3 leads from Supabase...");
        const { data: leads, error } = await supabase
            .from('leads')
            .select('id, business_name, phone')
            .not('phone', 'is', 'null')
            .neq('phone', '')
            .limit(3);

        if (error || !leads || leads.length === 0) {
            console.error("Failed to fetch", error);
            return;
        }

        for (const lead of leads) {
            let phoneStr = lead.phone.replace(/\D/g, ''); 
            if (phoneStr.length === 10) phoneStr = '1' + phoneStr;

            console.log(`\nTesting ${lead.business_name}: ${phoneStr}`);
            
            const input = { "phoneNumbers": [phoneStr] }; // Typically actors accept arrays if 'phoneNumbers'
            // Wait, screenshot says "Phone number (international format) (required)" -> "phone number"
            const inputSingle = { "phoneNumber": phoneStr };

            console.log("Starting actor api_factory/whatsapp-number-validator...");
            
            // Note: apify-client takes ~15-30s per run for headless browsers
            const run = await client.actor("api_factory/whatsapp-number-validator").call(inputSingle);
            console.log(`Run ${run.id} finished. Fetching...`);

            const { items } = await client.dataset(run.defaultDatasetId).listItems();
            console.log("Result:", JSON.stringify(items, null, 2));
        }
        console.log("\n✅ Test Complete");

    } catch (e) {
        console.error("Test failed", e);
    }
}
run();
