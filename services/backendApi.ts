
import { Business } from "../types";

const API_BASE = '/api';

export interface ScreenshotResult {
    filepath: string;
    base64Image: string;
}

export const captureScreenshot = async (url: string, view: 'desktop' | 'mobile' = 'desktop', belowFold: boolean = false): Promise<ScreenshotResult> => {
    const response = await fetch(`${API_BASE}/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, view, belowFold })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Screenshot failed');
    }
    return response.json();
};

export const createProposalSlides = async (business: Business, screenshots: { aboveFold: string; belowFold: string }, redesigns: string[]) => {
    const response = await fetch(`${API_BASE}/slides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            businessName: business.name,
            screenshots,
            redesigns
        })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Slide generation failed');
    }
    return response.json(); // { presentationId, url }
};

export interface EnrichmentResult {
    founderName?: string;
    linkedin?: string;
    email?: string;
    phone?: string;
    instagram?: string;
    facebook?: string;
    twitter?: string;
    sources?: string[];
    address?: string;
}

export const enrichBusiness = async (businessName: string, location?: string, website?: string, quick = false): Promise<EnrichmentResult> => {
    const response = await fetch(`${API_BASE}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName, location, website, quick })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Enrichment failed');
    }
    return response.json();
};

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

export const discoverBusinesses = async (query: string, location?: string, maxResults = 20): Promise<DiscoveredBusiness[]> => {
    const response = await fetch(`${API_BASE}/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, location, maxResults })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Discovery failed');
    }
    const data = await response.json();
    return data.businesses;
};

// ============ BULK PIPELINE ENDPOINTS ============

export interface PageSpeedMetrics {
    mobile: {
        performance: number;
        accessibility: number;
        bestPractices: number;
        seo: number;
    };
    desktop: {
        performance: number;
        accessibility: number;
        bestPractices: number;
        seo: number;
    };
}

export interface AnalysisResult {
    screenshotBase64: string; // Primary/Hero screenshot
    screenshots?: string[]; // Array of 3 key screenshots (Hero, Middle, Bottom)
    pageSpeed: PageSpeedMetrics;
    designScore: number;
    overallScore: number;
    isQualified: boolean;
    analysisBullets: string[];
}

// Bulk enrich leads (founder, email, LinkedIn, Instagram)
export const bulkEnrich = async (leads: { id: string; name: string; address: string; website?: string }[]): Promise<Record<string, EnrichmentResult>> => {
    const response = await fetch(`${API_BASE}/pipeline/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Bulk enrichment failed');
    }
    const data = await response.json();
    return data.results;
};

// Bulk check google ads status (Serper)
export const bulkCheckAds = async (leads: { id: string; name: string; city: string }[]): Promise<Record<string, boolean>> => {
    const response = await fetch(`${API_BASE}/pipeline/check-ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Bulk ads check failed');
    }
    const data = await response.json();
    return data.results;
};

// Bulk fallback email search (Gemini URL Context)
export const bulkFallbackEmail = async (leads: { id: string; website: string }[]): Promise<Record<string, string | null>> => {
    const response = await fetch(`${API_BASE}/pipeline/fallback-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Bulk email fallback failed');
    }
    const data = await response.json();
    return data.results;
};

// Bulk analyze websites (screenshot + PageSpeed + Gemini scoring)
export const bulkAnalyze = async (leads: { id: string; url: string; name: string }[]): Promise<Record<string, AnalysisResult>> => {
    const response = await fetch(`${API_BASE}/pipeline/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Bulk analysis failed');
    }
    const data = await response.json();
    return data.results;
};

export const saveRankings = async (keyword: string, city: string, results: RankedBusiness[]): Promise<{ success: boolean; count: number }> => {
    const response = await fetch(`${API_BASE}/rankings/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, city, results })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save rankings');
    }

    return response.json();
};

export const getRankingHistory = async (keyword: string, city: string): Promise<RankSearchResult> => {
    const params = new URLSearchParams({ keyword, city });
    const response = await fetch(`${API_BASE}/rankings/history?${params.toString()}`);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to load ranking history');
    }

    const data = await response.json();
    return {
        keyword,
        city,
        totalResults: data.results.length,
        results: data.results,
        searchedAt: new Date().toISOString()
    };
};

// Bulk verify WhatsApp numbers
export const bulkVerifyWhatsApp = async (leads: { id: string; phone: string; location?: string }[]): Promise<Record<string, boolean>> => {
    const response = await fetch(`${API_BASE}/pipeline/verify-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'WhatsApp Verification failed');
    }
    const data = await response.json();
    return data.results;
};

