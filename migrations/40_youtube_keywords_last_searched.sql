-- Add last_searched_at to youtube_keywords to support daily keyword rotation.
-- The ingest picks the N oldest (last_searched_at ASC NULLS FIRST) each day,
-- ensuring all keywords cycle through regularly when the total count exceeds
-- the daily search quota budget.

ALTER TABLE youtube_keywords
  ADD COLUMN IF NOT EXISTS last_searched_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN youtube_keywords.last_searched_at IS
  'Last time this keyword was used in a YouTube search.list call. NULL means never searched. Used by the ingest to rotate through long keyword lists within daily API quota.';
