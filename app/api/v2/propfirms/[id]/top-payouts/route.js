/**
 * Top Payouts API
 * 
 * PP2-010: GET /api/v2/propfirms/[id]/top-payouts
 * 
 * Returns the top 10 largest single payouts for the selected period.
 * Uses JSON files for historical data.
 *
 * Note: We currently only surface Rise payouts in this endpoint/UI.
 * 
 * Query params:
 *   - period: 30d, 12m (default: 30d)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getTopPayoutsFromFiles } from '@/lib/services/payoutDataLoader';
import { validateOrigin, isRateLimited } from '@/lib/apiSecurity';
import { createLogger } from '@/lib/logger';
import { getRequestId, setRequestIdHeader } from '@/middleware/requestId';

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
  const log = createLogger({ requestId, route: '/api/v2/propfirms/[id]/top-payouts', firmId });
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

    // Get top payouts from JSON files (Rise only)
    const payouts = getTopPayoutsFromFiles(firmId, period, 5000)
      .filter(p => p.paymentMethod === 'rise')
      .slice(0, 10);

    log.info({ duration: Date.now() - start, count: payouts.length }, 'API response');
    return NextResponse.json(
      {
        firmId,
        period,
        payouts,
      },
      { headers }
    );
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
