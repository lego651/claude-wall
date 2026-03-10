/**
 * Cron endpoint: Ingest firm emails from Gmail
 *
 * Fetches new Gmail messages, categorizes with AI, stores in firm_content_items.
 * Runs every 15 minutes via Vercel cron (configure in vercel.json).
 *
 * Security: Protected by CRON_SECRET header (Bearer token).
 */

import { NextResponse } from 'next/server';
import { ingestFirmEmails } from '@/lib/gmail/ingest';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const startTime = Date.now();

  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV === 'production' && cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.log('[Cron ingest-firm-emails] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log('[Cron ingest-firm-emails] Starting...');

  try {
    const result = await ingestFirmEmails();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      ...result,
    });
  } catch (error) {
    console.error('[Cron ingest-firm-emails] Failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
