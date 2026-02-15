/**
 * TICKET-006: Review Classifier
 * Classifies Trustpilot reviews into categories for Alpha intelligence.
 * Taxonomy: docs/CLASSIFIER-TAXONOMY.md and lib/ai/classification-taxonomy.ts
 */

import { getOpenAIClient } from './openai-client';
import { createServiceClient } from '@/lib/supabase/service';
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

const CATEGORY_INSTRUCTIONS = `Classify into ONE category per review:
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

Severity (if negative category): high = serious/money/mass impact, medium = moderate/delays/bugs, low = minor/isolated. Use null for positive_experience, neutral_mixed, spam_template, low_info, off_topic.`;

function buildPrompt(review: ReviewInput): string {
  const title = review.title ?? '(no title)';
  return `Analyze this Trustpilot review for a prop trading firm.

Rating: ${review.rating}/5
Title: "${title}"
Review: "${review.text.slice(0, 4000)}"

${CATEGORY_INSTRUCTIONS}

Respond with valid JSON only, no markdown:
{"category":"<one of the categories above>","severity":"<low|medium|high|null>","confidence":<0-1>,"summary":"<1-2 sentence summary>"}`;
}

function buildBatchPrompt(reviews: ReviewInput[]): string {
  const parts = reviews.map((r, i) => {
    const title = r.title ?? '(no title)';
    return `--- Review ${i + 1} ---
Rating: ${r.rating}/5
Title: "${title}"
Review: "${r.text.slice(0, 4000)}"`;
  });
  return `Analyze each of the following Trustpilot reviews for a prop trading firm. There are exactly ${reviews.length} reviews.

${parts.join('\n\n')}

${CATEGORY_INSTRUCTIONS}

Respond with a JSON object with one key "results" whose value is an array of exactly ${reviews.length} objects in the same order as the reviews (index 0 = Review 1, etc.). Each object: {"category":"...","severity":"<low|medium|high|null>","confidence":<0-1>,"summary":"<1-2 sentence summary>"}
Example: {"results":[{"category":"positive_experience","severity":null,"confidence":0.9,"summary":"..."}, ...]}
No other text, only the JSON object.`;
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

/** Max reviews per API call for batch classification. 20 recommended; cap 25 for accuracy. */
export const CLASSIFY_AI_BATCH_SIZE_DEFAULT = 20;
export const CLASSIFY_AI_BATCH_SIZE_MAX = 25;

/**
 * Classify multiple reviews in one OpenAI request. Reduces API cost.
 * Returns results in same order as input. Throws if response count doesn't match.
 * Recommended batch size: 20 (see CLASSIFY_AI_BATCH_SIZE_DEFAULT).
 */
export async function classifyReviewBatch(reviews: ReviewInput[]): Promise<ClassificationResult[]> {
  if (reviews.length === 0) return [];
  const openai = getOpenAIClient();
  const prompt = buildBatchPrompt(reviews);

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const completionPromise = openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: Math.min(16384, 400 + reviews.length * 80),
        response_format: { type: 'json_object' },
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Classification batch timeout (60s)')), 60_000)
      );
      const completion = await Promise.race([completionPromise, timeoutPromise]);

      const raw = completion.choices[0]?.message?.content;
      if (!raw) throw new Error('Empty response from OpenAI');

      const parsed = JSON.parse(raw) as { results?: unknown[] };
      const arr = Array.isArray(parsed?.results) ? parsed.results : null;
      if (!arr || arr.length === 0) {
        throw new Error(`Expected at least 1 result, got ${arr?.length ?? 0}`);
      }
      // Model sometimes returns 19 or 21 for 20; use first N or fill missing with single-review
      const toUse = arr.slice(0, reviews.length);

      const allowed = [...CLASSIFICATION_CATEGORIES, ...LEGACY_CATEGORIES];
      const results: ClassificationResult[] = [];
      for (let i = 0; i < toUse.length; i++) {
        const item = toUse[i] as Record<string, unknown>;
        const rawCategory = String(item?.category ?? 'other');
        if (!allowed.includes(rawCategory as (typeof allowed)[number])) {
          throw new Error(`Invalid category at index ${i}: ${rawCategory}`);
        }
        const category = toCanonicalCategory(rawCategory);
        let severity: SeverityLevel | null = null;
        if (item?.severity && SEVERITY_LEVELS.includes(item.severity as SeverityLevel)) {
          severity = item.severity as SeverityLevel;
        }
        const confidence =
          typeof item?.confidence === 'number'
            ? Math.max(0, Math.min(1, item.confidence))
            : 0.5;
        const summary = typeof item?.summary === 'string' ? item.summary.trim() : '';
        results.push({ category, severity, confidence, summary });
      }
      // If model returned fewer than N, classify missing reviews one-by-one
      for (let i = toUse.length; i < reviews.length; i++) {
        const single = await classifyReview(reviews[i]);
        results.push(single);
      }
      return results;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }

  throw lastError ?? new Error('Batch classification failed after retries');
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

/** Required fields for bulk upsert so NOT NULL columns are not set to null. */
export interface ReviewRowForBulkUpdate {
  id: number;
  firm_id: string;
  rating: number;
  review_text: string;
  review_date: string; // ISO date YYYY-MM-DD
  trustpilot_url: string;
  title?: string | null;
}

/**
 * Bulk update trustpilot_reviews with classification results (one Supabase round-trip per batch).
 * Include all NOT NULL columns (firm_id, rating, review_text, review_date, trustpilot_url) so upsert does not violate constraints.
 */
export async function updateReviewClassificationsBulk(
  items: Array<{ id: number; firm_id: string; rating: number; review_text: string; review_date: string; trustpilot_url: string; title?: string | null; result: ClassificationResult }>
): Promise<void> {
  if (!items.length) return;
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const rows = items.map(({ id, firm_id, rating, review_text, review_date, trustpilot_url, title, result }) => ({
    id,
    firm_id,
    rating,
    review_text,
    review_date,
    trustpilot_url,
    title: title ?? null,
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
