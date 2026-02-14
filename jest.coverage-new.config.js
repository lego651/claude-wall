/** Jest config for pre-commit: enforce 80% coverage on newly added/changed code only. */
const base = require('./jest.config.js');

module.exports = {
  ...base,
  collectCoverageFrom: [], // overridden by CLI in coverage-check-new.js
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
