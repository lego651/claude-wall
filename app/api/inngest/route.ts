import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { syncPropFirmPayouts } from "@/lib/inngest-payouts";
import { syncTraderPayouts } from "@/lib/inngest-traders";

/**
 * Inngest handler route
 *
 * Exposes Inngest functions (firm + trader cron-based sync)
 * at /api/inngest for the Inngest Cloud or self-hosted runner.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncPropFirmPayouts, syncTraderPayouts],
});

