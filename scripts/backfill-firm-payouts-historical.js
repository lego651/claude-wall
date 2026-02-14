#!/usr/bin/env node

/**
 * Backfill Monthly JSON Files for Historical Payouts
 *
 * One-off utility to generate historical month files for a firm
 * using the same logic as `update-monthly-json.js`, but across
 * a configurable month range.
 *
 * Example (FundedNext from Jan 2025 onwards):
 *   node scripts/backfill-firm-payouts-historical --firm fundednext --from 2025-01
 *
 * Required env:
 *   - ARBISCAN_API_KEY
 */

const fs = require("fs");
const path = require("path");

// Reuse core config from update-monthly-json logic
const ARBISCAN_API_BASE = "https://api.etherscan.io/v2/api";
const ARBITRUM_CHAIN_ID = "42161";
const PAYOUTS_DIR = path.join(process.cwd(), "data", "propfirms");
const SUPPORTED_TOKENS = ["USDC", "USDT", "RISEPAY"];
const PRICES = { ETH: 2500, USDC: 1.0, USDT: 1.0, RISEPAY: 1.0 };
const TOKEN_TO_METHOD = {
  RISEPAY: "rise",
  USDC: "crypto",
  USDT: "crypto",
  ETH: "crypto",
};

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const firmFilter = args.includes("--firm")
  ? args[args.indexOf("--firm") + 1]
  : null;
const fromArg = args.includes("--from")
  ? args[args.indexOf("--from") + 1]
  : null;
const toArg = args.includes("--to")
  ? args[args.indexOf("--to") + 1]
  : null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getLocalDate(utcTimestamp, timezone) {
  const date = new Date(utcTimestamp);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function getLocalYearMonth(utcTimestamp, timezone) {
  const localDate = getLocalDate(utcTimestamp, timezone);
  return localDate.slice(0, 7);
}

function* iterateYearMonths(from, to) {
  // from / to: "YYYY-MM"
  const [fromY, fromM] = from.split("-").map(Number);
  const [toY, toM] = (to || getCurrentYearMonth()).split("-").map(Number);

  let y = fromY;
  let m = fromM;

  while (y < toY || (y === toY && m <= toM)) {
    yield `${y}-${String(m).padStart(2, "0")}`;
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
}

function getCurrentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

// ---------------------------------------------------------------------------
// Arbiscan
// ---------------------------------------------------------------------------

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "0" && data.message !== "No transactions found") {
        throw new Error(`API error: ${data.message}`);
      }

      return data.result || [];
    } catch (err) {
      console.log(`  Retry ${i + 1}/${retries}: ${err.message}`);
      if (i === retries - 1) throw err;
      await sleep(2000);
    }
  }
}

async function fetchAllTransactions(address, apiKey) {
  console.log(`  Fetching native transactions for ${address.slice(0, 10)}...`);
  const nativeUrl = `${ARBISCAN_API_BASE}?chainid=${ARBITRUM_CHAIN_ID}&module=account&action=txlist&address=${address}&sort=desc&apikey=${apiKey}`;
  const native = await fetchWithRetry(nativeUrl);

  await sleep(300);

  console.log(`  Fetching token transactions for ${address.slice(0, 10)}...`);
  const tokenUrl = `${ARBISCAN_API_BASE}?chainid=${ARBITRUM_CHAIN_ID}&module=account&action=tokentx&address=${address}&sort=desc&apikey=${apiKey}`;
  const tokens = await fetchWithRetry(tokenUrl);

  return { native, tokens };
}

// ---------------------------------------------------------------------------
// Data processing (mirrors update-monthly-json.js)
// ---------------------------------------------------------------------------

