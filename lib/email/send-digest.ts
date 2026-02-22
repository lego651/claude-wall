/**
 * TICKET-015: Send one aggregated weekly digest email per user via Resend.
 * One email containing reports for all firms the user follows.
 */

import { sendEmail } from "@/lib/resend";
import { buildWeeklyDigestHtml, type DigestReportInput } from "@/lib/email/weekly-digest-html";
import { createUnsubscribeToken } from "@/lib/email/unsubscribe-token";
import { createServiceClient } from "@/lib/supabase/service";
import { getCachedWeeklyDigestData } from "@/lib/digest/weekly-cache";

/** Shape of report_json from weekly_reports (matches WeeklyReportJson from generator). */
export interface WeeklyReportJson {
  firmId: string;
  weekStart: string;
  weekEnd: string;
  payouts: {
    total: number;
    count: number;
    largest: number;
    avgPayout: number;
    changeVsLastWeek: number | null;
  };
  trustpilot: {
    avgRating: number;
    ratingChange: number | null;
    reviewCount: number;
    sentiment: { positive: number; neutral: number; negative: number };
  };
  incidents: Array<{
    incident_type: string;
    severity: string;
    title: string;
    summary: string;
    review_count: number;
  }>;
  ourTake: string;
}

export interface DigestUser {
  id: string;
  email: string | undefined;
}

export interface SendDigestOptions {
  weekStart: string;
  weekEnd: string;
  baseUrl: string;
}

// Resend's test sender – works without domain verification (for local/Vercel testing).
// When you have a domain, set DIGEST_FROM_EMAIL e.g. "PropProof <reports@yourdomain.com>".
const DEFAULT_FROM = "PropProof <onboarding@resend.dev>";

function mapReportToInput(report: WeeklyReportJson): DigestReportInput {
  return {
    firmId: report.firmId,
    firmName: report.firmId,
    weekStart: report.weekStart,
    weekEnd: report.weekEnd,
    payouts: report.payouts,
    trustpilot: report.trustpilot,
    incidents: report.incidents,
    ourTake: report.ourTake,
  };
}

/**
 * Send one aggregated weekly digest email to the user. Builds HTML from template,
 * includes manage subscriptions + unsubscribe links, sends via Resend, updates last_sent_at.
 */
export async function sendWeeklyDigest(
  user: DigestUser,
  reports: WeeklyReportJson[],
  options: SendDigestOptions
): Promise<{ ok: boolean; error?: string }> {
  const email = user.email?.trim();
  if (!email) {
    return { ok: false, error: "User has no email" };
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn("[send-digest] RESEND_API_KEY is not set, skipping send");
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  const { weekStart, weekEnd, baseUrl } = options;
  const base = baseUrl.replace(/\/$/, "");
  const manageSubscriptionsUrl = `${base}/user/settings`;
  const token = createUnsubscribeToken(user.id);
  const unsubscribeUrl = `${base}/api/unsubscribe?token=${encodeURIComponent(token)}`;

  // TICKET-S8-009: Fetch firm content and industry news for this week (CACHED!)
  // S8-TW-006b: Top tweets per firm (cached)
  const { firmContent: allFirmContent, industryNews, topTweets: allTopTweets } =
    await getCachedWeeklyDigestData(weekStart, weekEnd);

  // Filter cached data to only user's subscribed firms
  const userFirmIds = reports.map((r) => r.firmId);
  const firmContentMap = new Map();
  for (const firmId of userFirmIds) {
    firmContentMap.set(firmId, allFirmContent.get(firmId) || {
      company_news: [],
      rule_change: [],
      promotion: [],
    });
  }

  // Map reports and attach firm content + top tweets
  const digestReports: DigestReportInput[] = reports.map((report) => ({
    ...mapReportToInput(report),
    content: firmContentMap.get(report.firmId) || {
      company_news: [],
      rule_change: [],
      promotion: [],
    },
    topTweets: allTopTweets.get(report.firmId) || [],
  }));

  const html = buildWeeklyDigestHtml(digestReports, {
    weekStart,
    weekEnd,
    manageSubscriptionsUrl,
    unsubscribeUrl,
    baseUrl: base,
    industryNews: industryNews.map(item => ({
      title: item.title,
      ai_summary: item.ai_summary,
      mentioned_firm_ids: item.mentioned_firm_ids,
      source_url: item.source_url,
      content_date: item.content_date,
    })),
  });

  const weekLabel = weekStart.slice(0, 10);
  const subject = `Your Weekly PropProof Digest - Week of ${weekLabel}`;
  const from = (process.env.DIGEST_FROM_EMAIL || DEFAULT_FROM).trim();

  try {
    await sendEmail({
      from,
      to: email,
      subject,
      html,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[send-digest] Resend failed:", message);
    return { ok: false, error: message };
  }

  try {
    const supabase = createServiceClient();
    await supabase
      .from("user_subscriptions")
      .update({ last_sent_at: new Date().toISOString() })
      .eq("user_id", user.id);
  } catch (err) {
    console.error("[send-digest] Failed to update last_sent_at:", err);
    // Email was sent; don't fail the whole operation
  }

  return { ok: true };
}
