# Sprint 14 Scope — Trade Log v2: /logs Page + Accounts + Settings

**Sprint Goal:** Build the `/logs` trade journal page with daily/monthly views, enforce auth on the trade log FAB, introduce trade accounts with P&L unit types, and add trading settings per user.

**Date:** 2026-03-20
**Status:** PM-reviewed ✅ (rev 2 — P&L unit clarification)

---

## Context

The trade log FAB (S12) lets any visitor log a trade with no auth and no user binding. This sprint wires everything to real users, adds a proper journal page, introduces trade accounts with locked P&L unit types, and expands the AI chat to handle P&L updates in addition to new trade logging.

---

## P&L System — Design Rules

### Two P&L unit types
Each **trade account** has exactly one P&L unit, set at account creation and **immutable**:
- **R** — risk multiples (e.g. +2R, -1.5R)
- **USD** — dollar amount (e.g. +$1,000, -$500)

To use a different unit type, the user must create a new account. Existing accounts cannot be converted.

### P&L default
All trades start with `pnl = null` (displayed as "—"). Users never see "$0" by default — null means "not yet recorded."

### How P&L gets set — three paths
1. **At log time:** When the trade log modal is open, there is an optional P&L field. The label changes based on the selected account's unit (e.g. "P&L (R)" or "P&L ($)"). Leaving it blank saves `pnl = null`.
2. **Edit on /logs page:** User taps a trade card → Edit → fills in P&L field → saves via PATCH.
3. **Via AI chat:** User sends a message or screenshot describing the trade result (e.g. "EURUSD closed at +2R" or posts a broker screenshot showing P&L). The AI detects a P&L update intent and returns structured data; the modal applies the update.

### AI chat — allowed operations (rule file)
A new config file `lib/ai/trade-chat-rules.js` defines what the AI assistant accepts:
- ✅ **Log new trade** — extract trade fields from text or image
- ✅ **Update P&L** — user describes or shows a trade result; AI extracts `pnl` value and the trade to update
- ❌ **Anything else** — polite refusal: "This assistant is only for logging trades and recording P&L results."

### P&L update via chat — disambiguation rule
When the AI detects a P&L update intent, the parse API returns:
```json
{ "type": "pnl_update", "symbol": "EURUSD", "pnl": 2.0, "raw_input": "..." }
```
The frontend (TradeLogModal) then:
1. Looks for trades matching the symbol **on today's date** in the user's active account.
2. If exactly one match → shows a confirmation card ("Update EURUSD trade P&L to +2R?") with Confirm/Cancel.
3. If multiple matches → shows a list of matching trades for user to pick one, then confirm.
4. On confirm → PATCH `/api/trade-log/[id]` with `{ pnl: 2.0 }`.

The `pnl` value is always stored as a **plain number** (e.g. `2.0` for 2R, `1000` for $1000). The unit is derived from the account. Display formatting is done in the UI.

---

## DB Schema Changes (requires migrations)

### Migration 47 — Extend `trade_logs`
```sql
ALTER TABLE trade_logs
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS account_id UUID,   -- references trade_accounts.id
  ADD COLUMN IF NOT EXISTS pnl NUMERIC;       -- null = not recorded; unit derived from account

CREATE INDEX IF NOT EXISTS idx_trade_logs_user_date
  ON trade_logs (user_id, trade_at DESC);
```
- `exit_price` removed from scope — not needed since P&L is entered directly.
- Existing rows: `user_id`/`account_id`/`pnl` remain NULL (not shown in /logs).

### Migration 48 — `trade_accounts` table
```sql
CREATE TABLE IF NOT EXISTS trade_accounts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT 'Default',
  is_default BOOLEAN NOT NULL DEFAULT false,
  pnl_unit   TEXT NOT NULL DEFAULT 'USD' CHECK (pnl_unit IN ('R', 'USD')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trade_accounts_user ON trade_accounts (user_id);
```
- `pnl_unit` is set at creation and never updated (enforced in API layer — no PATCH for this field).
- Business rule: one `is_default = true` per user, enforced in API layer.

