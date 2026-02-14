import { inngest } from "@/lib/inngest";
import { syncAllFirms } from "@/lib/services/payoutSyncService";

// Cron function to sync prop firm payouts only (no trader sync)
export const syncPropFirmPayouts = inngest.createFunction(
  {
    id: "sync-prop-firm-payouts",
    name: "Sync Prop Firm Payouts",
  },
  {
    // Run every 5 minutes for more frequent updates
    cron: "*/5 * * * *",
  },
  async ({ step }) => {
    const result = await step.run("sync-all-firms", async () => {
      return await syncAllFirms();
    });

    return result;
  }
);
