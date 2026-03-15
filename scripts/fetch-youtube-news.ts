/**
 * Daily YouTube news ingest script.
 *
 * Entrypoint for GitHub Actions daily cron (07:00 UTC).
 * Calls runYouTubeIngest() and exits with code 1 on fatal errors
 * so GitHub Actions marks the run as failed.
 *
 * Usage:
 *   npx tsx scripts/fetch-youtube-news.ts
 *
 * Required env vars (from .env or GitHub Secrets):
 *   YOUTUBE_API_KEY, OPENAI_API_KEY,
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import "dotenv/config";
import { runYouTubeIngest } from "@/lib/youtube/ingest";

async function main() {
  console.log("[YouTube Ingest] Starting...", new Date().toISOString());

  const result = await runYouTubeIngest();

  console.log("[YouTube Ingest] Complete:", JSON.stringify(result, null, 2));

  if (result.errors.length > 0) {
    console.warn("[YouTube Ingest] Non-fatal errors:", result.errors);
  }

  if (result.picksInserted === 0 && result.candidatesFound === 0) {
    console.error("[YouTube Ingest] No candidates found — check YOUTUBE_API_KEY and channel list");
    process.exit(1);
  }

  console.log(`[YouTube Ingest] Done: ${result.picksInserted} picks inserted for ${result.date}`);
}

main().catch((err) => {
  console.error("[YouTube Ingest] Fatal error:", err);
  process.exit(1);
});