function processTransactionsForMonth(
  native,
  tokens,
  addresses,
  firmId,
  yearMonth,
  timezone = "UTC",
) {
  const lowerAddresses = addresses.map((a) => a.toLowerCase());
  const payouts = [];

  for (const tx of native) {
    if (!tx.from || !lowerAddresses.includes(tx.from.toLowerCase())) continue;

    const timestamp = parseInt(tx.timeStamp, 10);
    const isoTimestamp = new Date(timestamp * 1000).toISOString();

    const txYearMonth = getLocalYearMonth(isoTimestamp, timezone);
    if (txYearMonth !== yearMonth) continue;

    const amount = parseFloat(tx.value) / 1e18;
    const amountUSD = amount * PRICES.ETH;
    if (amountUSD < 10) continue;

    payouts.push({
      tx_hash: tx.hash,
      firm_id: firmId,
      amount: amountUSD,
      payment_method: "crypto",
      timestamp: isoTimestamp,
      from_address: tx.from,
      to_address: tx.to,
    });
  }

  for (const tx of tokens) {
    if (!tx.from || !lowerAddresses.includes(tx.from.toLowerCase())) continue;

    const timestamp = parseInt(tx.timeStamp, 10);
    const isoTimestamp = new Date(timestamp * 1000).toISOString();

    const txYearMonth = getLocalYearMonth(isoTimestamp, timezone);
    if (txYearMonth !== yearMonth) continue;

    if (!SUPPORTED_TOKENS.includes(tx.tokenSymbol?.toUpperCase())) continue;

    const decimals = parseInt(tx.tokenDecimal, 10) || 18;
    const amount = parseFloat(tx.value) / Math.pow(10, decimals);
    const token = tx.tokenSymbol.toUpperCase();
    const amountUSD = amount * (PRICES[token] || 1);
    if (amountUSD < 10) continue;

    payouts.push({
      tx_hash: tx.hash,
      firm_id: firmId,
      amount: amountUSD,
      payment_method: TOKEN_TO_METHOD[token] || "crypto",
      timestamp: isoTimestamp,
      from_address: tx.from,
      to_address: tx.to,
    });
  }

  const unique = Array.from(new Map(payouts.map((p) => [p.tx_hash, p])).values());
  return unique.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

function buildMonthData(firmId, yearMonth, transactions, timezone = "UTC") {
  const amounts = transactions.map((t) => t.amount);
  const summary = {
    totalPayouts: Math.round(amounts.reduce((a, b) => a + b, 0)),
    payoutCount: transactions.length,
    largestPayout: Math.round(
      amounts.length > 0 ? Math.max(...amounts) : 0,
    ),
    avgPayout: Math.round(
      amounts.length > 0
        ? amounts.reduce((a, b) => a + b, 0) / amounts.length
        : 0,
    ),
  };

  const dailyMap = {};
  for (const t of transactions) {
    const day = getLocalDate(t.timestamp, timezone);
    if (!dailyMap[day]) {
      dailyMap[day] = { date: day, total: 0, rise: 0, crypto: 0, wire: 0 };
    }
    dailyMap[day].total += t.amount;
    dailyMap[day][t.payment_method] =
      (dailyMap[day][t.payment_method] || 0) + t.amount;
  }

  const dailyBuckets = Object.values(dailyMap)
    .map((d) => ({
      date: d.date,
      total: Math.round(d.total),
      rise: Math.round(d.rise),
      crypto: Math.round(d.crypto),
      wire: Math.round(d.wire),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    firmId,
    period: yearMonth,
    timezone,
    generatedAt: new Date().toISOString(),
    summary,
    dailyBuckets,
    transactions,
  };
}

function saveMonthData(firmId, yearMonth, data) {
  const firmDir = path.join(PAYOUTS_DIR, firmId);
  if (!fs.existsSync(firmDir)) {
    fs.mkdirSync(firmDir, { recursive: true });
  }
  const filePath = path.join(firmDir, `${yearMonth}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return filePath;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("🚀 Backfill Monthly JSON Files");
  console.log("==============================\n");

  const apiKey = process.env.ARBISCAN_API_KEY;
  if (!apiKey) {
    console.error("❌ ARBISCAN_API_KEY not found in environment");
    process.exit(1);
  }

  if (!firmFilter) {
    console.error("❌ Please specify --firm <id> (e.g. fundednext)");
    process.exit(1);
  }

  const fromYearMonth = fromArg || "2025-01";
  const toYearMonth = toArg || getCurrentYearMonth();

  console.log(
    `Backfilling firm "${firmFilter}" from ${fromYearMonth} to ${toYearMonth}\n`,
  );

  const firmsPath = path.join(process.cwd(), "data", "propfirms.json");
  const firmsData = JSON.parse(fs.readFileSync(firmsPath, "utf8"));
  const firm = firmsData.firms.find((f) => f.id === firmFilter);

  if (!firm) {
    console.error(`❌ Firm "${firmFilter}" not found in data/propfirms.json`);
    process.exit(1);
  }

  const timezone = firm.timezone || "UTC";

  // Fetch full history once
  let allNative = [];
  let allTokens = [];
  for (const address of firm.addresses) {
    const { native, tokens } = await fetchAllTransactions(address, apiKey);
    allNative = [...allNative, ...native];
    allTokens = [...allTokens, ...tokens];
    await sleep(500);
  }

  console.log(
    `Fetched ${allNative.length} native + ${allTokens.length} token txs total\n`,
  );

  let filesWritten = 0;

  for (const yearMonth of iterateYearMonths(fromYearMonth, toYearMonth)) {
    console.log(`📅 Processing ${yearMonth}...`);

    const transactions = processTransactionsForMonth(
      allNative,
      allTokens,
      firm.addresses,
      firm.id,
      yearMonth,
      timezone,
    );

    if (transactions.length === 0) {
      console.log("  No payouts in this month, skipping.");
      continue;
    }

    const monthData = buildMonthData(
      firm.id,
      yearMonth,
      transactions,
      timezone,
    );
    const filePath = saveMonthData(firm.id, yearMonth, monthData);
    filesWritten++;

    console.log(
      `  ✅ Saved ${filePath} (${monthData.summary.payoutCount} payouts, total $${monthData.summary.totalPayouts.toLocaleString()})`,
    );
  }

  console.log("\n==============================");
  console.log(`Files written: ${filesWritten}`);
  console.log("✅ Backfill complete!");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});

