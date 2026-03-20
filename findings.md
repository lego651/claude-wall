# Findings — Trade Log Feature

---

## Codebase Audit (2026-03-20)

### Reusable — no rework needed
- `lib/ai/openai-client.ts` — `getOpenAIClient()` singleton; reuse for parse route
- `lib/supabase/service.ts` — service client for DB writes (bypasses RLS)
- `lib/schemas/` — existing Zod schemas; add `trade-log.js` here

### Key Facts
- Last migration: `45_youtube_live_stream.sql` → next = **`46_`**
- `app/page.js` is a **server component** — FAB must be a separate `"use client"` component imported into it
- OpenAI model for vision: `gpt-4o` (supports image inputs). `gpt-4o-mini` does NOT support vision reliably
- File upload: use `request.formData()` in Next.js API route; read file as buffer, convert to base64 for OpenAI vision
- Existing API route pattern: `NextResponse.json()`, env var checks, try/catch wrapping all logic

### Schema: trade_logs (new, migration 46)
```sql
id UUID PK, symbol TEXT NOT NULL, direction TEXT (buy/sell),
entry_price NUMERIC, stop_loss NUMERIC, take_profit NUMERIC,
lots NUMERIC, risk_reward NUMERIC, trade_at TIMESTAMPTZ,
notes TEXT, raw_input TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
```

### OpenAI Vision Pattern
```js
messages: [{
  role: "user",
  content: [
    { type: "text", text: userMessage },
    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } }
  ]
}]
```

### Component Structure
```
app/page.js (server)
  └── <TradeLogFAB /> (client)
        └── <TradeLogModal /> (client)
              └── <TradeCard /> (client)
```
