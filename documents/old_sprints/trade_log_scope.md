# Trade Log Feature — Product Scope

**Status:** Awaiting tech-lead review
**Date:** 2026-03-20
**Author:** PM

---

## Overview

Add a **"Log a Trade"** floating action button (FAB) on the home page. Clicking it opens a ChatGPT-style modal where users can describe a trade they just made — via text or image — and the system uses OpenAI to extract structured trade data and present it as an editable card.

---

## User Flow

1. User visits home page (no login required).
2. User clicks the FAB (bottom-right corner).
3. A chat-style modal/drawer opens.
4. User types their trade details OR uploads a screenshot via the camera icon.
5. User hits **Send**.
6. OpenAI analyzes the input and returns a structured trade card in the chat history.
7. User reviews the card, optionally clicks **Edit** to correct any fields in an inline table.
8. User clicks **Save** to persist the trade to the database.

---

## UI Components

### Chat Input Row (3 items)
| Element | Description |
|---------|-------------|
| Text input | Free-text field: "Describe your trade…" |
| Camera icon button | Opens native camera (mobile) or file picker (desktop) to attach a screenshot or photo |
| Send button | Submits the input to the AI pipeline |

### Trade Card (AI response in chat history)
Displayed after the AI processes the input. Contains:

| Field | Notes |
|-------|-------|
| Symbol | e.g. EURUSD, AAPL, BTC/USD |
| Direction | Buy / Sell |
| Entry Price | |
| Stop Loss | |
| Take Profit | |
| Lots / Size | Position size |
| Risk/Reward Ratio | Auto-calculated if SL/TP provided |
| Trade Date & Time | Extracted from input or defaulted to now |
| Notes | Any additional context extracted |

**Card CTAs:**
- **Edit** — Expands an inline editable table for all fields
- **Save** — Persists the trade to `trade_logs` table in Supabase

### Non-trade message handling
If the user sends a message unrelated to trade logging, the AI responds with a polite refusal:
> "This assistant is only for logging trades. For other questions, please use the main chat."

---

## Scope Boundaries

### In Scope
- FAB button on home page (public, no login required to open modal)
- Chat modal with text input, image upload, send button
- OpenAI integration to parse trade text and images
- Trade card display in chat history
- Inline edit table on the card
- Save to `trade_logs` DB table (new migration)
- Session-only chat history (cleared on page refresh)
- Trade-topic guardrail (reject off-topic messages)

### Out of Scope
- Persistent chat history across sessions
- Trade list / history page
- Trade analytics or P&L reporting
- Authentication requirement (public access)
- Editing or deleting saved trades (post-save)
- Push notifications

---

## Dependencies
- OpenAI API (`openai-client.ts` in `lib/ai/`) — already integrated
- Supabase — already integrated; needs new `trade_logs` table (migration 46)
- Image upload — needs file handling in API route (base64 to OpenAI vision)

---

## Success Criteria
1. User can describe a trade in natural language and get a structured card back.
2. User can upload a screenshot and get fields auto-extracted.
3. User can edit and save the trade; row appears in `trade_logs` table.
4. Off-topic messages receive a polite refusal.
