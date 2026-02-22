/**
 * Content Review Queue API (TICKET-S8-008)
 * GET /api/admin/content/review?status=pending|published|all
 *
 * Returns pending and/or published firm content and industry news for admin review.
 * Optional: limit (default 50 per type), page (default 1).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

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

const LIMIT = 50;

export async function GET(req: Request) {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) return authCheck.error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'pending'; // pending | published | all
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || String(LIMIT), 10)));
  const offset = (page - 1) * limit;

  const supabase = createServiceClient();

  const buildFirmQuery = () => {
    let q = supabase
      .from('firm_content_items')
      .select('*', { count: 'exact' })
      .order('content_date', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);
    if (status === 'pending') q = q.eq('published', false);
    else if (status === 'published') q = q.eq('published', true);
    return q;
  };

  const buildIndustryQuery = () => {
    let q = supabase
      .from('industry_news_items')
      .select('*', { count: 'exact' })
      .order('content_date', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);
    if (status === 'pending') q = q.eq('published', false);
    else if (status === 'published') q = q.eq('published', true);
    return q;
  };

  try {
    const [firmRes, industryRes] = await Promise.all([buildFirmQuery(), buildIndustryQuery()]);

    if (firmRes.error) {
      console.error('[Content Review] firm_content_items', firmRes.error);
      return NextResponse.json({ error: firmRes.error.message }, { status: 500 });
    }
    if (industryRes.error) {
      console.error('[Content Review] industry_news_items', industryRes.error);
      return NextResponse.json({ error: industryRes.error.message }, { status: 500 });
    }

    const firm_content = firmRes.data || [];
    const industry_news = industryRes.data || [];

    return NextResponse.json({
      firm_content,
      industry_news,
      pagination: {
        page,
        limit,
        firm_count: firmRes.count ?? firm_content.length,
        industry_count: industryRes.count ?? industry_news.length,
      },
    });
  } catch (err) {
    console.error('[Content Review]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
