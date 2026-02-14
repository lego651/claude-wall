# Sentry Error Tracking

Sentry is integrated for error monitoring and performance (API routes). This doc covers setup and usage.

## Setup

### 1. Create a Sentry account and project

1. Sign up at [sentry.io](https://sentry.io/signup/).
2. Create a new project and choose **Next.js**.
3. Copy the **DSN** from Project Settings → Client Keys (DSN).

### 2. Environment variables

Add to `.env.local` (and to your hosting provider, e.g. Vercel):

```bash
# Required for error/performance reporting
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# Optional: same value for client (browser); can use SENTRY_DSN only if not using NEXT_PUBLIC_*
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# Optional: for source map upload (readable stack traces in Sentry)
# Create at Sentry: Settings → Auth Tokens
SENTRY_AUTH_TOKEN=xxx
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
```

- **SENTRY_DSN**: Used by server and edge configs. Required for Sentry to receive events.
- **NEXT_PUBLIC_SENTRY_DSN**: Used by the client (browser). Can be omitted if you set `SENTRY_DSN` and ensure it is available at build time for the client bundle (e.g. in Vercel env).
- **SENTRY_AUTH_TOKEN**, **SENTRY_ORG**, **SENTRY_PROJECT**: Only needed if you want to upload source maps during build (recommended for production).

### 3. Build with Sentry (optional source maps)

If `SENTRY_DSN`, `SENTRY_ORG`, and `SENTRY_PROJECT` are set, the build will wrap Next.js config with Sentry and upload source maps when `SENTRY_AUTH_TOKEN` is set (e.g. in CI). Otherwise, the app still runs and reports errors; stack traces may be minified.

## What is instrumented

- **Client**: Errors in React components and unhandled rejections (via `sentry.client.config.js` and `instrumentation-client.js`).
- **Server**: Errors in API routes and server components (via `sentry.server.config.js` and `instrumentation.js` → `onRequestError`).
- **Edge**: Errors in middleware and edge routes (via `sentry.edge.config.js`).
- **Global errors**: Root-level errors are captured in `app/global-error.js` and sent to Sentry.
- **Performance**: Tracing is enabled with a sample rate (10% in production, 100% in development by default). API routes are auto-instrumented.

## Sampling

- **Errors**: Effectively 100% in production (all captured errors are sent when DSN is set).
- **Traces**: 10% in production, 100% in development (configurable in the Sentry config files).

## Dashboard usage

1. **Issues**: [Sentry → Issues](https://docs.sentry.io/product/issues/) – list of errors with stack traces, release, and environment.
2. **Performance**: [Sentry → Performance](https://docs.sentry.io/product/performance/) – transactions and spans for API routes and navigation.
3. **Alerts**: Project Settings → Alerts – create rules (e.g. notify when error count exceeds a threshold or a new issue is created).

## Test error reporting

1. Set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`.
2. Add a temporary button that throws: `throw new Error('Sentry test');`
3. Click it and confirm the error appears in Sentry → Issues.

## Files

| File | Purpose |
|------|---------|
| `sentry.client.config.js` | Browser Sentry init (DSN, traces, env). |
| `sentry.server.config.js` | Node server Sentry init. |
| `sentry.edge.config.js` | Edge runtime Sentry init. |
| `instrumentation.js` | Registers server/edge configs and `onRequestError`. |
| `instrumentation-client.js` | Loads client config in the browser. |
| `app/global-error.js` | Root error boundary; captures and reports to Sentry. |
| `next.config.js` | Uses `withSentryConfig` when Sentry env vars are set (source maps, etc.). |

## Security

- Do not commit `SENTRY_DSN` or `SENTRY_AUTH_TOKEN` to the repo. Use env vars only.
- DSN is safe to expose in the client (it only allows sending events). Auth token must stay server-side / CI only.
