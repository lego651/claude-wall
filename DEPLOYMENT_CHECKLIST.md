# Vercel Deployment Checklist

## ✅ Pre-Deployment Steps

### 1. Verify Local Build Works
```bash
# Use dummy env vars for testing
cp .env.example.build .env
npm run build

# Should see: ✓ Compiled successfully
```

### 2. Commit All Changes
```bash
git add .
git commit -m "fix: TypeScript migration and Vercel build fixes"
git push origin main
```

## 🚀 Vercel Configuration

### Step 1: Environment Variables

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add these variables (use your **real values**):

#### **Critical - Build will fail without these:**

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
```
- ✅ Production
- ✅ Preview
- ✅ Development

```
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
- ✅ Production
- ✅ Preview
- ✅ Development

```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
- ✅ Production
- ✅ Preview
- ✅ Development

```
STRIPE_SECRET_KEY=sk_live_... (or sk_test_... for testing)
```
- ✅ Production
- ✅ Preview
- ✅ Development

```
STRIPE_WEBHOOK_SECRET=whsec_...
```
- ✅ Production
- ✅ Preview
- ✅ Development

#### **Optional - App will work without these:**

```
RESEND_API_KEY=re_...
STRIPE_PUBLIC_KEY=pk_live_... (or pk_test_...)
OPENAI_API_KEY=sk-...
```

### Step 2: Framework Preset

Make sure Vercel is using:
- Framework Preset: **Next.js**
- Build Command: `npm run build` (or leave default)
- Output Directory: `.next` (or leave default)

### Step 3: Node Version (Optional)

If you want to specify Node version, add to `package.json`:
```json
{
  "engines": {
    "node": ">=18.0.0"
  }
}
```

## 🔄 Deploy

### Option 1: Automatic (Recommended)
Just push to your repository - Vercel will auto-deploy

### Option 2: Manual Redeploy
1. Go to Deployments tab
2. Click **Redeploy** on latest deployment

## ✅ Verification

After deployment, check:

### 1. Build Logs
Should show:
```
✓ Compiled successfully
✓ Running TypeScript
✓ Collecting page data
✓ Generating static pages
✓ Finalizing page optimization
```

### 2. Test Your Site
- [ ] Homepage loads
- [ ] Sign in works
- [ ] Dashboard loads (after login)
- [ ] Stripe checkout works (if applicable)

## 🐛 Troubleshooting

### Error: "Neither apiKey nor config.authenticator provided"

**Cause:** Environment variables not set in Vercel

**Fix:**
1. Double-check all env vars are added
2. Make sure **all three environments** are checked (Production, Preview, Development)
3. Click **Redeploy**

### Error: "Failed to collect page data for /api/..."

**Cause:** Missing environment variable for that specific route

**Fix:**
1. Check which route is failing in the error message
2. Add the missing env var (see list above)
3. Redeploy

### Error: Build works locally but fails on Vercel

**Possible causes:**
1. Environment variables not configured in Vercel
2. Using `yarn` locally but `npm` on Vercel (or vice versa)
3. Node version mismatch

**Fix:**
1. Add env vars in Vercel dashboard
2. Make sure `package-lock.json` or `yarn.lock` is committed
3. Specify Node version in package.json

## 📝 Post-Deployment

### Stripe Webhook Setup

After deployment, configure Stripe webhooks:

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click **Add endpoint**
3. URL: `https://your-domain.vercel.app/api/webhook/stripe`
4. Events to listen:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Copy the webhook secret
6. Add it to Vercel env vars as `STRIPE_WEBHOOK_SECRET`
7. Redeploy

---

## Summary

✅ **All API routes migrated to TypeScript**
✅ **Dynamic rendering configured**
✅ **Lazy initialization for external services**
✅ **Environment validation in place**
✅ **Local build verified**

**Ready for Vercel deployment** - Just add environment variables! 🚀
