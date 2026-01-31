/**
 * OpenAI client for Alpha intelligence (TICKET-005)
 * Used by review classifier and future AI features.
 */

import OpenAI from 'openai';

let client: OpenAI | null = null;

/**
 * Get initialized OpenAI client. Throws if OPENAI_API_KEY is missing.
 */
export function getOpenAIClient(): OpenAI {
  if (client) return client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set. Add it to .env.local and Vercel environment.');
  }

  client = new OpenAI({ apiKey });
  return client;
}

/**
 * Test API connection with a minimal prompt. Returns true if successful.
 */
export async function testOpenAIConnection(): Promise<boolean> {
  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      max_tokens: 5,
    });
    const text = completion.choices[0]?.message?.content?.trim();
    return text === 'OK';
  } catch (err) {
    console.error('[OpenAI] Connection test failed:', err);
    return false;
  }
}

export default getOpenAIClient;
