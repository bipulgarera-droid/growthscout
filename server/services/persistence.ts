
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') }); // Go up two levels: services -> server -> root

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ===== TYPE DEFINITIONS =====

interface PreviewData {
    slug: string;
    business_name: string;
    contact_info: any;
    logo_url?: string;
    website_url?: string;
}

// Frontend Business type (camelCase)
interface Business {
    id: string;
    name: string;
    address: string;
    category: string;
    rating: number;
    reviewCount: number;
    phone: string;
    email?: string;
    website?: string;
    status: string;
    qualityScore: number;
    digitalScore?: number;
    seoScore?: number;
    socialScore?: number;
    estimatedValue?: number;
    projectId?: string;
    founderName?: string;
    logoUrl?: string;
    instagram?: string;
    linkedin?: string;
    contactEmail?: string;
    isQualified?: boolean;
    redesignImageUrl?: string;
    redesignBelowFoldUrl?: string;
    originalScreenshot?: string;
    belowFoldScreenshot?: string;
    screenshots?: string[];
    previewSiteUrl?: string;
    auditResult?: any;
    pageSpeedMobile?: number;
    pageSpeedDesktop?: number;
    analysisBullets?: string[];
    outreachMessages?: {
        email: string;
        linkedin: string;
        instagram: string;
    };
    searchQuery?: string;
    searchLocation?: string;
    whatsappVerified?: boolean;
    isContacted?: boolean;
    source?: string;
    rank?: number;
}

// Supabase row type (snake_case)
interface LeadRow {
    id: string;
    business_name: string;
    address?: string | null;
    category?: string | null;
    rating?: number | null;
    review_count?: number | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    original_url?: string | null;
    status?: string;
    quality_score?: number | null;
    digital_score?: number | null;
    seo_score?: number | null;
    social_score?: number | null;
    estimated_value?: number | null;
    project_id?: string | null;
    founder_name?: string | null;
    logo_url?: string | null;
    instagram?: string | null;
    linkedin?: string | null;
    contact_email?: string | null;
    is_qualified?: boolean | null;
    redesign_image_url?: string | null;
    redesign_below_fold_url?: string | null;
    original_screenshot?: string | null;
    below_fold_screenshot?: string | null;
    screenshots?: string[] | null;
    preview_url?: string | null;
    audit_data?: any;
    pagespeed_mobile?: number | null;
    pagespeed_desktop?: number | null;
    analysis_bullets?: string[] | null;
    outreach_messages?: any;
    outreach_message?: string | null; // Legacy field
    contact_info?: any; // Legacy field
    search_location?: string | null;
    search_query?: string | null;
    source?: string | null;
    rank?: number | null;
    created_at?: string;
    updated_at?: string;
    slug?: string | null;
    whatsapp_verified?: boolean | null;
    is_contacted?: boolean | null;
}

// ===== FIELD MAPPING =====

// Convert frontend Business to Supabase row (omit id - let Supabase generate UUID)
const businessToRow = (b: Business): Partial<LeadRow> => ({
    // Note: omitting 'id' so Supabase generates a UUID
    // Using business_name for upsert conflict resolution
    business_name: b.name,
    address: b.address,
    category: b.category,
    rating: b.rating || 0,
    review_count: b.reviewCount || 0,
    phone: b.phone || null,
    email: b.email || null,
    website: b.website || null,
    original_url: b.website || null,
    status: b.status,
    quality_score: b.qualityScore || 0,
    digital_score: b.digitalScore || 0,
    seo_score: b.seoScore || 0,
    social_score: b.socialScore || 0,
    estimated_value: b.estimatedValue || 0,
    project_id: b.projectId || null,
    founder_name: b.founderName || null,
    logo_url: b.logoUrl || null,
    instagram: b.instagram || null,
    linkedin: b.linkedin || null,
    contact_email: b.contactEmail || null,
    is_qualified: b.isQualified ?? false,
    redesign_image_url: b.redesignImageUrl || null,
    redesign_below_fold_url: b.redesignBelowFoldUrl || null,
    original_screenshot: b.originalScreenshot || null,
    below_fold_screenshot: b.belowFoldScreenshot || null,
    screenshots: b.screenshots || null,
    preview_url: b.previewSiteUrl || null,
    audit_data: b.auditResult || null,
    pagespeed_mobile: b.pageSpeedMobile || null,
    pagespeed_desktop: b.pageSpeedDesktop || null,
    analysis_bullets: b.analysisBullets || null,
    outreach_messages: b.outreachMessages || null,
    search_query: b.searchQuery || null,
    search_location: b.searchLocation || null,
    source: b.source || null,
    rank: b.rank || null,
    whatsapp_verified: b.whatsappVerified ?? null,
    is_contacted: b.isContacted ?? false,
    updated_at: new Date().toISOString(),
});

