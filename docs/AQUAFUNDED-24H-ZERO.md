# Why Aqua Funded Shows $0 and "14D AGO" on 24h Leaderboard

## Cause

The **24 Hours** leaderboard uses:

1. **Supabase `recent_payouts`** – only rows with `timestamp` in the last 24h. Metrics (aggregate payouts, mean exit, peak) come from this.
2. **`firms.last_payout_at`** – used for "Activity status" (e.g. "14D AGO").

When the 5‑minute payout sync had issues for ~10 days:

- **Cleanup** still ran: `recent_payouts` rows older than 24h are deleted every run. So any older Aqua Funded payouts were removed.
- **No new payouts** were written for Aqua Funded (sync failures or no on-chain payouts in the 24h window).
- **`last_payout_at`** is only updated when the sync finds at least one payout and calls `updateFirmLastPayout()`. When the sync finds **0 payouts**, it does not update `last_payout_at`, so it stayed at the last time we had a payout (~14 days ago).

Result: **0 rows** for Aqua Funded in `recent_payouts` in the last 24h → **$0**; **last_payout_at** unchanged → **"14D AGO"**.

## Config check

- Aqua Funded is in **Supabase `firms`** with the correct address: `0x6F405a66cb4048fb05E72D74FCCcD5073697c469`.
- **Historical JSON** (e.g. `data/payouts/aquafunded/`) has data; the backfill script sees payouts. So the address and token support (USDC/USDT/RISEPAY) are fine.

## Fix

1. **Run the payout sync** so the last 24h is re-fetched from Arbiscan and written to `recent_payouts`:
   - **Inngest**: ensure the "Sync Prop Firm Payouts" function runs (e.g. trigger from Inngest dashboard).
   - **Or** call your cron endpoint (if you use it): `POST /api/cron/sync-payouts` with `Authorization: Bearer <CRON_SECRET>`.
   - **Or** run the standalone script (with env set): `node scripts/sync-to-supabase.js` (requires `ARBISCAN_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

2. After a successful sync, if Aqua Funded had any payout in the last 24h on-chain, they will show non-zero and a recent "X H AGO". If they truly had no payout in 24h, you will still see $0; "14D AGO" will only change after a sync run that finds at least one new payout (then `last_payout_at` is updated).

## Optional improvement

To avoid "14D AGO" when the firm simply had no recent payout but the sync is healthy, the UI could show **last sync time** (e.g. `last_synced_at` from `firms`) when `payoutCount === 0` for the 24h period, so activity shows "Last checked 5m ago" instead of "Last payout 14d ago".
