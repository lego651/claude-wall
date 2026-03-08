-- Migration 32: Add Trustpilot overall/lifetime score columns to firm_profiles
-- These store the aggregate rating scraped from the Trustpilot listing page (JSON-LD).
-- Used as the baseline for the weekly score momentum feature (S10-007, S10-008, S10-009).

ALTER TABLE firm_profiles
  ADD COLUMN IF NOT EXISTS trustpilot_overall_score NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS trustpilot_overall_review_count INT,
  ADD COLUMN IF NOT EXISTS trustpilot_overall_updated_at TIMESTAMPTZ;
