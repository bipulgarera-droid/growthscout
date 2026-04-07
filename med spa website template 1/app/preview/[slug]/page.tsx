import { notFound } from 'next/navigation';
import DynamicPreview from '@/components/DynamicPreview';

// Supabase config
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fjbowxwqaegvpjyinnsa.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

interface PreviewData {
    id: string;
    slug: string;
    business_name: string;
    tagline: string;
    website_url: string;
    colors: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        text: string;
    };
    services: string[];
    value_props: string[];
    cta_text: string;
    contact_info: {
        phone?: string;
        email?: string;
        address?: string;
    };
    logo_url?: string;
    industry?: string;
    hero_phrases?: string[];
    vibe?: string;
}

// Fallback data for demo
const RONDEBOSCH_DATA: PreviewData = {
    id: "rondebosch",
    slug: "rondebosch",
    business_name: "Rondebosch Laser Hair Removal",
    tagline: "Glow with Confidence",
    website_url: "https://laserhairremovalrondebosch.co.za/",
    colors: { primary: "#FFD5C2", secondary: "#000000", accent: "#F5B5A0", background: "#FFFFFF", text: "#333333" },
    services: ["Laser Hair Removal", "Cosmelan", "Threading & Waxing", "Peels", "Dermaplaning", "Microneedling", "LED Light Therapy", "Tinting & Henna Eyebrow"],
    value_props: ["State-of-the-Art Technology", "Experienced Professionals", "Safety & Results Guaranteed"],
    cta_text: "BOOK FREE CONSULTATION",
    contact_info: { phone: "072 337 2544", email: "darika25@gmail.com", address: "33 Sangrove Drive, Rondebosch, Cape Town 7700" },
    industry: "Laser & Skincare",
    logo_url: "https://laserhairremovalrondebosch.co.za/_WebmoduleData/Images/used/_CompanyLogo.png"
};

// Auto-extracted data for Lumenis
const LUMENIS_DATA: PreviewData = {
    id: "lumenis",
    slug: "lumenis",
    business_name: "Lumenis",
    tagline: "Leading medical equipment & innovative laser technologies.",
    website_url: "https://lumenis.com/",
    colors: { primary: "#000000", secondary: "#FFFFFF", accent: "#808080", background: "#FFFFFF", text: "#333333" },
    services: ["Facial Muscle Stimulation", "Hair Removal", "Hair Loss Treatment", "Tattoo Removal", "Vascular Lesion Treatment", "Dry Eye Treatment", "Glaucoma Treatment", "Retina Treatment"],
    value_props: ["Over 50 years of industry leadership and innovation", "Minimally invasive solutions for Aesthetic and Vision markets", "Solutions for previously untreatable conditions"],
    hero_phrases: ["BEAUTYTECH PIONEERS", "HEALTH HORIZONS", "BEAUTY THAT MATTERS"],
    cta_text: "BOOK CONSULTATION",
    contact_info: {},
    industry: "Medical Equipment",
    logo_url: "https://uytcxbsbdoyn-u1880.pressidiumcdn.com/wp-content/uploads/2023/01/Lumenis_RGB_Logo_Black.svg"
};

// Auto-extracted data for Renova Laser
const RENOVALASER_DATA: PreviewData = {
    id: "renovalaser",
    slug: "renovalaser",
    business_name: "Renova Laser Hair Removal & MedSpa",
    tagline: "Premier laser hair removal and MedSpa.",
    website_url: "https://renovalaser.com/",
    colors: { primary: "#000000", secondary: "#FFFFFF", accent: "#808080", background: "#FFFFFF", text: "#333333" },
    services: ["Laser Hair Removal", "Body Contouring", "Microneedling", "Botox & Fillers", "Chemical Peels", "IPL Photofacials", "Microdermabrasion", "SilkPeel Dermalinfusion"],
    value_props: ["Patient-centered approach", "Effective treatment plans", "Affordable pricing"],
    hero_phrases: ["AESTHETICS PERFECTED", "RENOVA DIFFERENCE", "CARE EXCELLENCE"],
    cta_text: "BOOK CONSULTATION",
    contact_info: {},
    industry: "Laser & Aesthetics",
    logo_url: "https://renovalaser.com/wp-content/uploads/2018/12/logo-renova-laser.png"
};

// Fallback data lookup
const FALLBACK_DATA: Record<string, PreviewData> = {
    rondebosch: RONDEBOSCH_DATA,
    lumenis: LUMENIS_DATA,
    renovalaser: RENOVALASER_DATA
};

async function getPreviewData(slug: string): Promise<PreviewData | null> {
    // 1. Try Supabase first (allows dynamic updates)
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/personalized_previews?slug=eq.${encodeURIComponent(slug)}&select=*`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
                next: { revalidate: 0 } // No cache for fresh previews
            }
        );

        if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
                return data[0] as PreviewData;
            }
        }
    } catch (error) {
        console.error('Error fetching preview from Supabase:', error);
    }

    // 2. Fallback to hardcoded examples if not in DB
    if (FALLBACK_DATA[slug]) {
        return FALLBACK_DATA[slug];
    }

    return null;
}

export default async function PreviewPage({ params }: { params: { slug: string } }) {
    const data = await getPreviewData(params.slug);

    if (!data) {
        notFound();
    }

    return <DynamicPreview data={data} />;
}

// Generate metadata for SEO
export async function generateMetadata({ params }: { params: { slug: string } }) {
    const data = await getPreviewData(params.slug);

    if (!data) {
        return { title: 'Preview Not Found' };
    }

    return {
        title: `${data.business_name} - Website Preview`,
        description: data.tagline || `Preview for ${data.business_name}`,
    };
}
