/**
 * Admin: Firm Email Sender by ID
 * DELETE /api/admin/firm-senders/[id] — remove a sender mapping
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { ok: true };
}

export async function DELETE(_req, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('firm_email_senders')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
