/**
 * Run Twitter topic grouping for a week (TG-004)
 * Groups industry tweets by topic_title (≥3 per topic) and writes to twitter_topic_groups.
 * Same week semantics as Trustpilot incidents: default = current week (we run by end of week).
 *
 * Usage:
 *   npx tsx scripts/run-twitter-topic-groups.ts           # current week (default, same as GA)
 *   npx tsx scripts/run-twitter-topic-groups.ts -1        # last week
 *   npx tsx scripts/run-twitter-topic-groups.ts -2        # two weeks ago
 *
 * Env: OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *      TWITTER_TOPIC_GROUP_WEEK_OFFSET (optional; 0 = current week, -1 = last week; default 0)
 */

import "dotenv/config";
import { getWeekBoundsUtc } from "@/lib/digest/week-utils";
import { runIndustryTopicGrouping } from "@/lib/digest/twitter-topic-groups";

const arg = process.argv[2];
const WEEK_OFFSET = arg !== undefined
  ? parseInt(arg, 10)
  : parseInt(process.env.TWITTER_TOPIC_GROUP_WEEK_OFFSET ?? "0", 10);

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error("[Topic groups] OPENAI_API_KEY is not set. Add it to .env");
    process.exit(1);
  }

  const refDate = new Date();
  refDate.setUTCDate(refDate.getUTCDate() + WEEK_OFFSET * 7);
  const { weekStart, weekEnd } = getWeekBoundsUtc(refDate);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  console.log(`[Topic groups] Running for week ${weekStartStr} – ${weekEndStr} (offset ${WEEK_OFFSET})...`);
  const count = await runIndustryTopicGrouping(weekStart, weekEnd);
  console.log(`[Topic groups] Done. Created ${count} topic group(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[Topic groups] Error:", err);
  process.exit(1);
});
