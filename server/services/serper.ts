import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import libphonenumber from 'google-libphonenumber';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();
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
export const serperSearch = async (query: string, retries = 3): Promise<any> => {
    if (!SERPER_API_KEY) {
        throw new Error("Missing SERPER_API_KEY in environment variables");
    }

    for (let i = 0; i < retries; i++) {
        try {
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

            if (response.status === 429) {
                console.warn(`[Serper] 429 Too Many Requests. Retrying in ${2000 * Math.pow(2, i)}ms...`);
                await new Promise(r => setTimeout(r, 2000 * Math.pow(2, i)));
                continue;
            }

            if (!response.ok) {
                throw new Error(`Serper API error: ${response.statusText}`);
            }

            const data: any = await response.json();
            console.log(`[Serper] Found ${data.organic?.length || 0} results for: "${query}"`);
            return data.organic || [];
        } catch (e: any) {
            if (i === retries - 1) throw e;
            console.warn(`[Serper] Request failed, retrying... (${e.message})`);
            await new Promise(r => setTimeout(r, 2000 * Math.pow(2, i)));
        }
    }
    return [];
};

// Extract one or multiple emails from text
const extractEmail = (text: string | undefined): string | undefined => {
    if (!text) return undefined;
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
    const matches = text.match(emailRegex);
    if (matches && matches.length > 0) {
        const uniqueEmails = Array.from(new Set(matches.map(e => e.toLowerCase())));
        const filtered = uniqueEmails.filter(e =>
            !e.includes('example') &&
            !e.includes('noreply') &&
            !e.includes('john.smith') &&
            !e.includes('john.s@') &&
            !e.includes('john.doe') &&
            !e.includes('jane.doe') &&
            !e.includes('test@') &&
            !e.includes('name@') &&
            !e.includes('fake@')
        );

        if (filtered.length > 0) {
            return filtered.slice(0, 2).join(', ');
        }
    }
    return undefined;
};

// Detect country code (ISO 3166-1 alpha-2) from a location string
const detectCountryCode = (location?: string): string => {
    if (!location) return 'US'; // Default to US if unknown

    const locLower = location.toLowerCase();

    if (locLower.includes('india') || locLower.includes('mumbai') || locLower.includes('delhi')) return 'IN';
    if (locLower.includes('uk') || locLower.includes('united kingdom') || locLower.includes('london')) return 'GB';
    if (locLower.includes('canada') || locLower.includes('toronto')) return 'CA';
    if (locLower.includes('australia') || locLower.includes('sydney')) return 'AU';
    // Add more explicit country mappings as needed

    return 'US'; // Default to US 
};

