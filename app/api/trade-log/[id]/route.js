import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const PATCH_SCHEMA = z.object({
  symbol: z.string().min(1).max(20).optional(),
  direction: z.enum(['buy', 'sell']).nullable().optional(),
  entry_price: z.number().positive().nullable().optional(),
  stop_loss: z.number().positive().nullable().optional(),
  take_profit: z.number().positive().nullable().optional(),
  lots: z.number().positive().nullable().optional(),
  risk_reward: z.number().nullable().optional(),
  trade_at: z.string().datetime({ offset: true }).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  pnl: z.number().nullable().optional(),
  account_id: z.string().uuid().nullable().optional(),
  chart_url: z.string().max(2048).nullable().optional(),
  chart_image_path: z.string().max(512).nullable().optional(),
});

// PATCH /api/trade-log/[id]
export async function PATCH(request, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const result = PATCH_SCHEMA.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 422 }
    );
  }

  const { id } = await params;

  try {
    // Verify ownership and fetch existing chart image path for cleanup
    const { data: existing } = await supabase
      .from('trade_logs')
      .select('id, chart_image_path')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    // Only update keys present in body (partial update)
    const updates = {};
    for (const key of Object.keys(body)) {
      if (key in result.data) {
        updates[key] = result.data[key] !== undefined ? result.data[key] : body[key];
      }
    }
    // Explicitly handle nullable fields
    if ('pnl' in body) updates.pnl = body.pnl;
    if ('chart_url' in body) updates.chart_url = body.chart_url;
    if ('chart_image_path' in body) updates.chart_image_path = body.chart_image_path;

    // If chart_image_path is being cleared, delete old file from storage
    if ('chart_image_path' in updates && updates.chart_image_path === null && existing.chart_image_path) {
      await supabase.storage.from('trade-charts').remove([existing.chart_image_path]);
    }

    const { data, error } = await supabase
      .from('trade_logs')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select(`
        id, symbol, direction, entry_price, stop_loss, take_profit,
        lots, risk_reward, trade_at, notes, pnl, account_id,
        chart_url, chart_image_path,
        trade_accounts!account_id (name, pnl_unit)
      `)
      .single();

    if (error) {
      console.error('[trade-log/[id]] PATCH error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Flatten account fields
    const flat = data ? {
      ...data,
      account_name: data.trade_accounts?.name ?? null,
      pnl_unit: data.trade_accounts?.pnl_unit ?? null,
      trade_accounts: undefined,
    } : data;

    return NextResponse.json(flat);
  } catch (err) {
    console.error('[trade-log/[id]] PATCH unexpected:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/trade-log/[id]
export async function DELETE(request, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    // Verify ownership and fetch chart image path for cleanup
    const { data: existing } = await supabase
      .from('trade_logs')
      .select('id, chart_image_path')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('trade_logs')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[trade-log/[id]] DELETE error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Clean up chart image from storage after successful delete
    if (existing.chart_image_path) {
      await supabase.storage.from('trade-charts').remove([existing.chart_image_path]);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[trade-log/[id]] DELETE unexpected:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
