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

  const { firmContent = [], industryNews = [], incidents = [], weekNumber, year } = body;

  if (!Array.isArray(firmContent) || !Array.isArray(industryNews) || !Array.isArray(incidents)) {
    return NextResponse.json(
      {
        error: 'Invalid request format',
        expected: { firmContent: 'number[]', industryNews: 'number[]', incidents: 'number[]' },
      },
      { status: 400 }
    );
  }

  if (firmContent.length === 0 && industryNews.length === 0 && incidents.length === 0) {
    return NextResponse.json(
      { error: 'No items to approve' },
      { status: 400 }
    );
  }

  console.log('[Bulk Approve] Processing:', {
    firmContent: firmContent.length,
    industryNews: industryNews.length,
    incidents: incidents.length,
  });

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  try {
    let firmContentApproved = 0;
    let industryNewsApproved = 0;
    let incidentsApproved = 0;

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
