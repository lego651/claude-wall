import { NextResponse } from 'next/server';
import { getOpenAIClient } from '@/lib/ai/openai-client';
import { createClient } from '@/lib/supabase/server';
import { SYSTEM_PROMPT, ALLOWED_INTENTS } from '@/lib/ai/trade-chat-rules';

export async function POST(request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI not configured' }, { status: 500 });
  }

  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let message = '';
  let imageBase64 = null;
  let imageMimeType = 'image/jpeg';

  try {
    const formData = await request.formData();
    message = (formData.get('message') || '').toString().trim();
    const imageFile = formData.get('image');

    if (imageFile && imageFile.size > 0) {
      const buffer = await imageFile.arrayBuffer();
      imageBase64 = Buffer.from(buffer).toString('base64');
      imageMimeType = imageFile.type || 'image/jpeg';
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!message && !imageBase64) {
    return NextResponse.json({ error: 'message or image required' }, { status: 400 });
  }

  try {
    const openai = getOpenAIClient();

    const userContent = [];
    userContent.push({
      type: 'text',
      text: message || 'Extract trade information from this chart/screenshot.',
    });
    if (imageBase64) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:${imageMimeType};base64,${imageBase64}`, detail: 'high' },
      });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      max_tokens: 500,
      temperature: 0,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '';

    // Strip markdown code fences if the model wraps its response
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('[trade-log/parse] Non-JSON response:', raw);
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 502 });
    }

    if (parsed.error === 'non_trade') {
      return NextResponse.json({ error: 'non_trade' });
    }

    // Validate type; default to new_trade for backward compatibility
    if (!parsed.type || !ALLOWED_INTENTS.includes(parsed.type)) {
      parsed.type = 'new_trade';
    }

    // Sanity-check SL/TP direction against entry — null out values that are logically impossible
    if (parsed.type === 'new_trade' && parsed.entry_price && parsed.stop_loss && parsed.take_profit) {
      const isBuy = parsed.direction === 'buy';
      const isSell = parsed.direction === 'sell';
      if (isBuy && parsed.stop_loss >= parsed.entry_price) parsed.stop_loss = null;
      if (isBuy && parsed.take_profit <= parsed.entry_price) parsed.take_profit = null;
      if (isSell && parsed.stop_loss <= parsed.entry_price) parsed.stop_loss = null;
      if (isSell && parsed.take_profit >= parsed.entry_price) parsed.take_profit = null;
    }

    // Auto-calculate risk_reward if missing but SL and TP are present (new_trade only)
    if (
      parsed.type === 'new_trade' &&
      !parsed.risk_reward &&
      parsed.entry_price &&
      parsed.stop_loss &&
      parsed.take_profit
    ) {
      const risk = Math.abs(parsed.entry_price - parsed.stop_loss);
      const reward = Math.abs(parsed.take_profit - parsed.entry_price);
      if (risk > 0) {
        parsed.risk_reward = Math.round((reward / risk) * 100) / 100;
      }
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('[trade-log/parse] OpenAI error:', err);
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
  }
}
