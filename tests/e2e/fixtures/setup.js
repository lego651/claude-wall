/**
 * PROP-023: Optional E2E global setup.
 * Can be wired in playwright.config.js as globalSetup for env checks or test data.
 */
module.exports = async () => {
  // No-op by default; extend for auth or seed data if needed.
};
