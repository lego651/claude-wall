/**
 * Firm Chart Data API
 * 
 * PP2-009: GET /api/v2/propfirms/[id]/chart
 * 
 * Returns chart data and summary statistics for a specific firm.
 * 
 * Query params:
 *   - period: 30d, 12m (default: 30d)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

  try {
    const supabase = createSupabaseClient();

    // Fetch firm metadata
    const { data: firm, error: firmError } = await supabase
      .from('firms')
      .select('id, name, logo, website, last_payout_at')
      .eq('id', firmId)
      .single();

    if (firmError || !firm) {
      return NextResponse.json(
        { error: 'Firm not found' },
        { status: 404 }
      );
    }

    // Calculate date range
    const now = new Date();
    const daysBack = period === '30d' ? 30 : 365;
    const cutoffDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000)).toISOString();

    // Fetch payouts for this firm
    const { data: payouts, error: payoutsError } = await supabase
      .from('recent_payouts')
      .select('amount, payment_method, timestamp')
      .eq('firm_id', firmId)
      .gte('timestamp', cutoffDate)
      .order('timestamp', { ascending: true });

    if (payoutsError) {
      throw new Error(`Failed to fetch payouts: ${payoutsError.message}`);
    }

    // Calculate summary stats
    const summary = {
      totalPayouts: 0,
      payoutCount: payouts.length,
      largestPayout: 0,
      avgPayout: 0,
      latestPayoutAt: firm.last_payout_at,
    };

    for (const payout of payouts) {
      const amount = parseFloat(payout.amount);
      summary.totalPayouts += amount;
      summary.largestPayout = Math.max(summary.largestPayout, amount);
    }

    summary.totalPayouts = Math.round(summary.totalPayouts);
    summary.largestPayout = Math.round(summary.largestPayout);
    summary.avgPayout = summary.payoutCount > 0 
      ? Math.round(summary.totalPayouts / summary.payoutCount) 
      : 0;

    // Build chart data
    let chartData;
    let bucketType;

    if (period === '30d') {
      // Daily buckets for 30 days
      bucketType = 'daily';
      chartData = buildDailyBuckets(payouts, 30);
    } else {
      // Monthly buckets for 12 months
      bucketType = 'monthly';
      chartData = buildMonthlyBuckets(payouts, 12);
    }

    return NextResponse.json({
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
      // Note about data limitations
      dataLimitation: 'Data limited to last 24h (JSON archives not yet implemented)',
    });

  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Build daily buckets for chart
 */
function buildDailyBuckets(payouts, days) {
  const buckets = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const dayPayouts = payouts.filter(p => {
      const pDate = new Date(p.timestamp).toISOString().split('T')[0];
      return pDate === dateStr;
    });

    const bucket = {
      date: dateStr,
      total: 0,
      rise: 0,
      crypto: 0,
      wire: 0,
    };

    for (const p of dayPayouts) {
      const amount = parseFloat(p.amount);
      bucket.total += amount;
      
      if (p.payment_method === 'rise') {
        bucket.rise += amount;
      } else if (p.payment_method === 'crypto') {
        bucket.crypto += amount;
      } else if (p.payment_method === 'wire') {
        bucket.wire += amount;
      }
    }

    // Round values
    bucket.total = Math.round(bucket.total);
    bucket.rise = Math.round(bucket.rise);
    bucket.crypto = Math.round(bucket.crypto);
    bucket.wire = Math.round(bucket.wire);

    buckets.push(bucket);
  }

  return buckets;
}

/**
 * Build monthly buckets for chart
 */
function buildMonthlyBuckets(payouts, months) {
  const buckets = [];
  const now = new Date();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthLabel = `${monthNames[month]} ${year}`;

    const monthPayouts = payouts.filter(p => {
      const pDate = new Date(p.timestamp);
      return pDate.getFullYear() === year && pDate.getMonth() === month;
    });

    const bucket = {
      month: monthLabel,
      total: 0,
      rise: 0,
      crypto: 0,
      wire: 0,
    };

    for (const p of monthPayouts) {
      const amount = parseFloat(p.amount);
      bucket.total += amount;
      
      if (p.payment_method === 'rise') {
        bucket.rise += amount;
      } else if (p.payment_method === 'crypto') {
        bucket.crypto += amount;
      } else if (p.payment_method === 'wire') {
        bucket.wire += amount;
      }
    }

    // Round values
    bucket.total = Math.round(bucket.total);
    bucket.rise = Math.round(bucket.rise);
    bucket.crypto = Math.round(bucket.crypto);
    bucket.wire = Math.round(bucket.wire);

    buckets.push(bucket);
  }

  return buckets;
}
