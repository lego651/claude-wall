/**
 * POST /api/admin/test-alert
 * Sends a test alert email to ALERT_EMAIL. Requires authenticated user with is_admin.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendAlert } from '@/lib/alerts';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const to = process.env.ALERT_EMAIL || process.env.ALERTS_TO;
  if (!to?.trim()) {
    return NextResponse.json({ error: 'ALERT_EMAIL / ALERTS_TO not set' }, { status: 400 });
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 400 });
  }

  try {
    await sendAlert(
      'Admin dashboard',
      'Test alert from admin dashboard. Critical alerts (file size, Arbiscan, DB) are sent here (throttled 1h).',
      'INFO',
      { test: true, at: new Date().toISOString() }
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to send test alert' }, { status: 500 });
  }
}
