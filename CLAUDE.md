# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **ShipFast**, a Next.js SaaS boilerplate using modern technologies including Next.js 15, React 19, Tailwind CSS v4, DaisyUI v5, Supabase, and Stripe. The codebase is designed for rapid SaaS development with authentication, payments, database integration, and email functionality.

### Trading Logs System

This repo also contains a **trading log system** in `/trading-logs/` for tracking R-multiples across 6 trading strategies.

**Important:** If the user mentions:
- "trading log" or "weekly screenshot" or "trading data"
- Screenshots with trading results (Mon-Fri grid)
- Generating reports or aggregating data

**→ Read `/trading-logs/CLAUDE-CONTEXT.md` first!** It contains complete instructions for parsing screenshots and generating files.

## Development Commands

```bash
npm run dev          # Development server with Turbopack
npm run build        # Production build
npm run postbuild    # Generate sitemap after build
npm run start        # Start production server
npm run lint         # ESLint check
```

## Critical Warning Prevention

### 1. Async/Await Requirements (Next.js 15)
- **ALWAYS** await `cookies()` and `headers()` calls in server components
- **ALWAYS** await `createClient()` from Supabase server in server components

```javascript
// ✅ CORRECT
const cookieStore = await cookies();
const supabase = await createClient();

// ❌ WRONG - causes warnings
const cookieStore = cookies();
const supabase = createClient();
```

### 2. Import Management
- Remove unused imports immediately
- Comment out imports when code is commented out
- Use specific imports over wildcard imports

### 3. React Hook Dependencies
- Include all dependencies in useEffect arrays OR move dependencies inside the effect
- Prefer moving Supabase client creation inside useEffect to avoid dependency issues

## Architecture Overview

### Directory Structure
- **`app/`** - Next.js App Router pages and API routes
  - `app/api/` - API endpoints (auth, Stripe webhooks, lead generation)
  - `app/dashboard/` - Protected user pages
- **`components/`** - Reusable UI components (buttons, testimonials, features)
- **`lib/`** - Core utilities and integrations
 - `lib/supabase/` - Database client configurations (server, client, middleware)
 - `lib/stripe.ts` - Payment processing
 - `lib/seo.js` - SEO tag generation
 - `lib/resend.ts` - Email service
- **`config.js`** - Central configuration (app settings, Stripe plans, colors, auth URLs)

### Tech Stack Integration

**Authentication & Database:**
- Supabase with SSR support
- Server components use `@/lib/supabase/server`
- Client components use `@/lib/supabase/client`
- Middleware handles session updates

**Payments:**
- Stripe integration with webhooks at `/api/webhook/stripe`
- Multiple pricing plans configured in `config.js`
- Customer portal and checkout creation endpoints

**Styling:**
- Tailwind CSS v4 with CSS-based configuration
- DaisyUI v5 component library
- Custom theme defined in `config.js`
- CSS imports: `@import "tailwindcss"; @plugin "daisyui";`

### Key Configuration

**Environment Variables Required:**
- `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `STRIPE_SECRET_KEY` & `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`

**Central Config (`config.js`):**
- App metadata and SEO settings
- Stripe pricing plans and features
- Email configuration (Resend)
- Theme and color settings
- Authentication URLs

## Component Patterns

### Server Components (Default)
```javascript
export default async function ServerPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('table').select('*');
  return <div>{/* JSX */}</div>;
}
```

### Client Components (Interactive)
```javascript
"use client";
import { createClient } from "@/lib/supabase/client";

export default function ClientComponent() {
  useEffect(() => {
    const supabase = createClient(); // No await on client
    // Fetch data
  }, []);
  return <div>{/* Interactive JSX */}</div>;
}
```

### API Routes
```javascript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req) {
  const supabase = await createClient();
  const body = await req.json();

  // Always check environment variables
  if (!process.env.REQUIRED_VAR) {
    return NextResponse.json({ error: "Config error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

## Styling Guidelines

### Tailwind v4 + DaisyUI v5
```css
/* globals.css structure */
@import "tailwindcss";
@plugin "daisyui";

@theme {
  --color-custom: oklch(60% 0.2 280);
}

@utility custom-class {
  property: value;
}

/* Pseudo-selectors as separate rules */
.custom-class:hover {
  property: value;
}
```

### DaisyUI v5 Classes
- Use `card-border` instead of `card-bordered`
- Use `card-sm` instead of `card-compact`
- Responsive modifiers: `btn btn-primary md:btn-lg`

## Testing & Quality

### Pre-commit Checklist
1. `npm run build` passes without errors
2. `npm run lint` shows no warnings
3. No unused imports
4. All async functions properly awaited
5. Environment variables checked before use
6. Proper error handling in API routes

### Warning Suppression
The `next.config.js` includes webpack configuration to suppress known Supabase realtime warnings that are harmless but noisy during development.

## Key Integration Points

**SEO:** Handled by `lib/seo.js` with default tags in root layout
**Email:** Resend integration in `lib/resend.ts` for transactional emails
**Payments:** Stripe webhooks handle subscription events and user updates
**Auth:** Middleware updates user sessions on all routes
**Database:** Supabase with automatic session management via SSR package

This codebase prioritizes developer experience with modern patterns, comprehensive error handling, and clear separation of concerns between client and server components.