// Extract and format phone from text using google-libphonenumber
const extractPhone = (text: string | undefined, defaultCountry: string = 'US'): string | undefined => {
    if (!text) return undefined;
    // A broad regex to catch phone-like sequences in snippets before validating them
    const potentialPhonesRegex = /(\+?\d{1,4}?[-.\s]?\(?\d{1,4}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,4})/g;
    const matches = text.match(potentialPhonesRegex);

    if (matches && matches.length > 0) {
        const validPhones = new Set<string>();

        for (const match of matches) {
            try {
                // Parse the potential number using the context country code
                const number = phoneUtil.parseAndKeepRawInput(match, defaultCountry);

                if (phoneUtil.isValidNumber(number)) {
                    // Always try to return E.164 strictly, but UI might want national formatting
                    const formatted = phoneUtil.format(number, libphonenumber.PhoneNumberFormat.INTERNATIONAL);
                    validPhones.add(formatted);
                }
            } catch (e) {
                // Not a valid number snippet, ignore
            }
        }

        if (validPhones.size > 0) {
            return Array.from(validPhones).slice(0, 2).join(', '); // Limit to 2 just like emails
        }
    }
    return undefined;
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

    // Clean up business name: 
    // 1. Remove legal entities
    // 2. Remove keyword stuffing after pipes | or hyphens - (common in spammy GMB names)
    let cleanBusinessName = businessName
        .split('|')[0] // Take only the first part before a pipe
        .split(' - ')[0] // Take only the first part before a spaced hyphen
        .replace(/\b(Private Limited|Pvt Ltd|Pvt\. Ltd\.|LLC|L\.L\.C\.|Inc|Inc\.|Corporation|Corp|Corp\.|Ltd|Ltd\.|Limited)\b/gi, '')
        .replace(/[,.]/g, '')
        .trim();
    
    // Fallback if the cleaning removed everything
    if (!cleanBusinessName) {
        cleanBusinessName = businessName.split('|')[0].trim();
    }

    // Extract just the city name for fallback searches
    let city = '';
    if (location) {
        const parts = location.split(',').map(p => p.trim());
        if (parts.length >= 3) {
            // Handle "Mumbai, Maharashtra 400079, India" format
            const maybeStateZip = parts[parts.length - 2];
            const hasNumbers = /\d/.test(maybeStateZip);
            city = hasNumbers ? parts[parts.length - 3] : parts[parts.length - 2];
        } else if (parts.length === 2) {
            city = parts[0];
        } else {
            // Fallback to regex if parsing fails
            const cityMatch = location.match(/,?\s*([A-Za-z\s]+),\s*[A-Z]{2}/);
            city = cityMatch ? cityMatch[1].trim() : parts[0];
        }

        // If the extracted "city" is too long, it's probably an address line. Clear it.
        if (city && city.split(' ').length > 3) {
            city = '';
        }
    }

    try {
        // ===== SEARCH 1A: Email Search =====
        const emailQuery = `${cleanBusinessName} email ${city}`.trim();
        console.log(`\n--- [SERPER PRIMARY] ---`);
        console.log(`[Serper] Executing Query: [ ${emailQuery} ]`);
        const emailResults = await serperSearch(emailQuery);

        const allEmails = new Set<string>();
        const allPhones = new Set<string>();

        const countryCode = detectCountryCode(location);

        for (const result of emailResults) {
            const extractedEmails = extractEmail(result.snippet);
            if (extractedEmails) extractedEmails.split(', ').forEach(e => allEmails.add(e));

            // Incidentally extract phone if it appears here
            const extractedPhones = extractPhone(result.snippet, countryCode);
            if (extractedPhones) extractedPhones.split(', ').forEach(p => allPhones.add(p));

            if (result.link.includes('/contact') || result.link.includes('/about')) {
                if (!info.sources.includes(result.link)) info.sources.push(result.link);
            }
        }

        // ===== SEARCH 1B: Phone Search (Explicit) =====
        const phoneQuery = `${cleanBusinessName} phone number ${city}`.trim();
        console.log(`[Serper] Executing Query: [ ${phoneQuery} ]`);
        const phoneResults = await serperSearch(phoneQuery);

        for (const result of phoneResults) {
            const extractedPhones = extractPhone(result.snippet, countryCode);
            if (extractedPhones) extractedPhones.split(', ').forEach(p => allPhones.add(p));

            // Incidentally extract email if it appears here
            const extractedEmails = extractEmail(result.snippet);
            if (extractedEmails) extractedEmails.split(', ').forEach(e => allEmails.add(e));

            if (result.link.includes('/contact') || result.link.includes('/about')) {
                if (!info.sources.includes(result.link)) info.sources.push(result.link);
            }
        }

        if (allEmails.size > 0) info.email = Array.from(allEmails).slice(0, 2).join(', ');
        if (allPhones.size > 0) info.phone = Array.from(allPhones).join(', ');

        // ===== SEARCH 2: LinkedIn Company Page =====
        const linkedinQuery = `site:linkedin.com ${cleanBusinessName} founder ${city}`.trim();
        console.log(`[Serper] Executing Query: [ ${linkedinQuery} ]`);
        const linkedinResults = await serperSearch(linkedinQuery);
        info.linkedin = extractLinkedIn(linkedinResults);
        if (info.linkedin) info.sources.push(info.linkedin);

        // ===== SEARCH 3: Instagram Profile =====
        const instaQuery = `site:instagram.com ${cleanBusinessName} ${city}`.trim();
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

        // General search (Email)
        const emailResults = await serperSearch(`"${businessName}" contact email`);
        for (const result of emailResults) {
            if (!info.email) info.email = extractEmail(result.snippet);
            if (!info.phone) info.phone = extractPhone(result.snippet);
        }

        // General search (Phone)
        const phoneResults = await serperSearch(`"${businessName}" contact phone`);
        for (const result of phoneResults) {
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

// Check if a business is currently running Google Ads
export const isRunningGoogleAds = async (businessName: string, city: string): Promise<boolean> => {
    if (!SERPER_API_KEY) {
        console.warn("Missing SERPER_API_KEY for isRunningGoogleAds");
        return false;
    }

    const query = `${businessName} ${city}`.trim();
    
    try {
        const response = await fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: {
                "X-API-KEY": SERPER_API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ q: query, num: 10 })
        });
        
        if (!response.ok) {
            console.error(`[Serper Ads] API failed for ${query}: ${response.status}`);
            return false;
        }
        
        const data = await response.json();
        const ads = data.ads || [];
        
        if (ads.length === 0) {
            return false;
        }
        
        const businessDomain = businessName.toLowerCase().replace(/\s+/g, "");
        
        for (const ad of ads) {
            const link = (ad.link || "").toLowerCase();
            if (link.includes(businessDomain)) {
                console.log(`[Serper Ads] Match found for ${businessName}: ${link}`);
                return true;
            }
        }
        
        return false;
    } catch (e) {
        console.error(`[Serper Ads] Error checking ads for ${businessName}:`, e);
        return false;
    }
};

