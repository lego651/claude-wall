import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOpenAIClient } from '@/lib/ai/openai-client';

const BUCKET = 'trade-charts';

/**
 * POST /api/trade-log/chart-upload
 *
 * FormData:
 *   image      - required: the chart image file
 *   old_path   - optional: existing chart_image_path to delete (for replacements)
 *
 * Validates the image is a trading chart via GPT-4o, then uploads to Supabase Storage.
 * Returns: { chart_image_path }
 */
export async function POST(request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI not configured' }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let imageBuffer, imageMimeType, oldPath;
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image');
    oldPath = formData.get('old_path') || null;

    if (!imageFile || imageFile.size === 0) {
      return NextResponse.json({ error: 'Image required' }, { status: 400 });
    }
    imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    imageMimeType = imageFile.type || 'image/jpeg';
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // AI validation: confirm this is a trading chart screenshot
  try {
    const openai = getOpenAIClient();
    const base64 = imageBuffer.toString('base64');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Is this a trading chart or trading screenshot (candlestick chart, price chart, broker order screen, etc.)? Reply with JSON only: {"is_trading_chart": true} or {"is_trading_chart": false}',
          },
          { type: 'image_url', image_url: { url: `data:${imageMimeType};base64,${base64}` } },
        ],
      }],
      max_tokens: 20,
      temperature: 0,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '';
    let parsed = {};
    try { parsed = JSON.parse(raw); } catch { /* non-JSON → reject */ }

    if (!parsed.is_trading_chart) {
      return NextResponse.json({ error: 'not_trading_chart' }, { status: 422 });
    }
  } catch (err) {
    console.error('[chart-upload] AI validation error:', err);
    return NextResponse.json({ error: 'AI validation failed' }, { status: 500 });
  }

  // Delete old image when replacing
  if (oldPath) {
    await supabase.storage.from(BUCKET).remove([oldPath]);
  }

  // Upload new image
  const ext = imageMimeType === 'image/png' ? 'png' : imageMimeType === 'image/webp' ? 'webp' : 'jpg';
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, imageBuffer, { contentType: imageMimeType });

  if (uploadError) {
    console.error('[chart-upload] upload error:', uploadError);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  return NextResponse.json({ chart_image_path: path });
}
