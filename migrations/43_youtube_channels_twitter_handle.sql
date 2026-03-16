-- Add twitter_handle to youtube_channels so the bot can @mention creators when posting picks.
-- Nullable: most channels won't have a handle initially; enriched manually via admin UI.
ALTER TABLE youtube_channels
  ADD COLUMN IF NOT EXISTS twitter_handle VARCHAR(100);
