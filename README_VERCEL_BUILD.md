# How to Fix Vercel Build Errors

## The Error You're Seeing

```
Error: Neither apiKey nor config.authenticator provided
```

This happens because Vercel's build process tries to evaluate your API routes, and they need environment variables even at build time.

## Solution: Configure Environment Variables in Vercel

### Step 1: Go to Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select your project
3. Click **Settings** → **Environment Variables**

### Step 2: Add All Required Variables

Add these environment variables with your **real values** (not the dummy values):

#### Required for Build & Runtime

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

#### Optional (but recommended)

```
RESEND_API_KEY
STRIPE_PUBLIC_KEY
OPENAI_API_KEY
```

### Step 3: Important Settings

For **each** environment variable:
- ✅ Check **Production**
- ✅ Check **Preview**
- ✅ Check **Development**

This ensures the variables are available during build time.

### Step 4: Redeploy

After adding all variables:
1. Go to **Deployments** tab
2. Click the **...** menu on the latest deployment
3. Click **Redeploy**

OR just push a new commit to trigger a new build.

## Why This Happens

Next.js 15+ tries to "collect page data" during build, which means it actually evaluates your API routes. Since we're using:
- Supabase (needs URL and keys)
- Stripe (needs secret key)
- Resend (needs API key)

All these need to be available even during build time.

## Local Development

For local development, copy the `.env.example.build` file:

```bash
cp .env.example.build .env
# Then edit .env with your real keys
```

## Verification

After setting environment variables, your Vercel build should show:

```
✓ Compiled successfully
✓ Running TypeScript
✓ Collecting page data
✓ Generating static pages
```

## Troubleshooting

### Build Still Failing?

1. **Double-check variable names** - They must match exactly (case-sensitive)
2. **Check all environments** - Make sure Production, Preview, AND Development are checked
3. **No quotes needed** - Just paste the value directly (Vercel handles quotes)
4. **Redeploy** - Changes to env vars require a new deployment

### Example of Correct Setup

In Vercel dashboard, it should look like:

| Name | Value | Environments |
|------|-------|--------------|
| NEXT_PUBLIC_SUPABASE_URL | https://xxx.supabase.co | Production, Preview, Development ✓ |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | eyJhbGc... | Production, Preview, Development ✓ |
| STRIPE_SECRET_KEY | sk_live_... | Production, Preview, Development ✓ |

### Still Having Issues?

Check the Vercel build logs for the specific route that's failing:
- Look for "Failed to collect page data for /api/..."
- That route might need additional env vars

---

**Need Help?** Share the complete error message from Vercel build logs.
