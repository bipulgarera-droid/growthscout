import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SERPER_API_KEY = process.env.SERPER_API_KEY;

interface SerperSearchResult {
    title: string;
    link: string;
    snippet: string;
}

interface FounderInfo {
    founderName?: string;
    linkedin?: string;
    email?: string;
    phone?: string;
    instagram?: string;
    facebook?: string;
    twitter?: string;
    sources: string[];
    address?: string; // New field
}

// Serper Places Search
const serperPlacesSearch = async (query: string): Promise<any[]> => {
    console.log(`[Serper] Places Search: "${query}"`);
    if (!SERPER_API_KEY) throw new Error("Missing SERPER_API_KEY");

    const response = await fetch('https://google.serper.dev/places', {
        method: 'POST',
        headers: { 'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, num: 1 })
    });

    if (!response.ok) throw new Error(`Serper Places API error: ${response.statusText}`);
    const data: any = await response.json();
    return data.places || [];
};

// Generic Serper search
const serperSearch = async (query: string): Promise<SerperSearchResult[]> => {
    console.log(`[Serper] Searching for: "${query}"`); // Added Log
    if (!SERPER_API_KEY) {
        throw new Error("Missing SERPER_API_KEY in environment variables");
    }

    const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
            'X-API-KEY': SERPER_API_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            q: query,
            num: 10
        })
    });

    if (!response.ok) {
        throw new Error(`Serper API error: ${response.statusText}`);
    }

    const data: any = await response.json();
    console.log(`[Serper] Found ${data.organic?.length || 0} results for: "${query}"`);
    return data.organic || [];
};

// Extract email from text
const extractEmail = (text: string): string | undefined => {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex);
    if (matches) {
        // Filter out common non-contact emails
        const filtered = matches.filter(e =>
            !e.includes('example') &&
            !e.includes('noreply') &&
            !e.includes('support@') &&
            !e.includes('info@')
        );
        return filtered[0] || matches[0];
    }
    return undefined;
};

