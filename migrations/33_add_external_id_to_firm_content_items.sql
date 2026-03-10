-- Migration: Add external_id to firm_content_items for dedup
-- Description: Stores the external source ID (e.g. Gmail message ID) to prevent duplicate ingestion
-- Sprint: S8 (Phase 2 — Gmail ingest pipeline)
-- Date: 2026-03-10

ALTER TABLE firm_content_items ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Unique index so duplicate ingestion attempts are caught at DB level
CREATE UNIQUE INDEX IF NOT EXISTS idx_firm_content_external_id
  ON firm_content_items(external_id)
  WHERE external_id IS NOT NULL;

COMMENT ON COLUMN firm_content_items.external_id IS 'External source ID for dedup (e.g. Gmail message ID). Unique when present.';