export interface OutreachMessages {
    email: string;
    linkedin: string;
    instagram: string;
    whatsapp: string;
}

export interface LeadOutreachInput {
    businessName: string;
    contactName?: string;
    websiteUrl: string;
    previewUrl: string;
    speedScore?: number;
    flaws?: string[];
}

// Bulk generate outreach messages (Email, LinkedIn, Instagram)
export const bulkGenerateMessages = async (leads: LeadOutreachInput[]): Promise<Record<string, OutreachMessages>> => {
    const response = await fetch(`${API_BASE}/pipeline/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Bulk message generation failed');
    }
    const data = await response.json();
    return data.results;
};

// Bulk send outreach (status update only for now)
export const bulkSendOutreach = async (leadIds: string[], method: 'email' | 'linkedin' | 'instagram'): Promise<{ success: true; count: number; status: string }> => {
    const response = await fetch(`${API_BASE}/pipeline/outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds, method })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Bulk outreach failed');
    }
    return response.json();
};

// Add Manual Lead
export const addManualLead = async (url: string, name?: string, city?: string): Promise<any> => {
    const response = await fetch(`${API_BASE}/pipeline/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, name, city })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Manual lead add failed');
    }
    return response.json();
};

// Generate website preview
export const generateWebsite = async (business: any): Promise<{ success: true; previewUrl: string }> => {
    const response = await fetch(`${API_BASE}/pipeline/site-gen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(business)
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Site generation failed');
    }
    return response.json();
};

export const bulkGenerateWebsites = async (leads: any[]): Promise<Record<string, { success: boolean; previewUrl: string; error?: string }>> => {
    const response = await fetch(`${API_BASE}/pipeline/site-gen-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Bulk site generation failed');
    }
    const data = await response.json();
    return data.results;
};

// Upload custom logo
export const uploadLogo = async (leadId: string, payload: { logoUrl?: string; logoData?: string }): Promise<any> => {
    const response = await fetch(`${API_BASE}/leads/${leadId}/upload-logo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Logo upload failed');
    }
    return response.json();
};

// Analyze single website
export const analyzeWebsite = async (url: string, businessName: string): Promise<AnalysisResult> => {
    const response = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, businessName })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Analysis failed');
    }
    return response.json();
};

// ============ SUPABASE PERSISTENCE ============

// Load all businesses from Supabase (filtered by project optional)
export const loadBusinessesFromDB = async (projectId?: string): Promise<Business[]> => {
    let url = `${API_BASE}/leads`;
    if (projectId) {
        url += `?projectId=${encodeURIComponent(projectId)}`;
    }
    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to load businesses');
    }
    const data = await response.json();
    return data.leads || [];
};

// Bulk sync businesses to Supabase
export const syncBusinessesToDB = async (businesses: Business[]): Promise<{ saved: number; failed: number }> => {
    const response = await fetch(`${API_BASE}/leads/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businesses })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Sync failed');
    }
    return response.json();
};

// Save single business to Supabase
export const saveBusinessToDB = async (business: Business): Promise<boolean> => {
    const response = await fetch(`${API_BASE}/leads/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Save failed');
    }
    const data = await response.json();
    return data.success;
};

// Update business field in Supabase
export const updateBusinessInDB = async (id: string, updates: Partial<Business>): Promise<boolean> => {
    const response = await fetch(`${API_BASE}/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Update failed');
    }
    const data = await response.json();
    return data.success;
};

// ============ PROJECTS ============

import { Project } from '../types';

export const getProjects = async (): Promise<Project[]> => {
    const response = await fetch(`${API_BASE}/projects`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to load projects');
    }
    const data = await response.json();
    return data.projects || [];
};

export const createProject = async (name: string, description?: string): Promise<Project> => {
    const response = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Project creation failed');
    }
    const data = await response.json();
    return data.project;
};

// ============ RANK TRACKER ============

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
}

export interface RankSearchResult {
    keyword: string;
    city: string;
    totalResults: number;
    results: RankedBusiness[];
    searchedAt: string;
    cost?: number;
}

export const searchRankings = async (keyword: string, city: string, maxResults: number = 100): Promise<RankSearchResult> => {
    const response = await fetch(`${API_BASE}/rankings/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, city, maxResults })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Rank search failed');
    }
    return response.json();
};
