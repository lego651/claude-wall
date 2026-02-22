/**
 * Weekly Digest Review API
 * GET /api/admin/content/weekly-review?week=2026-02-17
 *
 * Returns all content (firm content, industry news, incidents) for a specific week
 * for admin to review before sending weekly digest.
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

    // Fetch all content for the week in parallel (TG-005: add topic groups)
    const [
      { data: firmContentItems, error: firmContentError },
      { data: industryNewsItems, error: industryNewsError },
      { data: incidents, error: incidentsError },
      { data: topicGroupsRows, error: topicGroupsError },
    ] = await Promise.all([
      // Firm content (both published and unpublished)
      supabase
        .from('firm_content_items')
        .select('*')
        .in('firm_id', firmIds)
        .gte('content_date', weekStartIso)
        .lte('content_date', weekEndIso)
        .order('content_date', { ascending: false }),

      // Industry tweets (firm_twitter_tweets firm_id='industry') for the week; mapped to same shape as legacy industry news
      supabase
        .from('firm_twitter_tweets')
        .select('id, text, url, ai_summary, tweeted_at, published')
        .eq('firm_id', 'industry')
        .gte('tweeted_at', weekStartIso)
        .lte('tweeted_at', weekEndIso)
        .order('tweeted_at', { ascending: false }),

      // Trustpilot incidents for the week
      supabase
        .from('firm_daily_incidents')
        .select('*')
        .eq('week_number', weekNumber)
        .eq('year', year)
        .order('created_at', { ascending: false }),

      // Twitter topic groups for the week (industry only)
      supabase
        .from('twitter_topic_groups')
        .select('id, topic_title, summary, item_ids, published, week_number, year')
        .eq('week_start', weekStartIso)
        .eq('item_type', 'industry')
        .is('firm_id', null)
        .order('id', { ascending: true }),
    ]);

    if (firmContentError) throw firmContentError;
    if (industryNewsError) throw industryNewsError;
    if (incidentsError) throw incidentsError;
    if (topicGroupsError) throw topicGroupsError;

    // Map industry tweets to shape expected by UI (title, content_date, ai_confidence, etc.)
    const industryTweetsRows = (industryNewsItems || []) as { id: number; text: string; url: string; ai_summary: string | null; tweeted_at: string; published: boolean | null }[];
    const allIndustryNews = industryTweetsRows.map((r) => ({
      id: r.id,
      title: (r.text || '').slice(0, 200).trim() || 'Tweet',
      ai_summary: r.ai_summary || '',
      content_date: r.tweeted_at,
      published: r.published === true,
      ai_confidence: 0.8,
      mentioned_firm_ids: [] as string[],
      source_url: r.url,
    }));

    // Resolve topic group item_ids from firm_twitter_tweets (industry tweet ids)
    type TopicGroupRow = { id: number; topic_title: string; summary: string | null; item_ids?: number[]; published: boolean; week_number: number; year: number };
    const topicGroups = (topicGroupsRows || []) as TopicGroupRow[];
    const allTopicGroupItemIds = topicGroups.flatMap((row) => (Array.isArray(row.item_ids) ? row.item_ids : []));
    const uniqueItemIds = [...new Set(allTopicGroupItemIds)];
    let itemIdToDisplay: Record<number, { id: number; title: string; source_url: string | null }> = {};
    if (uniqueItemIds.length > 0) {
      const { data: resolvedItems } = await supabase
        .from('firm_twitter_tweets')
        .select('id, text, url')
        .eq('firm_id', 'industry')
        .in('id', uniqueItemIds);
      if (resolvedItems) {
        for (const r of resolvedItems as { id: number; text: string; url: string }[]) {
          itemIdToDisplay[r.id] = { id: r.id, title: (r.text || '').slice(0, 100), source_url: r.url };
        }
      }
    }
    const industryTopicGroups = topicGroups.map((row) => ({
      id: row.id,
      topic_title: row.topic_title,
      summary: row.summary || '',
      item_ids: Array.isArray(row.item_ids) ? row.item_ids : [],
      published: row.published,
      week_number: row.week_number,
      year: row.year,
      items: (Array.isArray(row.item_ids) ? row.item_ids : []).map((id) => itemIdToDisplay[id] || { id, title: '', source_url: null }),
    }));

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

    // Calculate overall stats (allIndustryNews already defined above as mapped industry tweets)
    const allFirmContent = firmContentItems || [];
    const allIncidents = incidents || [];

    const totalFirmContent = allFirmContent.length;
    const approvedFirmContent = allFirmContent.filter((c) => c.published).length;
    const pendingFirmContent = totalFirmContent - approvedFirmContent;

    const totalIndustryNews = allIndustryNews.length;
    const approvedIndustryNews = allIndustryNews.filter((n) => n.published).length;
    const pendingIndustryNews = totalIndustryNews - approvedIndustryNews;

    const totalIncidents = allIncidents.length;
    const approvedIncidents = allIncidents.filter((i) => i.published !== false).length;
    const pendingIncidents = totalIncidents - approvedIncidents;

    const totalTopicGroups = industryTopicGroups.length;
    const approvedTopicGroups = industryTopicGroups.filter((g) => g.published).length;
    const pendingTopicGroups = totalTopicGroups - approvedTopicGroups;

    const response = {
      weekStart: weekStartIso,
      weekEnd: weekEndIso,
      weekNumber,
      year,
      weekLabel: `Week ${weekNumber}, ${year}`,
      overallStats: {
        totalItems: totalFirmContent + totalIndustryNews + totalIncidents + totalTopicGroups,
        firmContent: {
          total: totalFirmContent,
          approved: approvedFirmContent,
          pending: pendingFirmContent,
        },
        industryNews: {
          total: totalIndustryNews,
          approved: approvedIndustryNews,
          pending: pendingIndustryNews,
        },
        incidents: {
          total: totalIncidents,
          approved: approvedIncidents,
          pending: pendingIncidents,
        },
        topicGroups: {
          total: totalTopicGroups,
          approved: approvedTopicGroups,
          pending: pendingTopicGroups,
        },
      },
      industryNews: allIndustryNews,
      industryTopicGroups,
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
