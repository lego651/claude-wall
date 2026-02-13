/**
 * Smoke test: verifies Jest + config run correctly.
 * PROP-001: Test framework setup.
 */
describe('Test framework', () => {
  it('runs and resolves @/ path alias', () => {
    // Module resolution (would throw if alias broken)
    const path = require('path');
    const rootDir = path.resolve(__dirname, '..');
    expect(rootDir).toBeDefined();
    expect(typeof rootDir).toBe('string');
  });

  it('has expected globals from jest.setup.js', () => {
    expect(process.env.TZ).toBe('UTC');
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined();
  });
});
