-- Replace firm-name keyword variants with a focused set of ~18 high-signal,
-- intent-based keywords. The firm-specific keywords ("FXIFY challenge", etc.)
-- are redundant with the channel watchlist and burn API quota unnecessarily.

DELETE FROM youtube_keywords;

INSERT INTO youtube_keywords (keyword, active) VALUES
  -- Payouts (high engagement — money content drives views)
  ('prop firm payout',          true),
  ('prop firm withdrawal',      true),
  ('funded trader payout',      true),

  -- Challenges (catch non-watchlist channels)
  ('prop firm challenge',       true),
  ('pass prop firm challenge',  true),

  -- Reviews & comparisons (cross-firm content)
  ('best prop firm',            true),
  ('prop firm review',          true),
  ('prop firm comparison',      true),

  -- News & controversy (viral, high engagement)
  ('prop firm scam',            true),
  ('prop firm banned',          true),
  ('prop firm news',            true),

  -- Broad discovery
  ('funded trader',             true),
  ('funded account',            true),
  ('FTMO',                      true),

  -- Current year
  ('prop firm 2026',            true),

  -- Asset class specific
  ('futures prop firm',         true),
  ('forex prop firm',           true),
  ('crypto prop firm',          true);
