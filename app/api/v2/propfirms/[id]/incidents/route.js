/**
 * GET /api/v2/propfirms/[id]/incidents
 *
 * Returns incidents for the firm from weekly_incidents, filtered to the last N days.
 * Query: days (default 90). Response includes week_start (YYYY-MM-DD) for display.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateOrigin, isRateLimited } from '@/lib/apiSecurity';
import { createLogger } from '@/lib/logger';
import { getRequestId, setRequestIdHeader } from '@/middleware/requestId';
import { withQueryGuard } from '@/lib/supabaseQuery';

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
  const requestId = getRequestId(request);
  const log = createLogger({ requestId, route: '/api/v2/propfirms/[id]/incidents', firmId });
  const start = Date.now();
  const { searchParams } = new URL(request.url);
  const days = Math.min(365, Math.max(1, parseInt(searchParams.get('days') || '90', 10) || 90));

  log.info({ method: 'GET', params: { days } }, 'API request');

  const { ok, headers } = validateOrigin(request);
  setRequestIdHeader(headers, requestId);
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
  let rows;
  let err;
  try {
    const result = await withQueryGuard(
      supabase
        .from('weekly_incidents')
        .select('id, firm_id, week_number, year, incident_type, severity, title, summary, review_count, affected_users, review_ids, created_at')
        .eq('firm_id', firmId)
        .order('year', { ascending: false })
        .order('week_number', { ascending: false }),
      { context: 'incidents weekly_incidents' }
    );
    rows = result.data;
    err = result.error;
  } catch (e) {
    return NextResponse.json(
      { error: e.message === 'Query timeout' ? 'Database timeout' : e.message },
      { status: 500 }
    );
  }

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

  // Resolve review_ids to source URLs (Trustpilot) for up to 3 links per incident
  const allReviewIds = [...new Set(incidents.flatMap((r) => r.review_ids || []))].filter(Boolean);
  let idToUrl = {};
  if (allReviewIds.length > 0) {
    const { data: reviewRows } = await withQueryGuard(
      supabase.from('trustpilot_reviews').select('id, trustpilot_url').in('id', allReviewIds),
      { context: 'incidents trustpilot_reviews' }
    );
    if (reviewRows?.length) {
      idToUrl = Object.fromEntries(reviewRows.map((row) => [row.id, row.trustpilot_url]));
    }
  }

  const incidentsWithLinks = incidents.map((r) => {
    const ids = Array.isArray(r.review_ids) ? r.review_ids : [];
    const source_links = ids
      .slice(0, 3)
      .map((id) => idToUrl[id])
      .filter(Boolean);
    const { review_ids: _rid, ...rest } = r;
    return { ...rest, source_links };
  });

  log.info({ duration: Date.now() - start, count: incidentsWithLinks.length }, 'API response');
  return NextResponse.json({ incidents: incidentsWithLinks }, { headers });
}
