/**
 * GET /api/v2/propfirms/[id]/incidents
 *
 * Returns incidents for the firm from weekly_incidents, filtered to the last N days.
 * Query: days (default 90). Response includes week_start (YYYY-MM-DD) for display.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateOrigin, isRateLimited } from '@/lib/apiSecurity';

function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/** Monday of ISO week (year, week_number) in YYYY-MM-DD */
function getWeekStartDate(year, weekNumber) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dow = jan4.getUTCDay();
  const mondayOffset = dow === 0 ? 6 : dow - 1;
  const week1Monday = new Date(Date.UTC(year, 0, 4 - mondayOffset));
  const weekStart = new Date(week1Monday);
  weekStart.setUTCDate(week1Monday.getUTCDate() + (weekNumber - 1) * 7);
  return weekStart.toISOString().slice(0, 10);
}

export async function GET(request, { params }) {
  const { id: firmId } = await params;
  const { searchParams } = new URL(request.url);
  const days = Math.min(365, Math.max(1, parseInt(searchParams.get('days') || '90', 10) || 90));

  const { ok, headers } = validateOrigin(request);
  if (!ok) {
    return NextResponse.json({ error: 'Forbidden origin' }, { status: 403, headers });
  }

  const { limited, retryAfterMs } = isRateLimited(request, {
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      {
        status: 429,
        headers: {
          ...headers,
          'Retry-After': String(Math.ceil(retryAfterMs / 1000)),
        },
      }
    );
  }

  const supabase = createSupabaseClient();
  const { data: rows, error: err } = await supabase
    .from('weekly_incidents')
    .select('id, firm_id, week_number, year, incident_type, severity, title, summary, review_count, affected_users, review_ids, created_at')
    .eq('firm_id', firmId)
    .order('year', { ascending: false })
    .order('week_number', { ascending: false });

  if (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const incidents = (rows || [])
    .map((r) => {
      const weekStart = getWeekStartDate(r.year, r.week_number);
      return { ...r, week_start: weekStart };
    })
    .filter((r) => r.week_start >= cutoffStr);

  return NextResponse.json({ incidents }, { headers });
}
