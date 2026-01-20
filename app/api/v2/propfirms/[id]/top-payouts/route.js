/**
 * Top Payouts API
 * 
 * PP2-010: GET /api/v2/propfirms/[id]/top-payouts
 * 
 * Returns the top 10 largest single payouts for the selected period.
 * Uses JSON files for historical data.
 * 
 * Query params:
 *   - period: 30d, 12m (default: 30d)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getTopPayoutsFromFiles } from '@/lib/services/payoutDataLoader';

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

    // Get top payouts from JSON files
    const payouts = getTopPayoutsFromFiles(firmId, period, 10);

    return NextResponse.json({
      firmId,
      period,
      payouts,
    });

  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
