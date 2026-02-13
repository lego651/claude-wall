/**
 * Debug endpoint: check if key env vars are present in this deployment.
 * Use to verify production has ARBISCAN_API_KEY when Inngest runs.
 *
 * Call: GET /api/debug-env with Authorization: Bearer <CRON_SECRET>
 * Returns: { ARBISCAN_API_KEY: 'set'|'missing', VERCEL_ENV, ok } (no values)
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hasArbiscan = !!process.env.ARBISCAN_API_KEY;
  return NextResponse.json({
    ARBISCAN_API_KEY: hasArbiscan ? "set" : "missing",
    VERCEL_ENV: process.env.VERCEL_ENV ?? "unknown",
    VERCEL_URL: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    ok: hasArbiscan,
  });
}
