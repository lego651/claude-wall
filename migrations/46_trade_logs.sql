-- Trade logs table for the ChatGPT-style trade logging feature.
-- Users describe a trade (text or image); OpenAI extracts structured fields;
-- user reviews, edits, and saves here.

CREATE TABLE IF NOT EXISTS trade_logs (
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
  raw_input TEXT,           -- original user message / image description for audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);
