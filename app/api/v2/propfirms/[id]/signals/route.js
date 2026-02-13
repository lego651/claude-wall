/**
 * GET /api/v2/propfirms/[id]/signals
 *
 * Returns firm signals for the last N days: payout summary + Trustpilot aggregate (review count, sentiment).
 * Query: days (default 30). API-only; no UI.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { loadPeriodData } from '@/lib/services/payoutDataLoader';
import { validateOrigin, isRateLimited } from '@/lib/apiSecurity';
import { createLogger } from '@/lib/logger';
import { getRequestId, setRequestIdHeader } from '@/middleware/requestId';

function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

const POSITIVE_CATEGORIES = ['positive_experience', 'positive'];
const NEUTRAL_CATEGORIES = ['neutral_mixed', 'neutral'];
const NEGATIVE_CATEGORIES = [
  'payout_delay', 'payout_denied', 'kyc_withdrawal_issue', 'platform_technical_issue',
  'support_issue', 'rules_dispute', 'pricing_fee_complaint', 'execution_conditions',
  'high_risk_allegation',
  'payout_issue', 'scam_warning', 'platform_issue', 'rule_violation',
];

export async function GET(request, { params }) {
  const { id: firmId } = await params;
  const requestId = getRequestId(request);
  const log = createLogger({ requestId, route: '/api/v2/propfirms/[id]/signals', firmId });
  const start = Date.now();
  const { searchParams } = new URL(request.url);
  const days = Math.min(365, Math.max(1, parseInt(searchParams.get('days') || '30', 10) || 30));

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

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  try {
    const supabase = createSupabaseClient();

    const { data: firm, error: firmError } = await supabase
      .from('firms')
      .select('id, name')
      .eq('id', firmId)
      .single();

    if (firmError || !firm) {
      return NextResponse.json({ error: 'Firm not found' }, { status: 404, headers });
    }

    const historical = loadPeriodData(firmId, '30d');
    const summary = historical?.summary || {};
    const payout = {
      totalPayouts: Math.round(summary.totalPayouts || 0),
      payoutCount: summary.payoutCount || 0,
      largestPayout: Math.round(summary.largestPayout || 0),
      avgPayout: summary.payoutCount > 0
        ? Math.round((summary.totalPayouts || 0) / summary.payoutCount)
        : 0,
    };

    const { data: reviews, error: revError } = await supabase
      .from('trustpilot_reviews')
      .select('category')
      .eq('firm_id', firmId)
      .gte('review_date', cutoffStr);

    if (revError) {
      return NextResponse.json({ error: revError.message }, { status: 500 });
    }

    let positive = 0;
    let neutral = 0;
    let negative = 0;
    (reviews || []).forEach((r) => {
      const c = r.category || '';
      if (POSITIVE_CATEGORIES.includes(c)) positive++;
      else if (NEUTRAL_CATEGORIES.includes(c)) neutral++;
      else if (NEGATIVE_CATEGORIES.includes(c)) negative++;
    });

    const trustpilot = {
      reviewCount: (reviews || []).length,
      sentiment: { positive, neutral, negative },
    };

    log.info({ duration: Date.now() - start }, 'API response');
    return NextResponse.json(
      {
        firm_id: firmId,
        firm_name: firm.name,
        days,
        payout,
        trustpilot,
      },
      { headers }
    );
  } catch (e) {
    log.error(
      { error: e?.message, stack: e?.stack, duration: Date.now() - start },
      'API error'
    );
    return NextResponse.json(
      { error: e?.message || 'Internal error' },
      { status: 500, headers }
    );
  }
}
