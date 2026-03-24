import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const DEFAULT_DAILY_LIMIT = 3;

export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const account_id = searchParams.get('account_id') || null;

  // Validate date param
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date is required (YYYY-MM-DD)' }, { status: 400 });
  }

  try {
    // Fetch daily trade limit
    const { data: settingsData } = await supabase
      .from('user_trading_settings')
      .select('daily_trade_limit')
      .eq('user_id', user.id)
      .single();
    const dailyLimit = settingsData?.daily_trade_limit ?? DEFAULT_DAILY_LIMIT;

    // Build trade query
    const dayStart = `${date}T00:00:00.000Z`;
    const dayEnd = `${date}T23:59:59.999Z`;

    let query = supabase
      .from('trade_logs')
      .select(`
        id, symbol, direction, entry_price, stop_loss, take_profit,
        lots, risk_reward, trade_at, notes, pnl, account_id,
        trade_accounts!account_id (name, pnl_unit)
      `)
      .eq('user_id', user.id)
      .gte('trade_at', dayStart)
      .lte('trade_at', dayEnd)
      .order('trade_at', { ascending: true });

    if (account_id) {
      query = query.eq('account_id', account_id);
    }

    const { data: trades, error } = await query;

    if (error) {
      console.error('[trade-log/daily] query error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Flatten joined account fields
    const flatTrades = (trades || []).map((t) => ({
      id: t.id,
      symbol: t.symbol,
      direction: t.direction,
      entry_price: t.entry_price,
      stop_loss: t.stop_loss,
      take_profit: t.take_profit,
      lots: t.lots,
      risk_reward: t.risk_reward,
      trade_at: t.trade_at,
      notes: t.notes,
      pnl: t.pnl,
      account_id: t.account_id,
      account_name: t.trade_accounts?.name ?? null,
      pnl_unit: t.trade_accounts?.pnl_unit ?? null,
    }));

    // Compute P&L total (null if all null)
    const pnlValues = flatTrades.map((t) => t.pnl).filter((v) => v !== null);
    const pnlTotal = pnlValues.length > 0 ? pnlValues.reduce((a, b) => a + b, 0) : null;

    // pnl_unit from selected account (null if no account filter)
    let pnlUnit = null;
    if (account_id) {
      const { data: acct } = await supabase
        .from('trade_accounts')
        .select('pnl_unit')
        .eq('id', account_id)
        .eq('user_id', user.id)
        .single();
      pnlUnit = acct?.pnl_unit ?? null;
    }

    const tradesLogged = flatTrades.length;
    const tradesRemaining = Math.max(0, dailyLimit - tradesLogged);

    return NextResponse.json({
      date,
      daily_limit: dailyLimit,
      trades_logged: tradesLogged,
      trades_remaining: tradesRemaining,
      pnl_total: pnlTotal,
      pnl_unit: pnlUnit,
      trades: flatTrades,
    });
  } catch (err) {
    console.error('[trade-log/daily] unexpected:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
