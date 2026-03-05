
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testLeadFlow() {
    const businessName = "Glamour Med Spa Test";
    const slug = "glamour-med-spa-test";

    console.log(`Testing flow for: ${businessName}`);
    console.log(`Slug: ${slug}`);

    // 1. Clean up old test data
    await supabase.from('personalized_previews').delete().eq('slug', slug);

    // 2. Insert Test Data
    const { error } = await supabase.from('personalized_previews').insert({
        slug,
        business_name: businessName,
        logo_url: "https://via.placeholder.com/150",
        contact_info: {
            phone: "555-0123",
            email: "test@glamourmed.com",
            address: "123 Beauty Lane"
        }
    });

    if (error) {
        console.error("❌ Insertion Failed:", error);
        return;
    }

    console.log("✅ Data inserted into Supabase!");
    console.log(`🔗 Verify here: https://voice-ai-template.vercel.app/preview/${slug}`);
}

testLeadFlow();
