-- Rename weekly_incidents → firm_daily_incidents (data updated daily by incident job).
-- Replace weekly_reports with firm_weekly_reports using week_from_date / week_to_date (no week_number/year).
-- All week logic and cron use UTC; digest runs Sunday 8:00 UTC, report generation Sunday 7:00 UTC.

-- =============================================================================
-- 1. RENAME weekly_incidents → firm_daily_incidents
-- =============================================================================
ALTER TABLE IF EXISTS weekly_incidents RENAME TO firm_daily_incidents;

-- Index names stay attached to the table; optionally rename for clarity
ALTER INDEX IF EXISTS idx_incidents_firm_week RENAME TO idx_firm_daily_incidents_firm_week;
ALTER INDEX IF EXISTS idx_incidents_severity RENAME TO idx_firm_daily_incidents_severity;

-- =============================================================================
-- 2. CREATE firm_weekly_reports (week_from_date, week_to_date), MIGRATE, DROP weekly_reports
-- =============================================================================
CREATE TABLE IF NOT EXISTS firm_weekly_reports (
  id SERIAL PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  week_from_date DATE NOT NULL,
  week_to_date DATE NOT NULL,
  report_json JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT firm_weekly_reports_firm_week_from_key UNIQUE (firm_id, week_from_date)
);

COMMENT ON TABLE firm_weekly_reports IS 'One row per firm per week (UTC Mon–Sun). week_from_date = Monday, week_to_date = Sunday. Populated by Weekly 1 (Sunday 7:00 UTC); read by Weekly 2 digest (Sunday 8:00 UTC).';

ALTER TABLE firm_weekly_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view reports" ON firm_weekly_reports;
CREATE POLICY "Anyone can view reports"
  ON firm_weekly_reports
  FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_firm_weekly_reports_firm_dates
  ON firm_weekly_reports(firm_id, week_from_date DESC);

CREATE INDEX IF NOT EXISTS idx_firm_weekly_reports_generated
  ON firm_weekly_reports(generated_at DESC);

-- Migrate existing weekly_reports (compute week_from_date, week_to_date from year, week_number; ISO week 1 = week containing Jan 4)
INSERT INTO firm_weekly_reports (firm_id, week_from_date, week_to_date, report_json, generated_at)
SELECT
  wr.firm_id,
  (
    (make_date(wr.year, 1, 4) - (EXTRACT(ISODOW FROM make_date(wr.year, 1, 4))::integer - 1))
    + (wr.week_number - 1) * 7
  )::date AS week_from_date,
  (
    (make_date(wr.year, 1, 4) - (EXTRACT(ISODOW FROM make_date(wr.year, 1, 4))::integer - 1))
    + (wr.week_number - 1) * 7 + 6
  )::date AS week_to_date,
  wr.report_json,
  COALESCE(wr.generated_at, NOW())
FROM weekly_reports wr
ON CONFLICT (firm_id, week_from_date) DO NOTHING;

DROP TABLE IF EXISTS weekly_reports CASCADE;
