import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const DEFAULT_DAILY_LIMIT = 3;

// GET /api/user-settings/trading
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data } = await supabase
      .from('user_trading_settings')
      .select('daily_trade_limit')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({
      daily_trade_limit: data?.daily_trade_limit ?? DEFAULT_DAILY_LIMIT,
    });
  } catch (err) {
    console.error('[user-settings/trading] GET unexpected:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/user-settings/trading
export async function PATCH(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { daily_trade_limit } = body;

  if (
    daily_trade_limit === undefined ||
    !Number.isInteger(daily_trade_limit) ||
    daily_trade_limit < 1
  ) {
    return NextResponse.json(
      { error: 'daily_trade_limit must be an integer >= 1' },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from('user_trading_settings')
      .upsert(
        { user_id: user.id, daily_trade_limit, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      .select('daily_trade_limit')
      .single();

    if (error) {
      console.error('[user-settings/trading] PATCH error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ daily_trade_limit: data.daily_trade_limit });
  } catch (err) {
    console.error('[user-settings/trading] PATCH unexpected:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
