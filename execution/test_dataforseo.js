import { searchRankings } from './server/services/rankTracker.js';

async function run() {
    try {
        console.log("Testing DataForSEO expansion...");
        const result = await searchRankings("med spa", "Dubai, UAE", 50);
        console.log(`Successfully retrieved ${result.results.length} results!`);
        
        // Output a few names to verify
        const sample = result.results.slice(0, 5).map(r => `${r.rank}. ${r.name} - ${r.address}`);
        console.log("Samples:", sample);

    } catch (e) {
        console.error("Test failed:", e);
    }
}

run();
