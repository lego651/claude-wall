/**
 * Admin: Firm Email Senders
 * GET  /api/admin/firm-senders — list all sender mappings
 * POST /api/admin/firm-senders — add a new sender mapping
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

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('firm_email_senders')
    .select('id, firm_id, sender_email, sender_domain, created_at')
    .order('firm_id')
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ senders: data });
}

export async function POST(req) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { firm_id, sender_email, sender_domain } = body;

  if (!firm_id) {
    return NextResponse.json({ error: 'firm_id is required' }, { status: 400 });
  }
  if (!sender_email && !sender_domain) {
    return NextResponse.json(
      { error: 'At least one of sender_email or sender_domain is required' },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // Verify firm exists
  const { data: firm } = await supabase
    .from('firm_profiles')
    .select('id')
    .eq('id', firm_id)
    .single();

  if (!firm) {
    return NextResponse.json({ error: `Firm not found: ${firm_id}` }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('firm_email_senders')
    .insert({ firm_id, sender_email: sender_email || null, sender_domain: sender_domain || null })
    .select()
    .single();

  if (error) {
    const isDupe = error.code === '23505';
    return NextResponse.json(
      { error: isDupe ? 'Sender email or domain already mapped to a firm' : error.message },
      { status: isDupe ? 409 : 500 }
    );
  }

  return NextResponse.json({ sender: data }, { status: 201 });
}
