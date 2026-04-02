import { inngest } from "@/lib/inngest";
import { syncAllTradersRealtime } from "@/lib/services/traderRealtimeSyncService";

export const syncTraderPayouts = inngest.createFunction(
  {
    id: "sync-trader-payouts",
    name: "Sync Trader Payouts (24h realtime)",
  },
  {
    cron: "0 8 * * *",
  },
  async ({ step }) => {
    const result = await step.run("sync-all-traders-realtime", async () => {
      return await syncAllTradersRealtime();
    });
    return result;
  }
);
