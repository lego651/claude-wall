/**
 * Industry News Upload API (TICKET-S8-005)
 * POST /api/admin/content/industry
 *
 * Allows admins to upload industry-wide news (not firm-specific, or affects multiple firms)
 * with AI categorization that extracts mentioned firms.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { categorizeContent } from '@/lib/ai/categorize-content';

const VALID_SOURCE_TYPES = ['manual_upload', 'news_website', 'twitter', 'reddit', 'regulatory', 'other'];

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

  // 2. Parse request body
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
  const { title, raw_content, content_date } = body;

  if (!title || !raw_content || !content_date) {
    return NextResponse.json(
      {
        error: 'Missing required fields',
        required: ['title', 'raw_content', 'content_date'],
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

  // 4. AI categorization (extracts mentioned firms)
  let aiResult;
  try {
    console.log('[Industry News Upload] Starting AI categorization:', {
      title,
      content_length: raw_content.length,
      source_type,
    });

    aiResult = await categorizeContent(raw_content, {
      title,
      source_type,
      // No firm_id for industry news - AI will extract mentioned firms
    });

    console.log('[Industry News Upload] AI categorization complete:', {
      ai_category: aiResult.ai_category,
      ai_confidence: aiResult.ai_confidence,
      mentioned_firm_ids: aiResult.mentioned_firm_ids,
      ai_tags: aiResult.ai_tags,
    });
  } catch (aiError) {
    console.error('[Industry News Upload] AI categorization failed:', aiError);
    return NextResponse.json(
      {
        error: 'AI categorization failed',
        details: aiError instanceof Error ? aiError.message : 'Unknown error',
      },
      { status: 500 }
    );
  }

  // 5. Insert into database
  const serviceClient = createServiceClient();
  const { data: insertedItem, error: insertError } = await serviceClient
    .from('industry_news_items')
    .insert({
      title,
      raw_content,
      source_url: body.source_url || null,
      source_type,
      ai_summary: aiResult.ai_summary,
      ai_category: aiResult.ai_category,
      ai_confidence: aiResult.ai_confidence,
      ai_tags: aiResult.ai_tags,
      mentioned_firm_ids: aiResult.mentioned_firm_ids || [],
      screenshot_url: body.screenshot_url || null, // TODO: Implement file upload in future ticket
      content_date,
      published: false, // Pending admin approval
      ingested_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    console.error('[Industry News Upload] Database insert failed:', insertError);
    return NextResponse.json(
      {
        error: 'Database insert failed',
        details: insertError.message,
      },
      { status: 500 }
    );
  }

  console.log('[Industry News Upload] Success:', {
    id: insertedItem.id,
    title,
    ai_category: aiResult.ai_category,
    mentioned_firm_ids: aiResult.mentioned_firm_ids,
  });

  return NextResponse.json({
    success: true,
    item: {
      id: insertedItem.id,
      title: insertedItem.title,
      ai_summary: insertedItem.ai_summary,
      ai_category: insertedItem.ai_category,
      ai_confidence: insertedItem.ai_confidence,
      ai_tags: insertedItem.ai_tags,
      mentioned_firm_ids: insertedItem.mentioned_firm_ids,
      screenshot_url: insertedItem.screenshot_url,
      published: insertedItem.published,
      content_date: insertedItem.content_date,
      created_at: insertedItem.created_at,
    },
  });
}
