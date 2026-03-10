/**
 * GET /api/v2/propfirms/[id]/content
 *
 * Returns published firm content items (news, rule changes, promotions).
 * Query params:
 *   - type: filter by content_type (company_news | rule_change | promotion | other)
 *   - limit: max items to return (default 50, max 200)
 *   - days: only return items within last N days (default: all time)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateOrigin, isRateLimited } from '@/lib/apiSecurity';
import { createLogger } from '@/lib/logger';
import { getRequestId, setRequestIdHeader } from '@/middleware/requestId';
import { withQueryGuard } from '@/lib/supabaseQuery';

const VALID_CONTENT_TYPES = new Set(['company_news', 'rule_change', 'promotion', 'other']);

function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function GET(request, { params }) {
  const { id: firmId } = await params;
  const requestId = getRequestId(request);
  const log = createLogger({ requestId, route: '/api/v2/propfirms/[id]/content', firmId });
  const start = Date.now();

  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get('type');
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
  const days = searchParams.get('days') ? Math.max(1, parseInt(searchParams.get('days'), 10) || 0) : null;

  log.info({ method: 'GET', params: { type: typeParam, limit, days } }, 'API request');

  const { ok, headers } = validateOrigin(request);
  setRequestIdHeader(headers, requestId);
  if (!ok) {
    return NextResponse.json({ error: 'Forbidden origin' }, { status: 403, headers });
  }

  const { limited, retryAfterMs } = isRateLimited(request, { limit: 60, windowMs: 60_000 });
  if (limited) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: { ...headers, 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  if (typeParam && !VALID_CONTENT_TYPES.has(typeParam)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${[...VALID_CONTENT_TYPES].join(', ')}` },
      { status: 400, headers }
    );
  }

  const supabase = createSupabaseClient();

  let query = supabase
    .from('firm_content_items')
    .select('id, content_type, title, ai_summary, ai_category, ai_confidence, ai_tags, source_type, source_url, content_date, published_at')
    .eq('firm_id', firmId)
    .eq('published', true)
    .order('content_date', { ascending: false })
    .limit(limit);

  if (typeParam) {
    query = query.eq('content_type', typeParam);
  }

  if (days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    query = query.gte('content_date', cutoff.toISOString().slice(0, 10));
  }

  let rows, err;
  try {
    const result = await withQueryGuard(query, { context: 'firm_content_items' });
    rows = result.data;
    err = result.error;
  } catch (e) {
    return NextResponse.json(
      { error: e.message === 'Query timeout' ? 'Database timeout' : e.message },
      { status: 500, headers }
    );
  }

  if (err) {
    return NextResponse.json({ error: err.message }, { status: 500, headers });
  }

  log.info({ duration: Date.now() - start, count: rows?.length ?? 0 }, 'API response');
  return NextResponse.json({ items: rows ?? [] }, { headers });
}
