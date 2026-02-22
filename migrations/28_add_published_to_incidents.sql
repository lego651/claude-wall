-- Migration: Add published field to firm_daily_incidents
-- Description: Allow admin to approve/un-approve incidents before digest send
-- Sprint: S8 (Weekly Review improvements)
-- Date: 2026-02-21

-- Add published columns to firm_daily_incidents (default TRUE = auto-approved)
ALTER TABLE firm_daily_incidents
ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill existing incidents as published
UPDATE firm_daily_incidents
SET published = TRUE, published_at = created_at
WHERE published IS NULL;

-- Add index for querying published incidents
CREATE INDEX IF NOT EXISTS idx_firm_daily_incidents_published
ON firm_daily_incidents(published, week_number, year)
WHERE published = true;

-- Add trigger for updated_at (if it exists)
ALTER TABLE firm_daily_incidents
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS update_firm_daily_incidents_updated_at ON firm_daily_incidents;
CREATE TRIGGER update_firm_daily_incidents_updated_at
  BEFORE UPDATE ON firm_daily_incidents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON COLUMN firm_daily_incidents.published IS 'Auto-approved by default (TRUE). Admin can un-approve on review page.';
COMMENT ON COLUMN firm_daily_incidents.published_at IS 'Timestamp when incident was published/approved';
