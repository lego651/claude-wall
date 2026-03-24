# Sprint 14 — Manual Test Checklist

**Sprint:** S14 — Trade Log v2: /logs Page + Accounts + Settings
**Status:** In progress

> Mark items `[x]` as you verify them. Note failures inline with `❌ FAIL: <what happened>`.

---

## Pre-requisites

- [ ] Migrations 47–50 applied in Supabase (SQL Editor, in order)
- [ ] `npm run dev` running
- [ ] Logged-in browser session ready
- [ ] Incognito window (logged-out) ready

---

## Block 1 — Auth Enforcement

- [x] **T1.1** Incognito → homepage → click FAB → redirected to login (no modal)
- [x] **T1.2** `POST /api/trade-log/parse` without session → `401`
- [x] **T1.3** `POST /api/trade-log/save` without session → `401`
- [x] **T1.4** Logged in → click FAB → modal opens

---

## Block 2 — Trade Accounts (Settings Page)

- [x] **T2.1** `/user/settings` shows "Trading Log" section with Daily Trade Limit + Accounts list
- [x] **T2.2** Add account with name `Funded Account`, unit `R` → warning shown before submit → account appears with `R` badge (read-only)
- [x] **T2.3** PATCH account with `{ pnl_unit: "USD" }` → `400 "P&L unit cannot be changed after creation"`
- [x] **T2.4** Rename account → name updates in list
- [x] **T2.5** "Set as default" on non-default → Default badge moves correctly
- [x] **T2.6** Cannot delete default account (button absent or blocked with error)
- [x] **T2.7** Delete non-default account → removed from list
- [x] **T2.8** Change daily limit to `5` → save → toast → refresh → shows `5`

---

## Block 3 — Trade Log Modal: Account Picker + P&L Field

- [ ] **T3.1** Modal opens → account dropdown visible, default account pre-selected with unit badge
- [ ] **T3.2** Switch to R account → P&L label = "P&L (R)"; switch to USD account → "P&L ($)"
- [ ] **T3.3** Log trade with P&L = `2` → DB row has `user_id`, `account_id`, `pnl = 2`
- [ ] **T3.4** Log trade with blank P&L → DB row has `pnl = null` (not 0)

---

## Block 4 — P&L Update via AI Chat

- [ ] **T4.1** Type `EURUSD closed at +2R` → confirmation bubble appears → Confirm → success bubble → DB updated
- [ ] **T4.2** Type `GBPUSD +1R` (no GBPUSD trade today) → "No GBPUSD trade found today. Log the trade first."
- [ ] **T4.3** Two EURUSD trades today → type `EURUSD +3R` → selection bubble with both trades → pick one → confirmation bubble
- [ ] **T4.4** P&L update → confirmation bubble → Cancel → "Cancelled." bubble → DB unchanged
- [ ] **T4.5** Type `what's the weather today` → refusal / non_trade message

---

## Block 5 — /logs Page: Day View

- [ ] **T5.1** Incognito → `/logs` → redirected to login
- [ ] **T5.2** Logged in → `/logs` → today shown, summary card visible with arc + trade count + P&L
- [ ] **T5.3** Arc/P&L formatting:
  - Arc green at low count, amber at limit, red over limit
  - R account P&L: `+2R` / `-1.5R`
  - USD account P&L: `+$1,000` / `-$500`
  - All null pnl → shows `—`
- [ ] **T5.4** Day navigator: `<` goes back, `>` disabled at today, label shows "Today" vs date string
- [ ] **T5.5** Trade list rows: Symbol, direction badge, entry price, time (UTC), account name (muted right)
- [ ] **T5.6** Expand trade → Edit → change P&L → Save → list and summary update
- [ ] **T5.7** Edit trade → clear P&L field → Save → shows `—` in list and summary updates
- [ ] **T5.8** Expand trade → Delete → confirm Yes → trade removed, summary updates
- [ ] **T5.9** Navigate to day with no trades → "No trades logged for this day."

---

## Block 6 — Monthly Calendar

- [ ] **T6.1** `/logs` monthly calendar visible above day navigator; shows full month grid (Sun–Sat), monthly P&L header
- [ ] **T6.2** Day cell colors: profit = green background, loss = red background, no trades = transparent
- [ ] **T6.3** Saturday column shows week summary: "Week N", weekly P&L, trade count
- [ ] **T6.4** Tap a day in calendar → day navigator updates, trade list refreshes for that day
- [ ] **T6.5** Month `<` arrow → previous month loads; "Today" button → returns to current month
- [ ] **T6.6** Today's cell has indigo ring highlight

---

## Block 7 — Calendar Day Picker (Bottom Sheet)

- [ ] **T7.1** Tap center date label in day navigator → bottom sheet slides up with simplified calendar
- [ ] **T7.2** Dot colors: 🟢 profit, 🔴 loss, ⚪ trades + null pnl, none = no trades
- [ ] **T7.3** Tap a day → sheet closes, selected date updates, trade list/summary refresh
- [ ] **T7.4** Tap backdrop → sheet closes, date unchanged

---

## Failures / Notes

<!-- Log any failures here:
- T2.3: ❌ FAIL — API returned 200 instead of 400
- T4.1: ❌ FAIL — confirmation bubble didn't appear
-->

