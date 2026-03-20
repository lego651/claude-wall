# Sprint 14 Tickets — Trade Log v2: /logs Page + Accounts + Settings

**Sprint Goal:** Auth-bind the trade log, add trade accounts with P&L unit types, expand AI chat for P&L updates, build the /logs journal page.
**Scope ref:** `s14_scope.md`
**Date:** 2026-03-20 (rev 2)
**Total story points:** 40

---

## Execution Order

```
S14-001  DB migrations 47–49                    (unblocks all)
S14-002  AI chat rules file + updated parse     (unblocks S14-007, S14-010 chat flow)
S14-003  Auth enforcement: FAB + save route     (unblocks /logs auth)
S14-004  Trade accounts API routes              (unblocks S14-005, S14-006)
S14-005  Trading settings API route             (unblocks S14-005-ui)
S14-006  Settings page: Trading Log section     (depends on S14-004, S14-005)
S14-007  Trade log modal: account picker + P&L field + pnl_update flow  (depends on S14-004)
S14-008  GET /api/trade-log/daily               (unblocks S14-010)
S14-009  GET /api/trade-log/monthly             (unblocks S14-011)
S14-010  PATCH + DELETE /api/trade-log/[id]    (unblocks S14-013)
S14-011  /logs page shell + day nav + summary   (depends on S14-003, S14-008)
S14-012  /logs page monthly calendar            (depends on S14-009, S14-011)
S14-013  /logs page calendar day picker         (depends on S14-011)
S14-014  /logs page trade list + edit/delete    (depends on S14-010, S14-011)
```

---

## Summary Table

| Ticket | Title | Points | Priority |
|--------|-------|--------|----------|
| S14-001 | DB migrations 47–49 | 2 | P0 |
| S14-002 | AI chat rules file + updated parse route | 3 | P0 |
| S14-003 | Auth enforcement: FAB + save route | 3 | P0 |
| S14-004 | Trade accounts API routes | 3 | P1 |
| S14-005 | Trading settings API route | 1 | P1 |
| S14-006 | Settings page: Trading Log section | 3 | P1 |
| S14-007 | Trade log modal: account picker + P&L + pnl_update flow | 4 | P0 |
| S14-008 | GET /api/trade-log/daily | 2 | P0 |
| S14-009 | GET /api/trade-log/monthly | 3 | P0 |
| S14-010 | PATCH + DELETE /api/trade-log/[id] | 2 | P1 |
| S14-011 | /logs page: shell + day navigator + summary card | 5 | P0 |
| S14-012 | /logs page: monthly review calendar | 5 | P0 |
| S14-013 | /logs page: calendar day picker | 3 | P1 |
| S14-014 | /logs page: trade list + edit/delete | 3 | P1 |

**Total: 42 points**

---

## TICKET S14-001: DB Migrations 47–49

**Priority:** P0 | **Points:** 2
**Files:** `migrations/47_trade_logs_user.sql`, `migrations/48_trade_accounts.sql`, `migrations/49_user_trading_settings.sql`, `migrations/README.md`

### Migration 47 — Extend `trade_logs`
```sql
ALTER TABLE trade_logs
  ADD COLUMN IF NOT EXISTS user_id    UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS account_id UUID,
  ADD COLUMN IF NOT EXISTS pnl        NUMERIC;  -- null = not recorded; unit from account

CREATE INDEX IF NOT EXISTS idx_trade_logs_user_date
  ON trade_logs (user_id, trade_at DESC);
```
Existing rows: all new columns null (orphaned; not shown in /logs).

### Migration 48 — `trade_accounts`
```sql
CREATE TABLE IF NOT EXISTS trade_accounts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  pnl_unit   TEXT NOT NULL DEFAULT 'USD' CHECK (pnl_unit IN ('R', 'USD')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trade_accounts_user ON trade_accounts (user_id);
```
`pnl_unit` is immutable post-creation — enforced in API layer (PATCH rejects this field).