const rowToBusiness = (r: LeadRow): Business => ({
    id: r.id,
    name: r.business_name,
    address: r.address || '',
    category: r.category || 'Unknown',
    rating: r.rating || 0,
    reviewCount: r.review_count || 0,
    phone: r.phone || '', // valid to be empty string if missing? Interface says string.
    email: r.email || undefined,
    website: r.website || undefined,
    status: (r.status as any) || 'new',
    qualityScore: r.quality_score || 0,
    digitalScore: r.digital_score || 0,
    seoScore: r.seo_score || 0,
    socialScore: r.social_score || 0,
    estimatedValue: r.estimated_value || 0,
    projectId: r.project_id || undefined,
    founderName: r.founder_name || undefined,
    logoUrl: r.logo_url || undefined,
    instagram: r.instagram || undefined,
    linkedin: r.linkedin || undefined,
    contactEmail: r.contact_email || undefined,
    isQualified: r.is_qualified ?? undefined,
    redesignImageUrl: r.redesign_image_url || undefined,
    redesignBelowFoldUrl: r.redesign_below_fold_url || undefined,
    originalScreenshot: r.original_screenshot || undefined,
    belowFoldScreenshot: r.below_fold_screenshot || undefined,
    screenshots: r.screenshots || undefined,
    previewSiteUrl: r.preview_url || undefined,
    auditResult: r.audit_data || undefined,
    pageSpeedMobile: r.pagespeed_mobile || undefined,
    pageSpeedDesktop: r.pagespeed_desktop || undefined,
    analysisBullets: r.analysis_bullets || undefined,
    outreachMessages: r.outreach_messages ? {
        email: r.outreach_messages?.email || '',
        linkedin: r.outreach_messages?.linkedin || '',
        instagram: r.outreach_messages?.instagram || '',
    } : undefined,
    // Legacy mapping if new fields missing
    searchQuery: r.search_query || undefined,
    searchLocation: r.search_location || undefined,
    source: (r.source as any) || undefined,
    rank: r.rank || undefined,
    whatsappVerified: r.whatsapp_verified ?? undefined,
    isContacted: r.is_contacted ?? false,
});

// ===== BUSINESS/LEAD OPERATIONS =====

/**
 * Save a single business to Supabase (upsert by id)
 */
export const saveBusiness = async (business: Business): Promise<boolean> => {
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Missing Supabase Credentials");

    const row = businessToRow(business);

    // Use business_name as conflict key since we don't pass frontend IDs
    const response = await fetch(`${SUPABASE_URL}/rest/v1/leads?on_conflict=business_name`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(row)
    });

    if (!response.ok) {
        console.error('[Persistence] Failed to save business:', await response.text());
        return false;
    }

    return true;
};

/**
 * Bulk save businesses to Supabase (upsert)
 */
export const bulkSaveBusinesses = async (businesses: Business[]): Promise<{ saved: number; failed: number }> => {
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Missing Supabase Credentials");

    // Deduplicate by business_name to prevent "ON CONFLICT DO UPDATE command cannot affect row a second time" error
    const uniqueBusinesses = new Map<string, Business>();
    for (const b of businesses) {
        uniqueBusinesses.set(b.name, b); // Later entries overwrite earlier ones with same name
    }
    const dedupedBusinesses = Array.from(uniqueBusinesses.values());

    const rows = dedupedBusinesses.map(businessToRow);

    console.log(`[Persistence] Bulk saving ${rows.length} businesses to Supabase (deduped from ${businesses.length})...`);

    const response = await fetch(`${SUPABASE_URL}/rest/v1/leads?on_conflict=business_name`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(rows)
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('[Persistence] Bulk save failed:', error);
        return { saved: 0, failed: dedupedBusinesses.length };
    }

    console.log(`[Persistence] ✅ Bulk saved ${dedupedBusinesses.length} businesses`);
    return { saved: dedupedBusinesses.length, failed: 0 };
};

/**
 * Load all businesses from Supabase
 */
