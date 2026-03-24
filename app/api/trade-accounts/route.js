import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/trade-accounts — list user's accounts
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data, error } = await supabase
      .from('trade_accounts')
      .select('id, name, is_default, pnl_unit, default_pnl, daily_trade_limit, created_at')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[trade-accounts] GET error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[trade-accounts] GET unexpected:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/trade-accounts — create account
export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, pnl_unit } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (name.trim().length > 50) {
    return NextResponse.json({ error: 'name must be 50 characters or fewer' }, { status: 400 });
  }
  if (!pnl_unit || !['R', 'USD'].includes(pnl_unit)) {
    return NextResponse.json({ error: 'pnl_unit must be "R" or "USD"' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('trade_accounts')
      .insert({ user_id: user.id, name: name.trim(), pnl_unit, is_default: false })
      .select('id, name, is_default, pnl_unit, default_pnl, daily_trade_limit, created_at')
      .single();

    if (error) {
      console.error('[trade-accounts] POST error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('[trade-accounts] POST unexpected:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