### Migration 49 — `user_trading_settings`
```sql
CREATE TABLE IF NOT EXISTS user_trading_settings (
  user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_trade_limit INT NOT NULL DEFAULT 3 CHECK (daily_trade_limit >= 1),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

**Acceptance criteria:**
- [ ] All three files created and idempotent (IF NOT EXISTS / IF EXISTS)
- [ ] `migrations/README.md` updated with entries 47, 48, 49
- [ ] No test file needed (pure SQL)

---

## TICKET S14-002: AI Chat Rules File + Updated Parse Route

**Priority:** P0 | **Points:** 3
**Files:**
- `lib/ai/trade-chat-rules.js` (new)
- `app/api/trade-log/parse/route.js` (modify — import rules, expand response shape)
- `app/api/trade-log/parse/route.test.js` (modify — add pnl_update tests)

### `lib/ai/trade-chat-rules.js`
Export the following:

```js
export const ALLOWED_INTENTS = ['new_trade', 'pnl_update'];

export const SYSTEM_PROMPT = `...`; // see below
```

Move the system prompt from `parse/route.js` into this file. The parse route imports `SYSTEM_PROMPT` from here.

**Updated system prompt** must instruct the AI to return one of three shapes:

**New trade:**
```json
{
  "type": "new_trade",
  "symbol": "EURUSD",
  "direction": "buy",
  "entry_price": 1.0850,
  "stop_loss": 1.0820,
  "take_profit": 1.0920,
  "lots": 0.1,
  "risk_reward": 2.33,
  "trade_at": null,
  "notes": null
}
```

**P&L update** (user describes or shows a trade result):
```json
{
  "type": "pnl_update",
  "symbol": "EURUSD",
  "pnl": 2.0
}
```
- `pnl` is always a plain number. Positive = profit, negative = loss.
- AI extracts the numeric value only (e.g. "2R" → `2.0`, "+$1000" → `1000`, "-500" → `-500`).
- AI does NOT embed the unit in the response — the frontend derives it from the account.
- If the user says "my EURUSD trade made 2R" or shows a screenshot of a +$1000 result → return `pnl_update`.
- If it's clearly a new trade being opened → return `new_trade`.

**Off-topic:**
```json
{ "error": "non_trade" }
```

**System prompt rules section:**
> Only respond with `{"error":"non_trade"}` if the input is completely unrelated to trading (e.g. weather, cooking, sports). If in doubt, attempt extraction. Images are assumed to be trading-related unless obviously otherwise.
> If the user is describing a trade result, profit, or loss — return `pnl_update`. If they are opening/planning a new position — return `new_trade`.

### Updated parse route
- Import `SYSTEM_PROMPT` from `lib/ai/trade-chat-rules.js`.
- After JSON parsing, validate `type` is one of `['new_trade', 'pnl_update']` (or `error`).
- If `type` missing → default to `new_trade` for backward compatibility.
- Return the parsed object as-is (frontend handles both shapes).

**Acceptance criteria:**
- [ ] `lib/ai/trade-chat-rules.js` exports `SYSTEM_PROMPT` and `ALLOWED_INTENTS`
- [ ] Parse route imports prompt from rules file (no inline prompt)
- [ ] `pnl_update` intent returned correctly for "EURUSD +2R" style input (mocked)
- [ ] `pnl_update` from screenshot: mock returns correct shape (mocked AI)
- [ ] `new_trade` still works for regular trade descriptions
- [ ] `non_trade` still works for off-topic
- [ ] ≥80% coverage maintained on parse route
- [ ] Tests in `route.test.js` cover both `new_trade` and `pnl_update` paths

---

## TICKET S14-003: Auth Enforcement — FAB + Save Route

**Priority:** P0 | **Points:** 3
**Files:**
- `components/trade-log/TradeLogFAB.jsx` (modify)
- `components/trade-log/TradeLogFAB.test.jsx` (modify)
- `app/api/trade-log/save/route.js` (modify)
- `app/api/trade-log/save/route.test.js` (modify)
- `app/api/trade-log/parse/route.js` (modify — add auth check)
- `lib/schemas/trade-log.js` (modify — add `account_id`, `pnl`)

### FAB — client-side auth check
On mount, call `supabase.auth.getUser()` and store result in state (`isLoggedIn`).
On click:
- If `!isLoggedIn` → `router.push(config.auth.loginUrl)`
- If logged in → open modal

### Parse route — add auth check
```js
const supabase = await createClient(); // server client
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```
Parse logic itself unchanged.

### Save route — inject user_id + lazy default account
- Switch from `createServiceClient()` to `createClient()` (server) for session.
- Return 401 if no user.
- Inject `user_id: user.id` (never from body).
- Accept `account_id` (optional UUID) from body. If provided and owned by user → use it.
- If `account_id` not provided → call `getOrCreateDefaultAccount(supabase, userId)`:
  ```
  SELECT id FROM trade_accounts WHERE user_id = $1 AND is_default = true LIMIT 1
  → if none: INSERT { user_id, name: 'Default', is_default: true, pnl_unit: 'USD' }
  → return id
  ```
- Inject resolved `account_id` into insert.

### Schema update (`lib/schemas/trade-log.js`)
Add to `tradeLogSchema`:
```js
account_id: z.string().uuid().nullable().optional(),
pnl: z.number().nullable().optional(),
```
Remove `exit_price` if previously added (not in scope).

**Acceptance criteria:**
- [ ] Unauthenticated FAB click → redirected to login
- [ ] Authenticated click → modal opens
- [ ] POST /api/trade-log/parse → 401 if no session
- [ ] POST /api/trade-log/save → 401 if no session
- [ ] Saved trade has `user_id` from session; `account_id` from body or lazy default
- [ ] First save creates default account if none exists
- [ ] ≥80% coverage maintained

---

## TICKET S14-004: Trade Accounts API Routes

**Priority:** P1 | **Points:** 3
**Files:**
- `app/api/trade-accounts/route.js` (new — GET + POST)
- `app/api/trade-accounts/route.test.js` (new)
- `app/api/trade-accounts/[id]/route.js` (new — PATCH + DELETE)
- `app/api/trade-accounts/[id]/route.test.js` (new)

### GET /api/trade-accounts
Returns accounts sorted `is_default DESC, created_at ASC`.
```json
[
  { "id": "uuid", "name": "Default", "is_default": true, "pnl_unit": "USD", "created_at": "..." },
  { "id": "uuid", "name": "Funded A", "is_default": false, "pnl_unit": "R", "created_at": "..." }
]
```

### POST /api/trade-accounts
Body: `{ "name": "Funded A", "pnl_unit": "R" }`
- Validates: `name` required (max 50 chars), `pnl_unit` must be `"R"` or `"USD"`.
- Inserts with `is_default: false`.
- Returns new account object.

### PATCH /api/trade-accounts/[id]
Accepted body fields: `name`, `is_default`.
- **Rename:** update `name` only. Max 50 chars.
- **Set as default:** set all user accounts `is_default = false`, then set this one `true`.
- **Reject `pnl_unit` in body:** if `pnl_unit` present → 400 `"P&L unit cannot be changed after creation"`.
- 404 if not found or owned by another user.

### DELETE /api/trade-accounts/[id]
- 400 if `is_default = true`: `"Cannot delete your default account"`.
- Delete; return `{ success: true }`.
- 404 if not found or owned by another user.

All routes: 401 if unauthenticated.

**Acceptance criteria:**
- [ ] GET returns only current user's accounts with `pnl_unit`
- [ ] POST validates `pnl_unit`; rejects invalid values
- [ ] PATCH rename works; set-default swaps correctly
- [ ] PATCH rejects `pnl_unit` field with 400
- [ ] DELETE blocks default; deletes non-default
- [ ] All routes 401 without auth
- [ ] ≥80% coverage per test file

---

## TICKET S14-005: Trading Settings API Route

**Priority:** P1 | **Points:** 1
**Files:**
- `app/api/user-settings/trading/route.js` (new)
- `app/api/user-settings/trading/route.test.js` (new)

### GET
Returns `{ daily_trade_limit: 3 }`. If no DB row, return default without inserting.

### PATCH
Body: `{ "daily_trade_limit": 5 }` — integer, min 1. Upsert. Returns updated settings.

**Acceptance criteria:**
- [ ] GET returns default 3 if no row
- [ ] PATCH upserts; validates min 1
- [ ] 401 without auth; ≥80% coverage

---

## TICKET S14-006: Settings Page — Trading Log Section

**Priority:** P1 | **Points:** 3
**Files:**
- `app/user/settings/page.js` (modify — add section)
- `components/settings/TradingLogSettings.jsx` (new)
- `components/settings/TradingLogSettings.test.jsx` (new)

New **"Trading Log"** section on `/user/settings` with two parts:

### Part A — Daily Trade Limit
Number input + save button → PATCH `/api/user-settings/trading`. Toast on result.

### Part B — Trade Accounts
- List: account name + `pnl_unit` badge (read-only, styled as tag: "R" or "$") + "Default" badge.
- **Rename:** inline text input on click → save on blur/Enter → PATCH name.
- **Set as default:** button on non-default.
- **Delete:** trash icon on non-default → inline confirm → DELETE.
- **Add account form** at bottom:
  - Name text input (required)
  - P&L unit radio: `R (risk multiples)` | `$ (US dollars)` — default `$`
  - Helper text: "⚠ Cannot be changed after creation"
  - "Add" button → POST; updates list on success.

**Acceptance criteria:**
- [ ] Trading Log section renders in settings page
- [ ] Daily limit loads + saves with toast
- [ ] Accounts list shows name + pnl_unit badge + Default badge
- [ ] Rename/set-default/delete work; cannot delete default
- [ ] Add form: both fields required; pnl_unit radio required; warning shown
- [ ] New account appears in list after creation with correct pnl_unit badge
- [ ] ≥80% coverage on `TradingLogSettings`

---

## TICKET S14-007: Trade Log Modal — Account Picker + P&L Field + pnl_update Flow

**Priority:** P0 | **Points:** 4
**Files:**
- `components/trade-log/TradeLogModal.jsx` (modify)
- `components/trade-log/TradeLogModal.test.jsx` (modify)

### Account picker
- On modal open: GET `/api/trade-accounts`. Show dropdown: account name + pnl_unit tag.
- Pre-select default account. Persist selection within session.
- Graceful if fetch fails (proceed without account_id, save route uses default).

### P&L field (new trade flow)
- Below the chat input, show an optional collapsed "P&L" row (expand on tap for mobile).
- Input: number (positive/negative). Label: **"P&L (R)"** or **"P&L ($)"** based on selected account's `pnl_unit`.
- Placeholder: `e.g. 2` or `e.g. 1000`. Empty → saves `pnl: null`.
- Sent to `/api/trade-log/save` along with `account_id`.

### P&L update flow (pnl_update response from parse)
When parse returns `{ type: 'pnl_update', symbol, pnl }`:

1. Fetch today's trades: GET `/api/trade-log/daily?date=<today>&account_id=<active>`.
2. Filter `trades` by `symbol` (case-insensitive).
3. **No match:** push system bubble: `"No [EURUSD] trade found today. Log the trade first."`
4. **One match:** push a confirmation bubble:
   ```
   Update EURUSD trade P&L to +2R?
   Entry: 1.0850 at 10:30 UTC
   [Confirm]  [Cancel]
   ```
5. **Multiple matches:** push a selection bubble listing each trade (symbol + time); user taps one → show confirmation as in step 4.
6. On **Confirm:** PATCH `/api/trade-log/[id]` with `{ pnl }`. Push success bubble: `"P&L updated: +2R on EURUSD ✓"`.
7. On **Cancel:** push cancel bubble: `"Cancelled."`

Pnl display in bubbles: format based on active account's `pnl_unit`:
- `R`: `+2R`, `-1.5R`
- `USD`: `+$1,000`, `-$500`

**Acceptance criteria:**
- [ ] Account dropdown renders with pnl_unit tag; default pre-selected
- [ ] P&L field label changes when account changes
- [ ] P&L value sent on new trade save; blank → null
- [ ] `pnl_update` response → fetch daily trades → match by symbol
- [ ] No match → system message shown
- [ ] One match → confirmation bubble with trade details
- [ ] Multiple matches → selection bubble; pick one → confirmation
- [ ] Confirm → PATCH called; success bubble shown
- [ ] Cancel → cancel bubble
- [ ] ≥80% coverage maintained

---

## TICKET S14-008: GET /api/trade-log/daily

**Priority:** P0 | **Points:** 2
**Files:**
- `app/api/trade-log/daily/route.js` (new)
- `app/api/trade-log/daily/route.test.js` (new)

### Request
`GET /api/trade-log/daily?date=YYYY-MM-DD&account_id=uuid`
- `date`: required, validated.
- `account_id`: optional filter.

### Response
```json
{
  "date": "2026-03-20",
  "daily_limit": 3,
  "trades_logged": 2,
  "trades_remaining": 1,
  "pnl_total": null,
  "pnl_unit": "USD",
  "trades": [
    {
      "id": "uuid",
      "symbol": "EURUSD",
      "direction": "buy",
      "entry_price": 1.0850,
      "pnl": null,
      "lots": 0.1,
      "risk_reward": 2.33,
      "trade_at": "2026-03-20T10:30:00Z",
      "notes": null,
      "account_id": "uuid",
      "account_name": "Default",
      "pnl_unit": "USD"
    }
  ]
}
```
- `pnl_total`: sum of non-null `pnl` values; `null` if all are null.
- `pnl_unit`: from selected account; `null` if no account filter (mixed accounts).
- `account_name` joined from `trade_accounts`.
- `trades_remaining`: `max(0, daily_limit - trades_logged)`.

**Acceptance criteria:**
- [ ] Returns correct trades for date + account filter
- [ ] `pnl_total` is null when all trades have null pnl; sums correctly when set
- [ ] `pnl_unit` present when account_id provided
- [ ] 401 without auth; 400 on invalid date
- [ ] ≥80% coverage

---

## TICKET S14-009: GET /api/trade-log/monthly

**Priority:** P0 | **Points:** 3
**Files:**
- `app/api/trade-log/monthly/route.js` (new)
- `app/api/trade-log/monthly/route.test.js` (new)

### Request
`GET /api/trade-log/monthly?month=YYYY-MM&account_id=uuid`

### Response
```json
{
  "month": "2026-03",
  "pnl_unit": "USD",
  "monthly_pnl": -2284.64,
  "days": {
    "2026-03-18": { "trade_count": 10, "pnl": -1800.08 },
    "2026-03-19": { "trade_count": 2,  "pnl": -1385.92 },
    "2026-03-20": { "trade_count": 2,  "pnl": 901.36 }
  },
  "weeks": [
    { "week": 1, "label": "Week 1", "trade_count": 0,  "pnl": 0,        "saturday": "2026-03-07" },
    { "week": 2, "label": "Week 2", "trade_count": 0,  "pnl": 0,        "saturday": "2026-03-14" },
    { "week": 3, "label": "Week 3", "trade_count": 14, "pnl": -2284.64, "saturday": "2026-03-21" },
    { "week": 4, "label": "Week 4", "trade_count": 0,  "pnl": 0,        "saturday": "2026-03-28" }
  ]
}
```
- Days with no trades omitted from `days` object.
- `pnl` in `days` and `weeks`: sum of non-null pnl; `null` if all trades have null pnl.
- `monthly_pnl`: null if no trades with pnl.
- Weeks aligned Sun–Sat calendar rows; Saturday date = last day of that row.

**Acceptance criteria:**
- [ ] Correct day aggregates; omits days with no trades
- [ ] Week summaries group correctly (Sun–Sat)
- [ ] `monthly_pnl` correct
- [ ] Account filter scopes results
- [ ] pnl null handling correct throughout
- [ ] 401 without auth; 400 on invalid month
- [ ] ≥80% coverage

---

## TICKET S14-010: PATCH + DELETE /api/trade-log/[id]

**Priority:** P1 | **Points:** 2
**Files:**
- `app/api/trade-log/[id]/route.js` (new)
- `app/api/trade-log/[id]/route.test.js` (new)

### PATCH /api/trade-log/[id]
Accepted fields (whitelist): `symbol`, `direction`, `entry_price`, `stop_loss`, `take_profit`, `lots`, `risk_reward`, `trade_at`, `notes`, `pnl`, `account_id`.
- Auth + ownership check: `user_id = session.user.id`. 404 if not found or wrong user.
- Partial update — only keys present in body are updated.
- `pnl: null` in body → explicit null (clears P&L). Use `z.number().nullable()` to accept null.
- Returns updated row (joined with account name + pnl_unit).

### DELETE /api/trade-log/[id]
- Auth + ownership check.
- Hard delete. Returns `{ success: true }`.

**Acceptance criteria:**
- [ ] PATCH updates only provided fields
- [ ] `pnl: null` clears the field
- [ ] DELETE removes row
- [ ] Both return 401/404 appropriately
- [ ] ≥80% coverage

---

## TICKET S14-011: /logs Page — Shell + Day Navigator + Summary Card

**Priority:** P0 | **Points:** 5
**Files:**
- `app/logs/page.js` (new — server, auth redirect)
- `components/trade-log/LogsPageClient.jsx` (new — `"use client"`, main state)
- `components/trade-log/DayNavigator.jsx` (new)
- `components/trade-log/DailySummaryCard.jsx` (new)
- `components/trade-log/DailySummaryCard.test.jsx` (new)
- `components/trade-log/DayNavigator.test.jsx` (new)

### `app/logs/page.js`
Server component. Auth via `createClient()` — if no user, `redirect(config.auth.loginUrl)`.
Renders `<LogsPageClient />`.

### `LogsPageClient`
Central state manager:
- `selectedDate` (string `YYYY-MM-DD`, UTC, default today UTC)
- `dailyData` — from GET `/api/trade-log/daily`
- `monthlyData` — from GET `/api/trade-log/monthly`
- `showCalendarPicker` (bool)
- `selectedAccountId` (null = all accounts, fetched from GET /api/trade-accounts default)

Fetches:
- `dailyData` on mount and when `selectedDate` changes.
- `monthlyData` on mount and when selected month changes.

Layout order (stacked, max-w-lg mx-auto px-4):
1. `<MonthlyCalendar />` (S14-012)
2. `<DayNavigator />`
3. `<DailySummaryCard />`
4. `<DayTradeList />` (S14-014)
5. FAB — reuse `<TradeLogFAB />` (already handles auth redirect)

### `DayNavigator`
Props: `{ selectedDate, onPrev, onNext, onLabelClick }`
- `<` → `onPrev()`. `>` → `onNext()`; disabled if at today.
- Center: "Today" if selectedDate = today; else e.g. "Mar 19". Click → `onLabelClick()`.

### `DailySummaryCard`
Props: `{ tradesLogged, tradesRemaining, dailyLimit, pnlTotal, pnlUnit, isLoading }`
- **Arc SVG:** filled = `tradesLogged / dailyLimit`. Colors: green < limit, amber = limit, red > limit.
- **Left:** "Logged" / count.
- **Center:** remaining count (large). "Limit reached" in red if 0.
- **Right:** "P&L" / formatted value:
  - `pnlUnit === 'R'` → `+2R`, `-1.5R`
  - `pnlUnit === 'USD'` → `+$1,000`, `-$500`
  - `pnlTotal === null` → `—`
- Skeleton loading state.

**Acceptance criteria:**
- [ ] `/logs` redirects to login if unauthenticated
- [ ] Day navigator prev/next change `selectedDate`; next disabled at today
- [ ] Center label shows "Today" vs date string
- [ ] Summary card renders with correct arc fill + color
- [ ] P&L formatted correctly for both R and USD units
- [ ] null pnl shows "—"
- [ ] Loading skeleton renders
- [ ] ≥80% coverage on `DailySummaryCard` + `DayNavigator`

---

## TICKET S14-012: /logs Page — Monthly Review Calendar

**Priority:** P0 | **Points:** 5
**Files:**
- `components/trade-log/MonthlyCalendar.jsx` (new)
- `components/trade-log/MonthlyCalendar.test.jsx` (new)

### Props
`{ monthlyData, selectedDate, onDayClick, viewMonth, onMonthChange }`

### Layout
```
Monthly P&L: +$901.36                 ← colored header
< Mar 2026 >              [Today]
Su  Mo  Tu  We  Th  Fr  Sa
 1   2   3   4   5   6   7  │ Week 1 $0.00 · 0 trades
 8   9  10  11  12  13  14  │ Week 2 $0.00 · 0 trades
