/**
 * Latest Payouts API
 * 
 * PP2-011: GET /api/v2/propfirms/[id]/latest-payouts
 * 
 * Returns the 20 most recent payouts in real-time.
 * No period filter - always returns from Supabase (last 24h).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function GET(request, { params }) {
  const { id: firmId } = await params;

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

    // Fetch latest 20 payouts
    const { data: payouts, error: payoutsError } = await supabase
      .from('recent_payouts')
      .select('tx_hash, amount, payment_method, timestamp')
      .eq('firm_id', firmId)
      .order('timestamp', { ascending: false })
      .limit(20);

    if (payoutsError) {
      throw new Error(`Failed to fetch payouts: ${payoutsError.message}`);
    }

    // Format response
    const formattedPayouts = payouts.map(p => ({
      id: p.tx_hash,
      timestamp: p.timestamp,
      amount: Math.round(parseFloat(p.amount)),
      paymentMethod: p.payment_method,
      txHash: p.tx_hash,
      arbiscanUrl: `https://arbiscan.io/tx/${p.tx_hash}`,
    }));

    return NextResponse.json({
      firmId,
      payouts: formattedPayouts,
      count: formattedPayouts.length,
    });

  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
