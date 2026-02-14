# OAuth Setup for Local Development

## Issue: Redirecting to Wrong Environment

If you're experiencing redirects to the wrong environment (production when on localhost, or localhost when on production), you need to configure your Supabase project settings correctly.

## Solution

### 1. Configure Supabase Site URL (IMPORTANT)

**Set Site URL to your PRODUCTION URL:**
```
https://claude-wall.vercel.app
```

**Why?** The Site URL is used as a fallback when:
- No explicit `redirectTo` is provided
- The provided `redirectTo` doesn't match any whitelisted redirect URLs
- There's an error in the OAuth flow

Since our code **always explicitly passes `redirectTo`** based on `window.location.origin`, the Site URL should be set to production (your primary environment).

### 2. Configure Supabase Redirect URLs

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Authentication** → **URL Configuration**
4. Add the following to **Redirect URLs** (both environments must be whitelisted):
   ```
   http://localhost:3000/api/auth/callback
   https://claude-wall.vercel.app/api/auth/callback
   ```
   
   **Optional:** You can also use wildcards:
   ```
   http://localhost:3000/**
   https://claude-wall.vercel.app/**
   ```

**Important:** Both localhost and production callback URLs must be in the whitelist for both environments to work.

### 3. How It Works

The application code automatically detects the current environment and sets the correct redirect URL:

```javascript
// In app/signin/page.js
const currentOrigin = window.location.origin; // Automatically detects localhost or production
const redirectURL = `${currentOrigin}/api/auth/callback`;

await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: redirectURL, // Explicitly set based on current environment
  },
});
```

This means:
- **On localhost:** `redirectTo` = `http://localhost:3000/api/auth/callback`
- **On production:** `redirectTo` = `https://claude-wall.vercel.app/api/auth/callback`

Since we always explicitly pass `redirectTo`, Supabase will use that value (as long as it's in the whitelist) and won't fall back to the Site URL.

### 4. Verify Environment Variables

Make sure your `.env.local` file has:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 5. Test the Flow

1. Start your dev server: `npm run dev`
2. Navigate to `http://localhost:3000/connect-wallet`
3. Enter a wallet address
4. Click "Link Wallet"
5. Sign in with Google
6. You should be redirected back to `http://localhost:3000/dashboard`

## Troubleshooting

### Issue: Redirecting to wrong environment

**Symptoms:**
- On production, redirects to `http://localhost:3000/?code=...`
- On localhost, redirects to `https://claude-wall.vercel.app/?code=...`

**Solutions:**
1. **Check Site URL:** Should be set to `https://claude-wall.vercel.app` (production)
2. **Check Redirect URLs:** Both localhost and production must be whitelisted
3. **Check browser console:** Look for the logged redirect URL - it should match your current environment
4. **Verify code:** Ensure `window.location.origin` is being used (it should be automatic)

### Other Issues

- **OAuth error?** Verify your Google OAuth credentials in Supabase
- **CORS errors?** Ensure both localhost and production are in the allowed origins
- **Wallet not saving?** Check server logs and browser console for errors

## Summary

**Recommended Supabase Configuration:**
- **Site URL:** `https://claude-wall.vercel.app` (production)
- **Redirect URLs:**
  - `http://localhost:3000/api/auth/callback`
  - `https://claude-wall.vercel.app/api/auth/callback`

This setup works because:
1. The code always explicitly sets `redirectTo` based on `window.location.origin`
2. Both environments are whitelisted in Redirect URLs
3. Site URL is set to production (fallback for edge cases)