15  16  17  18  19  20  21  │ Week 3 -$2,284.64 · 14 trades
22  23  24  25  26  27  28  │ Week 4 $0.00 · 0 trades
29  30  31
```

- **Monthly P&L header:** green if > 0, red if < 0, gray if null.
- **Month nav:** arrows call `onMonthChange(±1)`. "Today" jumps to current month.
- **Day cells (Su–Fr):**
  - Top-left: day number. Bottom: P&L value (colored) + trade count ("2 trades").
  - Background: `bg-green-900/40` (profit), `bg-red-900/40` (loss), transparent (no trades or null pnl).
  - Today: `ring-2 ring-indigo-500`.
  - Tap: `onDayClick(dateString)`.
- **Saturday cells:** same as above + stacked week summary block below:
  - "Week N" label
  - Weekly P&L (formatted, colored)
  - Weekly trade count
- **Overflow cells** (prev/next month): muted day number, no data, not clickable.
- P&L formatted per `monthlyData.pnl_unit`.

**Acceptance criteria:**
- [ ] Correct grid for any month (4/5/6 row months)
- [ ] Day cells color-coded; background per profit/loss
- [ ] Saturday shows week summary
- [ ] Monthly P&L header correct
- [ ] Month nav works; "Today" returns to current month
- [ ] Tapping day calls `onDayClick` with correct `YYYY-MM-DD`
- [ ] Today highlighted
- [ ] Overflow days muted and not clickable
- [ ] ≥80% coverage

---

## TICKET S14-013: /logs Page — Calendar Day Picker (Bottom Sheet)

**Priority:** P1 | **Points:** 3
**Files:**
- `components/trade-log/CalendarPicker.jsx` (new)
- `components/trade-log/CalendarPicker.test.jsx` (new)

Opened when user taps center label in `DayNavigator`. Fixed overlay + slide-up bottom sheet.

### Props
`{ selectedDate, monthlyData, viewMonth, onSelectDate, onMonthChange, onClose }`

- Backdrop click → `onClose()`.
- Header: `< Mar 2026 >` + "Today" button.
- Grid: 7 columns, same structure as MonthlyCalendar but simplified:
  - Day number only.
  - Color dot below number: 🟢 (`pnl > 0`), 🔴 (`pnl < 0`), ⚪ (trades, pnl null/zero), none (no trades).
  - Today: filled indigo circle behind number.
  - Selected date: outlined indigo circle.
  - Tap → `onSelectDate(dateString)` + auto-close.
- Reuses `monthlyData` from parent (no extra API calls).
- Month navigation calls `onMonthChange(±1)` on parent (triggers fresh monthly fetch).

**Acceptance criteria:**
- [ ] Renders as bottom sheet with backdrop
- [ ] Dots match profit/loss/neutral/empty correctly
- [ ] Tap day → sets selectedDate + closes
- [ ] Backdrop tap → closes
- [ ] Today + selected date highlighted correctly
- [ ] Month nav triggers parent fetch
- [ ] ≥80% coverage

---

## TICKET S14-014: /logs Page — Trade List + Edit/Delete

**Priority:** P1 | **Points:** 3
**Files:**
- `components/trade-log/DayTradeList.jsx` (new)
- `components/trade-log/TradeEditModal.jsx` (new)
- `components/trade-log/DayTradeList.test.jsx` (new)
- `components/trade-log/TradeEditModal.test.jsx` (new)

### `DayTradeList`
Props: `{ trades, accounts, onUpdated, onDeleted, isLoading }`

**Trade row (collapsed):**
- Symbol (bold) + direction badge (BUY/SELL colored) + entry price + time (UTC HH:MM)
- Right side: account name (small, muted)
- Tap to toggle expand

**Trade row (expanded):**
- All collapsed fields +
- Stop Loss, Take Profit, Lots, R/R, Notes (shown only if non-null)
- **P&L:** formatted value with unit (`+2R`, `-$500`) or `—` if null
- **Edit** button → opens `TradeEditModal`
- **Delete** button → inline confirmation: "Delete this trade? [Yes] [No]"
  - On Yes: DELETE `/api/trade-log/[id]` → `onDeleted(id)` → parent removes from list
- **Empty state:** "No trades logged for this day." (centered, muted)
- **Loading state:** 3 skeleton rows

### `TradeEditModal`
Props: `{ trade, accounts, onSave, onClose }`

Modal (same style as TradeLogModal). Fields:
- Symbol (text input)
- Direction (select: buy / sell / —)
- Entry Price (number)
- Stop Loss (number)
- Take Profit (number)
- Lots (number)
- Risk/Reward (number)
- Trade Date & Time (datetime-local, values in UTC)
- Notes (textarea)
- Account (dropdown from `accounts`; shows name + pnl_unit tag)
- **P&L** (number input): label = "P&L (R)" or "P&L ($)" per selected account's pnl_unit
  - Placeholder: empty. Blank → saves `null`.
  - Negative values allowed.

On save:
- PATCH `/api/trade-log/[id]` with all fields (including `pnl: null` if blank).
- `onSave(updatedTrade)` → parent replaces trade in list.
- Inline error on failure.

**Acceptance criteria:**
- [ ] Rows render collapsed; expand/collapse on tap
- [ ] Expanded shows all non-null fields + formatted P&L
- [ ] Delete shows confirmation; calls DELETE; removes from list
- [ ] Edit modal opens pre-filled with all fields
- [ ] P&L label updates when account changes in modal
- [ ] Blank P&L → saves null; existing pnl cleared when explicitly blanked
- [ ] Save calls PATCH; updates parent list
- [ ] ≥80% coverage on both components

---

## Definition of Done

- [ ] All new files ≥80% Jest line coverage
- [ ] `npm run build` passes
- [ ] `npm run lint` clean
- [ ] Migrations 47–49 applied in dev Supabase
- [ ] Manual: unauthenticated FAB → login redirect ✓
- [ ] Manual: log trade → saved with user_id + account_id + null pnl ✓
- [ ] Manual: chat "EURUSD +2R" → pnl_update → confirmation → PATCH ✓
- [ ] Manual: chat screenshot of P&L → same flow ✓
- [ ] Manual: settings → add account with pnl_unit R; pnl_unit shown read-only ✓
- [ ] Manual: settings → cannot change pnl_unit; cannot delete default account ✓
- [ ] Manual: /logs today → correct summary arc + P&L formatted per unit ✓
- [ ] Manual: day nav arrows + calendar picker + dot colors ✓
- [ ] Manual: monthly calendar → correct P&L per day + week summaries ✓
- [ ] Manual: edit trade → P&L field labeled correctly → saves ✓
- [ ] Manual: blank P&L on edit → saves null → shows "—" ✓
- [ ] Manual: delete trade → removed from list + summary updated ✓
