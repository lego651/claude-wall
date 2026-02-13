# Testing Guide

**Stack**: Jest 30, React Testing Library, @testing-library/jest-dom  
**Target**: 90% coverage (threshold raised as coverage grows)

---

## Commands

| Command | Description |
|--------|-------------|
| `npm run test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report (enforced on pre-commit) |
| `npm run test:e2e` | Run Playwright E2E tests (starts app if needed) |
| `npm run test:e2e:ui` | Run E2E tests with Playwright UI |

---

## Where to put tests

- **Co-located**: `__tests__/*.test.js` next to the code (e.g. `lib/services/__tests__/payoutSyncService.test.js`)
- **Root smoke**: `__tests__/sample.test.js` for framework sanity

**Patterns**: `**/__tests__/**/*.[jt]s?(x)` and `**/?(*.)+(spec|test).[jt]s?(x)`.

---

## Unit tests (Node / no DOM)

- **Environment**: Default `testEnvironment: 'node'` in `jest.config.js`.
- **Path alias**: Use `@/` (e.g. `import { x } from '@/lib/arbiscan'`).
- **ESM**: Jest transforms `.js`/`.jsx`/`.ts`/`.tsx` via ts-jest.
- **Mocks**: `jest.mock('module')` at top of file; reset in `beforeEach` if shared.

Example:

```javascript
import { myFunction } from '@/lib/myModule';

jest.mock('@/lib/external');

describe('myFunction', () => {
  it('does something', () => {
    expect(myFunction()).toBe(expected);
  });
});
```

---

## Component tests (React + DOM)

- **Environment**: Use jsdom for that file:
  ```javascript
  /**
   * @jest-environment jsdom
   */
  import { render, screen } from '@testing-library/react';
  import { MyComponent } from '@/components/MyComponent';

  describe('MyComponent', () => {
    it('renders', () => {
      render(<MyComponent />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });
  ```
- **Matchers**: `@testing-library/jest-dom` is loaded in `jest.setup.js` (e.g. `toBeInTheDocument()`, `toHaveTextContent()`).

---

## Conventions

1. **Naming**: `*.test.js` or `*.spec.js`; describe blocks for module/function, it() for one behavior.
2. **Isolation**: Mock Supabase, fetch, and other I/O; avoid real API calls.
3. **Console**: Suppressed in tests via `jest.setup.js` (log/error/warn mocked).
4. **Coverage**: Collected from `lib/**` and `app/api/**`; global threshold is set in `jest.config.js` (currently low; goal 90%).
5. **Pre-commit**: `npm run test:coverage` runs on every commit; keep tests fast and deterministic.

---

## E2E tests (Playwright) – PROP-023

- **Stack**: `@playwright/test`, Chromium.
- **Location**: `tests/e2e/*.spec.js` (e.g. `tests/e2e/propfirms.spec.js`).
- **Run**: `npm run test:e2e` (uses `node node_modules/@playwright/test/cli.js test`). Do not use `npx playwright test`—that runs the browser-only CLI and tests will fail. The config starts the app via `webServer` if not already running; in CI it runs `npm run build && npm run start`.
- **Base URL**: `http://localhost:3000` (override with `PLAYWRIGHT_BASE_URL`).
- **Coverage**: Prop firms leaderboard: page load, period switch, sort by column, click firm to details, loading skeleton, error state, empty state; responsive (mobile); accessibility (landmark, focus).
- **CI**: `.github/workflows/e2e-tests.yml` runs E2E on push/PR to `main`; artifact `playwright-report` on failure.

---

## Files

| File | Purpose |
|------|---------|
| `jest.config.js` | Jest config, `@/` mapping, coverage, transform |
| `jest.setup.js` | Env vars, timeout, console suppression, jest-dom |
| `playwright.config.js` | Playwright E2E config, webServer, baseURL |
| `tests/e2e/propfirms.spec.js` | E2E tests for /propfirms leaderboard |
| `tests/e2e/fixtures/setup.js` | Optional global setup for E2E |
| `docs/TESTING.md` | This guide |
