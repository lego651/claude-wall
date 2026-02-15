-- Store last run result for cron jobs (e.g. send-weekly-reports) for admin dashboard metrics.
-- service_role writes; admins read via RLS.

CREATE TABLE IF NOT EXISTS cron_last_run (
  job_name TEXT PRIMARY KEY,
  last_run_at TIMESTAMPTZ NOT NULL,
  result_json JSONB NOT NULL DEFAULT '{}'
);

ALTER TABLE cron_last_run ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read cron_last_run" ON cron_last_run;
CREATE POLICY "Admins can read cron_last_run"
  ON cron_last_run FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- service_role bypasses RLS and can INSERT/UPDATE.

COMMENT ON TABLE cron_last_run IS 'Last run time and result for cron jobs; used by admin dashboard (e.g. weekly email send).';
