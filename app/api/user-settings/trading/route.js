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
      .select('daily_trade_limit, preferred_timezone')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({
      daily_trade_limit: data?.daily_trade_limit ?? DEFAULT_DAILY_LIMIT,
      preferred_timezone: data?.preferred_timezone ?? null,
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

  const { daily_trade_limit, preferred_timezone } = body;
  const hasLimit = daily_trade_limit !== undefined;
  const hasTz = preferred_timezone !== undefined;

  if (!hasLimit && !hasTz) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
  }

  if (hasLimit && (!Number.isInteger(daily_trade_limit) || daily_trade_limit < 1)) {
    return NextResponse.json(
      { error: 'daily_trade_limit must be an integer >= 1' },
      { status: 400 }
    );
  }

  if (hasTz && (typeof preferred_timezone !== 'string' || !preferred_timezone.trim())) {
    return NextResponse.json(
      { error: 'preferred_timezone must be a non-empty string' },
      { status: 400 }
    );
  }

  const upsertData = { user_id: user.id, updated_at: new Date().toISOString() };
  if (hasLimit) upsertData.daily_trade_limit = daily_trade_limit;
  if (hasTz) upsertData.preferred_timezone = preferred_timezone.trim();

  try {
    const { data, error } = await supabase
      .from('user_trading_settings')
      .upsert(upsertData, { onConflict: 'user_id' })
      .select('daily_trade_limit, preferred_timezone')
      .single();

    if (error) {
      console.error('[user-settings/trading] PATCH error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({
      daily_trade_limit: data.daily_trade_limit ?? DEFAULT_DAILY_LIMIT,
      preferred_timezone: data.preferred_timezone ?? null,
    });
  } catch (err) {
    console.error('[user-settings/trading] PATCH unexpected:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
