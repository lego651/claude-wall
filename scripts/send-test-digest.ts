/**
 * TICKET-015: Send one test digest to a user who has subscriptions.
 *
 * Run: npx tsx scripts/send-test-digest.ts [weekStartYYYY-MM-DD] [toEmail]
 * Example: npx tsx scripts/send-test-digest.ts 2026-01-27
 * Example: npx tsx scripts/send-test-digest.ts 2026-01-27 legogao651@gmail.com
 *
 * If toEmail is provided, the digest is sent there. Otherwise uses TEST_DIGEST_TO from .env (e.g. your Resend account email when using onboarding@resend.dev).
 *
 * Prerequisites:
 * - RESEND_API_KEY and Supabase env in .env
 * - At least one user with firm_subscriptions (email_enabled = true)
 * - That user has email (in profiles or auth)
 * - weekly_reports exist for that week for the firms they follow (run run-weekly-report.ts first)
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env") });

import { createServiceClient } from "../lib/supabase/service";
import { sendWeeklyDigest, type WeeklyReportJson } from "../lib/email/send-digest";
import { getWeekBounds, getWeekNumber, getYear } from "../lib/digest/week-utils";

async function main() {
  const weekStartArg = process.argv[2];
  const toEmailOverride = process.argv[3]?.trim(); // optional: send to this address
  const defaultToEmail = process.env.TEST_DIGEST_TO?.trim(); // from .env: e.g. your Resend account email for testing
  const weekStart = weekStartArg
    ? new Date(weekStartArg + "T00:00:00Z")
    : (() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d;
      })();
  const { weekStart: start, weekEnd: end } = getWeekBounds(weekStart);
  const weekNumber = getWeekNumber(start);
  const year = getYear(start);

  const supabase = createServiceClient();

  const { data: subs, error: subsError } = await supabase
    .from("firm_subscriptions")
    .select("user_id, firm_id")
    .eq("email_enabled", true);

  if (subsError || !subs?.length) {
    console.error("No subscriptions with email_enabled = true. Follow at least one firm and ensure email_enabled is true.");
    process.exit(1);
  }

  const userIds = [...new Set(subs.map((s) => s.user_id as string))];
  const firstUserId = userIds[0];
  if (!firstUserId) {
    console.error("No user_id in subscriptions.");
    process.exit(1);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("id", firstUserId as string)
    .single();
  const profileEmail = profile?.email;
  const email = toEmailOverride || defaultToEmail || profileEmail;
  if (!email) {
    console.error("Set TEST_DIGEST_TO=your@email.com in .env, or pass toEmail: script [weekStart] toEmail");
    process.exit(1);
  }

  const firmIds = subs.filter((s) => s.user_id === firstUserId).map((s) => s.firm_id);
  if (firmIds.length === 0) {
    console.error("User has no firms.");
    process.exit(1);
  }

  const { data: reportRows, error: reportsError } = await supabase
    .from("weekly_reports")
    .select("report_json")
    .in("firm_id", firmIds)
    .eq("week_number", weekNumber)
    .eq("year", year);

  if (reportsError || !reportRows?.length) {
    console.error(
      "No weekly_reports for this week for firms:",
      firmIds.join(", "),
      "\nGenerate first: npx tsx scripts/run-weekly-report.ts <firmId>",
      weekStart.toISOString().slice(0, 10)
    );
    process.exit(1);
  }

  const reports = reportRows.map((r) => r.report_json as WeeklyReportJson);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  console.log("TICKET-015: Send test digest");
  console.log("User:", firstUserId, email === profileEmail ? email : `→ ${email} (TEST_DIGEST_TO or override)`);
  console.log("Week:", start.toISOString().slice(0, 10), "–", end.toISOString().slice(0, 10));
  console.log("Firms:", firmIds.join(", "));
  console.log("Reports:", reports.length);
  console.log("");

  const result = await sendWeeklyDigest(
    { id: firstUserId, email: String(email) },
    reports,
    {
      weekStart: start.toISOString().slice(0, 10),
      weekEnd: end.toISOString().slice(0, 10),
      baseUrl,
    }
  );

  if (!result.ok) {
    console.error("Send failed:", result.error);
    process.exit(1);
  }

  console.log("Digest sent to", email);
  console.log("Check inbox and click Unsubscribe to test the link.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
