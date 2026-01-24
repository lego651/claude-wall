# OAuth Setup for Local Development

## Issue: Redirecting to Production Instead of Localhost

If you're experiencing redirects to the production URL (`https://claude-wall.vercel.app`) instead of `http://localhost:3000` during OAuth sign-in, you need to configure your Supabase project settings.

## Solution

### 1. Configure Supabase Redirect URLs

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Authentication** → **URL Configuration**
4. Add the following to **Redirect URLs**:
   ```
   http://localhost:3000/api/auth/callback
   http://localhost:3000/**
   ```
5. Set **Site URL** to:
   ```
   http://localhost:3000
   ```
   (Or keep it as production URL, but ensure redirect URLs include localhost)

### 2. Configure Google OAuth Provider

1. In Supabase Dashboard, go to **Authentication** → **Providers**
2. Click on **Google**
3. Ensure **Redirect URL** includes:
   ```
   http://localhost:3000/api/auth/callback
   ```

### 3. Verify Environment Variables

Make sure your `.env.local` file has:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Test the Flow

1. Start your dev server: `npm run dev`
2. Navigate to `http://localhost:3000/connect-wallet`
3. Enter a wallet address
4. Click "Link Wallet"
5. Sign in with Google
6. You should be redirected back to `http://localhost:3000/dashboard`

## Troubleshooting

- **Still redirecting to production?** Check the browser console for the redirect URL being used
- **OAuth error?** Verify your Google OAuth credentials in Supabase
- **CORS errors?** Ensure localhost is in the allowed origins in Supabase

## Production Setup

For production, ensure:
- Site URL: `https://claude-wall.vercel.app`
- Redirect URLs include: `https://claude-wall.vercel.app/api/auth/callback`
