#!/usr/bin/env node
/**
 * Auto-Daily Cron Script for Railway
 * 
 * Railway runs this as a standalone process on schedule.
 * It hits the running GrowthScout web service internally and triggers the auto-daily pipeline.
 * 
 * Railway internal networking: services in the same project can reach each other
 * via http://<SERVICE_NAME>.railway.internal:<PORT>
 * 
 * Setup in Railway:
 *   1. Create a new "Cron Job" service in GrowthScout project
 *   2. Link to same GitHub repo
 *   3. Custom Start Command: node server/cron/auto-daily.mjs
 *   4. Set schedule (e.g. 0 3 * * * = 3AM UTC daily)
 *   5. Set env vars: CRON_SECRET, WEB_SERVICE_URL (optional)
 */

const rawUrl = process.env.WEB_SERVICE_URL 
    || (process.env.RAILWAY_PUBLIC_DOMAIN 
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : 'http://web.railway.internal:5001');
const WEB_URL = rawUrl.replace(/\/+$/, '');

const CRON_SECRET = process.env.CRON_SECRET || 'growthscout-auto-2026';
const TARGET_COUNT = parseInt(process.env.CRON_TARGET_COUNT || '1000');

async function main() {
    const endpoint = `${WEB_URL}/api/pipeline/auto-daily`;
    
    console.log(`[Cron] Triggering auto-daily pipeline...`);
    console.log(`[Cron] Endpoint: ${endpoint}`);
    console.log(`[Cron] Target count: ${TARGET_COUNT}`);
    console.log(`[Cron] Time: ${new Date().toISOString()}`);

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-cron-secret': CRON_SECRET,
            },
            body: JSON.stringify({ targetCount: TARGET_COUNT }),
        });

        const data = await res.json();
        
        if (res.ok) {
            console.log(`[Cron] ✅ Triggered successfully!`);
            console.log(`[Cron] ${JSON.stringify(data, null, 2)}`);
        } else {
            console.error(`[Cron] ❌ Failed: ${res.status}`);
            console.error(data);
            process.exit(1);
        }
    } catch (err) {
        console.error(`[Cron] ❌ Connection failed:`, err.message);
        console.error(`[Cron] Is the GrowthScout web service running?`);
        process.exit(1);
    }
}

main();
