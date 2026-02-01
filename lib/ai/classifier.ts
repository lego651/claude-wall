/**
 * TICKET-006: Review Classifier
 * Classifies Trustpilot reviews into categories for Alpha intelligence.
 * Taxonomy: docs/CLASSIFIER-TAXONOMY.md and lib/ai/classification-taxonomy.ts
 */

import { getOpenAIClient } from './openai-client';
import { createServiceClient } from '@/libs/supabase/service';
import {
  CLASSIFICATION_CATEGORIES,
  type ClassificationCategory,
  LEGACY_CATEGORIES,
  LEGACY_CATEGORY_MAP,
} from './classification-taxonomy';

// ============================================================================
// TYPES
// ============================================================================

export { CLASSIFICATION_CATEGORIES, type ClassificationCategory };

export const SEVERITY_LEVELS = ['low', 'medium', 'high'] as const;
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

export interface ReviewInput {
  rating: number;
  title?: string | null;
  text: string;
}

export interface ClassificationResult {
  category: ClassificationCategory;
  severity: SeverityLevel | null;
  confidence: number;
  summary: string;
}

const CLASSIFICATION_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

// ============================================================================
// PROMPT (Phase 1 taxonomy – Option B)
// ============================================================================

function buildPrompt(review: ReviewInput): string {
  const title = review.title ?? '(no title)';
  return `Analyze this Trustpilot review for a prop trading firm.

Rating: ${review.rating}/5
Title: "${title}"
Review: "${review.text.slice(0, 4000)}"

Classify into ONE category:
- payout_delay: Payouts late, processing delays
- payout_denied: Payout refused or withheld
- kyc_withdrawal_issue: KYC blocks, withdrawal method limits, verification delays
- platform_technical_issue: Login, charts, platform downtime, bugs
- support_issue: Slow reply, ticket ignored, rude or unprofessional support
- rules_dispute: Unfair termination, rule disagreements
- pricing_fee_complaint: Challenge fees, resets, hidden costs
- execution_conditions: Slippage, spreads, execution quality
- high_risk_allegation: Fraud/scam allegations, exit scam fears (use only when clearly alleged)
- positive_experience: Success stories, praise, recommendations
- neutral_mixed: Questions, general discussion, mixed feedback
- spam_template: Templated praise, affiliate-driven
- low_info: One-line or uninformative
- off_topic: Irrelevant, not about the firm

Determine severity (if negative category): high = serious/money/mass impact, medium = moderate/delays/bugs, low = minor/isolated. Use null for positive_experience, neutral_mixed, spam_template, low_info, off_topic.

Respond with valid JSON only, no markdown:
{"category":"<one of the categories above>","severity":"<low|medium|high|null>","confidence":<0-1>,"summary":"<1-2 sentence summary>"}`;
}

// ============================================================================
// CLASSIFY (with retry)
// ============================================================================

/**
 * Classify a single review. Returns category, severity, confidence, summary.
 * Retries up to 3 times with exponential backoff. Timeout 30s per attempt.
 */
export async function classifyReview(review: ReviewInput): Promise<ClassificationResult> {
  const openai = getOpenAIClient();
  const prompt = buildPrompt(review);

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const completionPromise = openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Classification timeout (30s)')), CLASSIFICATION_TIMEOUT_MS)
      );
      const completion = await Promise.race([completionPromise, timeoutPromise]);

      const raw = completion.choices[0]?.message?.content;
      if (!raw) throw new Error('Empty response from OpenAI');

      const parsed = JSON.parse(raw) as {
        category?: string;
        severity?: string | null;
        confidence?: number;
        summary?: string;
      };

      const rawCategory = parsed.category as string;
      const allowed = [...CLASSIFICATION_CATEGORIES, ...LEGACY_CATEGORIES];
      if (!allowed.includes(rawCategory as (typeof allowed)[number])) {
        throw new Error(`Invalid category: ${parsed.category}`);
      }
      // Store canonical (new) taxonomy so DB stays consistent
      const category = toCanonicalCategory(rawCategory);

      let severity: SeverityLevel | null = null;
      if (parsed.severity && SEVERITY_LEVELS.includes(parsed.severity as SeverityLevel)) {
        severity = parsed.severity as SeverityLevel;
      }

      const confidence =
        typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.5;
      const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';

      return { category, severity, confidence, summary };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }

  throw lastError ?? new Error('Classification failed after retries');
}

/** Normalize for storage: map legacy category to new taxonomy so DB stays consistent */
function toCanonicalCategory(raw: string): ClassificationCategory {
  const mapped = LEGACY_CATEGORY_MAP[raw];
  if (mapped) return mapped;
  return raw as ClassificationCategory;
}

// ============================================================================
// STORE RESULT IN SUPABASE
// ============================================================================

/**
 * Update trustpilot_reviews row with classification result.
 * Call after classifyReview() from cron or batch script.
 */
export async function updateReviewClassification(
  reviewId: number,
  result: ClassificationResult
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('trustpilot_reviews')
    .update({
      category: result.category,
      severity: result.severity,
      confidence: result.confidence,
      ai_summary: result.summary,
      classified_at: new Date().toISOString(),
    })
    .eq('id', reviewId);

  if (error) throw new Error(`Failed to update review ${reviewId}: ${error.message}`);
}

/**
 * Bulk update trustpilot_reviews with classification results (one Supabase round-trip per batch).
 * Use from batch script to reduce DB load. Each item must have id and the classification result.
 */
export async function updateReviewClassificationsBulk(
  items: Array<{ id: number; result: ClassificationResult }>
): Promise<void> {
  if (!items.length) return;
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const rows = items.map(({ id, result }) => ({
    id,
    category: result.category,
    severity: result.severity,
    confidence: result.confidence,
    ai_summary: result.summary,
    classified_at: now,
  }));
  const { error } = await supabase
    .from('trustpilot_reviews')
    .upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`Failed to bulk update reviews: ${error.message}`);
}
