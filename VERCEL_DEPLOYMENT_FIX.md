# Vercel Deployment Fix - TypeScript Migration

## Problem
After migrating to TypeScript, Vercel builds were failing with:
```
Error: Neither apiKey nor config.authenticator provided
```

## Root Cause
The build process in Next.js tries to collect page data for all routes, including API routes. When it evaluates the Stripe webhook route which imports `@supabase/supabase-js` directly, the Resend library tries to initialize without an API key.

## Solutions Implemented

### 1. Lazy Initialization in libs/resend.ts
Changed from module-level initialization to function-level:
```typescript
// Before (module-level - runs at build time)
const resend = new Resend(process.env.RESEND_API_KEY);

// After (lazy - only runs when function is called)
const getResendClient = (): Resend | null => {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
};
```

### 2. Dynamic Route Configuration
Added `export const dynamic = 'force-dynamic'` to all API routes:
- `app/api/lead/route.ts`
- `app/api/stripe/create-checkout/route.ts`
- `app/api/stripe/create-portal/route.ts`
- `app/api/webhook/stripe/route.ts`

This tells Next.js not to try to statically analyze these routes during build.

### 3. Environment Variable Validation
Added checks in all routes:
```typescript
if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
  return NextResponse.json(
    { error: "Server configuration error" },
    { status: 500 }
  );
}
```

## Vercel Deployment Instructions

### Step 1: Configure Environment Variables in Vercel
Go to your Vercel project settings → Environment Variables and add:

```
RESEND_API_KEY=<your_real_resend_key>
NEXT_PUBLIC_SUPABASE_URL=<your_supabase_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_supabase_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<your_supabase_service_key>
STRIPE_PUBLIC_KEY=<your_stripe_public_key>
STRIPE_SECRET_KEY=<your_stripe_secret_key>
STRIPE_WEBHOOK_SECRET=<your_stripe_webhook_secret>
OPENAI_API_KEY=<your_openai_key> (optional)
```

### Step 2: Deploy
Push your code to GitHub/GitLab/Bitbucket. Vercel will automatically deploy with the environment variables you configured.

## Local Development

### Option 1: With Real API Keys
Add your real keys to `.env`:
```bash
cp .env.example .env
# Edit .env with your real keys
```

### Option 2: For Build Testing Without Real Keys
Use dummy values for local builds:
```bash
cp .env.example.build .env
npm run build
```

## Build Verification
✅ Build passes with dummy environment variables
✅ TypeScript compilation successful
✅ All API routes properly configured
✅ Graceful degradation when API keys missing

## Notes
- The app gracefully handles missing API keys at runtime
- Email sending skips silently if RESEND_API_KEY is not set
- OpenAI calls return null if OPENAI_API_KEY is not set
- All routes check for required env vars and return 500 if missing

---

**Fixed**: 2026-01-04
**Tested**: ✅ Local build passing
**Ready**: ✅ For Vercel deployment
