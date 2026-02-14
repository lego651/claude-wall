#!/usr/bin/env node
/**
 * Enforces ≥80% coverage for new/changed code only (staged files in lib/, app/api/, components/).
 * Run after: npm run test:coverage (or test:coverage:enforce-new).
 * Reads coverage/coverage-summary.json; exits 1 if any staged file is below 80%.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const COVERAGE_THRESHOLD = 80;
const COVERAGE_SUMMARY_PATH = path.join(process.cwd(), "coverage", "coverage-summary.json");
const SCOPE_PATTERN = /^(lib|app\/api|components)\/.+\.(js|jsx|ts|tsx)$/;
const TEST_FILE_PATTERN = /__tests__|\.(test|spec)\.(js|jsx|ts|tsx)$/;
/** Internal admin APIs: skip coverage enforcement. */
const COVERAGE_SKIP_PATTERN = /^app\/api\/admin\//;

function getStagedFiles() {
  const out = execSync("git diff --cached --name-only", { encoding: "utf8" });
  return out
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => f && SCOPE_PATTERN.test(f) && !TEST_FILE_PATTERN.test(f) && !COVERAGE_SKIP_PATTERN.test(f));
}

function absolutePath(relativePath) {
  return path.resolve(process.cwd(), relativePath).replace(/\\/g, "/");
}

function findCoverageEntry(summary, filePath) {
  const abs = absolutePath(filePath);
  return summary[abs] ?? summary[abs.replace(/\//g, path.sep)];
}

function main() {
  const staged = getStagedFiles();
  if (staged.length === 0) {
    console.log("No staged files in lib/, app/api/, or components/ — skipping new-code coverage check.");
    process.exit(0);
    return;
  }

  if (!fs.existsSync(COVERAGE_SUMMARY_PATH)) {
    console.error("coverage/coverage-summary.json not found. Run: npm run test:coverage");
    process.exit(1);
  }

  const summary = JSON.parse(fs.readFileSync(COVERAGE_SUMMARY_PATH, "utf8"));
  const failures = [];

  for (const file of staged) {
    const entry = findCoverageEntry(summary, file);
    if (!entry) {
      failures.push({ file, reason: "no coverage (add tests or run test:coverage)" });
      continue;
    }
    const metrics = ["lines", "statements", "functions", "branches"];
    for (const m of metrics) {
      const data = entry[m];
      if (!data || data.total === 0) continue;
      const pct = data.pct;
      if (pct < COVERAGE_THRESHOLD) {
        failures.push({
          file,
          reason: `${m} coverage ${pct.toFixed(1)}% < ${COVERAGE_THRESHOLD}%`,
        });
        break;
      }
    }
  }

  if (failures.length === 0) {
    console.log(`New-code coverage check passed (${COVERAGE_THRESHOLD}% for ${staged.length} staged file(s)).`);
    process.exit(0);
    return;
  }

  console.error(`\nNew-code coverage: ${COVERAGE_THRESHOLD}% required for staged files in lib/, app/api/, components/.\n`);
  failures.forEach(({ file, reason }) => console.error(`  ${file}: ${reason}`));
  console.error("\nAdd or update tests, then run: npm run test:coverage\n");
  process.exit(1);
}

main();
