/**
 * TICKET-006: Review Classifier
 * Classifies Trustpilot reviews into categories for Alpha intelligence.
 */

import { getOpenAIClient } from './openai-client';
import { createServiceClient } from '@/libs/supabase/service';

// ============================================================================
// TYPES
// ============================================================================

export const CLASSIFICATION_CATEGORIES = [
  'payout_issue',
  'scam_warning',
  'platform_issue',
  'rule_violation',
  'positive',
  'neutral',
  'noise',
] as const;

export const SEVERITY_LEVELS = ['low', 'medium', 'high'] as const;

export type ClassificationCategory = (typeof CLASSIFICATION_CATEGORIES)[number];
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
// PROMPT (from alpha_scope_v3.md)
// ============================================================================

function buildPrompt(review: ReviewInput): string {
  const title = review.title ?? '(no title)';
  return `Analyze this Trustpilot review for a prop trading firm:

Rating: ${review.rating}/5
Title: "${title}"
Review: "${review.text.slice(0, 4000)}"

Classify into ONE category:
- payout_issue: Problems receiving payouts (delays, denials, missing payments)
- scam_warning: Fraud accusations, scam claims, exit scam fears
- platform_issue: Technical problems (login, charts, platform downtime)
- rule_violation: Unfair account termination, rule disputes
- positive: Success stories, praise, recommendations
- neutral: Questions, general discussion, mixed feedback
- noise: Irrelevant, off-topic, or uninformative

Determine severity (if negative category): high = serious/money/mass impact, medium = moderate/delays/bugs, low = minor/isolated. Use null for positive/neutral/noise.

Respond with valid JSON only, no markdown:
{"category":"<one of the categories>","severity":"<low|medium|high|null>","confidence":<0-1>,"summary":"<1-2 sentence summary>"}`;
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

      const category = parsed.category as ClassificationCategory;
      if (!CLASSIFICATION_CATEGORIES.includes(category)) {
        throw new Error(`Invalid category: ${parsed.category}`);
      }

      let severity: SeverityLevel | null = null;
      if (parsed.severity && SEVERITY_LEVELS.includes(parsed.severity as SeverityLevel)) {
        severity = parsed.severity as SeverityLevel;
      }

      const confidence = typeof parsed.confidence === 'number'
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
