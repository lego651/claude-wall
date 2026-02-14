/**
 * TICKET-004: Weekly Email Reports API Route
 * Cron endpoint invoked by GitHub Actions (send-weekly-reports.yml) every Monday 14:00 UTC.
 * Queries user_subscriptions, fetches weekly_reports for each user's firms, sends one digest email per user.
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendWeeklyDigest } from '@/lib/email/send-digest';
import { getWeekNumber, getYear, getWeekBounds } from '@/lib/digest/week-utils';

export const maxDuration = 300; // 5 min for many users
export const dynamic = 'force-dynamic';

/** Last week (Mon–Sun) in UTC. Cron runs Monday 14:00 UTC so "last week" is the week that just ended. */
function getLastWeekUtc() {
  const now = new Date();
  const lastWeekDate = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - 7
  ));
  const { weekStart, weekEnd } = getWeekBounds(lastWeekDate);
  return {
    weekNumber: getWeekNumber(weekStart),
    year: getYear(weekStart),
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
    const { weekNumber, year, weekStartIso, weekEndIso } = getLastWeekUtc();

    // Active subscriptions: user_id, firm_id (email_enabled = true)
    const { data: rows, error: subsError } = await supabase
      .from('user_subscriptions')
      .select('user_id, firm_id')
      .eq('email_enabled', true);

    if (subsError) {
      console.error('[send-weekly-reports] subscriptions', subsError);
      return NextResponse.json(
        { error: 'Failed to fetch subscriptions', detail: subsError.message },
        { status: 500 }
      );
    }

    if (!rows?.length) {
      return NextResponse.json({
        sent: 0,
        failed: 0,
        skipped: 0,
        errors: [],
        message: 'No active subscribers',
        durationMs: Date.now() - startTime,
      });
    }

    // Group by user_id -> firm_ids[]
    const byUser = new Map();
    for (const r of rows) {
      const uid = r.user_id;
      if (!byUser.has(uid)) byUser.set(uid, []);
      byUser.get(uid).push(r.firm_id);
    }

    // Get email for each user from profiles
    const userIds = [...byUser.keys()];
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', userIds);

    if (profilesError) {
      console.error('[send-weekly-reports] profiles', profilesError);
      return NextResponse.json(
        { error: 'Failed to fetch profiles', detail: profilesError.message },
        { status: 500 }
      );
    }

    const emailByUser = new Map((profiles || []).map((p) => [p.id, p.email?.trim()]).filter(([, e]) => e));

    // Fetch weekly_reports for (firm_id, week_number, year) for all firms we need
    const firmIds = [...new Set(rows.map((r) => r.firm_id))];
    const { data: reportsRows, error: reportsError } = await supabase
      .from('weekly_reports')
      .select('firm_id, report_json')
      .in('firm_id', firmIds)
      .eq('week_number', weekNumber)
      .eq('year', year);

    if (reportsError) {
      console.error('[send-weekly-reports] weekly_reports', reportsError);
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

    for (const [userId, firmIdsForUser] of byUser) {
      const email = emailByUser.get(userId);
      if (!email) {
        errors.push(`${userId}: no email in profile`);
        failed += 1;
        continue;
      }

      const reports = firmIdsForUser
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
      } else {
        failed += 1;
        errors.push(`${email}: ${result.error || 'unknown'}`);
      }
    }

    return NextResponse.json({
      sent,
      failed,
      skipped,
      errors: errors.slice(0, 50),
      weekStart: weekStartIso,
      weekEnd: weekEndIso,
      durationMs: Date.now() - startTime,
    });
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