export const loadAllBusinesses = async (projectId?: string): Promise<Business[]> => {
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Missing Supabase Credentials");

    console.log(`[Persistence] Loading businesses from Supabase (Project ID: ${projectId || 'ALL'})...`);

    let url = `${SUPABASE_URL}/rest/v1/leads?select=*&order=created_at.desc`;
    if (projectId) {
        url += `&project_id=eq.${projectId}`;
    }

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(await response.text());
    }

    const rows: LeadRow[] = await response.json();
    const businesses = rows.map(rowToBusiness);

    console.log(`[Persistence] ✅ Loaded ${businesses.length} businesses from Supabase`);
    return businesses;
};

/**
 * Update a single business field
 */
export const updateBusinessField = async (id: string, updates: Partial<Business>): Promise<boolean> => {
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Missing Supabase Credentials");

    // Convert to snake_case
    const rowUpdates: Partial<LeadRow> = {};
    if (updates.name !== undefined) rowUpdates.business_name = updates.name;
    if (updates.status !== undefined) rowUpdates.status = updates.status;
    if (updates.digitalScore !== undefined) rowUpdates.digital_score = updates.digitalScore;
    if (updates.previewSiteUrl !== undefined) rowUpdates.preview_url = updates.previewSiteUrl;
    if (updates.outreachMessages !== undefined) rowUpdates.outreach_messages = updates.outreachMessages;
    if (updates.originalScreenshot !== undefined) rowUpdates.original_screenshot = updates.originalScreenshot;
    if (updates.auditResult !== undefined) rowUpdates.audit_data = updates.auditResult;
    if (updates.pageSpeedMobile !== undefined) rowUpdates.pagespeed_mobile = updates.pageSpeedMobile;
    if (updates.pageSpeedDesktop !== undefined) rowUpdates.pagespeed_desktop = updates.pageSpeedDesktop;
    if (updates.analysisBullets !== undefined) rowUpdates.analysis_bullets = updates.analysisBullets;
    if (updates.instagram !== undefined) rowUpdates.instagram = updates.instagram;
    if (updates.linkedin !== undefined) rowUpdates.linkedin = updates.linkedin;
    if (updates.contactEmail !== undefined) rowUpdates.contact_email = updates.contactEmail;
    if (updates.founderName !== undefined) rowUpdates.founder_name = updates.founderName;
    if (updates.whatsappVerified !== undefined) rowUpdates.whatsapp_verified = updates.whatsappVerified;
    if (updates.isContacted !== undefined) rowUpdates.is_contacted = updates.isContacted;

    rowUpdates.updated_at = new Date().toISOString();

    const response = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(rowUpdates)
    });

    if (!response.ok) {
        console.error('[Persistence] Update failed:', await response.text());
        return false;
    }

    return true;
};

/**
 * Delete a business from Supabase
 */
export const deleteBusiness = async (id: string): Promise<boolean> => {
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Missing Supabase Credentials");

    const response = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
        }
    });

    return response.ok;
};

// ===== LEGACY FUNCTIONS (kept for backward compatibility) =====

export const savePreview = async (data: PreviewData) => {
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Missing Supabase Credentials");

    const response = await fetch(`${SUPABASE_URL}/rest/v1/personalized_previews?on_conflict=slug`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        console.error("Failed to save preview:", await response.text());
    }

    return true;
};

export const saveLead = async (data: any) => {
    // Legacy wrapper - convert to new format
    const business: Business = {
        id: data.id || `lead-${Date.now()}`,
        name: data.business_name,
        address: data.address || '',
        category: data.category || 'Unknown',
        rating: data.rating || 0,
        reviewCount: data.review_count || 0,
        phone: data.contact_info?.phone || '',
        website: data.original_url,
        status: data.status || 'new',
        qualityScore: 70,
    };

    await saveBusiness(business);
    return business;
};

export const getLeads = async (projectId?: string) => {
    return loadAllBusinesses(projectId);
};

export const createProject = async (name: string) => {
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Missing Supabase Credentials");

    const response = await fetch(`${SUPABASE_URL}/rest/v1/projects`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({ name })
    });

    if (!response.ok) {
        return null;
    }
    const result = await response.json();
    return result?.[0];
};

export const getProjects = async () => {
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Missing Supabase Credentials");

    const response = await fetch(`${SUPABASE_URL}/rest/v1/projects?select=*&order=created_at.desc`, {
        method: 'GET',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) throw new Error(await response.text());
    return await response.json();
};

export const generateSlug = (url: string) => {
    try {
        const domain = new URL(url).hostname.replace('www.', '');
        const base = domain.split('.')[0];
        return base.replace(/[^a-z0-9]/g, '').toLowerCase();
    } catch {
        return `biz${Date.now()}`;
    }
};
