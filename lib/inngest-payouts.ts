import { inngest } from "@/lib/inngest";
import { syncAllFirms } from "@/lib/services/payoutSyncService";

// Cron function to sync prop firm payouts only (no trader sync)
export const syncPropFirmPayouts = inngest.createFunction(
  {
    id: "sync-prop-firm-payouts",
    name: "Sync Prop Firm Payouts",
  },
  {
    // Run once daily at 8am UTC to stay within Vercel free tier CPU limits
    cron: "0 8 * * *",
  },
  async ({ step }) => {
    const result = await step.run("sync-all-firms", async () => {
      return await syncAllFirms();
    });

    return result;
  }
);
