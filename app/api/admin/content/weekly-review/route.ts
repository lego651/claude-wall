/**
 * Weekly Digest Review API
 * GET /api/admin/content/weekly-review?week=2026-02-17
 *
 * Returns firm content and Trustpilot incidents for a specific week for admin review.
 * Industry news is no longer shown on this page.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getWeekBoundsUtc, getWeekNumberUtc, getYearUtc } from '@/lib/digest/week-utils';

async function checkAdminAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { authorized: false, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    return { authorized: false, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { authorized: true };
}

export async function GET(req: Request) {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) return authCheck.error;

  const { searchParams } = new URL(req.url);
  const weekParam = searchParams.get('week'); // e.g., "2026-02-17" (Monday of the week)

  // Calculate week bounds
  let weekStart: Date;
  let weekEnd: Date;

  if (weekParam) {
    const paramDate = new Date(weekParam);
    const bounds = getWeekBoundsUtc(paramDate);
    weekStart = bounds.weekStart;
    weekEnd = bounds.weekEnd;
  } else {
    // Default to current week
    const now = new Date();
    const bounds = getWeekBoundsUtc(now);
    weekStart = bounds.weekStart;
    weekEnd = bounds.weekEnd;
  }

  const weekStartIso = weekStart.toISOString().slice(0, 10);
  const weekEndIso = weekEnd.toISOString().slice(0, 10);
  const weekNumber = getWeekNumberUtc(weekStart);
  const year = getYearUtc(weekStart);

  console.log('[Weekly Review] Fetching data for week:', {
    weekStartIso,
    weekEndIso,
    weekNumber,
    year,
  });

  const supabase = createServiceClient();

  try {
    // Fetch all active firms
    const { data: firms, error: firmsError } = await supabase
      .from('firm_profiles')
      .select('id, name')
      .not('trustpilot_url', 'is', null)
      .order('name');

    if (firmsError) throw firmsError;

    const firmIds = (firms || []).map((f) => f.id);

    // Fetch firm content and incidents for the week (industry news no longer shown)
    const [
      { data: firmContentItems, error: firmContentError },
      { data: incidents, error: incidentsError },
    ] = await Promise.all([
      supabase
        .from('firm_content_items')
        .select('*')
        .in('firm_id', firmIds)
        .gte('content_date', weekStartIso)
        .lte('content_date', weekEndIso)
        .order('content_date', { ascending: false }),

      supabase
        .from('firm_daily_incidents')
        .select('*')
        .eq('week_number', weekNumber)
        .eq('year', year)
        .order('created_at', { ascending: false }),
    ]);

    if (firmContentError) throw firmContentError;
    if (incidentsError) throw incidentsError;

    // Group firm content by firm
    const firmReviews = firms?.map((firm) => {
      const firmContent = (firmContentItems || []).filter(
        (item) => item.firm_id === firm.id
      );
      const firmIncidents = (incidents || []).filter(
        (inc) => inc.firm_id === firm.id
      );

      const contentByType = {
        company_news: firmContent.filter((c) => c.content_type === 'company_news'),
        rule_change: firmContent.filter((c) => c.content_type === 'rule_change'),
        promotion: firmContent.filter((c) => c.content_type === 'promotion'),
      };

      const totalItems =
        contentByType.company_news.length +
        contentByType.rule_change.length +
        contentByType.promotion.length +
        firmIncidents.length;

      const approvedItems =
        contentByType.company_news.filter((c) => c.published).length +
        contentByType.rule_change.filter((c) => c.published).length +
        contentByType.promotion.filter((c) => c.published).length +
        firmIncidents.filter((i) => i.published !== false).length; // Incidents auto-approved (published defaults to true)

      const pendingItems = totalItems - approvedItems;

      return {
        firmId: firm.id,
        firmName: firm.name || firm.id,
        content: contentByType,
        incidents: firmIncidents,
        stats: {
          totalItems,
          approvedItems,
          pendingItems,
        },
      };
    });

    // Calculate overall stats (industry news no longer included)
    const allFirmContent = firmContentItems || [];
    const allIncidents = incidents || [];

    const totalFirmContent = allFirmContent.length;
    const approvedFirmContent = allFirmContent.filter((c) => c.published).length;
    const pendingFirmContent = totalFirmContent - approvedFirmContent;

    const totalIncidents = allIncidents.length;
    const approvedIncidents = allIncidents.filter((i) => i.published !== false).length;
    const pendingIncidents = totalIncidents - approvedIncidents;

    const response = {
      weekStart: weekStartIso,
      weekEnd: weekEndIso,
      weekNumber,
      year,
      weekLabel: `Week ${weekNumber}, ${year}`,
      overallStats: {
        totalItems: totalFirmContent + totalIncidents,
        firmContent: {
          total: totalFirmContent,
          approved: approvedFirmContent,
          pending: pendingFirmContent,
        },
        incidents: {
          total: totalIncidents,
          approved: approvedIncidents,
          pending: pendingIncidents,
        },
      },
      firmReviews: firmReviews || [],
    };

    console.log('[Weekly Review] Success:', {
      weekLabel: response.weekLabel,
      firms: firmReviews?.length,
      totalItems: response.overallStats.totalItems,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Weekly Review] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch weekly review data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
