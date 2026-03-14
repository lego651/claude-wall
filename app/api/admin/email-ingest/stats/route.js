/**
 * GET /api/admin/email-ingest/stats
 * Returns the last 5 runs of the Gmail ingest job from cron_last_run,
 * with computed status for the admin dashboard email-ingest sub-tab.
 * Requires is_admin.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { EMAIL_INGEST_STALE_MINUTES } from '@/lib/alert-rules';

const JOB_NAME = 'ingest-firm-emails';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: runs, error } = await supabase
    .from('cron_last_run')
    .select('last_run_at, result_json')
    .eq('job_name', JOB_NAME)
    .order('last_run_at', { ascending: false })
    .limit(5);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const latest = runs?.[0] ?? null;

  // Compute status
  let status = 'critical';
  let statusReason = 'Never run';

  if (latest) {
    const minutesSince = (Date.now() - new Date(latest.last_run_at).getTime()) / 60000;
    const errors = latest.result_json?.errors ?? 0;

    if (minutesSince > EMAIL_INGEST_STALE_MINUTES || errors > 0) {
      status = 'critical';
      statusReason =
        errors > 0
          ? `${errors} error(s) in last run`
          : `Last run ${Math.round(minutesSince)}m ago`;
    } else if (minutesSince > 30) {
      status = 'warning';
      statusReason = `Last run ${Math.round(minutesSince)}m ago`;
    } else {
      status = 'ok';
      statusReason = 'Running normally';
    }
  }

  return NextResponse.json({
    lastRun: latest?.last_run_at ?? null,
    stats: {
      processed: latest?.result_json?.processed ?? 0,
      inserted: latest?.result_json?.inserted ?? 0,
      skipped: latest?.result_json?.skipped ?? 0,
      errors: latest?.result_json?.errors ?? 0,
    },
    status,
    statusReason,
    recentRuns: (runs ?? []).map((r) => ({
      ranAt: r.last_run_at,
      inserted: r.result_json?.inserted ?? 0,
      errors: r.result_json?.errors ?? 0,
    })),
  });
}
