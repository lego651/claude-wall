/**
 * GET /api/admin/twitter/history
 * Returns 7-day tweet ingestion breakdown from firm_twitter_tweets.created_at.
 * Used by admin dashboard for trend monitoring and health assessment.
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

  try {
    // Query last 7 days of inserted tweets grouped by date and source
    const { data: rows, error } = await supabase
      .from('firm_twitter_tweets')
      .select('created_at, firm_id')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    // Build per-day breakdown
    const dayMap = {};
    for (const row of rows ?? []) {
      const day = row.created_at.slice(0, 10); // YYYY-MM-DD
      if (!dayMap[day]) dayMap[day] = { firm: 0, industry: 0, total: 0 };
      if (row.firm_id === 'industry') {
        dayMap[day].industry++;
      } else {
        dayMap[day].firm++;
      }
      dayMap[day].total++;
    }

    // Build last 7 days array (today first)
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      days.push({
        date: key,
        firm: dayMap[key]?.firm ?? 0,
        industry: dayMap[key]?.industry ?? 0,
        total: dayMap[key]?.total ?? 0,
      });
    }

    // Summary stats
    const totalLast7 = days.reduce((s, d) => s + d.total, 0);
    const avgPerDay = Math.round(totalLast7 / 7);
    const daysWithData = days.filter((d) => d.total > 0).length;

    return NextResponse.json({ days, totalLast7, avgPerDay, daysWithData });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
