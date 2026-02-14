# Post-deploy verification (PROP-026)

Run these checks after a production deployment.

---

## 1. Health and availability

- [ ] **Homepage** loads: `https://<your-domain>/`
- [ ] **Propfirms leaderboard** loads: `https://<your-domain>/propfirms`
- [ ] **API list** returns 200: `curl -s -o /dev/null -w "%{http_code}" "https://<your-domain>/api/v2/propfirms?period=1d"`
- [ ] **Firm detail** loads: `https://<your-domain>/propfirm/fundingpips` (or another known firm ID)

---

## 2. Critical API checks

Run against production base URL (replace `BASE`):

```bash
BASE=https://<your-domain>

# List (1d – uses Supabase if configured)
curl -s -w "\n%{http_code}" "$BASE/api/v2/propfirms?period=1d" | tail -1
# Expect: 200

# List (7d – file-backed)
curl -s -w "\n%{http_code}" "$BASE/api/v2/propfirms?period=7d" | tail -1
# Expect: 200

# Firm chart
curl -s -w "\n%{http_code}" "$BASE/api/v2/propfirms/fundingpips/chart?period=30d" | tail -1
# Expect: 200
```

- [ ] All return **200**
- [ ] Response body is valid JSON (e.g. `data` array or expected structure)

---

## 3. Monitoring and alerts

- [ ] **Vercel:** Deployment shows as "Ready" in Vercel dashboard; no build/runtime errors in logs.
- [ ] **Sentry:** No new critical errors in Sentry for the deploy (or confirm Sentry is receiving events).
- [ ] **Analytics:** Vercel Analytics is receiving traffic (may take a few minutes).

---

## 4. Optional: cron and sync

If payout sync runs via Vercel Cron or GitHub Actions:

- [ ] Trigger a sync (e.g. wait for schedule or run workflow manually). Check logs for success.
- [ ] Admin dashboard: `/admin/dashboard` (with admin user) shows Arbiscan usage and cache stats if applicable.

---

## 5. Rollback

If verification fails:

1. In Vercel: Deployments → select previous deployment → **Promote to Production**.
2. Fix the issue (logs, Sentry, runbooks), then redeploy.
3. Document the incident and update runbooks if needed (see [INCIDENT-RESPONSE.md](./INCIDENT-RESPONSE.md)).