### Migration 49 — `user_trading_settings` table
```sql
CREATE TABLE IF NOT EXISTS user_trading_settings (
  user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_trade_limit INT NOT NULL DEFAULT 3 CHECK (daily_trade_limit >= 1),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Feature 1 — Auth Enforcement on Trade Log FAB

**Current behavior:** FAB is public; trades saved with no `user_id`.
**New behavior:**
- Home page FAB: if user is not logged in → clicking FAB redirects to login (`config.auth.loginUrl`).
- `POST /api/trade-log/parse` and `POST /api/trade-log/save`: require authenticated session. Return 401 if not logged in.
- On save, `user_id` is taken from the session (never from request body).

---

## Feature 2 — Trade Accounts

### Account rules
- Every user gets a **Default** account (lazy-created on first trade save if none exists; `pnl_unit: 'USD'` by default).
- One account always has `is_default = true`; cannot delete it, but can rename it.
- `pnl_unit` (R or USD) is chosen at creation and **cannot be changed afterward**.
- The "Default" label badge is shown next to whichever account has `is_default = true`.

### Account creation UI (Settings page)
- Name field (required)
- **P&L Unit** selector: `R (risk multiples)` | `$ (US dollars)` — clearly labeled; note shown: "This cannot be changed after creation."
- On submit → POST `/api/trade-accounts` with `{ name, pnl_unit }`.

### Account management UI (Settings page)
- List accounts: name + pnl_unit badge + Default badge if applicable.
- **Rename:** inline edit (only `name`; `pnl_unit` shown as read-only badge).
- **Delete:** only non-default accounts; requires confirmation.
- **Set as default:** button on non-default accounts.

### Trade log modal — Account picker
- Dropdown above chat input: shows account name + pnl_unit badge.
- Pre-selected: user's default account.
- P&L input field label updates dynamically: "P&L (R)" or "P&L ($)" based on selected account.

---

## Feature 3 — User Trading Settings

New "Trading Log" section on `/user/settings`:
- **Daily trade limit**: number input (min 1). Default: 3. Saved to `user_trading_settings`.

---

## Feature 4 — AI Chat Rules + P&L Update Intent

### `lib/ai/trade-chat-rules.js`
Exports:
- `SYSTEM_PROMPT` — the full OpenAI system prompt (moved here from the parse route; parse route imports it).
- `ALLOWED_INTENTS` — exported constant array: `['new_trade', 'pnl_update']`
- Intent detection logic is inside the system prompt itself.

### Updated parse route behavior
The system prompt instructs the AI to return one of two shapes:

**New trade (existing):**
```json
{ "type": "new_trade", "symbol": "EURUSD", "direction": "buy", ... }
```

**P&L update (new):**
```json
{ "type": "pnl_update", "symbol": "EURUSD", "pnl": 2.0 }
```
- `pnl` is always a plain number (positive = profit, negative = loss).
- AI does NOT know the unit — it just extracts the numeric value (e.g. "2R" → `2.0`, "$1000" → `1000`).
- The frontend uses the account's `pnl_unit` to determine how to display and store it.

**Off-topic:**
```json
{ "error": "non_trade" }
```

### TradeLogModal — handling `pnl_update` response
1. Fetch today's trades for the active account (GET `/api/trade-log/daily?date=today&account_id=...`).
2. Filter by `symbol` from response.
3. If one match → show confirmation bubble: `"Update [EURUSD] P&L to +2R? [Confirm] [Cancel]"`
4. If multiple matches → show a mini-list of matching trades → user picks one → show confirmation.
5. If no match → show message: `"No matching trade found for [EURUSD] today. Log the trade first."`
6. On confirm → PATCH `/api/trade-log/[id]` with `{ pnl: 2.0 }`.

---

## Feature 5 — `/logs` Page: Day View

**Route:** `app/logs/page.js` (auth-required; redirects to login if not authenticated)
**Timezone:** All dates/times stored and compared in UTC.

### Layout (mobile-first, stacked; desktop = same, max-w-lg centered)
```
┌─────────────────────────────────┐
│  [Monthly Review Calendar]       │  ← always-visible section
├─────────────────────────────────┤
│  <   Today ▼   >                │  ← day navigator
├─────────────────────────────────┤
│  [Daily Summary Card]            │
│  Logged: 2    Remaining: 1       │
│     ○ arc progress (2/3)         │
│  Daily P&L: +2R  (or +$450)     │
├─────────────────────────────────┤
│  Trade list for selected day     │
│  ┌──────────────────────────┐   │
│  │ EURUSD  BUY  1.0850  10:30│  │
│  └──────────────────────────┘   │
├─────────────────────────────────┤
│      [+ Log Trade]  (FAB)        │
└─────────────────────────────────┘
```

### Day navigator
- `< >` arrows navigate days; `>` disabled at today.
- Center label: "Today" or "Mar 19" — tap opens calendar day picker.

### Daily Summary Card
- Arc progress: `tradesLogged / dailyLimit`; green → amber → red.
- Left: "Logged" count. Center: "Remaining" (red if 0). Right: P&L total.
- **P&L total display:** sums `pnl` for the day; formatted per account unit.
  - If multiple accounts with different units: show separately ("2R · +$450").
  - If all null: show "—".

### Trade list
- Row: Symbol + direction badge + entry price + time (UTC HH:MM) + account name (right, muted).
- Tap to expand: all fields + P&L value (formatted with unit).
- Expanded: **Edit** | **Delete** buttons.

### P&L in edit modal
- P&L field: number input. Label: "P&L (R)" or "P&L ($)" per account's unit.
- If `pnl` is null: placeholder is empty (not "0").
- Saving with empty field → saves `null` (clears existing pnl).
- No auto-calculation from exit_price (removed from scope).

### Delete trade
- Inline confirmation → DELETE `/api/trade-log/[id]` → removed from list, summary recalculated.

---

## Feature 6 — `/logs` Page: Month Calendar Picker

Triggered by tapping center date label. Bottom sheet on mobile.

- Day cells: color dot — 🟢 green (`pnl > 0`), 🔴 red (`pnl < 0`), ⚪ gray (trades but pnl null), no dot (no trades).
- Reuses `monthlyData` already loaded in parent.

---

## Feature 7 — Monthly Review Calendar

Always-visible section above day navigator.

- **Header:** "Monthly P&L: +2.5R" or "Monthly P&L: -$2,284.64" — colored.
  - Unit label comes from the selected account. If no account filter: show aggregate (best effort).
- **Grid:** Full month, Sun–Sat.
  - Day cells: day number + P&L value + trade count; background tinted green/red.
  - Saturday column: week summary (Week N, weekly P&L, trade count).
- Month nav: `< Mar 2026 >` + "Today" button.

---

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/trade-log/monthly` | `?month=YYYY-MM&account_id=` — daily + weekly P&L aggregates |
| GET | `/api/trade-log/daily` | `?date=YYYY-MM-DD&account_id=` — trades + day summary |
| PATCH | `/api/trade-log/[id]` | Edit trade fields including `pnl` |
| DELETE | `/api/trade-log/[id]` | Delete trade |
| GET | `/api/trade-accounts` | List accounts |
| POST | `/api/trade-accounts` | Create account (name + pnl_unit) |
| PATCH | `/api/trade-accounts/[id]` | Rename or set-default (pnl_unit field rejected) |
| DELETE | `/api/trade-accounts/[id]` | Delete non-default account |
| GET | `/api/user-settings/trading` | Get daily_trade_limit |
| PATCH | `/api/user-settings/trading` | Update daily_trade_limit |

