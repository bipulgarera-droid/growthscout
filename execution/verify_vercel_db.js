
import { createClient } from '@supabase/supabase-js';

// Keys for the Vercel DB (fjbowxw...)
const VERCEL_DB_URL = 'https://fjbowxwqaegvpjyinnsa.supabase.co';
const VERCEL_DB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqYm93eHdxYWVndnBqeWlubnNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwODc3NDUsImV4cCI6MjA3OTY2Mzc0NX0.FOPlfwF7kHhwSPhW1nlxeQ9TNBmkztEd2sQFYQ7C-SI';

const supabase = createClient(VERCEL_DB_URL, VERCEL_DB_KEY);

async function checkVercelDB() {
    console.log("🔌 Connecting to Vercel DB (fjbowxw...)...");

    // 1. Try to read (should work if table exists)
    const { error: readError } = await supabase
        .from('personalized_previews')
        .select('count')
        .limit(1);

    if (readError) {
        if (readError.code === 'PGRST205' || readError.message.includes('does not exist')) {
            console.error("❌ FAILURE: The 'personalized_previews' table DOES NOT EXIST in this database.");
            console.error("   Please make sure you selected project 'fjbowxw...' in Supabase.");
        } else {
            console.error("⚠️ READ ERROR:", readError.message, readError);
        }
    } else {
        console.log("✅ Table 'personalized_previews' found.");
    }

    // 2. Try to insert (checks write permissions)
    const testSlug = 'verify-db-' + Date.now();
    const { error: writeError } = await supabase
        .from('personalized_previews')
        .insert({
            slug: testSlug,
            business_name: "Verification Test",
            contact_info: { note: "test" }
        });

    if (writeError) {
        console.error("❌ WRITE FAILURE:", writeError.message);
        console.error("   Hint: Did you run the SQL to add the 'Allow public insert' policy?");
    } else {
        console.log("✅ Insert successful! Write permissions are correct.");
        // Clean up
        await supabase.from('personalized_previews').delete().eq('slug', testSlug);
    }
}

checkVercelDB();
