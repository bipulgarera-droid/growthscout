-- Migration: Add whatsapp_verified column to leads table
-- Run this in Supabase SQL Editor

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'whatsapp_verified') THEN
        ALTER TABLE leads ADD COLUMN whatsapp_verified BOOLEAN DEFAULT NULL;
    END IF;
END $$;

SELECT 'Migration complete!' as result;
