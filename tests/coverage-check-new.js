#!/usr/bin/env node
/**
 * Pre-commit coverage check: newly added/changed code must have ≥80% coverage.
 * Only runs for staged files under lib/, app/api/, components/ (js, jsx, ts, tsx).
 * If no such files are staged, the check passes.
 */

const { execSync, execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const COVERED_PATTERNS = /^(lib|app\/api|components)\/.+\.(js|jsx|ts|tsx)$/;
const EXCLUDE_TEST_FILES = /__tests__|\.(spec|test)\.(js|jsx|ts|tsx)$/;

function getStagedSourceFiles() {
  const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
    encoding: 'utf8',
    cwd: ROOT,
  });
  return out
    .split('\n')
    .map((f) => f.trim())
    .filter((f) => COVERED_PATTERNS.test(f) && !EXCLUDE_TEST_FILES.test(f));
}

const files = getStagedSourceFiles();
if (files.length === 0) {
  process.exit(0);
}

const args = [
  'jest',
  '--config',
  'jest.coverage-new.config.js',
  '--coverage',
  '--passWithNoTests',
  ...files.flatMap((f) => ['--collectCoverageFrom', f]),
];

try {
  execFileSync('npx', args, { cwd: ROOT, stdio: 'inherit' });
} catch {
  console.error(
    '\n❌ Pre-commit: coverage for newly added/changed code is below 80%. Add tests or improve coverage.\n'
  );
  process.exit(1);
}