/**
 * Find email for a business by searching Google for: domain "email"
 * e.g. "benystreeserviceatx.com email"
 * Extracts emails from snippets returned by Serper.
 */
export const serperEmailByDomain = async (websiteUrl: string): Promise<string | null> => {
    if (!SERPER_API_KEY) return null;

    try {
        // Strip to bare domain: https://www.benystreeserviceatx.com/ → benystreeserviceatx.com
        let domain = websiteUrl.trim();
        try {
            const u = new URL(domain.startsWith('http') ? domain : `https://${domain}`);
            domain = u.hostname.replace(/^www\./, '');
        } catch (_) {}

        const query = `${domain} "email"`;
        console.log(`[Serper Email] Searching: "${query}"`);

        const response = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: { 'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: query, num: 5 })
        });

        if (!response.ok) return null;
        const data: any = await response.json();

        // Collect all text from organic results (title + snippet + sitelinks)
        const texts: string[] = [];
        for (const result of data.organic || []) {
            if (result.title) texts.push(result.title);
            if (result.snippet) texts.push(result.snippet);
            for (const sl of result.sitelinks || []) {
                if (sl.snippet) texts.push(sl.snippet);
            }
        }
        // Also check answerBox and knowledgeGraph if present
        if (data.answerBox?.answer) texts.push(data.answerBox.answer);
        if (data.knowledgeGraph?.description) texts.push(data.knowledgeGraph.description);

        const combined = texts.join(' ');
        const emailRegex = /([a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
        const matches = combined.match(emailRegex) || [];

        const cleaned = [...new Set(matches)]
            .map(e => e.toLowerCase().trim())
            .filter(e =>
                !e.includes('sentry') &&
                !e.includes('example.com') &&
                !e.includes('wixpress') &&
                !e.includes('yourname') &&
                !e.endsWith('.png') &&
                !e.endsWith('.jpg') &&
                !e.endsWith('.css') &&
                !e.endsWith('.js') &&
                e.split('@')[1]?.length > 3
            );

        if (cleaned.length > 0) {
            console.log(`[Serper Email] Found email for ${domain}: ${cleaned[0]}`);
            return cleaned[0];
        }

        console.log(`[Serper Email] No email found in snippets for ${domain}`);
        return null;
    } catch (e) {
        console.error(`[Serper Email] Error for ${websiteUrl}:`, e);
        return null;
    }
};

