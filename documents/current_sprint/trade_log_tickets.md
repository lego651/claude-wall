# Trade Log Feature — Engineering Tickets

**Sprint:** Current
**Date:** 2026-03-20
**Ref scope:** `trade_log_scope.md`

---

## Ticket 1 — DB Migration: `trade_logs` table
**Type:** Backend / DB
**File:** `migrations/46_trade_logs.sql`

Create a new table to store saved trades.

```sql
CREATE TABLE trade_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  direction TEXT CHECK (direction IN ('buy', 'sell')),
  entry_price NUMERIC,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  lots NUMERIC,
  risk_reward NUMERIC,
  trade_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  raw_input TEXT,           -- original user message for audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

- No RLS required (public access per scope).
- Update `migrations/README.md`.

---

## Ticket 2 — AI API Route: Parse Trade Input
**Type:** Backend
**File:** `app/api/trade-log/parse/route.js`
**Test file:** `app/api/trade-log/parse/route.test.js`

`POST /api/trade-log/parse`

**Request:** `multipart/form-data` with:
- `message` (string, optional) — free-text trade description
- `image` (file, optional) — screenshot or photo

**Logic:**
1. Accept text and/or base64 image.
2. Build an OpenAI messages array using `lib/ai/openai-client.ts`.
3. System prompt enforces trade-only context:
   > "You are a trade logging assistant. Extract trade fields from the user's input. If the message is not about logging a trade, respond with `{ "error": "non_trade" }` only."
4. Use `gpt-4o` with vision if image is present.
5. Return structured JSON:
```json
{
  "symbol": "EURUSD",
  "direction": "buy",
  "entry_price": 1.0850,
  "stop_loss": 1.0820,
  "take_profit": 1.0920,
  "lots": 0.1,
  "risk_reward": 2.33,
  "trade_at": "2026-03-20T10:30:00Z",
  "notes": "London session breakout"
}
```
6. If `error: "non_trade"` is returned, pass it through as-is.

**Error handling:** Wrap all DB/AI calls in try/catch; return proper 500 JSON on failure.

---

## Ticket 3 — AI API Route: Save Trade
**Type:** Backend
**File:** `app/api/trade-log/save/route.js`
**Test file:** `app/api/trade-log/save/route.test.js`

`POST /api/trade-log/save`

**Request body:** Trade fields JSON (same shape as parse response + optional user edits).

**Logic:**
1. Validate required fields (symbol at minimum) with Zod schema in `lib/schemas/`.
2. Insert row into `trade_logs` via Supabase service client.
3. Return `{ id, created_at }` on success.

---

## Ticket 4 — Zod Schema: Trade Log
**Type:** Backend
**File:** `lib/schemas/trade-log.js`
**Test file:** `lib/schemas/trade-log.test.js`

Define and export `tradeLogSchema` using Zod for use in Ticket 3 validation.

Fields: `symbol` (required), `direction`, `entry_price`, `stop_loss`, `take_profit`, `lots`, `risk_reward`, `trade_at`, `notes`.

---

## Ticket 5 — Component: TradeLogModal
**Type:** Frontend
**File:** `components/TradeLogModal.jsx`
**Test file:** `components/TradeLogModal.test.jsx`

`"use client"` component. Props: `onClose`.

**State:**
- `messages[]` — chat history (session only, `useState`)
- `input` (string)
- `imageFile` (File | null)
- `isLoading` (bool)

**Layout:**
```
┌─────────────────────────────────────────┐
│  [X] Log a Trade                         │
├─────────────────────────────────────────┤
│  chat history area (scrollable)          │
│  ┌──────────────────────────────────┐   │
│  │ user message bubble              │   │
│  ├──────────────────────────────────┤   │
│  │ TradeCard component (AI reply)   │   │
│  └──────────────────────────────────┘   │
├─────────────────────────────────────────┤
│ [text input.............] [📷] [Send →] │
└─────────────────────────────────────────┘
```

**Behavior:**
- Send button calls `POST /api/trade-log/parse` (FormData with message + optional image).
- On `error: "non_trade"` response → push a system message bubble: "This assistant is only for logging trades."
- On success → push a `TradeCard` into messages.
- Camera icon: `<input type="file" accept="image/*" capture="environment">` (triggers native camera on mobile, file picker on desktop).

---

## Ticket 6 — Component: TradeCard
**Type:** Frontend
**File:** `components/TradeCard.jsx`
**Test file:** `components/TradeCard.test.jsx`

`"use client"` component. Props: `trade` (object), `onSave`.

**States:** `view` | `editing` | `saved`

**View state:** Display all trade fields in a clean card layout. Two buttons:
- **Edit** → switches to `editing` state
- **Save** → calls `POST /api/trade-log/save`, then switches to `saved` state

**Editing state:** Render an inline HTML table with editable `<input>` fields for each trade field. A **Confirm** button exits editing and returns to view state with updated values.

**Saved state:** Disable both buttons, show a green "Saved ✓" indicator.

---

## Ticket 7 — Component: TradeLogFAB (Floating Action Button)
**Type:** Frontend
**File:** `components/TradeLogFAB.jsx`
**Test file:** `components/TradeLogFAB.test.jsx`

`"use client"` component. No props.

- Fixed position: bottom-right (`fixed bottom-6 right-6 z-50`).
- Button label: "Log Trade" with a pencil or chart icon.
- `useState(false)` to toggle `TradeLogModal` open/closed.
- Renders `<TradeLogModal onClose={() => setOpen(false)} />` when open.

---

## Ticket 8 — Home Page Integration
**Type:** Frontend
**File:** `app/page.js` (or wherever home page lives)

Import and render `<TradeLogFAB />` at the bottom of the home page component.

> Note: If `app/page.js` is a server component, just drop `<TradeLogFAB />` in — it's a client component and will self-contain its interactivity.

---

## Ticket 9 — System Prompt Tuning & Edge Cases
**Type:** Backend / QA

Validate the OpenAI system prompt handles:
- Vague inputs: "I bought AAPL" → extracts what it can, leaves others null
- Screenshot of MT4/MT5 terminal → vision extracts fields
- Off-topic: "What's the weather?" → returns `{ error: "non_trade" }`
- Ambiguous: "I made a trade" (no details) → asks for clarification in notes field

Write test cases covering these scenarios in `app/api/trade-log/parse/route.test.js`.

---

## Execution Order

```
1 → DB migration (unblocks save route)
2 → Parse API route
3 + 4 → Save API route + Zod schema (parallel)
5 + 6 → TradeLogModal + TradeCard (parallel, depends on 2+3)
7 → FAB (depends on 5)
8 → Home page wiring (depends on 7)
9 → QA / prompt tuning (parallel with 5–8)
```

---

## Definition of Done
- [ ] All new files have ≥80% Jest test coverage
- [ ] `npm run build` passes
- [ ] `npm run lint` clean
- [ ] Migration applied in dev Supabase
- [ ] Manual test: text input → card → edit → save → row in DB
- [ ] Manual test: image upload → fields extracted
- [ ] Manual test: off-topic message → refusal shown
