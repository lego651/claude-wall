import { inngest } from "@/libs/inngest";
import { syncAllFirms } from "@/lib/services/payoutSyncService";

// Cron function to sync prop firm payouts only (no trader sync)
export const syncPropFirmPayouts = inngest.createFunction(
  {
    id: "sync-prop-firm-payouts",
    name: "Sync Prop Firm Payouts",
  },
  {
    // Match the existing GitHub Action cadence (every 30 minutes)
    cron: "*/30 * * * *",
  },
  async ({ step }) => {
    const result = await step.run("sync-all-firms", async () => {
      return await syncAllFirms();
    });

    return result;
  }
);

