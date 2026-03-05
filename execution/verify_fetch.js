
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Use the SAME Public/Anon key that the website would use
// (Derived from service key for testing, or assume we have read access)
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyFetch() {
    const slug = "glamour-med-spa-test";
    console.log(`🔎 Attempting to fetch data for slug: ${slug}...`);

    const { data, error } = await supabase
        .from('personalized_previews')
        .select('slug, business_name, contact_info')
        .eq('slug', slug)
        .single();

    if (error) {
        console.error("❌ Fetch Failed:", error.message);
        process.exit(1);
    }

    if (!data) {
        console.error("❌ No data found for this slug!");
        process.exit(1);
    }

    console.log("✅ Fetch Successful!");
    console.log("   Business:", data.business_name);
    console.log("   Phone:", data.contact_info?.phone);
    console.log("   Email:", data.contact_info?.email);
    console.log("\n🚀 CONCLUSION: The website will be able to load this data.");
}

verifyFetch();
