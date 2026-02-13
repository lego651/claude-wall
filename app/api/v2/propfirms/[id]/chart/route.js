/**
 * Firm Chart Data API
 * 
 * PP2-009: GET /api/v2/propfirms/[id]/chart
 * 
 * Returns chart data and summary statistics for a specific firm.
 * Uses Supabase for firm metadata. Uses JSON files for historical data (30d, 12m).
 * 
 * Query params:
 *   - period: 30d, 12m (default: 30d)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { loadPeriodData } from '@/lib/services/payoutDataLoader';
import { validateOrigin, isRateLimited } from '@/lib/apiSecurity';
import { createLogger } from '@/lib/logger';
import { getRequestId, setRequestIdHeader } from '@/middleware/requestId';
import { cache } from '@/lib/cache';

const VALID_PERIODS = ['30d', '12m'];

function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function GET(request, { params }) {
  const { id: firmId } = await params;
  const requestId = getRequestId(request);
  const log = createLogger({ requestId, route: '/api/v2/propfirms/[id]/chart', firmId });
  const start = Date.now();
  const { searchParams } = new URL(request.url);

  const period = VALID_PERIODS.includes(searchParams.get('period'))
    ? searchParams.get('period')
    : '30d';

  log.info({ method: 'GET', params: { period } }, 'API request');

  const { ok, headers } = validateOrigin(request);
  setRequestIdHeader(headers, requestId);
  if (!ok) {
    return NextResponse.json(
      { error: 'Forbidden origin' },
      { status: 403, headers }
    );
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

  try {
    const supabase = createSupabaseClient();

    const { data: firm, error: firmError } = await supabase
      .from('firms')
      .select('id, name, logo, website, last_payout_at')
      .eq('id', firmId)
      .single();

    if (firmError || !firm) {
      return NextResponse.json(
        { error: 'Firm not found' },
        { status: 404, headers }
      );
    }

    const chartCacheKey = `chart:${firmId}:${period}`;
    const cached = await cache.get(chartCacheKey);
    if (cached) {
      log.info({ cache: 'hit', key: chartCacheKey }, 'API response');
      return NextResponse.json(cached, { headers });
    }

    const historicalData = await loadPeriodData(firmId, period);

    let chartData;
    let bucketType;
    let summary;

    if (period === '30d') {
      bucketType = 'daily';
      chartData = historicalData.dailyBuckets || [];
      summary = historicalData.summary || {};
      chartData = fillDailyGaps(chartData, 30);
    } else {
      bucketType = 'monthly';
      chartData = historicalData.monthlyBuckets || [];
      summary = historicalData.summary || {};
    }

    summary.latestPayoutAt = firm.last_payout_at;
    summary.totalPayouts = Math.round(summary.totalPayouts || 0);
    summary.largestPayout = Math.round(summary.largestPayout || 0);
    const payoutCount = summary.payoutCount || 0;
    const avgPayout =
      typeof summary.avgPayout === 'number'
        ? summary.avgPayout
        : payoutCount > 0
          ? summary.totalPayouts / payoutCount
          : 0;
    summary.avgPayout = Math.round(avgPayout);

    const body = {
      firm: {
        id: firm.id,
        name: firm.name,
        logo: firm.logo,
        website: firm.website,
      },
      summary,
      chart: {
        period,
        bucketType,
        data: chartData,
      },
    };
    await cache.set(chartCacheKey, body, 600);
    return NextResponse.json(body, { headers });

  } catch (error) {
    log.error(
      { error: error.message, stack: error.stack, duration: Date.now() - start },
      'API error'
    );
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers }
    );
  }
}

/**
 * Fill gaps in daily buckets with zero values
 */
function fillDailyGaps(buckets, days) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const bucketMap = new Map(buckets.map(b => [b.date, b]));
  const result = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    if (bucketMap.has(dateStr)) {
      result.push(bucketMap.get(dateStr));
    } else {
      result.push({
        date: dateStr,
        total: 0,
        rise: 0,
        crypto: 0,
        wire: 0,
      });
    }
  }

  return result;
}
