/**
 * Firm Content Management API (TICKET-S8-006)
 * PATCH /api/admin/content/firm/:id - Update/approve content
 * DELETE /api/admin/content/firm/:id - Delete content
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

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) return authCheck.error;

  const { id } = params;
  const body = await req.json();

  const updateData: any = {};

  if (body.published !== undefined) {
    updateData.published = body.published;
    if (body.published) {
      updateData.published_at = new Date().toISOString();
    }
  }

  if (body.admin_notes !== undefined) {
    updateData.admin_notes = body.admin_notes;
  }

  if (body.title !== undefined) {
    updateData.title = body.title;
  }

  if (body.raw_content !== undefined) {
    updateData.raw_content = body.raw_content;
  }

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from('firm_content_items')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Firm Content Update] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log('[Firm Content Update] Success:', {
    id,
    published: data.published,
  });

  return NextResponse.json({ success: true, item: data });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) return authCheck.error;

  const { id } = params;

  const serviceClient = createServiceClient();
  const { error } = await serviceClient
    .from('firm_content_items')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Firm Content Delete] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log('[Firm Content Delete] Success:', { id });

  return NextResponse.json({ success: true });
}
