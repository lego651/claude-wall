/**
 * Classification taxonomy (Phase 1 – Option B).
 * Single source of truth for category values, incident rules, and sentiment buckets.
 * See docs/CLASSIFIER-TAXONOMY.md.
 */

// ---------------------------------------------------------------------------
// All categories the classifier may return (single-label)
// ---------------------------------------------------------------------------

export const CLASSIFICATION_CATEGORIES = [
  // Negative – spike-based incidents (>=3 in 7d)
  'payout_delay',
  'payout_denied',
  'kyc_withdrawal_issue',
  'platform_technical_issue',
  'support_issue',
  'rules_dispute',
  'pricing_fee_complaint',
  'execution_conditions',
  // Negative – severity override (>=1 in 7d)
  'high_risk_allegation',
  // Positive / neutral
  'positive_experience',
  'neutral_mixed',
  // Never incident (noise)
  'spam_template',
  'low_info',
  'off_topic',
] as const;

export type ClassificationCategory = (typeof CLASSIFICATION_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// Incident rules
// ---------------------------------------------------------------------------

/** Categories that trigger incidents when count >= MIN_REVIEWS_FOR_INCIDENT in window */
export const NEGATIVE_SPIKE_CATEGORIES = [
  'payout_delay',
  'payout_denied',
  'kyc_withdrawal_issue',
  'platform_technical_issue',
  'support_issue',
  'rules_dispute',
  'pricing_fee_complaint',
  'execution_conditions',
] as const;

/** Categories that trigger an incident with lower threshold (e.g. >= 1 in 7d). UI: "High-risk allegations reported" */
export const SEVERITY_OVERRIDE_CATEGORIES = ['high_risk_allegation'] as const;

/** Categories we never create incidents from */
export const NEVER_INCIDENT_CATEGORIES = [
  'spam_template',
  'low_info',
  'off_topic',
  'positive_experience',
  'neutral_mixed',
] as const;

/** All categories that count as "negative" for incidents (spike + severity override) */
export const INCIDENT_ELIGIBLE_CATEGORIES = [
  ...NEGATIVE_SPIKE_CATEGORIES,
  ...SEVERITY_OVERRIDE_CATEGORIES,
] as const;

export const MIN_REVIEWS_FOR_SPIKE_INCIDENT = 3;
export const MIN_REVIEWS_FOR_HIGH_RISK_INCIDENT = 1;

// ---------------------------------------------------------------------------
// Digest sentiment (weekly report)
// ---------------------------------------------------------------------------

export const POSITIVE_SENTIMENT_CATEGORY = 'positive_experience';
export const NEUTRAL_SENTIMENT_CATEGORY = 'neutral_mixed';

/** Categories that count as "negative" for sentiment (same as incident-eligible negative) */
export const NEGATIVE_SENTIMENT_CATEGORIES = [...INCIDENT_ELIGIBLE_CATEGORIES];

// ---------------------------------------------------------------------------
// Backward compatibility: legacy category values (pre–Phase 1)
// ---------------------------------------------------------------------------

export const LEGACY_CATEGORIES = [
  'payout_issue',
  'scam_warning',
  'platform_issue',
  'rule_violation',
  'positive',
  'neutral',
  'noise',
] as const;

/** Map legacy category → canonical (new) category for grouping and display */
export const LEGACY_CATEGORY_MAP: Record<string, ClassificationCategory> = {
  payout_issue: 'payout_delay',
  scam_warning: 'high_risk_allegation',
  platform_issue: 'platform_technical_issue',
  rule_violation: 'rules_dispute',
  positive: 'positive_experience',
  neutral: 'neutral_mixed',
  noise: 'off_topic',
};

/** All category values allowed in DB (new + legacy) for CHECK and queries */
export const ALL_ALLOWED_CATEGORIES = [
  ...CLASSIFICATION_CATEGORIES,
  ...LEGACY_CATEGORIES,
] as unknown as string[];

/** Normalize category for grouping: legacy → new, else return as-is if already new */
export function normalizeCategory(category: string | null): string | null {
  if (!category) return null;
  return LEGACY_CATEGORY_MAP[category] ?? category;
}

/** True if category is in the spike-based incident set (after normalizing legacy) */
export function isSpikeCategory(category: string | null): boolean {
  const norm = normalizeCategory(category);
  return norm !== null && (NEGATIVE_SPIKE_CATEGORIES as readonly string[]).includes(norm);
}

/** True if category is high-risk (severity override) after normalizing */
export function isSeverityOverrideCategory(category: string | null): boolean {
  const norm = normalizeCategory(category);
  return norm !== null && (SEVERITY_OVERRIDE_CATEGORIES as readonly string[]).includes(norm);
}

/** True if category should never create an incident */
export function isNeverIncidentCategory(category: string | null): boolean {
  if (!category) return true;
  const norm = normalizeCategory(category);
  return norm !== null && (NEVER_INCIDENT_CATEGORIES as readonly string[]).includes(norm);
}
