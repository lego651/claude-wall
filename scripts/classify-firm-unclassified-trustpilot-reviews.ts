/**
 * TICKET-002: Classify Unclassified Reviews
 *
 * Queries trustpilot_reviews WHERE classified_at IS NULL, classifies in batches with OpenAI
 * (20 reviews per API call by default to reduce cost), updates category, severity, confidence,
 * ai_summary, classified_at. Uses lib/ai/classifier (Phase 1 taxonomy).
 * Called by GitHub Actions (daily-step2-sync-firm-classify-reviews.yml).
 *
 * Usage:
 *   npx tsx scripts/classify-firm-unclassified-trustpilot-reviews.ts
 *
 * Env (from .env at project root):
 *   OPENAI_API_KEY                    - required
 *   NEXT_PUBLIC_SUPABASE_URL          - required
 *   SUPABASE_SERVICE_ROLE_KEY        - required
 *   CLASSIFY_MAX_PER_RUN              - max reviews per run (default 1000; ~1–5k/day expected)
 *   CLASSIFY_AI_BATCH_SIZE           - reviews per OpenAI request, 20 default, max 25 (default 20)
 *   CLASSIFY_BATCH_DELAY_MS          - delay between batches to avoid rate limits (default 1500)
 */

import 'dotenv/config';
import { createServiceClient } from '@/lib/supabase/service';
import {
  classifyReviewBatch,
  updateReviewClassificationsBulk,
  CLASSIFY_AI_BATCH_SIZE_DEFAULT,
  CLASSIFY_AI_BATCH_SIZE_MAX,
} from '@/lib/ai/classifier';

const MAX_PER_RUN = parseInt(process.env.CLASSIFY_MAX_PER_RUN || '1000', 10);
const AI_BATCH_SIZE = Math.min(
  Math.max(1, parseInt(process.env.CLASSIFY_AI_BATCH_SIZE || String(CLASSIFY_AI_BATCH_SIZE_DEFAULT), 10)),
  CLASSIFY_AI_BATCH_SIZE_MAX
);
const BATCH_DELAY_MS = parseInt(process.env.CLASSIFY_BATCH_DELAY_MS || '1500', 10);

const FAILURE_EXIT_THRESHOLD = 0.5; // exit 1 if failed > 50% of attempted

interface ReviewRow {
  id: number;
  firm_id: string;
  rating: number;
  title: string | null;
  review_text: string;
  review_date: string;
  trustpilot_url: string;
}

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.error('[Classify] OPENAI_API_KEY is not set. Add it to .env or environment.');
    process.exit(1);
  }

  const supabase = createServiceClient();

  const { data: reviews, error: fetchError } = await supabase
    .from('firm_trustpilot_reviews')
    .select('id, firm_id, rating, title, review_text, review_date, trustpilot_url')
    .is('classified_at', null)
    .order('created_at', { ascending: true })
    .limit(MAX_PER_RUN);

  if (fetchError) {
    console.error('[Classify] Failed to fetch unclassified reviews:', fetchError.message);
    process.exit(1);
  }

  const rows = (reviews || []) as ReviewRow[];
  const total = rows.length;

  if (total === 0) {
    console.log('[Classify] No unclassified reviews found.');
    process.exit(0);
  }

  console.log(`[Classify] Found ${total} unclassified review(s). AI batch size: ${AI_BATCH_SIZE} (reviews per API call).`);

  let classified = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += AI_BATCH_SIZE) {
    const batch = rows.slice(i, i + AI_BATCH_SIZE);
    const batchInputs = batch.map((r) => ({ rating: r.rating, title: r.title, text: r.review_text }));

    try {
      const results = await classifyReviewBatch(batchInputs);
      const batchResults = batch.map((row, idx) => ({
        id: row.id,
        firm_id: row.firm_id,
        rating: row.rating,
        review_text: row.review_text,
        review_date: row.review_date,
        trustpilot_url: row.trustpilot_url,
        title: row.title,
        result: results[idx],
      }));
      await updateReviewClassificationsBulk(batchResults);
      classified += batch.length;
    } catch (err) {
      failed += batch.length;
      console.error(`[Classify] Batch failed (reviews ${batch.map((r) => r.id).join(', ')}):`, err instanceof Error ? err.message : String(err));
    }

    const done = Math.min(i + AI_BATCH_SIZE, total);
    console.log(`[Classify] Progress: ${done}/${total} processed (classified: ${classified}, failed: ${failed})`);

    if (i + AI_BATCH_SIZE < rows.length && BATCH_DELAY_MS > 0) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  console.log(`[Classify] Done. total=${total}, classified=${classified}, failed=${failed}`);

  const attempted = classified + failed;
  if (attempted > 0 && failed / attempted > FAILURE_EXIT_THRESHOLD) {
    console.error(`[Classify] Failure rate ${((failed / attempted) * 100).toFixed(1)}% exceeds ${FAILURE_EXIT_THRESHOLD * 100}%. Exiting with code 1.`);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('[Classify] Fatal error:', err);
  process.exit(1);
});
