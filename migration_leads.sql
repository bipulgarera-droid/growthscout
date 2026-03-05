-- Create the 'leads' table to store the entire pipeline data
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Business Info (Scraped)
    business_name TEXT NOT NULL,
    original_url TEXT,
    address TEXT,
    rating NUMERIC,
    review_count INTEGER,
    
    -- Contact Info (Enriched)
    contact_info JSONB DEFAULT '{}'::jsonb, 
    -- Structure: { "email": "...", "linkedin": "...", "instagram": "...", "phone": "..." }

    -- Audit Data (Puppeteer/Gemini)
    audit_data JSONB DEFAULT '{}'::jsonb,
    -- Structure: { "speed_score": 45, "screenshot_url": "...", "issues": ["..."] }

    -- Personalization (Voice AI Data)
    slug TEXT UNIQUE, -- e.g. 'renovalaser'
    preview_url TEXT, -- e.g. 'https://voice-ai-template.vercel.app/preview/renovalaser'

    -- Outreach
    outreach_message TEXT,
    status TEXT DEFAULT 'new' -- 'new', 'processed', 'audit_done', 'ready', 'sent'
);

-- Enable Row Level Security (RLS)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Create policy to allow full access (for now, for simplicity)
CREATE POLICY "Allow list access" ON leads FOR ALL USING (true);
