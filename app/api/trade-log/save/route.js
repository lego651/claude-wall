import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tradeLogSchema } from '@/lib/schemas/trade-log';

/**
 * Fetch the user's default trade account, creating one if none exists.
 */
async function getOrCreateDefaultAccount(supabase, userId) {
  const { data: existing } = await supabase
    .from('trade_accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('is_default', true)
    .limit(1)
    .single();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from('trade_accounts')
    .insert({ user_id: userId, name: 'Default', is_default: true, pnl_unit: 'USD' })
    .select('id')
    .single();

  if (error) {
    console.error('[trade-log/save] Failed to create default account:', error);
    return null;
  }

  return created.id;
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const result = tradeLogSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 422 }
    );
  }

  try {
    // Resolve account_id: use provided one if owned by user, else lazy default
    let accountId = result.data.account_id || null;

    if (accountId) {
      // Verify ownership
      const { data: acct } = await supabase
        .from('trade_accounts')
        .select('id')
        .eq('id', accountId)
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (!acct) {
        accountId = null; // fall back to default if not owned
      }
    }

    if (!accountId) {
      accountId = await getOrCreateDefaultAccount(supabase, user.id);
    }

    const insertData = {
      ...result.data,
      user_id: user.id,
      account_id: accountId,
    };

    const { data, error } = await supabase
      .from('trade_logs')
      .insert(insertData)
      .select('id, created_at')
      .single();

    if (error) {
      console.error('[trade-log/save] Supabase error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('[trade-log/save] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
