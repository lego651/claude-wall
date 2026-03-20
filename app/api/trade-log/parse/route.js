import { NextResponse } from 'next/server';
import { getOpenAIClient } from '@/lib/ai/openai-client';

const SYSTEM_PROMPT = `You are a trade logging assistant. Your only job is to extract structured trade information from the user's input.

IMPORTANT: If the user sends an image, assume it is ALWAYS a trading chart, MT4/MT5 screenshot, broker screenshot, or trade confirmation — treat it as a trade logging attempt and extract whatever information you can see (price levels, horizontal lines, entry/exit markers, labels, etc.). Never return non_trade for an image input.

Extract as many fields as possible from the image or text. Use null only for fields you genuinely cannot determine. For chart images, look for:
- Horizontal lines or price labels (entry, stop loss, take profit levels)
- Candlestick patterns and direction (bullish/bearish)
- Currency pair or instrument name (often shown in title bar or chart label)
- Any text overlays, trade boxes, or annotations

Respond with a JSON object containing these fields:
{
  "symbol": string,         // e.g. "EURUSD", "AAPL", "BTC/USD" — look at chart title/label
  "direction": "buy"|"sell"|null,
  "entry_price": number|null,
  "stop_loss": number|null,
  "take_profit": number|null,
  "lots": number|null,       // position size / lot size / quantity
  "risk_reward": number|null, // calculate from SL/TP if possible, else null
  "trade_at": string|null,   // ISO 8601 datetime if visible, else null
  "notes": string|null       // any extra context, chart pattern, timeframe, etc.
}

Only respond with {"error":"non_trade"} if the input is clearly unrelated to trading (e.g. asking about weather, sports, recipes). When in doubt, attempt extraction.

Respond with JSON only. No explanation, no markdown code blocks.`;

export async function POST(request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI not configured' }, { status: 500 });
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
    // Always include a text prompt so the model has a clear task anchor
    userContent.push({
      type: 'text',
      text: message || 'Extract trade information from this chart/screenshot.',
    });
    if (imageBase64) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:${imageMimeType};base64,${imageBase64}` },
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

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 502 });
    }

    if (parsed.error === 'non_trade') {
      return NextResponse.json({ error: 'non_trade' });
    }

    // Auto-calculate risk_reward if missing but SL and TP are present
    if (!parsed.risk_reward && parsed.entry_price && parsed.stop_loss && parsed.take_profit) {
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
