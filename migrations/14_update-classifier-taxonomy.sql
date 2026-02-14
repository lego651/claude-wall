-- Phase 1 (Option B): Expand trustpilot_reviews.category and weekly_incidents.incident_type
-- to support new taxonomy. See docs/CLASSIFIER-TAXONOMY.md and lib/ai/classification-taxonomy.ts.
-- Backward compatible: old values (payout_issue, scam_warning, etc.) remain allowed.

-- =============================================================================
-- 1. trustpilot_reviews: allow new + legacy category values
-- =============================================================================

ALTER TABLE trustpilot_reviews DROP CONSTRAINT IF EXISTS valid_category;

ALTER TABLE trustpilot_reviews ADD CONSTRAINT valid_category CHECK (
  category IN (
    -- New taxonomy (Phase 1)
    'payout_delay', 'payout_denied', 'kyc_withdrawal_issue', 'platform_technical_issue',
    'support_issue', 'rules_dispute', 'pricing_fee_complaint', 'execution_conditions',
    'high_risk_allegation', 'positive_experience', 'neutral_mixed',
    'spam_template', 'low_info', 'off_topic',
    -- Legacy
    'payout_issue', 'scam_warning', 'platform_issue', 'rule_violation',
    'positive', 'neutral', 'noise'
  )
  OR category IS NULL
);

COMMENT ON COLUMN trustpilot_reviews.category IS 'Phase 1 taxonomy: payout_delay, payout_denied, kyc_withdrawal_issue, platform_technical_issue, support_issue, rules_dispute, pricing_fee_complaint, execution_conditions, high_risk_allegation, positive_experience, neutral_mixed, spam_template, low_info, off_topic. Legacy: payout_issue, scam_warning, platform_issue, rule_violation, positive, neutral, noise. See docs/CLASSIFIER-TAXONOMY.md.';

-- =============================================================================
-- 2. weekly_incidents: allow new + legacy incident_type values
-- =============================================================================

ALTER TABLE weekly_incidents DROP CONSTRAINT IF EXISTS weekly_incidents_incident_type_check;

ALTER TABLE weekly_incidents ADD CONSTRAINT weekly_incidents_incident_type_check CHECK (
  incident_type IN (
    -- New taxonomy (Phase 1)
    'payout_delay', 'payout_denied', 'kyc_withdrawal_issue', 'platform_technical_issue',
    'support_issue', 'rules_dispute', 'pricing_fee_complaint', 'execution_conditions',
    'high_risk_allegation',
    -- Legacy
    'payout_issue', 'scam_warning', 'platform_issue', 'rule_violation',
    'other'
  )
);

COMMENT ON COLUMN weekly_incidents.incident_type IS 'Phase 1: spike categories + high_risk_allegation. Legacy: payout_issue, scam_warning, platform_issue, rule_violation, other. See docs/CLASSIFIER-TAXONOMY.md.';
