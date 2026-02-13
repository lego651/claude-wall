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
import { createLogger } from '@/lib/logger';
import { getRequestId, setRequestIdHeader } from '@/middleware/requestId';
import { withQueryGuard } from '@/lib/supabaseQuery';
import { validateLatestPayoutsResponse } from '@/lib/schemas/propfirms';

function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function GET(request, { params }) {
  const { id: firmId } = await params;
  const requestId = getRequestId(request);
  const log = createLogger({ requestId, route: '/api/v2/propfirms/[id]/latest-payouts', firmId });
  const start = Date.now();

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

    // Verify firm exists
    const { data: firm, error: firmError } = await withQueryGuard(
      supabase.from('firms').select('id').eq('id', firmId).single(),
      { context: 'latest-payouts firms' }
    );

    if (firmError || !firm) {
      return NextResponse.json(
        { error: 'Firm not found' },
        { status: 404, headers }
      );
    }

    // Fetch all payouts from the last 24 hours
    const cutoffDate = new Date(Date.now() - (24 * 60 * 60 * 1000)).toISOString();
    const { data: payouts, error: payoutsError } = await withQueryGuard(
      supabase
        .from('recent_payouts')
        .select('tx_hash, amount, payment_method, timestamp')
        .eq('firm_id', firmId)
        .gte('timestamp', cutoffDate)
        .order('timestamp', { ascending: false }),
      { context: 'latest-payouts recent_payouts' }
    );

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

    const body = {
      firmId,
      payouts: formattedPayouts,
      count: formattedPayouts.length,
    };
    const validated = validateLatestPayoutsResponse(body);
    if (!validated) {
      return NextResponse.json(
        { error: 'Response validation failed' },
        { status: 500, headers }
      );
    }
    log.info({ duration: Date.now() - start, count: validated.payouts.length }, 'API response');
    return NextResponse.json(validated, { headers });
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
