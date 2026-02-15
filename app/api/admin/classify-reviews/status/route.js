/**
 * GET /api/admin/classify-reviews/status
 * Returns trustpilot_reviews counts: total, classified, unclassified.
 * Requires is_admin.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
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

  const [
    { count: total },
    { count: classifiedCount },
    { data: latestRow },
  ] = await Promise.all([
    supabase.from('trustpilot_reviews').select('*', { count: 'exact', head: true }),
    supabase.from('trustpilot_reviews').select('*', { count: 'exact', head: true }).not('classified_at', 'is', null),
    supabase.from('trustpilot_reviews').select('classified_at').not('classified_at', 'is', null).order('classified_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const unclassifiedCount = total != null && classifiedCount != null ? total - classifiedCount : null;
  const lastClassifiedAt = latestRow?.classified_at ?? null;

  return NextResponse.json({
    totalReviews: total ?? 0,
    classifiedCount: classifiedCount ?? 0,
    unclassifiedCount: unclassifiedCount ?? 0,
    lastClassifiedAt: lastClassifiedAt ? new Date(lastClassifiedAt).toISOString() : null,
  });
}
