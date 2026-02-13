#!/usr/bin/env node
/**
 * Check file sizes in data/payouts/
 * Reports files >1MB, >5MB, >10MB and total size.
 * Output: JSON (default) or markdown for monitoring/dashboard.
 *
 * Usage:
 *   node scripts/check-file-sizes.js
 *   node scripts/check-file-sizes.js --format=markdown
 *
 * Exit codes:
 *   0 - OK (no file >10MB)
 *   1 - Fail (at least one file >10MB)
 */

const fs = require('fs');
const path = require('path');

const PAYOUTS_DIR = path.join(process.cwd(), 'data', 'payouts');
const MB = 1024 * 1024;
const THRESHOLD_1MB = 1 * MB;
const THRESHOLD_5MB = 5 * MB;
const THRESHOLD_10MB = 10 * MB;

function getAllFiles(dir, base = '') {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const rel = path.join(base, ent.name);
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      results.push(...getAllFiles(full, rel));
    } else if (ent.isFile() && ent.name.endsWith('.json')) {
      const stat = fs.statSync(full);
      results.push({ path: rel, size: stat.size });
    }
  }
  return results;
}

function run() {
  const files = getAllFiles(PAYOUTS_DIR);
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const over1MB = files.filter((f) => f.size >= THRESHOLD_1MB);
  const over5MB = files.filter((f) => f.size >= THRESHOLD_5MB);
  const over10MB = files.filter((f) => f.size >= THRESHOLD_10MB);

  const report = {
    scannedDir: 'data/payouts',
    fileCount: files.length,
    totalBytes,
    totalMB: Math.round((totalBytes / MB) * 100) / 100,
    over1MB: over1MB.map((f) => ({ path: f.path, sizeBytes: f.size, sizeMB: Math.round((f.size / MB) * 100) / 100 })),
    over5MB: over5MB.map((f) => ({ path: f.path, sizeBytes: f.size, sizeMB: Math.round((f.size / MB) * 100) / 100 })),
    over10MB: over10MB.map((f) => ({ path: f.path, sizeBytes: f.size, sizeMB: Math.round((f.size / MB) * 100) / 100 })),
    ok: over10MB.length === 0,
  };

  const format = process.argv.includes('--format=markdown') ? 'markdown' : 'json';
  if (format === 'markdown') {
    const lines = [
      '# File Size Report (data/payouts)',
      '',
      `**Total:** ${report.fileCount} files, ${report.totalMB} MB`,
      '',
      '## Files ≥ 1 MB',
      ...(report.over1MB.length ? report.over1MB.map((f) => `- \`${f.path}\`: ${f.sizeMB} MB`) : ['- None']),
      '',
      '## Files ≥ 5 MB (timeout risk)',
      ...(report.over5MB.length ? report.over5MB.map((f) => `- \`${f.path}\`: ${f.sizeMB} MB`) : ['- None']),
      '',
      '## Files ≥ 10 MB (fail threshold)',
      ...(report.over10MB.length ? report.over10MB.map((f) => `- \`${f.path}\`: ${f.sizeMB} MB`) : ['- None']),
      '',
    ];
    console.log(lines.join('\n'));
  } else {
    console.log(JSON.stringify(report, null, 2));
  }

  process.exit(report.ok ? 0 : 1);
}

run();
