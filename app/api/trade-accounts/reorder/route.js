import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/trade-accounts/reorder — persist user-defined account order
// body: { ids: string[] } — account IDs in the desired order
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

  const { ids } = body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 });
  }

  try {
    // Verify all ids belong to this user
    const { data: accounts, error: fetchError } = await supabase
      .from('trade_accounts')
      .select('id')
      .eq('user_id', user.id)
      .in('id', ids);

    if (fetchError) throw fetchError;

    const ownedIds = new Set(accounts.map((a) => a.id));
    if (ids.some((id) => !ownedIds.has(id))) {
      return NextResponse.json({ error: 'One or more accounts not found' }, { status: 404 });
    }

    // Update sort_order for each account
    await Promise.all(
      ids.map((id, index) =>
        supabase
          .from('trade_accounts')
          .update({ sort_order: index })
          .eq('id', id)
          .eq('user_id', user.id)
      )
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[trade-accounts/reorder] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
