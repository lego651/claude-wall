/**
 * Cron: post today's approved Twitter draft.
 *
 * Runs at 11:15 UTC daily (7:15 AM ET summer / 6:15 AM ET winter).
 * Looks for today's draft with status='approved' (or 'pending' if auto_approve=true).
 * Sends admin alert via Resend if no approved draft is found or if posting fails.
 *
 * Security: protected by CRON_SECRET header in production.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { postTweet } from "@/lib/twitter-bot/client";
import { Resend } from "resend";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function sendAdminAlert(subject: string, body: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!apiKey || !adminEmail) return;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "bot@propfirmhub.com",
      to: adminEmail,
      subject: `[Twitter Bot] ${subject}`,
      text: body,
    });
  } catch {
    // Alert failure is non-fatal — just log
    console.error("[post-twitter-tweet] Failed to send admin alert");
  }
}

export async function GET(request: Request) {
  const startTime = Date.now();

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  // Find today's draft: approved, OR pending with auto_approve=true
  const { data: draft, error: draftErr } = await supabase
    .from("twitter_drafts")
    .select("id, tweet_text, status, auto_approve, template, creator_handle")
    .eq("draft_date", today)
    .or("status.eq.approved,and(status.eq.pending,auto_approve.eq.true)")
    .maybeSingle();

  if (draftErr) {
    return NextResponse.json(
      { success: false, error: draftErr.message, duration: Date.now() - startTime },
      { status: 500 }
    );
  }

  const typedDraft = draft as {
    id: string;
    tweet_text: string;
    status: string;
    auto_approve: boolean;
    template: string;
    creator_handle: string | null;
  } | null;

  if (!typedDraft) {
    const msg = `No approved draft found for ${today}. Open /admin/twitter-queue to approve.`;
    console.warn("[post-twitter-tweet]", msg);
    await sendAdminAlert(`No draft for ${today}`, msg);
    // Return 200 — this is an operational warning, not a crash
    return NextResponse.json({
      success: false,
      skipped: true,
      reason: msg,
      duration: Date.now() - startTime,
    });
  }

  // Post the tweet
  let tweetId: string;
  try {
    const result = await postTweet(typedDraft.tweet_text);
    tweetId = result.tweetId;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[post-twitter-tweet] Failed to post:", message);

    await supabase
      .from("twitter_drafts")
      .update({ status: "failed", failure_reason: message, updated_at: new Date().toISOString() })
      .eq("id", typedDraft.id);

    await sendAdminAlert(
      `Post failed for ${today}`,
      `Tweet posting failed:\n\n${message}\n\nDraft ID: ${typedDraft.id}\nTweet text:\n${typedDraft.tweet_text}`
    );

    return NextResponse.json(
      { success: false, error: message, draftId: typedDraft.id, duration: Date.now() - startTime },
      { status: 500 }
    );
  }

  // Mark as posted
  await supabase
    .from("twitter_drafts")
    .update({ status: "posted", tweet_id: tweetId, updated_at: new Date().toISOString() })
    .eq("id", typedDraft.id);

  console.log(`[post-twitter-tweet] Posted tweet ${tweetId} for ${today}`);

  return NextResponse.json({
    success: true,
    tweetId,
    template: typedDraft.template,
    creatorHandle: typedDraft.creator_handle,
    duration: Date.now() - startTime,
  });
}
