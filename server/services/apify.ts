import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const APIFY_API_KEY = process.env.APIFY_API_KEY;
// Correct actor path with tilde
const APIFY_GOOGLE_MAPS_ACTOR = 'compass~crawler-google-places';

export interface BusinessSearchParams {
    query: string;
    location?: string;
    maxResults?: number;
}

export interface DiscoveredBusiness {
    name: string;
    address: string;
    phone?: string;
    website?: string;
    rating?: number;
    reviewCount?: number;
    category?: string;
    placeId?: string;
    imageUrl?: string;
}

export const discoverBusinesses = async (params: BusinessSearchParams): Promise<DiscoveredBusiness[]> => {
    if (!APIFY_API_KEY) {
        throw new Error("Missing APIFY_API_KEY in environment variables");
    }

    const { query, location, maxResults = 20 } = params;

    // Parse location into city and state (e.g., "New york, NY" -> city: "New york", state: "NY")
    let city = '';
    let state = '';
    if (location) {
        const parts = location.split(',').map(p => p.trim());
        city = parts[0] || '';
        state = parts[1] || '';
    }

    console.log(`Starting Apify search: query="${query}", city="${city}", state="${state}" (max: ${maxResults})`);

    // Combine query and location for a natural search term (e.g., "production house in mumbai, maharashtra")
    const searchString = location ? `${query} in ${location}` : query;

    // Use synchronous endpoint - waits for completion and returns results directly
    const response = await fetch(
        `https://api.apify.com/v2/acts/${APIFY_GOOGLE_MAPS_ACTOR}/run-sync-get-dataset-items?token=${APIFY_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                searchStringsArray: [searchString],
                maxCrawledPlacesPerSearch: maxResults,
                maxCrawledPlaces: maxResults,
                language: 'en',
                skipClosedPlaces: true,
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Apify error:', errorText);
        throw new Error(`Apify request failed: ${response.status} - ${errorText}`);
    }

    const rawResults: any[] = await response.json();
    console.log(`Apify returned ${rawResults.length} results`);

    // Map to our interface and split on comma-separated phones
    const businesses: DiscoveredBusiness[] = [];
    rawResults.forEach((item: any) => {
        const phoneRaw = item.phone || item.phoneUnformatted || '';
        const baseBz: DiscoveredBusiness = {
            name: item.title || item.name || 'Unknown',
            address: item.address || item.street || '',
            website: item.website || item.url,
            rating: item.totalScore || item.rating,
            reviewCount: item.reviewsCount || item.reviews,
            category: item.categoryName || item.category,
            placeId: item.placeId,
            imageUrl: item.imageUrl || (item.images && item.images[0]),
        };

        if (phoneRaw && phoneRaw.includes(',')) {
            const phones = phoneRaw.split(',').map((p: string) => p.trim()).filter(Boolean);
            if (phones.length > 0) {
                phones.forEach((p: string) => {
                    businesses.push({ ...baseBz, phone: p });
                });
            } else {
                businesses.push({ ...baseBz, phone: phoneRaw });
            }
        } else {
            businesses.push({ ...baseBz, phone: phoneRaw });
        }
    });

    const queryKeywords = query.toLowerCase().split(' ');
    return businesses.filter(b => {
        if (!b.category) return true;
        const cat = b.category.toLowerCase();
        return queryKeywords.some(keyword => cat.includes(keyword));
    });
};
