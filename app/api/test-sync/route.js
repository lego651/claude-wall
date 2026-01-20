/**
 * Test endpoint for sync service
 * 
 * GET /api/test-sync - Test Supabase connection and list firms
 * GET /api/test-sync?run=true - Actually run the sync
 * 
 * DELETE THIS FILE after testing!
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncAllFirms } from '@/lib/services/payoutSyncService';

export async function GET(request) {
  const url = new URL(request.url);
  const runSync = url.searchParams.get('run') === 'true';
  
  console.log('[Test] URL:', request.url);
  console.log('[Test] runSync:', runSync);

  // Step 1: Check environment variables
  const envCheck = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    ARBISCAN_API_KEY: !!process.env.ARBISCAN_API_KEY,
  };

  const missingEnvVars = Object.entries(envCheck)
    .filter(([, exists]) => !exists)
    .map(([key]) => key);

  if (missingEnvVars.length > 0) {
    return NextResponse.json({
      status: 'error',
      message: 'Missing environment variables',
      missing: missingEnvVars,
    }, { status: 500 });
  }

  // Step 2: Test Supabase connection
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Fetch firms
    const { data: firms, error } = await supabase
      .from('firms')
      .select('id, name, addresses, last_payout_at, last_synced_at');

    if (error) {
      return NextResponse.json({
        status: 'error',
        message: 'Supabase query failed',
        error: error.message,
      }, { status: 500 });
    }

    // If not running sync, just return connection test results
    if (!runSync) {
      return NextResponse.json({
        status: 'success',
        message: 'Connection test passed! Add ?run=true to run sync.',
        debug: { url: request.url, runSync },
        envVars: envCheck,
        firms: firms.map(f => ({
          id: f.id,
          name: f.name,
          addressCount: f.addresses?.length || 0,
          lastPayoutAt: f.last_payout_at,
          lastSyncedAt: f.last_synced_at,
        })),
      });
    }

    // Step 3: Run actual sync
    console.log('[Test] Running sync...');
    const syncResult = await syncAllFirms();

    // Fetch updated firms
    const { data: updatedFirms } = await supabase
      .from('firms')
      .select('id, name, last_payout_at, last_payout_amount, last_synced_at');

    // Fetch recent payouts count
    const { count: payoutCount } = await supabase
      .from('recent_payouts')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      status: 'success',
      message: 'Sync completed!',
      syncResult,
      firms: updatedFirms,
      recentPayoutsInDb: payoutCount,
    });

  } catch (error) {
    console.error('[Test] Error:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 });
  }
}
