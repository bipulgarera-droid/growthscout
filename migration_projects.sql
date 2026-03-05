-- Create the 'projects' table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL UNIQUE,
    description TEXT
);

-- Update 'leads' table to include project_id
-- We use DO block to check if column exists before adding to avoid errors in simple SQL execution
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'project_id') THEN
        ALTER TABLE leads ADD COLUMN project_id UUID REFERENCES projects(id);
    END IF;
END $$;

-- Create existing leads table if not exists (from previous steps)
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    business_name TEXT NOT NULL,
    original_url TEXT,
    address TEXT,
    rating NUMERIC,
    review_count INTEGER,
    contact_info JSONB DEFAULT '{}'::jsonb,
    audit_data JSONB DEFAULT '{}'::jsonb,
    slug TEXT UNIQUE,
    preview_url TEXT,
    outreach_message TEXT,
    status TEXT DEFAULT 'new',
    project_id UUID REFERENCES projects(id)
);

-- Enable RLS for projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow list access projects" ON projects FOR ALL USING (true);
