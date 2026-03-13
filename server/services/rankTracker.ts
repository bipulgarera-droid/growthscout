/**
 * Rank Tracker Service — DataForSEO Edition
 * 
 * Uses DataForSEO Google Maps SERP API to get ranked Google Maps results.
 * This returns up to 700 businesses with explicit rank positions and proper geo-targeting.
 * 
 * Docs: https://docs.dataforseo.com/v3/serp/google/maps/live/advanced/
 * Cost: ~$0.002 per request
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') }); // Try server/.env first
dotenv.config({ path: path.resolve(__dirname, '../../.env') }); // Then try root .env

export interface RankedBusiness {
    rank: number;
    name: string;
    address: string;
    phone?: string;
    website?: string;
    rating?: number;
    reviewCount?: number;
    category?: string;
    placeId?: string;
    imageUrl?: string;
    isClaimed?: boolean;
}

export interface RankSearchResult {
    keyword: string;
    city: string;
    totalResults: number;
    results: RankedBusiness[];
    searchedAt: string; // ISO timestamp
    cost?: number;
}

export const searchRankings = async (
    keyword: string,
    city: string,
    maxResults: number = 100
): Promise<RankSearchResult> => {
    const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
    const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;

    if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
        throw new Error("Missing DATAFORSEO_LOGIN or DATAFORSEO_PASSWORD in environment variables");
    }

    // Cap at DataForSEO max of 700
    const depth = Math.min(maxResults, 700);

    console.log(`[RankTracker] Searching DataForSEO: "${keyword}" in "${city}" (depth: ${depth})`);

    // Resolve city to GPS coordinates for DataForSEO Maps API
    let location_coordinate: string | undefined = undefined;
    try {
        console.log(`[RankTracker] Geocoding city: "${city}"`);
        const geocodeReq = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`, {
            headers: { 'User-Agent': 'GrowthScout-CRM/1.0' }
        });
        const geocodeData = await geocodeReq.json();

        if (geocodeData && geocodeData.length > 0) {
            const { lat, lon } = geocodeData[0];
            location_coordinate = `${lat},${lon},12z`; // Wider zoom level to capture the whole city
            console.log(`[RankTracker] Resolved coordinates: ${location_coordinate}`);
        } else {
            console.warn(`[RankTracker] Could not geocode "${city}", falling back to keyword search`);
        }
    } catch (err) {
        console.error(`[RankTracker] Geocoding error:`, err);
    }

    const authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');

    const searchPayload: any = {
        keyword: `${keyword} in ${city}`, // "med spa in Dubai, UAE"
        language_code: 'en',
        depth: depth,
        device: 'desktop'
    };

    if (location_coordinate) {
        searchPayload.location_coordinate = location_coordinate; // "25.0742823,55.1885387,12z"
    }

    const response = await fetch(
        'https://api.dataforseo.com/v3/serp/google/maps/live/advanced',
        {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([searchPayload])
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[RankTracker] DataForSEO HTTP error:', errorText);
        throw new Error(`DataForSEO request failed: ${response.status}`);
    }

    const data = await response.json();

    // Check for API-level errors
    if (data.status_code !== 20000) {
        throw new Error(`DataForSEO error: ${data.status_message}`);
    }

    const task = data.tasks?.[0];
    if (!task || task.status_code !== 20000) {
        throw new Error(`DataForSEO task error: ${task?.status_message || 'Unknown error'}`);
    }

    const resultData = task.result?.[0];
    if (!resultData) {
        throw new Error('DataForSEO returned no results');
    }

    const items = resultData.items || [];
    console.log(`[RankTracker] DataForSEO returned ${items.length} ranked results (cost: $${task.cost})`);

    // Map DataForSEO items to our RankedBusiness interface
    const results: RankedBusiness[] = items
        .filter((item: any) => item.type === 'maps_search')
        .map((item: any) => ({
            rank: item.rank_group || item.rank_absolute,
            name: item.title || 'Unknown',
            address: item.address || item.snippet || '',
            phone: item.phone || undefined,
            website: item.url || item.domain ? `https://${item.domain}` : undefined,
            rating: item.rating?.value || undefined,
            reviewCount: item.rating?.votes_count || undefined,
            category: item.category || undefined,
            placeId: item.place_id || undefined,
            imageUrl: item.main_image || undefined,
            isClaimed: item.is_claimed || false,
        }));

    return {
        keyword,
        city,
        totalResults: results.length,
        results,
        searchedAt: new Date().toISOString(),
        cost: task.cost,
    };
};
