/**
 * TICKET-008: Batch Classification
 * Fetches unclassified reviews, runs classifier on each, updates DB.
 */

import { createServiceClient } from '@/libs/supabase/service';
import { classifyReview, updateReviewClassification } from './classifier';

export interface BatchClassificationResult {
  classified: number;
  failed: number;
  errors: string[];
}

interface TrustpilotReviewRow {
  id: number;
  rating: number;
  title: string | null;
  review_text: string | null;
}

/**
 * Fetch all reviews where classified_at IS NULL, run classifyReview() on each,
 * update DB. Log failures and continue. Returns counts and error messages.
 */
export async function runBatchClassification(): Promise<BatchClassificationResult> {
  const supabase = createServiceClient();
  const result: BatchClassificationResult = { classified: 0, failed: 0, errors: [] };

  const { data: rows, error: fetchError } = await supabase
    .from('trustpilot_reviews')
    .select('id, rating, title, review_text')
    .is('classified_at', null)
    .order('created_at', { ascending: true });

  if (fetchError) {
    result.errors.push(`Fetch failed: ${fetchError.message}`);
    return result;
  }

  if (!rows?.length) {
    return result;
  }

  const typedRows = rows as TrustpilotReviewRow[];
  console.log(`[Batch Classify] Found ${typedRows.length} unclassified review(s)`);

  for (const row of typedRows) {
    try {
      const classification = await classifyReview({
        rating: row.rating,
        title: row.title ?? undefined,
        text: row.review_text ?? '',
      });
      await updateReviewClassification(row.id, classification);
      result.classified++;
      if (result.classified % 10 === 0) {
        console.log(`[Batch Classify] Classified ${result.classified}/${typedRows.length}`);
      }
    } catch (err) {
      result.failed++;
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Review ${row.id}: ${msg}`);
      console.error(`[Batch Classify] Review ${row.id} failed:`, msg);
    }
  }

  return result;
}
