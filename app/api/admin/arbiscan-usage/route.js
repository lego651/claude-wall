/**
 * PROP-019: Admin endpoint for Arbiscan usage stats.
 * GET /api/admin/arbiscan-usage
 * Returns { calls, limit, percentage, day }. Requires authenticated user with is_admin.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/server';
import { usageTracker } from '@/lib/arbiscan';

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

  const usage = usageTracker.getUsage();
  return NextResponse.json({
    calls: usage.calls,
    limit: usage.limit,
    percentage: usage.percentage,
    day: usage.day,
  });
}
