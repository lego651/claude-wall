/**
 * Cron endpoint for syncing payout data
 * 
 * PP2-005: Vercel Cron Endpoint
 * 
 * This endpoint is called every 10 minutes by Vercel Cron.
 * It fetches transactions from Arbiscan and updates Supabase.
 * 
 * Security: Protected by CRON_SECRET header verification.
 */

import { NextResponse } from 'next/server';
import { syncAllFirms } from '@/lib/services/payoutSyncService';

export const maxDuration = 60; // Allow up to 60 seconds (Vercel Pro)
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const startTime = Date.now();

  // Verify cron secret (Vercel sends this automatically)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // In production, require CRON_SECRET
  if (process.env.NODE_ENV === 'production' && cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.log('[Cron] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log('[Cron] Starting scheduled sync...');

  try {
    // Run the sync
    const result = await syncAllFirms();

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      ...result,
    };

    console.log('[Cron] Sync complete:', response);

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Cron] Sync failed:', error);

    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
    }, { status: 500 });
  }
}