All routes: 401 if unauthenticated.

---

## Scope Boundaries

### In Scope
- Auth on FAB + API routes
- `user_id` binding on all new saves
- Trade accounts with immutable `pnl_unit` (R or USD)
- P&L via chat (text or screenshot), at log time, and via edit
- AI chat rules config file
- Disambiguation flow for P&L update when multiple matching trades
- `/logs` page: day view + monthly review + calendar picker
- Edit + delete from /logs
- User trading settings (daily limit)

### Out of Scope
- Changing `pnl_unit` on existing accounts (by design — immutable)
- Multi-currency dollar conversion
- Trade analytics / charting
- Bulk operations
- Sharing / public log links
- Auto-calculation from exit_price (removed — user enters P&L directly)

---

## Success Criteria
- [ ] Unauthenticated FAB click → redirected to login
- [ ] All new trades save with `user_id` + `account_id`
- [ ] Account creation: pnl_unit required, shown read-only after; no way to change via API
- [ ] Chat: "EURUSD +2R" → AI returns `pnl_update`, modal finds trade, shows confirmation
- [ ] Chat screenshot of P&L → same `pnl_update` flow
- [ ] Off-topic chat → refusal message
- [ ] P&L field in log modal labeled per account unit; saves null if blank
- [ ] `/logs` day summary shows correct count + formatted P&L
- [ ] Monthly calendar correct P&L per day + week summaries
- [ ] Edit modal: P&L field saves correctly; blank → null
- [ ] Delete removes trade + updates summary
- [ ] Settings: add/rename/delete accounts; pnl_unit shown, not editable
- [ ] All new files ≥80% Jest test coverage
- [ ] `npm run build` + lint pass
