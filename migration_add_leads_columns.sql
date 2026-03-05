-- Migration: Add missing columns to leads table for full Business type support
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/gouevxvwapnpykvhasgl/sql

-- Add missing columns (IF NOT EXISTS pattern using DO block)
DO $$
BEGIN
    -- Basic Info
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'category') THEN
        ALTER TABLE leads ADD COLUMN category TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'phone') THEN
        ALTER TABLE leads ADD COLUMN phone TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'email') THEN
        ALTER TABLE leads ADD COLUMN email TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'website') THEN
        ALTER TABLE leads ADD COLUMN website TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'logo_url') THEN
        ALTER TABLE leads ADD COLUMN logo_url TEXT;
    END IF;
    
    -- Scores
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'quality_score') THEN
        ALTER TABLE leads ADD COLUMN quality_score INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'digital_score') THEN
        ALTER TABLE leads ADD COLUMN digital_score INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'seo_score') THEN
        ALTER TABLE leads ADD COLUMN seo_score INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'social_score') THEN
        ALTER TABLE leads ADD COLUMN social_score INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'estimated_value') THEN
        ALTER TABLE leads ADD COLUMN estimated_value INTEGER;
    END IF;
    
    -- Enrichment Data
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'founder_name') THEN
        ALTER TABLE leads ADD COLUMN founder_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'instagram') THEN
        ALTER TABLE leads ADD COLUMN instagram TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'linkedin') THEN
        ALTER TABLE leads ADD COLUMN linkedin TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'contact_email') THEN
        ALTER TABLE leads ADD COLUMN contact_email TEXT;
    END IF;
    
    -- Design/Sales Data
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'is_qualified') THEN
        ALTER TABLE leads ADD COLUMN is_qualified BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'redesign_image_url') THEN
        ALTER TABLE leads ADD COLUMN redesign_image_url TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'redesign_below_fold_url') THEN
        ALTER TABLE leads ADD COLUMN redesign_below_fold_url TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'original_screenshot') THEN
        ALTER TABLE leads ADD COLUMN original_screenshot TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'below_fold_screenshot') THEN
        ALTER TABLE leads ADD COLUMN below_fold_screenshot TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'screenshots') THEN
        ALTER TABLE leads ADD COLUMN screenshots JSONB;
    END IF;
    
    -- PageSpeed
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'pagespeed_mobile') THEN
        ALTER TABLE leads ADD COLUMN pagespeed_mobile INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'pagespeed_desktop') THEN
        ALTER TABLE leads ADD COLUMN pagespeed_desktop INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'analysis_bullets') THEN
        ALTER TABLE leads ADD COLUMN analysis_bullets JSONB;
    END IF;
    
    -- Outreach
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'whatsapp_verified') THEN
        ALTER TABLE leads ADD COLUMN whatsapp_verified BOOLEAN DEFAULT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'is_contacted') THEN
        ALTER TABLE leads ADD COLUMN is_contacted BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'outreach_messages') THEN
        ALTER TABLE leads ADD COLUMN outreach_messages JSONB;
    END IF;
    
    -- Search metadata
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'search_query') THEN
        ALTER TABLE leads ADD COLUMN search_query TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'search_location') THEN
        ALTER TABLE leads ADD COLUMN search_location TEXT;
    END IF;
    
    -- Updated at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'updated_at') THEN
        ALTER TABLE leads ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_category ON leads(category);
CREATE INDEX IF NOT EXISTS idx_leads_business_name ON leads(business_name);

-- Disable RLS for service key access (or enable with proper policies)
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;

SELECT 'Migration complete!' as result;
