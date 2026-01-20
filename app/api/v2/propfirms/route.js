/**
 * List Prop Firms API
 * 
 * PP2-008: GET /api/v2/propfirms
 * 
 * Returns all prop firms with aggregated metrics for the selected period.
 * 
 * Query params:
 *   - period: 1d, 7d, 30d, 12m (default: 1d)
 *   - sort: totalPayouts, payoutCount, largestPayout, avgPayout, latestPayout (default: totalPayouts)
 *   - order: asc, desc (default: desc)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

  try {
    const supabase = createSupabaseClient();
    
    // Calculate cutoff time
    const hoursBack = periodToHours(period);
    const cutoffDate = new Date(Date.now() - (hoursBack * 60 * 60 * 1000)).toISOString();

    // Fetch all firms with their metadata
    const { data: firms, error: firmsError } = await supabase
      .from('firms')
      .select('id, name, logo, website, last_payout_at');

    if (firmsError) {
      throw new Error(`Failed to fetch firms: ${firmsError.message}`);
    }

    // Fetch aggregated metrics for each firm from recent_payouts
    // Note: For 30d/12m, this only has 24h of data until JSON archives are implemented
    const { data: payouts, error: payoutsError } = await supabase
      .from('recent_payouts')
      .select('firm_id, amount, timestamp')
      .gte('timestamp', cutoffDate);

    if (payoutsError) {
      throw new Error(`Failed to fetch payouts: ${payoutsError.message}`);
    }

    // Aggregate metrics by firm
    const firmMetrics = {};
    for (const payout of payouts) {
      if (!firmMetrics[payout.firm_id]) {
        firmMetrics[payout.firm_id] = {
          totalPayouts: 0,
          payoutCount: 0,
          largestPayout: 0,
          payoutAmounts: [],
        };
      }
      const metrics = firmMetrics[payout.firm_id];
      const amount = parseFloat(payout.amount);
      
      metrics.totalPayouts += amount;
      metrics.payoutCount += 1;
      metrics.largestPayout = Math.max(metrics.largestPayout, amount);
      metrics.payoutAmounts.push(amount);
    }

    // Build response data
    const data = firms.map(firm => {
      const metrics = firmMetrics[firm.id] || {
        totalPayouts: 0,
        payoutCount: 0,
        largestPayout: 0,
        payoutAmounts: [],
      };

      const avgPayout = metrics.payoutCount > 0 
        ? Math.round(metrics.totalPayouts / metrics.payoutCount) 
        : 0;

      return {
        id: firm.id,
        name: firm.name,
        logo: firm.logo,
        website: firm.website,
        metrics: {
          totalPayouts: Math.round(metrics.totalPayouts),
          payoutCount: metrics.payoutCount,
          largestPayout: Math.round(metrics.largestPayout),
          avgPayout,
          latestPayoutAt: firm.last_payout_at,
        },
      };
    });

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

    return NextResponse.json({
      data,
      meta: {
        period,
        sort,
        order,
        count: data.length,
        // Note: For periods > 24h, data is limited until JSON archives are implemented
        dataLimitation: hoursBack > 24 ? 'Data limited to last 24h (JSON archives not yet implemented)' : null,
      },
    });

  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
