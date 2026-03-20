import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { tradeLogSchema } from '@/lib/schemas/trade-log';

export async function POST(request) {
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
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('trade_logs')
      .insert(result.data)
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
