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

# Testing
npm run test                        # Jest unit tests
npm run test:watch                  # Jest watch mode
npm run test:coverage               # Coverage report
npm run test:coverage:enforce-new   # Coverage enforcement (pre-commit)
npm run test:e2e                    # Playwright E2E tests
npm run test:e2e:ui                 # Playwright UI mode
npx jest path/to/file.test.ts       # Run a single test file
npx jest -t "test name"             # Run tests matching a name pattern
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
 - `lib/supabase/` - Database client configurations (server, client, service, middleware)
 - `lib/ai/` - OpenAI integration for classification and summarization
 - `lib/services/` - Business logic (firms, traders, payouts)
 - `lib/digest/` - Weekly email digest generation
 - `lib/schemas/` - Zod validation schemas
 - `lib/scrapers/` - Web scraping utilities (Apify, custom)
 - `lib/twitter-fetch/` & `lib/twitter-ingest/` - Twitter/X data pipeline
 - `lib/stripe.ts` - Payment processing
 - `lib/seo.js` - SEO tag generation
 - `lib/resend.ts` - Email service
- **`scripts/`** - Standalone utility scripts (backfill, reporting, Twitter sync); must load `.env` via `import 'dotenv/config'`
- **`migrations/`** - **Single source for all SQL migrations.** Numbered files (01_, 02_, …) define run order. Run via Supabase SQL Editor or `psql`. Do not create other migration folders (e.g. `supabase/migrations`, `database/`).
- **`documents/`** - **Single place for all markdown documentation.** See [Documents folder](#documents-folder) below for subfolder rules.
- **`config.js`** - Central configuration (app settings, Stripe plans, colors, auth URLs)

### Tech Stack Integration

**Authentication & Database:**
- Supabase with SSR support
- Server components use `@/lib/supabase/server`
- Client components use `@/lib/supabase/client`
- Admin/service-role operations (bypassing RLS) use `@/lib/supabase/service`
- Middleware handles session updates

**Payments:**
- Stripe integration with webhooks at `/api/webhook/stripe`
- Multiple pricing plans configured in `config.js`
- Customer portal and checkout creation endpoints

**Background Jobs:**
- Inngest for event-driven functions at `app/api/inngest/`
- Cron jobs at `app/api/cron/` authenticated via `CRON_SECRET` header

**Styling:**
- Tailwind CSS v4 with CSS-based configuration
- DaisyUI v5 component library
- Custom theme defined in `config.js`
- CSS imports: `@import "tailwindcss"; @plugin "daisyui";`

### Key Configuration

**Environment variables:** Use keys from **`.env`** at project root. Do not instruct users to `export VAR=value` in the shell; document that required vars go in `.env`. Standalone scripts (e.g. in `scripts/`) must load `.env` (e.g. `import 'dotenv/config'` at the top) so they read the same keys.

**Required in `.env`:**
- `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (for service-role / admin DB operations)
- `STRIPE_SECRET_KEY` & `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `OPENAI_API_KEY` (required for Intelligence Feed classification/summarization)
- `CRON_SECRET` (authenticates cron job endpoints)

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

### Cursor Rules — MANDATORY
Every interactive element must show a pointer cursor on hover. DaisyUI `btn` handles this automatically, but all other clickable elements require an explicit class:

```jsx
// ✅ CORRECT — always add cursor-pointer to non-btn interactive elements
<button className="... cursor-pointer">...</button>
<div onClick={fn} className="... cursor-pointer">...</div>

// ❌ WRONG — browser default is cursor:default on buttons/divs
<button className="text-red-400 hover:text-red-600">Delete</button>
```

Also apply to: icon buttons, close/delete icons, inline-edit triggers, toggle switches, custom selects, and any element with an `onClick` handler that is not a DaisyUI `btn`.

**Inline-editable fields** must visually signal their editability on hover — e.g. a dashed underline + pencil icon appearing on hover.

## Testing & Quality

### Write Tests Before Committing — MANDATORY

**Every new file in `lib/`, `app/api/`, or `components/` MUST have a corresponding test file with ≥80% line coverage before committing.** The pre-commit hook enforces this automatically and will block the commit if coverage is insufficient.

**CRITICAL: Always write tests as part of the same work session as the code — never defer them to later. Attempting a commit without tests for new files will always fail.**

Test file naming convention:
- `lib/gmail/ingest.ts` → `lib/gmail/ingest.test.ts`
- `app/api/v2/propfirms/[id]/content/route.js` → `app/api/v2/propfirms/[id]/content/route.test.js`

Workflow:
```bash
# 1. Write tests alongside new code
# 2. Verify coverage before staging
npx jest path/to/file.test.js --no-coverage

# 3. Only stage + commit once tests pass
git add <files> && git commit ...
```

If the pre-commit hook fails, fix the issue and create a **new** commit — never use `--no-verify` to bypass it.

### Pre-commit Checklist
1. `npm run build` passes without errors
2. `npm run lint` shows no warnings
3. Tests written and passing for all new files in `lib/`, `app/api/`, `components/` (≥80% line coverage each)
4. No unused imports
5. All async functions properly awaited
6. Environment variables checked before use
7. Proper error handling in API routes

### Warning Suppression
The `next.config.js` includes webpack configuration to suppress known Supabase realtime warnings that are harmless but noisy during development.

## Documents folder

All markdown (`.md`) documentation belongs under **`documents/`**. Do not create ad‑hoc doc folders at the project root (e.g. `docs/`, `specs/`). Use these subfolders:

| Subfolder | Purpose |
|-----------|--------|
| **`documents/alpha`** | Old and used files — reference material, completed designs, runbooks, and docs no longer actively edited. |
| **`documents/spikes`** | New ideas and current investigation — spikes, explorations, deep-dives, and in-progress analysis. |
| **`documents/sprints`** | Old sprint breakdowns — past sprint plans and retrospectives. |
| **`documents/current_sprint`** | Current sprint only — active planning: e.g. `tasks.md`, `scope.md`, and other sprint-specific files. |

**Rules:**
1. Put every new or moved `.md` file under `documents/` (or one of these subfolders).
2. Use `documents/current_sprint/` for the active sprint; when a sprint ends, move its contents to `documents/sprints/` (e.g. by sprint name or date).
3. Use `documents/spikes/` for exploration and ideas; when a spike is done or adopted, move the file to `documents/alpha` if it becomes reference.

## Database migrations

- **Use only the `migrations/` folder** at the project root for SQL schema and data migrations.
- Do not create or use separate migration folders (e.g. `supabase/migrations`, `database/`, or per-feature migration dirs). Add new migrations as numbered files (e.g. `18_my_change.sql`) and update `migrations/README.md` if needed.

## Key Integration Points

**SEO:** Handled by `lib/seo.js` with default tags in root layout
**Email:** Resend integration in `lib/resend.ts` for transactional emails
**Payments:** Stripe webhooks handle subscription events and user updates
**Auth:** Middleware updates user sessions on all routes
**Database:** Supabase with automatic session management via SSR package

This codebase prioritizes developer experience with modern patterns, comprehensive error handling, and clear separation of concerns between client and server components.