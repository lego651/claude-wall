#!/usr/bin/env node

/**
 * PROP-018: Validate overlap between JSON monthly payout data and Supabase recent_payouts.
 * Run after historical sync (e.g. update-monthly-json.js). Fails if >5% of Supabase rows
 * for a firm/month are missing from JSON (indicates JSON is stale or sync issue).
 *
 * Usage:
 *   node scripts/validate-data-overlap.js
 *   node scripts/validate-data-overlap.js --month 2025-02
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (optional; if missing, skips Supabase)
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { validateMonthData } from '@/lib/services/dataOverlapValidation';
import { getAvailableMonths } from '@/lib/services/payoutDataLoader';

const PAYOUTS_DIR = path.join(process.cwd(), 'data', 'payouts');
const PROPFIRMS_JSON = path.join(process.cwd(), 'data', 'propfirms.json');
const MISMATCH_THRESHOLD = 0.05; // fail if >5% of Supabase rows missing from JSON

function getFirmIds() {
  try {
    const raw = fs.readFileSync(PROPFIRMS_JSON, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.firms)) {
      return parsed.firms.map((f) => f.id);
    }
  } catch {
    // ignore
  }
  try {
    const dirs = fs.readdirSync(PAYOUTS_DIR, { withFileTypes: true });
    return dirs.filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
}

function getMonthsToCheck(onlyMonth) {
  if (onlyMonth) return [onlyMonth];
  const now = new Date();
  const current = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return [current];
}

function formatAmount(amount) {
  if (amount == null) return '?';
  const n = Number(amount);
  return Number.isFinite(n) ? `$${Math.round(n).toLocaleString()}` : '?';
}

function shortHash(txHash) {
  if (!txHash || txHash.length < 12) return txHash;
  return `${txHash.slice(0, 6)}...${txHash.slice(-4)}`;
}

async function main() {
  const args = process.argv.slice(2);
  const monthIdx = args.indexOf('--month');
  const onlyMonth = monthIdx >= 0 ? args[monthIdx + 1] : null;

  const firmIds = getFirmIds();
  if (firmIds.length === 0) {
    console.log('No firms found (data/propfirms.json or data/payouts/).');
    process.exit(0);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase =
    supabaseUrl && supabaseKey
      ? createClient(supabaseUrl, supabaseKey)
      : null;

  if (!supabase) {
    console.log('Supabase env not set; skipping overlap validation.');
    process.exit(0);
  }

  const monthsToCheck = getMonthsToCheck(onlyMonth);
  let hasFailure = false;
  const results = [];

  for (const firmId of firmIds) {
    const available = getAvailableMonths(firmId);
    const toValidate = monthsToCheck.filter((m) => available.includes(m));
    for (const yearMonth of toValidate) {
      const r = await validateMonthData(firmId, yearMonth, supabase);
      results.push(r);

      const ok = r.missingInJson.length === 0;
      const icon = ok ? '✅' : '⚠️';
      const line = `${icon} ${r.firmId} ${r.yearMonth}: JSON ${r.jsonCount} tx, Supabase ${r.supabaseCount} tx`;
      console.log(line);

      if (r.missingInJson.length > 0) {
        const pct =
          r.supabaseCount > 0
            ? (r.missingInJson.length / r.supabaseCount) * 100
            : 0;
        console.log(`  ${r.missingInJson.length} transactions in Supabase missing from JSON (${pct.toFixed(1)}%)`);
        r.missingInJson.slice(0, 5).forEach(({ tx_hash, amount }) => {
          console.log(`  - ${shortHash(tx_hash)} (${formatAmount(amount)})`);
        });
        if (r.missingInJson.length > 5) {
          console.log(`  ... and ${r.missingInJson.length - 5} more`);
        }
        if (r.supabaseCount > 0 && r.missingInJson.length / r.supabaseCount > MISMATCH_THRESHOLD) {
          hasFailure = true;
        }
      }
    }
  }

  if (results.length === 0) {
    console.log('No firm/month combinations to validate (no JSON for selected month(s)).');
  }

  if (hasFailure) {
    console.log('\n❌ Validation failed: at least one firm/month had >5% of Supabase rows missing from JSON.');
    process.exit(1);
  }
  console.log('\n✅ Overlap validation passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
