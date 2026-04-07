export interface Project {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
}

export interface Business {
  id: string;
  name: string;
  address: string;
  category: string;
  rating: number;
  reviewCount: number;
  phone: string;
  email?: string;
  website?: string;
  whatsappVerified?: boolean;
  isContacted?: boolean;
  status: 'new' | 'contacted' | 'follow-up' | 'proposal' | 'negotiating' | 'won' | 'lost';
  qualityScore: number;
  digitalScore?: number;
  seoScore?: number;
  socialScore?: number;
  estimatedValue?: number; // Potential deal size in USD
  projectId?: string; // Associated Project ID
  source?: 'rank_tracker' | 'apify_search' | 'manual';
  rank?: number;

  // Enrichment Data
  founderName?: string;
  logoUrl?: string; // LOGO from Places or Enrichment
  instagram?: string;
  linkedin?: string;
  contactEmail?: string;

  // Design Sales Data
  isQualified?: boolean; // True if website is bad
  redesignImageUrl?: string; // The AI generated "After" image (Hero)
  redesignBelowFoldUrl?: string; // The AI generated "After" image (Body)
  originalScreenshot?: string; // The captured "Before" image (above fold)
  belowFoldScreenshot?: string; // Below the fold screenshot
  screenshots?: string[]; // Array of 3 key screenshots
  previewSiteUrl?: string; // Generated preview website URL
  auditResult?: WebsiteAudit; // The full AI analysis
  
  // Template Customization Fields
  themeTemplate?: string;
  themeTagline?: string;
  themeHeroPhrases?: string[];
  themeColorPalette?: string;
  themeServices?: string[];

  // Fulfillment Configuration
  ragKnowledgeBase?: string;
  reviewUrl?: string;
  missedCallTemplate?: string;

  // New Analysis Fields
  pageSpeedMobile?: number;
  pageSpeedDesktop?: number;
  analysisBullets?: string[]; // 4 sales-focused comparison bullets

  // Pipeline
  outreachMessages?: {
    email: string;
    linkedin: string;
    instagram: string;
    whatsapp: string;
  };
  searchQuery?: string;
  searchLocation?: string;
}

export interface ActionItem {
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  costEstimate: string;
  expectedImpact: string;
  category: 'Design' | 'SEO' | 'Conversion' | 'Brand';
}

export interface WebsiteAudit {
  isBadDesign: boolean;
  qualificationReason: string; // "Qualified: Design is outdated and non-responsive"
  designFlaws: string[];
  brandAssetsDetected: string[]; // "Logo found", "Blue color palette"
  summary: string;
  actionItems: ActionItem[]; // ROI items
}