/**
 * List Prop Firms API
 * 
 * PP2-008: GET /api/v2/propfirms
 * 
 * Returns all prop firms with aggregated metrics for the selected period.
 * Uses Supabase for real-time data (1d) and JSON files for historical (7d, 30d, 12m).
 * 
 * Query params:
 *   - period: 1d, 7d, 30d, 12m (default: 1d)
 *   - sort: totalPayouts, payoutCount, largestPayout, avgPayout, latestPayout (default: totalPayouts)
 *   - order: asc, desc (default: desc)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { loadPeriodData } from '@/lib/services/payoutDataLoader';
import { validateOrigin, isRateLimited } from '@/lib/apiSecurity';

// Valid options
const VALID_PERIODS = ['1d', '7d', '30d', '12m'];
const VALID_SORT_FIELDS = ['totalPayouts', 'payoutCount', 'largestPayout', 'avgPayout', 'latestPayout'];
const VALID_ORDERS = ['asc', 'desc'];

// Create Supabase client (read-only, uses anon key)
function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// Convert period string to hours
function periodToHours(period) {
  switch (period) {
    case '1d': return 24;
    case '7d': return 24 * 7;
    case '30d': return 24 * 30;
    case '12m': return 24 * 365;
    default: return 24;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  
  // Parse and validate query params
  const period = VALID_PERIODS.includes(searchParams.get('period')) 
    ? searchParams.get('period') 
    : '1d';
  const sort = VALID_SORT_FIELDS.includes(searchParams.get('sort')) 
    ? searchParams.get('sort') 
    : 'totalPayouts';
  const order = VALID_ORDERS.includes(searchParams.get('order')) 
    ? searchParams.get('order') 
    : 'desc';

  const { ok, headers } = validateOrigin(request);
  if (!ok) {
    return NextResponse.json(
      { error: 'Forbidden origin' },
      { status: 403, headers }
    );
  }

  const { limited, retryAfterMs } = isRateLimited(request, {
    limit: 60, // ~60 requests per minute per IP
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

    // Fetch all firms with their metadata
    const { data: firms, error: firmsError } = await supabase
      .from('firms')
      .select('id, name, logo, website, last_payout_at');

    if (firmsError) {
      throw new Error(`Failed to fetch firms: ${firmsError.message}`);
    }

    if (!firms || firms.length === 0) {
      return NextResponse.json(
        {
          data: [],
          meta: {
            period,
            sort,
            order,
            count: 0,
          },
        },
        { headers }
      );
    }

    // For real-time metrics, batch-load payouts for all firms (avoid N+1 queries)
    let payoutsByFirmId = null;
    if (period === '1d') {
      const hoursBack = periodToHours(period);
      const cutoffDate = new Date(Date.now() - (hoursBack * 60 * 60 * 1000)).toISOString();
      const firmIds = firms.map(f => f.id);

      const { data: payoutsRows, error: payoutsError } = await supabase
        .from('recent_payouts')
        .select('firm_id, amount')
        .in('firm_id', firmIds)
        .gte('timestamp', cutoffDate);

      if (payoutsError) {
        throw new Error(`Failed to fetch payouts: ${payoutsError.message}`);
      }

      payoutsByFirmId = new Map();
      for (const row of payoutsRows || []) {
        const firmId = row.firm_id;
        const amount = Number(row.amount);
        if (!firmId || !Number.isFinite(amount)) continue;

        if (!payoutsByFirmId.has(firmId)) {
          payoutsByFirmId.set(firmId, []);
        }
        payoutsByFirmId.get(firmId).push(amount);
      }
    }

    // Build response data
    const data = [];

    for (const firm of firms) {
      let metrics;

      if (period === '1d') {
        // Use Supabase for real-time data (last 24h only)
        const amounts = payoutsByFirmId?.get(firm.id) || [];
        const totalPayouts = amounts.reduce((sum, a) => sum + a, 0);
        const largestPayout = amounts.length > 0 ? Math.max(...amounts) : 0;

        metrics = {
          totalPayouts: Math.round(totalPayouts),
          payoutCount: amounts.length,
          largestPayout: Math.round(largestPayout),
          avgPayout: amounts.length > 0 ? Math.round(totalPayouts / amounts.length) : 0,
          latestPayoutAt: firm.last_payout_at,
        };
      } else {
        // Use JSON files for historical data (7d, 30d, 12m)
        const historicalData = loadPeriodData(firm.id, period);
        
        metrics = {
          totalPayouts: Math.round(historicalData.summary?.totalPayouts || 0),
          payoutCount: historicalData.summary?.payoutCount || 0,
          largestPayout: Math.round(historicalData.summary?.largestPayout || 0),
          avgPayout: Math.round(historicalData.summary?.avgPayout || 0),
          latestPayoutAt: firm.last_payout_at,
        };
      }

      data.push({
        id: firm.id,
        name: firm.name,
        logo: firm.logo,
        website: firm.website,
        metrics,
      });
    }

    // Sort the data
    data.sort((a, b) => {
      let aVal, bVal;
      
      if (sort === 'latestPayout') {
        aVal = a.metrics.latestPayoutAt ? new Date(a.metrics.latestPayoutAt).getTime() : 0;
        bVal = b.metrics.latestPayoutAt ? new Date(b.metrics.latestPayoutAt).getTime() : 0;
      } else {
        aVal = a.metrics[sort] || 0;
        bVal = b.metrics[sort] || 0;
      }

      return order === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return NextResponse.json(
      {
        data,
        meta: {
          period,
          sort,
          order,
          count: data.length,
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
