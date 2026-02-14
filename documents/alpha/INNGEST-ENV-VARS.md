# Inngest + Vercel: Environment Variables

When **Sync Prop Firm Payouts** (or **Sync Trader Payouts**) runs in Inngest Cloud, it triggers your app by sending an HTTP request to your Vercel deployment. The code runs **on Vercel**, so all required env vars must be set in the **same Vercel project and environment** that serves the request.

## If you see "Missing ARBISCAN_API_KEY environment variable"

You’ve added `ARBISCAN_API_KEY` in Vercel but the Inngest run still fails. Common causes:

### 1. Wrong deployment is being called

Inngest can be configured with different **environments** (e.g. Production vs Preview), each with its own **App URL**.

- **Inngest dashboard** → Your app → **Sync** / **Environments**: note which URL is used for the cron (e.g. `https://your-app.vercel.app` for Production, or a preview URL for branch envs).
- Ensure **that** deployment has `ARBISCAN_API_KEY`:
  - **Vercel** → Project → **Settings** → **Environment Variables**
  - Confirm `ARBISCAN_API_KEY` is present and that its **Environments** include the one that serves the Inngest URL (e.g. **Production** and/or **Preview**).
- If the cron runs in a **Preview** environment, add `ARBISCAN_API_KEY` explicitly to **Preview** (or use "All Environments") and redeploy that branch.

### 2. Redeploy after adding the variable

After adding or changing env vars, trigger a new deployment so the runtime that handles Inngest uses the latest config:

- **Vercel** → **Deployments** → **Redeploy** (e.g. latest production deployment).
- Or push a small commit to the branch that Inngest uses.

### 3. Variable name and scope

- Name must be exactly: `ARBISCAN_API_KEY` (no typo, no trailing space).
- If you use **branch environments** in Inngest, each branch’s deployment needs the var; "All Environments" in Vercel usually covers Production + Preview.

### 4. Same Vercel project as Inngest

If you have multiple Vercel projects (e.g. prod vs staging), ensure `ARBISCAN_API_KEY` is set in the **project** that is connected to Inngest (the one whose URL is registered in Inngest).

## Required env vars for payout sync (Inngest)

These must be set in Vercel for the deployment that serves `/api/inngest`:

| Variable | Used by |
|----------|--------|
| `ARBISCAN_API_KEY` | Prop firm + trader payout sync (Arbiscan API) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase (sync writes) |
| `INNGEST_SIGNING_KEY` | Inngest (set by Vercel integration) |
| `INNGEST_EVENT_KEY` | Inngest (set by Vercel integration) |

## Verify the deployment actually sees the var

If Inngest uses your **production** URL and the var is set for **All Environments**, the next check is whether that deployment’s runtime sees it.

1. **Redeploy production**  
   Vercel injects env at runtime, but triggering a fresh production deploy often fixes “missing” vars.  
   **Vercel** → **Deployments** → latest production → **⋯** → **Redeploy**.

2. **Call the debug endpoint** (after deploy):
   ```bash
   curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://claude-wall.vercel.app/api/debug-env
   ```
   You should see something like:
   - `"ARBISCAN_API_KEY": "set"` → deployment has the var; if Inngest still fails, the issue is in the Inngest execution path.
   - `"ARBISCAN_API_KEY": "missing"` → this deployment doesn’t get the var; double‑check the var in Vercel (exact name, same project), then redeploy again.

## Quick checklist

1. **Inngest** → App → note the **Sync URL** (and environment) used for the failing cron.
2. **Vercel** → Same project → **Environment Variables** → `ARBISCAN_API_KEY` present and scoped to that environment (e.g. Production and/or Preview).
3. **Redeploy** the deployment that serves that URL.
4. **Verify** with `GET /api/debug-env` (Bearer `CRON_SECRET`) that the deployment reports `ARBISCAN_API_KEY: "set"`.
5. Re-run the function in Inngest; the service logs `Vercel env` and `URL` on failure to confirm which deployment ran.
