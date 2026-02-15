/**
 * Batch classification of unclassified reviews (library).
 * Uses classifyReviewBatch() — 20 reviews per OpenAI call (same as script).
 * Canonical entry point for cron: scripts/classify-unclassified-reviews.ts
 */

import { createServiceClient } from '@/lib/supabase/service';
import {
  classifyReviewBatch,
  updateReviewClassificationsBulk,
  CLASSIFY_AI_BATCH_SIZE_DEFAULT,
  CLASSIFY_AI_BATCH_SIZE_MAX,
} from './classifier';

const AI_BATCH_SIZE = Math.min(
  Math.max(1, parseInt(process.env.CLASSIFY_AI_BATCH_SIZE || String(CLASSIFY_AI_BATCH_SIZE_DEFAULT), 10)),
  CLASSIFY_AI_BATCH_SIZE_MAX
);

export interface BatchClassificationResult {
  classified: number;
  failed: number;
  errors: string[];
}

interface TrustpilotReviewRow {
  id: number;
  firm_id: string;
  rating: number;
  title: string | null;
  review_text: string | null;
  review_date: string;
  trustpilot_url: string;
}

export interface RunBatchOptions {
  /** Max number of unclassified reviews to process this run. Omit = no limit. */
  limit?: number;
}

/**
 * Fetch reviews where classified_at IS NULL, classify in batches of 20 per API call,
 * update DB. Returns counts and error messages. Use limit (e.g. 40) for admin/small runs.
 */
export async function runBatchClassification(options?: RunBatchOptions): Promise<BatchClassificationResult> {
  const supabase = createServiceClient();
  const result: BatchClassificationResult = { classified: 0, failed: 0, errors: [] };
  const limit = options?.limit;

  let query = supabase
    .from('trustpilot_reviews')
    .select('id, firm_id, rating, title, review_text, review_date, trustpilot_url')
    .is('classified_at', null)
    .order('created_at', { ascending: true });
  if (limit != null && limit > 0) query = query.limit(limit);

  const { data: rows, error: fetchError } = await query;

  if (fetchError) {
    result.errors.push(`Fetch failed: ${fetchError.message}`);
    return result;
  }

  if (!rows?.length) {
    return result;
  }

  const typedRows = rows as TrustpilotReviewRow[];
  console.log(`[Batch Classify] Found ${typedRows.length} unclassified review(s), AI batch size: ${AI_BATCH_SIZE}`);

  for (let i = 0; i < typedRows.length; i += AI_BATCH_SIZE) {
    const batch = typedRows.slice(i, i + AI_BATCH_SIZE);
    const inputs = batch.map((r) => ({
      rating: r.rating,
      title: r.title ?? undefined,
      text: r.review_text ?? '',
    }));

    try {
      const results = await classifyReviewBatch(inputs);
      const items = batch.map((row, idx) => ({
      id: row.id,
      firm_id: row.firm_id,
      rating: row.rating,
      review_text: row.review_text ?? '',
      review_date: row.review_date,
      trustpilot_url: row.trustpilot_url,
      title: row.title,
      result: results[idx],
    }));
      await updateReviewClassificationsBulk(items);
      result.classified += batch.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.failed += batch.length;
      result.errors.push(`Batch at ${i}: ${msg}`);
      console.error(`[Batch Classify] Batch failed:`, msg);
    }

    if ((i + AI_BATCH_SIZE) % (AI_BATCH_SIZE * 5) === 0 || i + AI_BATCH_SIZE >= typedRows.length) {
      console.log(`[Batch Classify] Progress: ${Math.min(i + AI_BATCH_SIZE, typedRows.length)}/${typedRows.length}`);
    }
  }

  return result;
}
