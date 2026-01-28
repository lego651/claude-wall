/**
 * Latest Payouts API
 * 
 * PP2-011: GET /api/v2/propfirms/[id]/latest-payouts
 * 
 * Returns all payouts in the last 24 hours (real-time).
 * Always returns from Supabase (rolling window).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateOrigin, isRateLimited } from '@/lib/apiSecurity';

function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function GET(request, { params }) {
  const { id: firmId } = await params;

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

    // Verify firm exists
    const { data: firm, error: firmError } = await supabase
      .from('firms')
      .select('id')
      .eq('id', firmId)
      .single();

    if (firmError || !firm) {
      return NextResponse.json(
        { error: 'Firm not found' },
        { status: 404, headers }
      );
    }

    // Fetch all payouts from the last 24 hours
    const cutoffDate = new Date(Date.now() - (24 * 60 * 60 * 1000)).toISOString();
    const { data: payouts, error: payoutsError } = await supabase
      .from('recent_payouts')
      .select('tx_hash, amount, payment_method, timestamp')
      .eq('firm_id', firmId)
      .gte('timestamp', cutoffDate)
      .order('timestamp', { ascending: false })
      ;

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

    return NextResponse.json(
      {
        firmId,
        payouts: formattedPayouts,
        count: formattedPayouts.length,
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
