/**
 * Top Payouts API
 * 
 * PP2-010: GET /api/v2/propfirms/[id]/top-payouts
 * 
 * Returns the top 10 largest single payouts for the selected period.
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

    // Verify firm exists
    const { data: firm, error: firmError } = await supabase
      .from('firms')
      .select('id')
      .eq('id', firmId)
      .single();

    if (firmError || !firm) {
      return NextResponse.json(
        { error: 'Firm not found' },
        { status: 404 }
      );
    }

    // Calculate date range
    const daysBack = period === '30d' ? 30 : 365;
    const cutoffDate = new Date(Date.now() - (daysBack * 24 * 60 * 60 * 1000)).toISOString();

    // Fetch top 10 payouts by amount
    const { data: payouts, error: payoutsError } = await supabase
      .from('recent_payouts')
      .select('tx_hash, amount, payment_method, timestamp')
      .eq('firm_id', firmId)
      .gte('timestamp', cutoffDate)
      .order('amount', { ascending: false })
      .limit(10);

    if (payoutsError) {
      throw new Error(`Failed to fetch payouts: ${payoutsError.message}`);
    }

    // Format response
    const formattedPayouts = payouts.map(p => ({
      id: p.tx_hash,
      date: new Date(p.timestamp).toISOString().split('T')[0],
      amount: Math.round(parseFloat(p.amount)),
      paymentMethod: p.payment_method,
      txHash: p.tx_hash,
      arbiscanUrl: `https://arbiscan.io/tx/${p.tx_hash}`,
    }));

    return NextResponse.json({
      firmId,
      period,
      payouts: formattedPayouts,
    });

  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
