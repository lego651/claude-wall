/**
 * Firm Chart Data API
 * 
 * PP2-009: GET /api/v2/propfirms/[id]/chart
 * 
 * Returns chart data and summary statistics for a specific firm.
 * Uses JSON files for historical data (30d, 12m).
 * 
 * Query params:
 *   - period: 30d, 12m (default: 30d)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { loadPeriodData } from '@/lib/services/payoutDataLoader';
import { validateOrigin, isRateLimited } from '@/lib/apiSecurity';

const VALID_PERIODS = ['30d', '12m'];

function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function GET(request, { params }) {
  const { id: firmId } = await params;
  const { searchParams } = new URL(request.url);
  
  const period = VALID_PERIODS.includes(searchParams.get('period')) 
    ? searchParams.get('period') 
    : '30d';

  const { ok, headers } = validateOrigin(request);
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

    // Fetch firm metadata from Supabase
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

    // Load historical data from JSON files
    const historicalData = loadPeriodData(firmId, period);

    // Build response
    let chartData;
    let bucketType;
    let summary;

    if (period === '30d') {
      bucketType = 'daily';
      chartData = historicalData.dailyBuckets || [];
      summary = historicalData.summary || {};
      
      // Ensure we have 30 days of data (fill gaps with zeros)
      chartData = fillDailyGaps(chartData, 30);
    } else {
      bucketType = 'monthly';
      chartData = historicalData.monthlyBuckets || [];
      summary = historicalData.summary || {};
    }

    // Add latest payout timestamp from Supabase (always fresh)
    summary.latestPayoutAt = firm.last_payout_at;
    summary.totalPayouts = Math.round(summary.totalPayouts || 0);
    summary.largestPayout = Math.round(summary.largestPayout || 0);
    // Ensure avgPayout is always present (API-level computation)
    const payoutCount = summary.payoutCount || 0;
    const avgPayout =
      typeof summary.avgPayout === 'number'
        ? summary.avgPayout
        : payoutCount > 0
          ? summary.totalPayouts / payoutCount
          : 0;
    summary.avgPayout = Math.round(avgPayout);

    return NextResponse.json(
      {
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
      },
      { headers }
    );

  } catch (error) {
    console.error('[API] Error:', error);
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
