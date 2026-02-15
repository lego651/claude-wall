/**
 * POST /api/admin/classify-reviews
 * Run classification on up to `limit` unclassified reviews (default 40).
 * Returns classified, failed, errors, unclassifiedRemaining.
 * Requires is_admin.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { runBatchClassification } from '@/lib/ai/batch-classify';

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let limit = 40;
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.limit === 'number' && body.limit > 0) {
      limit = Math.min(body.limit, 1000);
    }
  } catch {
    // use default 40
  }

  const start = Date.now();
  let result;
  try {
    result = await runBatchClassification({ limit });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Classification failed' },
      { status: 500 }
    );
  }

  const service = createServiceClient();
  const { count: unclassifiedRemaining } = await service
    .from('trustpilot_reviews')
    .select('*', { count: 'exact', head: true })
    .is('classified_at', null);

  const durationMs = Date.now() - start;

  return NextResponse.json({
    classified: result.classified,
    failed: result.failed,
    errors: result.errors,
    totalProcessed: result.classified + result.failed,
    limit,
    unclassifiedRemaining: unclassifiedRemaining ?? 0,
    durationMs,
  });
}
