-- ============================================================================
-- Trustpilot scraper status columns on firms (for admin dashboard monitoring)
-- ============================================================================
-- Backfill script updates these after each firm. Admin dashboard shows last run
-- per firm: scraped, stored, duplicates, error (if any).

ALTER TABLE firms
  ADD COLUMN IF NOT EXISTS last_scraper_run_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_scraper_reviews_scraped INT,
  ADD COLUMN IF NOT EXISTS last_scraper_reviews_stored INT,
  ADD COLUMN IF NOT EXISTS last_scraper_duplicates_skipped INT,
  ADD COLUMN IF NOT EXISTS last_scraper_error TEXT;

COMMENT ON COLUMN firms.last_scraper_run_at IS 'When Trustpilot scraper last ran for this firm (GitHub Actions daily)';
COMMENT ON COLUMN firms.last_scraper_error IS 'Last run error message if scrape failed; null if success';
