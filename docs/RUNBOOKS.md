# Alert runbooks (PROP-022)

Alerts are sent **by email** via Resend to the address in `ALERT_EMAIL` (or `ALERTS_TO`). Severity levels: **INFO**, **WARNING**, **CRITICAL**. If `ALERT_EMAIL` or `RESEND_API_KEY` is not set, alerts are only logged (no email).

## Configure

- **ALERT_EMAIL** (or **ALERTS_TO**): recipient address for all alerts.
- **RESEND_API_KEY**: required for sending (same as digest/transactional email).

## Alert: Arbiscan API – circuit breaker opened (CRITICAL)

**When:** More than 5 consecutive Arbiscan API failures; circuit breaker opens and blocks all requests for 60 seconds.

**What to do:**

1. Check [Arbiscan status](https://arbiscan.io/) and [Arbitrum](https://arbitrum.io/status) for outages.
2. Check **Arbiscan API key** (rate limit, quota, or invalid key). Rotate key in dashboard if needed.
3. Check **admin dashboard** → Arbiscan usage (calls/day, % of limit). If near limit, wait for UTC midnight reset or reduce sync frequency.
4. After 60s the circuit will try one request (HALF_OPEN). If it succeeds, traffic resumes. If not, it opens again.
5. Optional: restart the process to reset the circuit (e.g. redeploy or restart cron worker).

**Prevention:** Monitor Arbiscan usage (PROP-019); add more delay between addresses in payout sync if hitting rate limits.

---

## Other alerts (to be wired)

You can call `sendAlert(service, message, severity, details)` from:

- **Supabase connection failures** – e.g. in `withQueryGuard` or API routes when Supabase returns unreachable/timeout.
- **File size >5MB** – in `loadMonthlyData` or admin metrics when a payout file exceeds 5MB (see FILE-SIZE-MITIGATION.md).
- **Sync failures (GitHub Actions / cron)** – in the cron handler for `/api/cron/sync-payouts` when sync returns errors for multiple firms.
- **Data overlap >5%** – in `scripts/validate-data-overlap.js` or the validation workflow when Supabase vs JSON mismatch exceeds 5%.
- **Rate limit >90%** – in Arbiscan usage tracker when `usage.percentage >= 90` (already logs; add `sendAlert(..., 'WARNING', usage)` if desired).
- **API error rate >5%** – would require aggregating errors (e.g. in middleware or a separate job) and calling `sendAlert` when threshold exceeded.

Example:

```javascript
import { sendAlert } from '@/lib/alerts';

if (syncResult.errors.length > 0 && syncResult.errors.length >= firms.length * 0.5) {
  await sendAlert(
    'Payout Sync',
    'More than half of firm syncs failed',
    'CRITICAL',
    { errors: syncResult.errors.slice(0, 5), totalFirms: firms.length }
  );
}
```
