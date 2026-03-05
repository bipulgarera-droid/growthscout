
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Mimic the App.tsx logic for logo fallback
function getLogoUrl(imageUrl: string | undefined, website: string | undefined) {
    if (imageUrl) return imageUrl;
    if (website) {
        try {
            const hostname = new URL(website).hostname;
            return `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
        } catch (e) {
            return undefined;
        }
    }
    return undefined;
}

// Mock Data from Apify (Simulated)
const MOCK_RESULTS_WITH_IMAGE = {
    name: "Business With Image",
    website: "https://example.com",
    imageUrl: "https://lh5.googleusercontent.com/p/AF1QipN..."
};

const MOCK_RESULTS_NO_IMAGE = {
    name: "Business NO Image",
    website: "https://stripe.com",
    imageUrl: undefined
};

async function testLogoLogic() {
    console.log("🧪 Testing Logo Logic...\n");

    // Case 1: Image exists
    const logo1 = getLogoUrl(MOCK_RESULTS_WITH_IMAGE.imageUrl, MOCK_RESULTS_WITH_IMAGE.website);
    console.log(`[Case 1] Has Image: ${logo1}`);
    if (logo1 === MOCK_RESULTS_WITH_IMAGE.imageUrl) {
        console.log("✅ PASSED: Used provided image.");
    } else {
        console.log("❌ FAILED: Did not use provided image.");
    }

    // Case 2: No Image, Has Website (Fallback Trigger)
    const logo2 = getLogoUrl(MOCK_RESULTS_NO_IMAGE.imageUrl, MOCK_RESULTS_NO_IMAGE.website);
    console.log(`\n[Case 2] No Image, Has Website: ${logo2}`);
    if (logo2 && logo2.includes('google.com/s2/favicons') && logo2.includes('stripe.com')) {
        console.log("✅ PASSED: Generated favicon URL.");

        // Verify the URL actually works (returns 200)
        console.log("   Verifying URL reachability...");
        try {
            const res = await fetch(logo2);
            if (res.ok) console.log("   ✅ URL is reachable (HTTP 200)");
            else console.log(`   ❌ URL failed with status ${res.status}`);
        } catch (e) {
            console.log("   ❌ Error fetching URL:", e);
        }

    } else {
        console.log("❌ FAILED: Did not generate favicon URL.");
    }
}

testLogoLogic();
