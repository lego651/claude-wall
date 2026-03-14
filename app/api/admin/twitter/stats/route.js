/**
 * GET /api/admin/twitter/stats
 * Returns summary of the hybrid 2-run Twitter model:
 *   firmRun   — Run 1: firm official handles (from:handle combined query)
 *   industryRun — Run 2: industry keywords
 *   topicGroups — weekly topic grouping job stats
 * Requires authenticated user with is_admin.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

  // Fetch cron_last_run for twitter fetch+ingest job (single row covers both runs)
  const { data: fetchRow } = await supabase
    .from('cron_last_run')
    .select('last_run_at, result_json')
    .eq('job_name', 'twitter_fetch_ingest')
    .maybeSingle();

  const r = fetchRow?.result_json ?? {};
  const lastRunAt = fetchRow?.last_run_at ?? null;

  const firmRun = {
    lastRunAt,
    tweetsInserted: r.firmInserted ?? 0,
    tweetsSkipped: r.firmSkipped ?? 0,
    errors: 0,
  };

  const industryRun = {
    lastRunAt,
    tweetsInserted: r.industryInserted ?? 0,
    tweetsSkipped: r.industrySkipped ?? 0,
    errors: 0,
  };

  // Fetch topic groups: count rows from most recent week in twitter_topic_groups
  let topicGroupsLastRunAt = null;
  let groupsGenerated = 0;
  let topicGroupsErrors = 0;

  try {
    const { data: topicRows, error: topicError } = await supabase
      .from('twitter_topic_groups')
      .select('created_at, week_start')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (topicError) {
      topicGroupsErrors = 1;
    } else if (topicRows) {
      topicGroupsLastRunAt = topicRows.created_at ?? null;
      // Count all groups for the same week_start
      const { count } = await supabase
        .from('twitter_topic_groups')
        .select('*', { count: 'exact', head: true })
        .eq('week_start', topicRows.week_start);
      groupsGenerated = count ?? 0;
    }
  } catch {
    topicGroupsErrors = 1;
  }

  const topicGroups = {
    lastRunAt: topicGroupsLastRunAt,
    groupsGenerated,
    errors: topicGroupsErrors,
  };

  return NextResponse.json({ firmRun, industryRun, topicGroups });
}
