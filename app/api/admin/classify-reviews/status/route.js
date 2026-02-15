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
  ] = await Promise.all([
    supabase.from('trustpilot_reviews').select('*', { count: 'exact', head: true }),
    supabase.from('trustpilot_reviews').select('*', { count: 'exact', head: true }).not('classified_at', 'is', null),
  ]);

  const unclassifiedCount = total != null && classifiedCount != null ? total - classifiedCount : null;

  return NextResponse.json({
    totalReviews: total ?? 0,
    classifiedCount: classifiedCount ?? 0,
    unclassifiedCount: unclassifiedCount ?? 0,
  });
}
