# Task Plan: Trade Log Feature

**Goal:** Add a ChatGPT-style trade logging modal to the home page. Users type or upload a screenshot of a trade; OpenAI extracts structured fields into an editable card; user saves to DB.

**Scope doc:** `documents/current_sprint/trade_log_scope.md`
**Tickets doc:** `documents/current_sprint/trade_log_tickets.md`
**Started:** 2026-03-20

---

## Phase Overview

| Phase | Ticket | Name | Status |
|---|---|---|---|
| 1 | T1 | DB Migration: trade_logs table | `pending` |
| 2 | T2 | API Route: Parse trade input (OpenAI) | `pending` |
| 3 | T3 | API Route: Save trade to DB | `pending` |
| 3 | T4 | Zod Schema: trade-log | `pending` |
| 4 | T5 | Component: TradeLogModal | `pending` |
| 4 | T6 | Component: TradeCard | `pending` |
| 5 | T7 | Component: TradeLogFAB | `pending` |
| 6 | T8 | Home page integration | `pending` |
| 7 | T9 | QA / prompt tuning | `pending` |

---

## Ticket 1 — DB Migration
**Status:** `pending`
**File:** `migrations/46_trade_logs.sql`

- [ ] Create `trade_logs` table with all trade fields
- [ ] Update `migrations/README.md`

---

## Ticket 2 — Parse API Route
**Status:** `pending`
**Files:** `app/api/trade-log/parse/route.js` + `route.test.js`

- [ ] Accept multipart/form-data (message + optional image)
- [ ] Call OpenAI (gpt-4o, vision if image present)
- [ ] System prompt enforces trade-only context
- [ ] Return structured trade JSON or `{ error: "non_trade" }`
- [ ] Tests ≥80% coverage

---

## Ticket 3 — Save API Route
**Status:** `pending`
**Files:** `app/api/trade-log/save/route.js` + `route.test.js`

- [ ] Validate with Zod schema (T4)
- [ ] Insert into `trade_logs` via Supabase service client
- [ ] Return `{ id, created_at }`
- [ ] Tests ≥80% coverage

---

## Ticket 4 — Zod Schema
**Status:** `pending`
**Files:** `lib/schemas/trade-log.js` + `trade-log.test.js`

- [ ] Define `tradeLogSchema`
- [ ] Tests ≥80% coverage

---

## Ticket 5 — TradeLogModal Component
**Status:** `pending`
**Files:** `components/TradeLogModal.jsx` + `TradeLogModal.test.jsx`

- [ ] Chat history (session state)
- [ ] Text input + camera icon + send button
- [ ] Calls parse API on send
- [ ] Shows user bubble + TradeCard or refusal message
- [ ] Tests ≥80% coverage

---

## Ticket 6 — TradeCard Component
**Status:** `pending`
**Files:** `components/TradeCard.jsx` + `TradeCard.test.jsx`

- [ ] Display all trade fields
- [ ] Edit CTA → inline editable table
- [ ] Save CTA → calls save API → saved state
- [ ] Tests ≥80% coverage

---

## Ticket 7 — TradeLogFAB Component
**Status:** `pending`
**Files:** `components/TradeLogFAB.jsx` + `TradeLogFAB.test.jsx`

- [ ] Fixed bottom-right FAB
- [ ] Toggles TradeLogModal
- [ ] Tests ≥80% coverage

---

## Ticket 8 — Home Page Integration
**Status:** `pending`
**File:** `app/page.js`

- [ ] Import and render `<TradeLogFAB />`

---

## Ticket 9 — QA
**Status:** `pending`

- [ ] Text trade → card generated
- [ ] Image upload → fields extracted
- [ ] Off-topic → refusal
- [ ] Edit fields → save → row in DB

---

## Key Decisions

| Decision | Rationale |
|---|---|
| Public access (no login) | PM decision |
| Session-only chat history | PM decision |
| New trade_logs table (migration 46) | PM decision |
| FAB placement: fixed bottom-right | PM decision |
| gpt-4o for parsing (vision support) | Need image reading capability |
| Zod validation in save route | Consistent with existing patterns |