// Extract phone from text
const extractPhone = (text: string): string | undefined => {
    const phoneRegex = /(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const matches = text.match(phoneRegex);
    return matches ? matches[0] : undefined;
};

// Common first names for validation (detect if extracted "name" is likely a real person)
const COMMON_FIRST_NAMES = new Set([
    'james', 'john', 'robert', 'michael', 'david', 'william', 'richard', 'joseph', 'thomas', 'charles',
    'mary', 'patricia', 'jennifer', 'linda', 'elizabeth', 'barbara', 'susan', 'jessica', 'sarah', 'karen',
    'daniel', 'matthew', 'anthony', 'mark', 'donald', 'steven', 'paul', 'andrew', 'joshua', 'kenneth',
    'nancy', 'betty', 'margaret', 'sandra', 'ashley', 'emily', 'donna', 'michelle', 'dorothy', 'carol',
    'brian', 'kevin', 'jason', 'jeff', 'ryan', 'jacob', 'gary', 'nicholas', 'eric', 'jonathan',
    'lisa', 'kimberly', 'amy', 'angela', 'melissa', 'brenda', 'anna', 'rebecca', 'virginia', 'kathleen',
    'chris', 'christopher', 'tim', 'timothy', 'steve', 'stephen', 'scott', 'frank', 'raymond', 'gregory',
    'samantha', 'katherine', 'christine', 'deborah', 'rachel', 'laura', 'carolyn', 'janet', 'catherine', 'heather',
    'alex', 'alexander', 'benjamin', 'samuel', 'patrick', 'jack', 'dennis', 'jerry', 'tyler', 'aaron',
    'nicole', 'stephanie', 'victoria', 'lauren', 'andrea', 'kelly', 'cynthia', 'diana', 'julie', 'joyce'
]);

const isLikelyPersonName = (name: string): boolean => {
    const firstName = name.split(' ')[0].toLowerCase();
    return COMMON_FIRST_NAMES.has(firstName);
};

// Extract LinkedIn URL
const extractLinkedIn = (results: SerperSearchResult[]): string | undefined => {
    for (const result of results) {
        // Match personal profiles OR company pages
        if (result.link.includes('linkedin.com/in/') || result.link.includes('linkedin.com/company/')) {
            console.log(`[Serper] Found LinkedIn: ${result.link}`);
            return result.link;
        }
    }
    console.log(`[Serper] No LinkedIn URL found in ${results.length} results`);
    return undefined;
};

// Extract Instagram URL
const extractInstagram = (results: SerperSearchResult[]): string | undefined => {
    for (const result of results) {
        if (result.link.includes('instagram.com/')) {
            console.log(`[Serper] Found Instagram: ${result.link}`);
            return result.link;
        }
    }
    console.log(`[Serper] No Instagram URL found in ${results.length} results`);
    return undefined;
};

// Main business enrichment function - OPTIMIZED: Contact Info Fallback Only
export const findFounderInfo = async (businessName: string, location?: string): Promise<FounderInfo> => {
    const info: FounderInfo = { sources: [] };

    // Use full address without quotes for a comprehensive search
    const fullAddress = location || '';

    // Extract just the city name for fallback searches
    let city = '';
    if (location) {
        const cityMatch = location.match(/,?\s*([A-Za-z\s]+),\s*[A-Z]{2}/);
        city = cityMatch ? cityMatch[1].trim() : location.split(',')[0].trim();
    }

    try {
        // ===== SEARCH 1: General Contact Info =====
        const contactQuery = `${businessName} ${fullAddress} email OR phone OR contact`;
        console.log(`\n--- [SERPER FALLBACK] ---`);
        console.log(`[Serper] Executing Query: [ ${contactQuery} ]`);
        const contactResults = await serperSearch(contactQuery);

        for (const result of contactResults) {
            if (!info.email) info.email = extractEmail(result.snippet);
            if (!info.phone) info.phone = extractPhone(result.snippet);
            if (result.link.includes('/contact') || result.link.includes('/about')) {
                info.sources.push(result.link);
            }
        }

        // ===== SEARCH 2: LinkedIn Company Page =====
        const linkedinQuery = `site:linkedin.com ${businessName} founder ${city}`;
        console.log(`[Serper] Executing Query: [ ${linkedinQuery} ]`);
        const linkedinResults = await serperSearch(linkedinQuery);
        info.linkedin = extractLinkedIn(linkedinResults);
        if (info.linkedin) info.sources.push(info.linkedin);

        // ===== SEARCH 3: Instagram Profile =====
        const instaQuery = `site:instagram.com ${businessName} ${city}`;
        console.log(`[Serper] Executing Query: [ ${instaQuery} ]`);
        const instaResults = await serperSearch(instaQuery);
        info.instagram = extractInstagram(instaResults);
        if (info.instagram) info.sources.push(info.instagram);

        console.log(`[Serper] Fallback enrichment complete for "${businessName}":`, {
            email: info.email ? '✅' : '❌',
            phone: info.phone ? '✅' : '❌',
            linkedin: info.linkedin ? '✅' : '❌',
            instagram: info.instagram ? '✅' : '❌',
        });
        console.log(`-------------------------\n`);

    } catch (error) {
        console.error('Enrichment error:', error);
    }

    return info;
};

// Quick contact search (lighter weight - just email + phone + linkedin)
export const quickEnrich = async (businessName: string, website?: string): Promise<Partial<FounderInfo>> => {
    const info: Partial<FounderInfo> = {};

    try {
        // If we have website, search for contact on that domain
        if (website) {
            const domain = new URL(website).hostname;
            const siteResults = await serperSearch(`site:${domain} contact email`);
            for (const result of siteResults) {
                if (!info.email) info.email = extractEmail(result.snippet);
                if (!info.phone) info.phone = extractPhone(result.snippet);
            }
        }

        // General search
        const results = await serperSearch(`"${businessName}" contact email phone`);
        for (const result of results) {
            if (!info.email) info.email = extractEmail(result.snippet);
            if (!info.phone) info.phone = extractPhone(result.snippet);
        }

        // LinkedIn
        const linkedinResults = await serperSearch(`site:linkedin.com "${businessName}"`);
        info.linkedin = extractLinkedIn(linkedinResults);

    } catch (error) {
        console.error('Quick enrich error:', error);
    }

    return info;
};
