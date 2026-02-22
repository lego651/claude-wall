/**
 * Firm Content Upload API (TICKET-S8-004)
 * POST /api/admin/content/firm
 *
 * Allows admins to upload firm-specific content (news, rules, promotions)
 * with AI categorization and optional screenshot upload.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { categorizeContent } from '@/lib/ai/categorize-content';

const VALID_CONTENT_TYPES = ['company_news', 'rule_change', 'promotion', 'other'];
const VALID_SOURCE_TYPES = ['manual_upload', 'firm_email', 'discord', 'twitter', 'reddit', 'blog', 'other'];

export async function POST(req: Request) {
  // 1. Authenticate admin
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

  // 2. Parse request body (JSON for now, multipart for screenshots later)
  let body: any;
  try {
    body = await req.json();
  } catch (parseError) {
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    );
  }

  // 3. Validate required fields
  const { firm_id, content_type, title, raw_content, content_date } = body;

  if (!firm_id || !content_type || !title || !raw_content || !content_date) {
    return NextResponse.json(
      {
        error: 'Missing required fields',
        required: ['firm_id', 'content_type', 'title', 'raw_content', 'content_date'],
      },
      { status: 400 }
    );
  }

  if (!VALID_CONTENT_TYPES.includes(content_type)) {
    return NextResponse.json(
      {
        error: `Invalid content_type. Must be one of: ${VALID_CONTENT_TYPES.join(', ')}`,
      },
      { status: 400 }
    );
  }

  const source_type = body.source_type || 'manual_upload';
  if (!VALID_SOURCE_TYPES.includes(source_type)) {
    return NextResponse.json(
      {
        error: `Invalid source_type. Must be one of: ${VALID_SOURCE_TYPES.join(', ')}`,
      },
      { status: 400 }
    );
  }

  // 4. Verify firm exists
  const { data: firm, error: firmError } = await supabase
    .from('firm_profiles')
    .select('id, name')
    .eq('id', firm_id)
    .single();

  if (firmError || !firm) {
    return NextResponse.json(
      { error: `Firm not found: ${firm_id}` },
      { status: 404 }
    );
  }

  // 5. AI categorization
  let aiResult;
  try {
    console.log('[Firm Content Upload] Starting AI categorization:', {
      firm_id,
      content_type,
      title,
      content_length: raw_content.length,
    });

    aiResult = await categorizeContent(raw_content, {
      title,
      source_type,
      firm_id,
    });

    console.log('[Firm Content Upload] AI categorization complete:', {
      ai_category: aiResult.ai_category,
      ai_confidence: aiResult.ai_confidence,
      ai_tags: aiResult.ai_tags,
    });
  } catch (aiError) {
    console.error('[Firm Content Upload] AI categorization failed:', aiError);
    return NextResponse.json(
      {
        error: 'AI categorization failed',
        details: aiError instanceof Error ? aiError.message : 'Unknown error',
      },
      { status: 500 }
    );
  }

  // 6. Insert into database
  const serviceClient = createServiceClient();
  const { data: insertedItem, error: insertError } = await serviceClient
    .from('firm_content_items')
    .insert({
      firm_id,
      content_type,
      title,
      raw_content,
      source_url: body.source_url || null,
      source_type,
      ai_summary: aiResult.ai_summary,
      ai_category: aiResult.ai_category,
      ai_confidence: aiResult.ai_confidence,
      ai_tags: aiResult.ai_tags,
      screenshot_url: body.screenshot_url || null, // TODO: Implement file upload in future ticket
      content_date,
      published: false, // Pending admin approval
      ingested_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    console.error('[Firm Content Upload] Database insert failed:', insertError);
    return NextResponse.json(
      {
        error: 'Database insert failed',
        details: insertError.message,
      },
      { status: 500 }
    );
  }

  console.log('[Firm Content Upload] Success:', {
    id: insertedItem.id,
    firm_id,
    content_type,
    ai_category: aiResult.ai_category,
  });

  return NextResponse.json({
    success: true,
    item: {
      id: insertedItem.id,
      firm_id: insertedItem.firm_id,
      firm_name: firm.name,
      content_type: insertedItem.content_type,
      title: insertedItem.title,
      ai_summary: insertedItem.ai_summary,
      ai_category: insertedItem.ai_category,
      ai_confidence: insertedItem.ai_confidence,
      ai_tags: insertedItem.ai_tags,
      screenshot_url: insertedItem.screenshot_url,
      published: insertedItem.published,
      content_date: insertedItem.content_date,
      created_at: insertedItem.created_at,
    },
  });
}
