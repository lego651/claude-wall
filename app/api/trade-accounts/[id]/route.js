import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// PATCH /api/trade-accounts/[id] — rename or set as default
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

  if ('pnl_unit' in body) {
    return NextResponse.json({ error: 'P&L unit cannot be changed after creation' }, { status: 400 });
  }

  const { id } = await params;

  // Verify ownership
  const { data: account } = await supabase
    .from('trade_accounts')
    .select('id, is_default')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  try {
    const updates = {};

    if ('name' in body) {
      const name = body.name?.toString().trim();
      if (!name || name.length === 0) {
        return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
      }
      if (name.length > 50) {
        return NextResponse.json({ error: 'name must be 50 characters or fewer' }, { status: 400 });
      }
      updates.name = name;
    }

    if ('default_pnl' in body) {
      const val = body.default_pnl;
      if (val === null) {
        updates.default_pnl = null;
      } else {
        const num = parseFloat(val);
        if (isNaN(num)) {
          return NextResponse.json({ error: 'default_pnl must be a number or null' }, { status: 400 });
        }
        updates.default_pnl = num;
      }
    }

    if (body.is_default === true) {
      // Unset all other defaults for this user first
      await supabase
        .from('trade_accounts')
        .update({ is_default: false })
        .eq('user_id', user.id);

      updates.is_default = true;
    }

    const { data, error } = await supabase
      .from('trade_accounts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, name, is_default, pnl_unit, default_pnl, created_at')
      .single();

    if (error) {
      console.error('[trade-accounts/[id]] PATCH error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[trade-accounts/[id]] PATCH unexpected:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/trade-accounts/[id] — delete non-default account
export async function DELETE(request, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: account } = await supabase
    .from('trade_accounts')
    .select('id, is_default')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  if (account.is_default) {
    return NextResponse.json({ error: 'Cannot delete your default account' }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('trade_accounts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[trade-accounts/[id]] DELETE error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[trade-accounts/[id]] DELETE unexpected:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
