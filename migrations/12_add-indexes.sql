-- PROP-014: Add database indexes for API and sync performance
-- Run after tables exist (firms, recent_payouts, trustpilot_reviews, weekly_incidents).
-- Safe to run multiple times (IF NOT EXISTS).

-- recent_payouts: used by GET /api/v2/propfirms (1d period), latest-payouts, payoutSyncService
-- Index for single-firm + time filter + order by timestamp desc
CREATE INDEX IF NOT EXISTS idx_recent_payouts_firm_timestamp
  ON recent_payouts(firm_id, timestamp DESC);

-- Index for time-range queries (list by firm_id in 1d, cleanup by timestamp)
CREATE INDEX IF NOT EXISTS idx_recent_payouts_timestamp
  ON recent_payouts(timestamp DESC);

-- trustpilot_reviews: used by signals, incidents (resolve review_ids), digest, classifier
-- May already exist from migrations/11_alpha-intelligence-schema.sql
CREATE INDEX IF NOT EXISTS idx_trustpilot_firm_date
  ON trustpilot_reviews(firm_id, review_date DESC);

-- weekly_incidents: used by GET /api/v2/propfirms/[id]/incidents, incident-aggregator
-- May already exist as idx_incidents_firm_week from migrations/11_alpha-intelligence-schema.sql
CREATE INDEX IF NOT EXISTS idx_weekly_incidents_firm_year_week
  ON weekly_incidents(firm_id, year DESC, week_number DESC);
