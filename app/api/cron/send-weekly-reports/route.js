/**
 * TICKET-004: Weekly Email Reports API Route
 * Cron endpoint invoked by GitHub Actions (weekly-step2-send-firm-weekly-reports.yml) every Sunday 8:00 UTC.
 * Queries user_subscriptions, fetches firm_weekly_reports for each user's firms, sends one digest email per user.
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendWeeklyDigest } from '@/lib/email/send-digest';
import { getCurrentWeekUtc } from '@/lib/digest/week-utils';

const CRON_JOB_NAME = 'send_weekly_reports';

/** Persist last run result for admin dashboard metrics. */
async function persistCronLastRun(supabase, result) {
  try {
    await supabase.from('cron_last_run').upsert(
      {
        job_name: CRON_JOB_NAME,
        last_run_at: new Date().toISOString(),
        result_json: {
          sent: result.sent,
          failed: result.failed,
          skipped: result.skipped,
          errors: Array.isArray(result.errors) ? result.errors.slice(0, 20) : [],
          weekStart: result.weekStart,
          weekEnd: result.weekEnd,
          durationMs: result.durationMs,
        },
      },
      { onConflict: 'job_name' }
    );
  } catch (e) {
    console.error('[send-weekly-reports] persistCronLastRun', e);
  }
}

export const maxDuration = 300; // 5 min for many users
export const dynamic = 'force-dynamic';

/** Current week (Mon–Sun) in UTC. Cron runs Sunday 8:00 UTC; we send the report for this week. */
function getCurrentWeekUtcIso() {
  const { weekStart, weekEnd } = getCurrentWeekUtc();
  return {
    weekStartIso: weekStart.toISOString().slice(0, 10),
    weekEndIso: weekEnd.toISOString().slice(0, 10),
  };
}

export async function GET(request) {
  const startTime = Date.now();

  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const baseUrl =
    process.env.SITE_URL ||
    process.env.VERCEL_URL?.startsWith('http')
      ? process.env.VERCEL_URL
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';

  try {
    const supabase = createServiceClient();
    const { weekStartIso, weekEndIso } = getCurrentWeekUtcIso();

    // Active subscriptions: user_id, firm_id, email (email_enabled = true)
    // Note: email column added in migration 23 for performance (no JOIN with profiles needed)
    const { data: rows, error: subsError } = await supabase
      .from('user_subscriptions')
      .select('user_id, firm_id, email')
      .eq('email_enabled', true);

    if (subsError) {
      console.error('[send-weekly-reports] subscriptions', subsError);
      return NextResponse.json(
        { error: 'Failed to fetch subscriptions', detail: subsError.message },
        { status: 500 }
      );
    }

    if (!rows?.length) {
      const result = { sent: 0, failed: 0, skipped: 0, errors: [], message: 'No active subscribers', durationMs: Date.now() - startTime };
      await persistCronLastRun(supabase, result);
      return NextResponse.json(result);
    }

    // Group by user_id -> { email, firm_ids[] }
    const byUser = new Map();
    for (const r of rows) {
      const uid = r.user_id;
      if (!byUser.has(uid)) {
        byUser.set(uid, { email: r.email?.trim(), firmIds: [] });
      }
      byUser.get(uid).firmIds.push(r.firm_id);
    }

    // Fetch firm_weekly_reports for current week (week_from_date / week_to_date) for all firms we need
    const firmIds = [...new Set(rows.map((r) => r.firm_id))];
    const { data: reportsRows, error: reportsError } = await supabase
      .from('firm_weekly_reports')
      .select('firm_id, report_json')
      .in('firm_id', firmIds)
      .eq('week_from_date', weekStartIso)
      .eq('week_to_date', weekEndIso);

    if (reportsError) {
      console.error('[send-weekly-reports] firm_weekly_reports', reportsError);
      return NextResponse.json(
        { error: 'Failed to fetch weekly reports', detail: reportsError.message },
        { status: 500 }
      );
    }

    const reportsByFirm = new Map((reportsRows || []).map((r) => [r.firm_id, r.report_json]));

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const errors = [];

    // Resend free tier: 2 requests/second. Add 600ms delay between emails.
    const RATE_LIMIT_DELAY_MS = 600;

    for (const [userId, userData] of byUser) {
      const { email, firmIds } = userData;
      if (!email) {
        errors.push(`${userId}: no email in subscription`);
        failed += 1;
        continue;
      }

      const reports = firmIds
        .map((fid) => reportsByFirm.get(fid))
        .filter(Boolean);

      if (reports.length === 0) {
        skipped += 1;
        continue;
      }

      const result = await sendWeeklyDigest(
        { id: userId, email },
        reports,
        {
          weekStart: weekStartIso,
          weekEnd: weekEndIso,
          baseUrl,
        }
      );

      if (result.ok) {
        sent += 1;
        // Rate limit: wait 600ms after successful send to stay under 2 req/sec
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
      } else {
        failed += 1;
        errors.push(`${email}: ${result.error || 'unknown'}`);
      }
    }

    const result = {
      sent,
      failed,
      skipped,
      errors: errors.slice(0, 50),
      weekStart: weekStartIso,
      weekEnd: weekEndIso,
      durationMs: Date.now() - startTime,
    };
    await persistCronLastRun(supabase, result);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[send-weekly-reports]', err);
    return NextResponse.json(
      {
        error: err.message || 'Internal error',
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
