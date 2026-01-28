import { serve } from "inngest/next";
import { inngest } from "@/libs/inngest";
import { syncPropFirmPayouts } from "@/libs/inngest-payouts";

/**
 * Inngest handler route
 *
 * Exposes Inngest functions (including the cron-based payout sync)
 * at /api/inngest for the Inngest Cloud or self-hosted runner.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncPropFirmPayouts],
});

