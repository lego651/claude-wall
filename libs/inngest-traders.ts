import { inngest } from "@/libs/inngest";
import { syncAllTradersRealtime } from "@/lib/services/traderRealtimeSyncService";

export const syncTraderPayouts = inngest.createFunction(
  {
    id: "sync-trader-payouts",
    name: "Sync Trader Payouts (24h realtime)",
  },
  {
    cron: "*/5 * * * *",
  },
  async ({ step }) => {
    const result = await step.run("sync-all-traders-realtime", async () => {
      return await syncAllTradersRealtime();
    });
    return result;
  }
);
