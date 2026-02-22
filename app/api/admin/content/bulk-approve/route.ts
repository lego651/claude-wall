/**
 * Bulk Approve Content API
 * POST /api/admin/content/bulk-approve
 *
 * Allows admin to approve multiple content items at once.
 * Updates published flag and published_at timestamp.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { invalidateWeeklyCache } from '@/lib/digest/weekly-cache';

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

export async function POST(req: Request) {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) return authCheck.error;

  let body: any;
  try {
    body = await req.json();
  } catch (parseError) {
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    );
  }

  const { firmContent = [], industryNews = [], incidents = [], topicGroups = [], weekNumber, year } = body;

  if (!Array.isArray(firmContent) || !Array.isArray(industryNews) || !Array.isArray(incidents) || !Array.isArray(topicGroups)) {
    return NextResponse.json(
      {
        error: 'Invalid request format',
        expected: { firmContent: 'number[]', industryNews: 'number[]', incidents: 'number[]', topicGroups: 'number[]' },
      },
      { status: 400 }
    );
  }

  if (firmContent.length === 0 && industryNews.length === 0 && incidents.length === 0 && topicGroups.length === 0) {
    return NextResponse.json(
      { error: 'No items to approve' },
      { status: 400 }
    );
  }

  console.log('[Bulk Approve] Processing:', {
    firmContent: firmContent.length,
    industryNews: industryNews.length,
    incidents: incidents.length,
    topicGroups: topicGroups.length,
  });

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  try {
    let firmContentApproved = 0;
    let industryNewsApproved = 0;
    let incidentsApproved = 0;
    let topicGroupsApproved = 0;

    // Approve firm content items
    if (firmContent.length > 0) {
      const { data: firmResults, error: firmError } = await supabase
        .from('firm_content_items')
        .update({
          published: true,
          published_at: now,
        })
        .in('id', firmContent)
        .select('id');

      if (firmError) {
        throw new Error(`Firm content update failed: ${firmError.message}`);
      }

      firmContentApproved = firmResults?.length || 0;
    }

    // Approve industry news items
    if (industryNews.length > 0) {
      const { data: industryResults, error: industryError } = await supabase
        .from('industry_news_items')
        .update({
          published: true,
          published_at: now,
        })
        .in('id', industryNews)
        .select('id');

      if (industryError) {
        throw new Error(`Industry news update failed: ${industryError.message}`);
      }

      industryNewsApproved = industryResults?.length || 0;
    }

    // Approve incidents that are checked
    if (incidents.length > 0) {
      const { data: incidentResults, error: incidentError } = await supabase
        .from('firm_daily_incidents')
        .update({
          published: true,
          published_at: now,
        })
        .in('id', incidents)
        .select('id');

      if (incidentError) {
        throw new Error(`Incident update failed: ${incidentError.message}`);
      }

      incidentsApproved = incidentResults?.length || 0;
    }

    // TG-007: Approve topic groups = publish all industry_news_items in group + mark group published
    if (topicGroups.length > 0) {
      const { data: groups, error: groupsError } = await supabase
        .from('twitter_topic_groups')
        .select('id, item_ids')
        .in('id', topicGroups);

      if (groupsError) {
        throw new Error(`Topic groups fetch failed: ${groupsError.message}`);
      }

      const allItemIds = new Set<number>();
      const groupIdsToPublish: number[] = [];
      for (const g of groups || []) {
        const ids = Array.isArray((g as { item_ids?: number[] }).item_ids) ? (g as { item_ids: number[] }).item_ids : [];
        ids.forEach((id) => allItemIds.add(id));
        groupIdsToPublish.push((g as { id: number }).id);
      }

      if (allItemIds.size > 0) {
        const { data: industryResults, error: industryError } = await supabase
          .from('industry_news_items')
          .update({ published: true, published_at: now })
          .in('id', Array.from(allItemIds))
          .select('id');

        if (industryError) {
          throw new Error(`Industry news (topic group) update failed: ${industryError.message}`);
        }
        industryNewsApproved += industryResults?.length || 0;
      }

      if (groupIdsToPublish.length > 0) {
        await supabase
          .from('twitter_topic_groups')
          .update({ published: true, published_at: now })
          .in('id', groupIdsToPublish);
        topicGroupsApproved = groupIdsToPublish.length;
      }
    }

    // IMPORTANT: Also un-approve incidents that were unchecked for this week
    if (weekNumber && year) {
      const { data: allWeekIncidents } = await supabase
        .from('firm_daily_incidents')
        .select('id')
        .eq('week_number', weekNumber)
        .eq('year', year);

      const allIncidentIds = (allWeekIncidents || []).map(i => i.id);
      const uncheckedIncidentIds = allIncidentIds.filter(id => !incidents.includes(id));

      if (uncheckedIncidentIds.length > 0) {
        await supabase
          .from('firm_daily_incidents')
          .update({ published: false, published_at: null })
          .in('id', uncheckedIncidentIds);

        console.log('[Bulk Approve] Un-approved unchecked incidents:', uncheckedIncidentIds.length);
      }
    }

    const totalApproved = firmContentApproved + industryNewsApproved + incidentsApproved;

    console.log('[Bulk Approve] Success:', {
      firmContentApproved,
      industryNewsApproved,
      incidentsApproved,
      topicGroupsApproved,
      totalApproved,
    });

    // Invalidate weekly cache so fresh data is fetched next time
    invalidateWeeklyCache();
    console.log('[Bulk Approve] Cache invalidated');

    return NextResponse.json({
      success: true,
      approvedCount: totalApproved,
      breakdown: {
        firmContent: firmContentApproved,
        industryNews: industryNewsApproved,
        incidents: incidentsApproved,
        topicGroups: topicGroupsApproved,
      },
    });
  } catch (error) {
    console.error('[Bulk Approve] Error:', error);
    return NextResponse.json(
      {
        error: 'Bulk approve failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
