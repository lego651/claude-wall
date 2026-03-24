import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Get week number (1-based) of a date within its month, using Sun–Sat rows.
 * Returns the index of the calendar row (1 = first row containing that date).
 */
function getWeekRow(year, month, day) {
  // day of week for the 1st of the month (0=Sun)
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  // 0-indexed day position in the flat grid
  const gridPos = firstDow + day - 1;
  return Math.floor(gridPos / 7) + 1;
}

/**
 * Generate all calendar rows (Sun–Sat) for the given month.
 * Returns array of { week, label, saturday } where saturday is "YYYY-MM-DD".
 */
function buildWeekRows(year, month) {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // Number of rows needed
  const rowCount = Math.ceil((firstDow + daysInMonth) / 7);

  const rows = [];
  for (let row = 0; row < rowCount; row++) {
    // Saturday of this row = row*7 + 6 - firstDow (1-based day in month)
    const satDay = row * 7 + 7 - firstDow; // day number that falls on Saturday
    // Clamp to month boundaries for the label date
    const satActual = Math.min(Math.max(satDay, 1), daysInMonth);
    const satDate = `${year}-${String(month).padStart(2, '0')}-${String(satActual).padStart(2, '0')}`;
    rows.push({ week: row + 1, label: `Week ${row + 1}`, trade_count: 0, pnl: null, saturday: satDate });
  }
  return rows;
}

export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');
  const account_id = searchParams.get('account_id') || null;

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month is required (YYYY-MM)' }, { status: 400 });
  }

  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);

  if (monthNum < 1 || monthNum > 12) {
    return NextResponse.json({ error: 'month is required (YYYY-MM)' }, { status: 400 });
  }

  try {
    const monthStart = `${month}-01T00:00:00.000Z`;
    const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
    const monthEnd = `${month}-${String(daysInMonth).padStart(2, '0')}T23:59:59.999Z`;

    let query = supabase
      .from('trade_logs')
      .select('trade_at, pnl, account_id, trade_accounts!account_id (pnl_unit)')
      .eq('user_id', user.id)
      .gte('trade_at', monthStart)
      .lte('trade_at', monthEnd)
      .order('trade_at', { ascending: true });

    if (account_id) {
      query = query.eq('account_id', account_id);
    }

    const { data: trades, error } = await query;

    if (error) {
      console.error('[trade-log/monthly] query error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // pnl_unit from selected account
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

    // Build day aggregates
    const dayMap = {};
    for (const trade of (trades || [])) {
      const d = trade.trade_at?.substring(0, 10);
      if (!d) continue;
      if (!dayMap[d]) dayMap[d] = { trade_count: 0, pnlValues: [] };
      dayMap[d].trade_count++;
      if (trade.pnl !== null) dayMap[d].pnlValues.push(trade.pnl);
    }

    const days = {};
    for (const [d, { trade_count, pnlValues }] of Object.entries(dayMap)) {
      days[d] = {
        trade_count,
        pnl: pnlValues.length > 0 ? pnlValues.reduce((a, b) => a + b, 0) : null,
      };
    }

    // Build week rows
    const weekRows = buildWeekRows(year, monthNum);
    for (const [d, { trade_count, pnl }] of Object.entries(days)) {
      const day = parseInt(d.split('-')[2], 10);
      const weekIdx = getWeekRow(year, monthNum, day) - 1;
      if (weekIdx < 0 || weekIdx >= weekRows.length) continue;
      weekRows[weekIdx].trade_count += trade_count;
      if (pnl !== null) {
        weekRows[weekIdx].pnl = (weekRows[weekIdx].pnl ?? 0) + pnl;
      }
    }

    // Monthly total
    const allPnl = Object.values(days).map((d) => d.pnl).filter((v) => v !== null);
    const monthlyPnl = allPnl.length > 0 ? allPnl.reduce((a, b) => a + b, 0) : null;

    return NextResponse.json({
      month,
      pnl_unit: pnlUnit,
      monthly_pnl: monthlyPnl,
      days,
      weeks: weekRows,
    });
  } catch (err) {
    console.error('[trade-log/monthly] unexpected:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
