# Sprint 7 Tickets - Trader-Side Feature Release Check

**Sprint Goal:** Verify and polish all trader-side features for Alpha release: authentication flows, wallet linking, payout backfill, realtime sync, and firm subscription management.

**Context:** S6 completed prop firm data syncing and intelligence-feed system. Now we need to ensure traders can sign up, connect wallets, view their payout data, and manage firm subscriptions before Alpha release.

**Story Points:** Based on Fibonacci scale (1, 2, 3, 5, 8, 13)

---

## Sprint 7 status (updated 2026-02-20)

| Ticket | Title | Status |
|--------|--------|--------|
| S7-001 | Test both auth flows | ✅ Done |
| S7-002 | Backfill script exists & works | ✅ Done |
| S7-003 | OAuth callback error handling (`backfill_error`) | ✅ Done |
| S7-004 | DB tables verified | ✅ Done |
| S7-005 | Test real-time sync (Inngest) | ✅ Done |
| S7-006 | Combined data loader tests | ✅ Done |
| S7-007 | Auto-subscribe new users | ✅ Done (DB trigger) |
| S7-008 | Bulk subscribe/unsubscribe UI | 🔲 Pending |
| S7-009 | Subscription stats panel | 🔲 Pending |
| S7-010 | Rate limits & scaling docs | 🔲 Pending |

**Next:** S7-008 (bulk subscribe/unsubscribe UI) or S7-009 (subscription stats panel).

---

## Current State

### ✅ What's Already Built

1. **Authentication & Wallet Linking:**
   - Google OAuth integration ✅
   - Two flows: Google first → wallet, OR wallet first → Google ✅
   - Wallet validation API (checks duplicates, format, prop firm addresses) ✅
   - Profile creation with display_name and handle from auth metadata ✅

2. **Backfill System:**
   - OAuth callback triggers backfill script on first wallet link ✅
   - Fetches full history from Arbiscan ✅
   - Writes to Supabase `trader_history_payouts` (script: `scripts/backfill-trader-history.js`) ✅
   - Sets `backfilled_at` timestamp in `user_profiles` ✅
   - Fire-and-forget (doesn't block OAuth redirect) ✅

3. **Real-time Sync:**
   - Inngest cron (every 5 min) ✅
   - Syncs last 24h of incoming payouts to `trader_recent_payouts` (renamed from `recent_trader_payouts`) ✅
   - Combines with historical data for complete view ✅
   - Architecture mirrors firm sync (proven system) ✅

4. **Firm Subscriptions:**
   - UI with search, tabs (all/subscribed/unsubscribed) ✅
   - Toggle switches for subscribe/unsubscribe ✅
   - Shows subscription count badge ✅
   - API routes: GET/POST/DELETE `/api/subscriptions` ✅
   - New users: Auto-subscribe via DB trigger `auto_subscribe_new_user` (migration 23, 24) ✅
   - Bulk operations: No UI yet ⚠️

### 🔴 What Needs Verification/Polish

1. **Authentication Flow Testing:**
   - Flow 1 (Google first → add wallet) verified ✅
   - Flow 2 (wallet first → Google) verified ✅; error-handling cases optional
   - Check profile creation with edge cases (no name, no email prefix)

2. **Backfill Script:**
   - Verify it exists and works (`scripts/backfill-trader-history.js`)
   - Test timeout handling (5 min limit)
   - Check large wallet handling (1000+ txs)

3. **Rate Limits & Scaling:**
   - Verify Arbiscan rate limits are safe (currently 500ms between traders)
   - Project storage growth (currently 32KB, safe up to 10k traders)
   - Document limits clearly

4. **Subscription Defaults:**
   - New users should auto-subscribe to ALL firms (not implemented yet)
   - Bulk subscribe/unsubscribe UI polish

5. **Database Migrations:**
   - `trader_records` and `trader_recent_payouts` (renamed from `recent_trader_payouts`) exist ✅
   - Tables created in migrations 06, 08; rename in 24

---

## Epic 1: Authentication & Wallet Linking

### TICKET-S7-001: Test Both Authentication Flows 🔴 CRITICAL

**Status:** ✅ Done (2026-02-20 — Flow 1 & Flow 2 verified: email-first and wallet-first signup)
**Priority:** P0 (Blocker)
**Story Points:** 3
**Assignee:** QA Engineer

**Description:**

Test both signup flows: (1) Google first → wallet, and (2) Wallet first → Google. Verify error handling, profile creation, and wallet validation.

**Runbook:** [documents/runbooks/s7-001-auth-flows-test-runbook.md](../runbooks/s7-001-auth-flows-test-runbook.md) — use this for step-by-step manual execution.

**Acceptance Criteria:**

**Flow 1: Google OAuth First** ✅ Verified 2026-02-20
- [x] Sign in with Google (no wallet yet)
- [x] Profile created with display_name and handle from Google
- [x] Navigate to settings → Add wallet address
- [x] Submit valid wallet → Success
- [ ] Submit duplicate wallet → Error: "already linked to another account"
- [ ] Submit prop firm address → Error: "belongs to prop firm"
- [ ] Submit invalid format → Error: "invalid format"
- [x] After successful link → `wallet_address` in profile
- [ ] After successful link → Backfill starts (check logs)

**Flow 2: Wallet Address First** ✅ Verified 2026-02-20
- [x] Navigate to `/connect-wallet` (wallet-first entry)
- [x] Enter wallet address (no Google yet), submit → redirects to `/signin`
- [x] Click "Sign in with Google"
- [x] Wallet stored in `pending_wallet` cookie
- [x] OAuth redirect → callback retrieves cookie
- [x] Profile created WITH wallet_address
- [ ] Backfill triggered automatically
- [x] Cookie cleared after callback

**Edge Cases:**
- [ ] No full_name in Google → Falls back to email prefix
- [ ] Email prefix too short (<3 chars) → Padded with zeros
- [ ] Wallet already linked to self → Allows (same user)
- [ ] Wallet mixed case → Normalized to lowercase

**Testing:**

- **Manual:** Follow the [S7-001 auth flows runbook](../runbooks/s7-001-auth-flows-test-runbook.md). Entry points: Flow 1 = `/signin` then `/user/settings` to add wallet; Flow 2 = `/connect-wallet` → `/signin` → Sign in with Google.
- **API coverage:** `app/api/wallet/validate/route.test.js` covers format, prop_firm, already_used, same-user. `app/api/auth/callback/route.test.js` covers callback with/without pending_wallet, profile create/update, backfill trigger, cookie clear.

**Files to Check:**
- [app/api/auth/callback/route.js:11-275](../../app/api/auth/callback/route.js) - OAuth callback
- [app/api/wallet/validate/route.js](../../app/api/wallet/validate/route.js) - Wallet validation

**Dependencies:** None (blocking)

---

### TICKET-S7-002: Verify Backfill Script Exists and Works 🔴 CRITICAL

**Status:** ✅ Done (2026-02-19)
**Priority:** P0 (Blocker)
**Story Points:** 5
**Assignee:** Backend Engineer

**Description:**

~~The OAuth callback references `scripts/backfill-trader-history.js` but this file doesn't exist.~~ **Done:** Script exists; writes to Supabase `trader_history_payouts` (not JSON files). Caller uses 5 min timeout.

**Acceptance Criteria:**

- [ ] Check if `scripts/backfill-trader-history.js` exists
- [ ] If missing → Create it based on firm backfill script
- [ ] Script takes wallet address as CLI argument
- [ ] Fetches ALL transactions from Arbiscan (no time filter)
- [ ] Groups by month (UTC timezone)
- [ ] Writes to `data/traders/<wallet>/<YYYY-MM>.json`
- [ ] Handles pagination (>10k txs per address)
- [ ] Timeout: 5 minutes max
- [ ] Logs progress and errors clearly
- [ ] Returns exit code 0 on success, 1 on error

**Implementation Outline:**

```javascript
#!/usr/bin/env node
/**
 * Backfill Trader History
 *
 * Usage: node scripts/backfill-trader-history.js <walletAddress>
 */

import fs from 'fs';
import path from 'path';
import { fetchAllNativeTransactions, fetchAllTokenTransactions } from '@/lib/arbiscan';

const PRICES = { ETH: 2500, USDC: 1.0, USDT: 1.0, RISEPAY: 1.0 };
const SUPPORTED_TOKENS = ['USDC', 'USDT', 'RISEPAY'];

async function main() {
  const walletAddress = process.argv[2];
  if (!walletAddress) {
    console.error('Usage: node backfill-trader-history.js <walletAddress>');
    process.exit(1);
  }

  const apiKey = process.env.ARBISCAN_API_KEY;
  if (!apiKey) {
    console.error('Missing ARBISCAN_API_KEY');
    process.exit(1);
  }

  console.log(`[Backfill] Starting for ${walletAddress}`);

  // 1. Fetch ALL transactions (no cutoff)
  const [native, tokens] = await Promise.all([
    fetchAllNativeTransactions(walletAddress, apiKey, { delayMs: 300 }),
    fetchAllTokenTransactions(walletAddress, apiKey, { delayMs: 300 }),
  ]);

  console.log(`[Backfill] Fetched ${native.length} native, ${tokens.length} token txs`);

  // 2. Filter to incoming transactions only
  const walletLower = walletAddress.toLowerCase();
  const incomingNative = native.filter(tx =>
    tx.to && tx.to.toLowerCase() === walletLower
  );
  const incomingTokens = tokens.filter(tx =>
    tx.to && tx.to.toLowerCase() === walletLower &&
    SUPPORTED_TOKENS.includes(tx.tokenSymbol?.toUpperCase())
  );

  // 3. Process and group by month
  const monthlyData = {};

  incomingNative.forEach(tx => {
    const amount = parseFloat(tx.value) / 1e18 * PRICES.ETH;
    if (amount < 10) return; // Spam filter

    const date = new Date(parseInt(tx.timeStamp) * 1000);
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

    if (!monthlyData[month]) {
      monthlyData[month] = { transactions: [], summary: { totalPayouts: 0, payoutCount: 0 } };
    }

    monthlyData[month].transactions.push({
      tx_hash: tx.hash,
      wallet_address: walletLower,
      amount,
      payment_method: 'crypto',
      timestamp: date.toISOString(),
      from_address: tx.from,
      to_address: tx.to,
    });

    monthlyData[month].summary.totalPayouts += amount;
    monthlyData[month].summary.payoutCount++;
  });

  // Similar for tokens...

  // 4. Write JSON files
  const dir = path.join(process.cwd(), 'data', 'traders', walletLower);
  fs.mkdirSync(dir, { recursive: true });

  for (const [month, data] of Object.entries(monthlyData)) {
    const filePath = path.join(dir, `${month}.json`);
    const fileData = {
      walletAddress: walletLower,
      period: month,
      timezone: 'UTC',
      generatedAt: new Date().toISOString(),
      summary: {
        totalPayouts: Math.round(data.summary.totalPayouts),
        payoutCount: data.summary.payoutCount,
        largestPayout: Math.round(Math.max(...data.transactions.map(t => t.amount))),
        avgPayout: Math.round(data.summary.totalPayouts / data.summary.payoutCount),
      },
      transactions: data.transactions.sort((a, b) =>
        new Date(a.timestamp) - new Date(b.timestamp)
      ),
    };

    fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2));
    console.log(`[Backfill] Wrote ${filePath}`);
  }

  console.log(`[Backfill] Complete! ${Object.keys(monthlyData).length} months`);
  process.exit(0);
}

main().catch(err => {
  console.error('[Backfill] Error:', err);
  process.exit(1);
});
```

**Testing:**

```bash
# Test with existing wallet
ARBISCAN_API_KEY="$ARBISCAN_API_KEY" node scripts/backfill-trader-history.js 0x1c969652d758f8fc23c443758f8911086f676216

# Check output
ls -lh data/traders/0x1c969652d758f8fc23c443758f8911086f676216/
cat data/traders/0x1c969652d758f8fc23c443758f8911086f676216/2024-06.json

# Test with large wallet (1000+ txs)
# ... (find a whale address)
```

**Dependencies:**
- TICKET-S7-001 (auth flow testing)

**Files to Create:**
- `scripts/backfill-trader-history.js` (new)

---

### TICKET-S7-003: Add Error Handling to OAuth Callback 🟡 HIGH

**Status:** ✅ Done (2026-02-21 — backfill_error column, updateBackfillSuccess/updateBackfillError)
**Priority:** P1 (High)
**Story Points:** 3
**Assignee:** Backend Engineer

**Description:**

The OAuth callback triggers backfill but doesn't handle script errors gracefully. If backfill fails, user should still complete signup (backfill can be retried later).

**Acceptance Criteria:**

- [ ] Wrap `triggerBackfill()` in try-catch (already done, verify)
- [ ] If script execution fails → Log error but don't throw
- [ ] If script times out (5 min) → Log timeout but don't fail
- [ ] Update `profiles.backfilled_at` only on success
- [ ] Add `profiles.backfill_error` column for debugging
- [ ] If backfill fails → User can retry from dashboard

**Implementation:**

```javascript
// app/api/auth/callback/route.js

async function triggerBackfill(walletAddress, userId) {
  try {
    console.log(`[OAuth Backfill] Triggering for ${walletAddress}`);

    if (!process.env.ARBISCAN_API_KEY) {
      console.error('[OAuth Backfill] Missing ARBISCAN_API_KEY');
      // Update error in profile
      await updateBackfillError(userId, 'Missing ARBISCAN_API_KEY');
      return;
    }

    const scriptPath = 'scripts/backfill-trader-history.js';
    const command = `node ${scriptPath} ${walletAddress}`;

    execPromise(command, {
      timeout: 300000, // 5 min
      maxBuffer: 10 * 1024 * 1024,
    })
      .then(({ stdout, stderr }) => {
        if (stdout) console.log('[OAuth Backfill] Output:', stdout);
        if (stderr) console.warn('[OAuth Backfill] Warnings:', stderr);

        // Mark success
        updateBackfillSuccess(userId);
      })
      .catch((execError) => {
        console.error('[OAuth Backfill] Script failed:', execError.message);

        if (execError.killed) {
          console.error('[OAuth Backfill] Timeout - wallet may have too many txs');
          updateBackfillError(userId, 'Timeout: too many transactions');
        } else {
          updateBackfillError(userId, execError.message);
        }
      });

    console.log('[OAuth Backfill] Job queued (running in background)');
  } catch (error) {
    console.error('[OAuth Backfill] Unexpected error:', error);
    await updateBackfillError(userId, error.message);
  }
}

async function updateBackfillSuccess(userId) {
  const serviceClient = createServiceClient(...);
  await serviceClient
    .from('profiles')
    .update({
      backfilled_at: new Date().toISOString(),
      backfill_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
}

async function updateBackfillError(userId, error) {
  const serviceClient = createServiceClient(...);
  await serviceClient
    .from('profiles')
    .update({
      backfill_error: error,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
}
```

**Migration (add backfill_error column):**

```sql
-- migrations/XX_add_backfill_error.sql
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS backfill_error TEXT;
```

**Testing:**

```bash
# Test normal success
1. Sign up with new wallet
2. Check logs for "[OAuth Backfill] Complete"
3. Verify backfilled_at is set, backfill_error is null

# Test script missing
1. Rename script temporarily
2. Sign up with new wallet
3. Check backfill_error contains "script not found"
4. Restore script

# Test timeout
1. Use wallet with 10k+ txs
2. Sign up
3. Wait 5 min
4. Check backfill_error contains "Timeout"
```

**Dependencies:**
- TICKET-S7-002 (backfill script)

**Files Changed:**
- [app/api/auth/callback/route.js](../../app/api/auth/callback/route.js) - Add error helpers
- `migrations/XX_add_backfill_error.sql` (new)

---

## Epic 2: Data Sync Verification

### TICKET-S7-004: Verify Database Tables and Migrations 🔴 CRITICAL

**Status:** ✅ Done (2026-02-19)
**Priority:** P0 (Blocker)
**Story Points:** 2
**Assignee:** Database Engineer

**Description:**

Verify that `recent_trader_payouts` and `trader_records` tables exist. **Done:** `trader_records` (migration 06), table created as `recent_trader_payouts` (08) then renamed to `trader_recent_payouts` (24). Code uses `trader_recent_payouts`.

**Acceptance Criteria:**

- [ ] Check if `recent_trader_payouts` table exists
- [ ] Check if `trader_records` table exists
- [ ] Verify schemas match [traders-payouts-sync.md](../../documents/runbooks/traders-payouts-sync.md)
- [ ] Verify indexes on wallet_address and timestamp
- [ ] Check RLS policies (should allow service role)
- [ ] If missing → Create migration

**Investigation:**

```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('recent_trader_payouts', 'trader_records');

-- Check schemas
\d recent_trader_payouts;
\d trader_records;

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('recent_trader_payouts', 'trader_records');

-- Check RLS policies
SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('recent_trader_payouts', 'trader_records');
```

**Expected Schemas:**

```sql
-- recent_trader_payouts
CREATE TABLE IF NOT EXISTS recent_trader_payouts (
  tx_hash TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  from_address TEXT,
  to_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recent_trader_payouts_wallet
  ON recent_trader_payouts(wallet_address, timestamp DESC);

-- trader_records
CREATE TABLE IF NOT EXISTS trader_records (
  wallet_address TEXT PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  total_payout_usd NUMERIC DEFAULT 0,
  last_30_days_payout_usd NUMERIC DEFAULT 0,
  avg_payout_usd NUMERIC DEFAULT 0,
  payout_count INTEGER DEFAULT 0,
  first_payout_at TIMESTAMPTZ,
  last_payout_at TIMESTAMPTZ,
  last_payout_tx_hash TEXT,
  last_synced_at TIMESTAMPTZ,
  sync_error TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trader_records_profile
  ON trader_records(profile_id);

-- RLS policies (allow service role)
ALTER TABLE recent_trader_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trader_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_all ON recent_trader_payouts
  FOR ALL USING (true);

CREATE POLICY service_role_all ON trader_records
  FOR ALL USING (true);
```

**If Missing:**

Create `migrations/XX_trader_payouts_tables.sql` with schemas above.

**Testing:**

```bash
# Run migration
psql $DATABASE_URL -f migrations/XX_trader_payouts_tables.sql

# Verify
psql $DATABASE_URL -c "\d recent_trader_payouts"
psql $DATABASE_URL -c "\d trader_records"
```

**Dependencies:** None (blocking)

**Files to Create:**
- `migrations/XX_trader_payouts_tables.sql` (if missing)

---

### TICKET-S7-005: Test Real-time Sync End-to-End 🔴 CRITICAL

**Status:** ✅ Done (2026-02-21 — unit tests for traderRealtimeSyncService + Inngest registration verified)
**Priority:** P0 (Blocker)
**Story Points:** 5
**Assignee:** Backend Engineer

**Description:**

Test the Inngest cron job that syncs trader payouts every 5 minutes. Verify it runs successfully and populates `recent_trader_payouts` and `trader_records`.

**Acceptance Criteria:**

- [ ] Check Inngest dashboard for `sync-trader-payouts` function
- [ ] Verify cron schedule: `*/5 * * * *` (every 5 min)
- [ ] Manually trigger function (workflow_dispatch)
- [ ] Check logs for successful execution
- [ ] Verify `recent_trader_payouts` table populated
- [ ] Verify `trader_records` table updated
- [ ] Test with 0 traders → No errors
- [ ] Test with 1 trader → 1 wallet synced
- [ ] Test with 10 traders → All synced with rate limiting

**Testing:**

```bash
# 1. Check Inngest function is registered
curl https://your-app.vercel.app/api/inngest
# Should return JSON with "sync-trader-payouts" function

# 2. Manually trigger (requires Inngest dashboard access)
# Go to Inngest dashboard → sync-trader-payouts → Run

# 3. Check logs
# View Inngest logs for execution result

# 4. Verify Supabase data
psql $DATABASE_URL -c "
SELECT COUNT(*), MAX(timestamp) AS latest
FROM recent_trader_payouts;
"

psql $DATABASE_URL -c "
SELECT wallet_address, last_synced_at, payout_count, total_payout_usd
FROM trader_records
ORDER BY last_synced_at DESC;
"
```

**Expected Results:**

```
recent_trader_payouts:
  10 traders × ~2 txs/24h = ~20 rows
  latest timestamp: Within last 24h

trader_records:
  10 rows (one per trader)
  last_synced_at: Within last 5 minutes
  total_payout_usd > 0
```

**Edge Cases:**

```bash
# Test with 0 traders (empty profiles table)
1. Delete all wallet_address from profiles
2. Trigger sync
3. Check logs: "No trader wallets found"
4. Verify no errors

# Test with invalid wallet (simulate Arbiscan error)
1. Add fake wallet "0xinvalid" to profiles
2. Trigger sync
3. Check trader_records.sync_error contains "failed"
```

**Dependencies:**
- TICKET-S7-004 (database tables)

**Files to Check:**
- [lib/inngest-traders.ts](../../lib/inngest-traders.ts) - Cron definition
- [lib/services/traderRealtimeSyncService.js](../../lib/services/traderRealtimeSyncService.js) - Sync logic

---

### TICKET-S7-006: Verify Combined Data Loader 🟡 HIGH

**Status:** ✅ Done (2026-02-21 — unit tests for loadTraderMonthlyData, getTraderAvailableMonths, getAllTraderTransactions, loadTraderPeriodData)
**Priority:** P1 (High)
**Story Points:** 3
**Assignee:** Full-stack Engineer

**Description:**

Test the [traderDataLoader.js](../../lib/services/traderDataLoader.js) service that combines historical (JSON) + recent (Supabase) data.

**Acceptance Criteria:**

- [ ] Test `getAllTraderTransactions(walletAddress)` returns JSON data
- [ ] Test `getRecentTraderPayouts(walletAddress)` returns Supabase data
- [ ] Test merge deduplicates by tx_hash
- [ ] Test with only historical data (no recent)
- [ ] Test with only recent data (no JSON files)
- [ ] Test with both (overlap should deduplicate)
- [ ] Verify sorting by timestamp (oldest to newest)

**Testing:**

```javascript
// test/services/traderDataLoader.test.js

import { getAllTraderTransactions, getRecentTraderPayouts } from '@/lib/services/traderDataLoader';

describe('Trader Data Loader', () => {
  const wallet = '0x1c969652d758f8fc23c443758f8911086f676216';

  it('loads historical from JSON', async () => {
    const txs = await getAllTraderTransactions(wallet);
    expect(txs.length).toBeGreaterThan(0);
    expect(txs[0]).toHaveProperty('tx_hash');
    expect(txs[0]).toHaveProperty('amount');
  });

  it('loads recent from Supabase', async () => {
    const txs = await getRecentTraderPayouts(wallet);
    expect(Array.isArray(txs)).toBe(true);
    if (txs.length > 0) {
      expect(txs[0]).toHaveProperty('tx_hash');
    }
  });

  it('merges and deduplicates', async () => {
    const historical = await getAllTraderTransactions(wallet);
    const recent = await getRecentTraderPayouts(wallet);

    const merged = mergeTransactions(historical, recent);

    // No duplicate tx_hash
    const hashes = merged.map(tx => tx.tx_hash);
    const uniqueHashes = new Set(hashes);
    expect(hashes.length).toBe(uniqueHashes.size);
  });
});
```

**Manual Testing:**

```bash
# 1. Check JSON files exist
ls -lh data/traders/0x1c969652d758f8fc23c443758f8911086f676216/

# 2. Check recent_trader_payouts has data
psql $DATABASE_URL -c "
SELECT tx_hash, amount, timestamp
FROM recent_trader_payouts
WHERE wallet_address = '0x1c969652d758f8fc23c443758f8911086f676216'
ORDER BY timestamp DESC;
"

# 3. Load combined data via API
curl https://your-app.vercel.app/api/traders/0x1c969652d758f8fc23c443758f8911086f676216
```

**Dependencies:**
- TICKET-S7-005 (real-time sync)
- TICKET-S7-002 (backfill script)

**Files to Test:**
- [lib/services/traderDataLoader.js](../../lib/services/traderDataLoader.js)

---

## Epic 3: Firm Subscriptions Polish

### TICKET-S7-007: Auto-Subscribe New Users to All Firms 🟡 HIGH

**Status:** ✅ Done (DB trigger in migration 23/24)
**Priority:** P1 (High)
**Story Points:** 3
**Assignee:** Backend Engineer

**Description:**

New users should be automatically subscribed to all firms on first signup. **Done:** Trigger `auto_subscribe_new_user` (migration 23, recreated on `user_profiles` in 24) subscribes new profiles to all firms with `trustpilot_url`.

**Acceptance Criteria:**

- [ ] On profile creation → Fetch all firms from `firms` table
- [ ] Create subscription for each firm
- [ ] Set `email_enabled = true` by default
- [ ] Only run on FIRST profile creation (not updates)
- [ ] Log success/failure per firm
- [ ] Don't fail OAuth if subscriptions fail

**Implementation:**

```javascript
// app/api/auth/callback/route.js

async function createDefaultSubscriptions(userId) {
  try {
    const serviceClient = createServiceClient(...);

    // Fetch all firms
    const { data: firms, error: firmsError } = await serviceClient
      .from('firms')
      .select('id');

    if (firmsError) {
      console.error('[DefaultSubs] Failed to fetch firms:', firmsError);
      return;
    }

    if (!firms || firms.length === 0) {
      console.log('[DefaultSubs] No firms found');
      return;
    }

    // Create subscriptions
    const subscriptions = firms.map(firm => ({
      user_id: userId,
      firm_id: firm.id,
      email_enabled: true,
      subscribed_at: new Date().toISOString(),
    }));

    const { error: insertError } = await serviceClient
      .from('user_subscriptions')
      .insert(subscriptions);

    if (insertError) {
      console.error('[DefaultSubs] Failed to create subscriptions:', insertError);
    } else {
      console.log(`[DefaultSubs] Created ${subscriptions.length} subscriptions for user ${userId}`);
    }
  } catch (error) {
    console.error('[DefaultSubs] Unexpected error:', error);
    // Don't throw - subscriptions can be added later via UI
  }
}

// Call after profile creation
if (!existingProfile) {
  // ... create profile ...

  // Create default subscriptions
  await createDefaultSubscriptions(session.user.id);
}
```

**Testing:**

```bash
# Test new user signup
1. Sign up with new Google account
2. Complete profile creation
3. Check user_subscriptions table:

psql $DATABASE_URL -c "
SELECT firm_id, email_enabled, subscribed_at
FROM user_subscriptions
WHERE user_id = '<new-user-id>'
ORDER BY firm_id;
"

# Should show 8 firms (or however many exist)
# All with email_enabled = true

# Test existing user login (should not create duplicates)
4. Log out and log in again
5. Verify no duplicate subscriptions
```

**Dependencies:**
- TICKET-S7-001 (auth flow)

**Files Changed:**
- [app/api/auth/callback/route.js](../../app/api/auth/callback/route.js)

---

### TICKET-S7-008: Add Bulk Subscribe/Unsubscribe UI 🟢 MEDIUM

**Status:** 🔲 Pending
**Priority:** P2 (Medium)
**Story Points:** 3
**Assignee:** Frontend Engineer

**Description:**

Add bulk actions to [SubscriptionsSection.js](../../components/user/settings/SubscriptionsSection.js): "Subscribe to All" and "Unsubscribe from All" buttons.

**Acceptance Criteria:**

- [ ] Add "Subscribe to All" button above firm list
- [ ] Add "Unsubscribe from All" button (with confirmation)
- [ ] Disable buttons during loading
- [ ] Show loading spinner during bulk operations
- [ ] Update UI immediately after completion
- [ ] Handle errors gracefully (show toast notification)

**Implementation:**

```javascript
// components/user/settings/SubscriptionsSection.js

async function handleSubscribeAll() {
  setLoadingBulk(true);
  try {
    const unsubscribedFirms = firmsWithSubscribed.filter(f => !f.subscribed);

    await Promise.all(
      unsubscribedFirms.map(firm =>
        fetch('/api/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firm_id: firm.id }),
        })
      )
    );

    // Update local state
    setSubscribedIds(new Set(firms.map(f => f.id)));
  } catch (err) {
    console.error('[SubscriptionsSection] Subscribe all failed', err);
    // Show toast notification
  } finally {
    setLoadingBulk(false);
  }
}

async function handleUnsubscribeAll() {
  if (!confirm('Unsubscribe from all firms? You will stop receiving weekly digests.')) {
    return;
  }

  setLoadingBulk(true);
  try {
    const subscribedFirms = firmsWithSubscribed.filter(f => f.subscribed);

    await Promise.all(
      subscribedFirms.map(firm =>
        fetch(`/api/subscriptions/${firm.id}`, { method: 'DELETE' })
      )
    );

    // Update local state
    setSubscribedIds(new Set());
  } catch (err) {
    console.error('[SubscriptionsSection] Unsubscribe all failed', err);
    // Show toast notification
  } finally {
    setLoadingBulk(false);
  }
}
```

**UI Mockup:**

```jsx
<div className="flex gap-4 mb-8">
  <button
    type="button"
    onClick={handleSubscribeAll}
    disabled={loadingBulk || subscribedCount === firms.length}
    className="btn btn-primary btn-sm"
  >
    {loadingBulk ? <span className="loading loading-spinner" /> : 'Subscribe to All'}
  </button>

  <button
    type="button"
    onClick={handleUnsubscribeAll}
    disabled={loadingBulk || subscribedCount === 0}
    className="btn btn-outline btn-sm"
  >
    {loadingBulk ? <span className="loading loading-spinner" /> : 'Unsubscribe from All'}
  </button>
</div>
```

**Testing:**

```bash
# Test Subscribe to All
1. Unsubscribe from 5 firms
2. Click "Subscribe to All"
3. Verify all firms are now subscribed
4. Check database: user_subscriptions count = firms count

# Test Unsubscribe from All
1. Subscribe to 8 firms
2. Click "Unsubscribe from All"
3. Confirm dialog
4. Verify all subscriptions removed
5. Check database: user_subscriptions count = 0

# Test edge cases
- Click "Subscribe to All" when already subscribed → Should be disabled
- Click "Unsubscribe from All" with 0 subscriptions → Should be disabled
```

**Dependencies:**
- None (enhancement)

**Files Changed:**
- [components/user/settings/SubscriptionsSection.js](../../components/user/settings/SubscriptionsSection.js)

---

### TICKET-S7-009: Add Subscription Stats to Dashboard 🟢 LOW

**Status:** 🔲 Pending
**Priority:** P3 (Low)
**Story Points:** 2
**Assignee:** Full-stack Engineer

**Description:**

Add a dashboard panel showing user's subscription stats: firms subscribed, next digest date, etc.

**Acceptance Criteria:**

- [ ] Create `/api/user/subscription-stats` endpoint
- [ ] Return: `{ subscribedCount, nextDigestDate, firms: [...] }`
- [ ] Add panel to user dashboard
- [ ] Show: "You're subscribed to X firms"
- [ ] Show: "Next digest: Sunday at 8:00 AM UTC"
- [ ] Link to settings page

**Implementation:**

```javascript
// app/api/user/subscription-stats/route.js

export async function GET(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: subscriptions, error } = await supabase
    .from('user_subscriptions')
    .select('firm_id, firm:firms(name, logo_url)')
    .eq('user_id', user.id)
    .eq('email_enabled', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Calculate next Sunday 8:00 UTC
  const now = new Date();
  const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
  const nextSunday = new Date(now);
  nextSunday.setUTCDate(now.getUTCDate() + daysUntilSunday);
  nextSunday.setUTCHours(8, 0, 0, 0);

  return NextResponse.json({
    subscribedCount: subscriptions.length,
    nextDigestDate: nextSunday.toISOString(),
    firms: subscriptions.map(s => ({
      id: s.firm_id,
      name: s.firm.name,
      logo: s.firm.logo_url,
    })),
  });
}
```

**UI Panel:**

```jsx
// components/user/dashboard/SubscriptionStatsPanel.js

export default function SubscriptionStatsPanel({ stats }) {
  return (
    <div className="card card-border bg-base-100 shadow-sm">
      <div className="card-body">
        <h3 className="text-lg font-bold">Weekly Digest</h3>
        <div className="flex items-center gap-4 my-4">
          <div className="stat-value text-primary">{stats.subscribedCount}</div>
          <div className="text-sm text-base-content/70">
            Firms subscribed
          </div>
        </div>
        <p className="text-xs text-base-content/50">
          Next digest: {new Date(stats.nextDigestDate).toLocaleString('en-US', {
            weekday: 'long',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short',
          })}
        </p>
        <Link href="/user/settings?tab=subscriptions" className="btn btn-sm btn-ghost">
          Manage subscriptions
        </Link>
      </div>
    </div>
  );
}
```

**Dependencies:**
- None (enhancement)

**Files to Create:**
- `app/api/user/subscription-stats/route.js` (new)
- `components/user/dashboard/SubscriptionStatsPanel.js` (new)

---

## Epic 4: Rate Limits & Scaling

### TICKET-S7-010: Document Rate Limits and Scaling Plan 📄 DOCUMENTATION

**Status:** 🔲 Pending
**Priority:** P2 (Medium)
**Story Points:** 2
**Assignee:** Tech Lead

**Description:**

Document Arbiscan rate limits, current usage, and scaling plan in [traders-payouts-sync.md](../../documents/runbooks/traders-payouts-sync.md) (already complete, verify accuracy).

**Acceptance Criteria:**

- [ ] Verify rate limit calculations in runbook are accurate
- [ ] Verify storage projections match actual data
- [ ] Add monitoring queries to runbook
- [ ] Document when to optimize (>10k traders threshold)
- [ ] Add troubleshooting section

**Already Documented:**

✅ Arbiscan rate limits (5 calls/sec, 100k/day)
✅ Current usage (5,760 calls/day + backfills)
✅ Storage scaling (safe up to 10k traders)
✅ Optimization strategies (JSON → Supabase, S3, lazy backfill)

**Verification:**

```bash
# 1. Check actual rate limiting delays
grep -n "setTimeout" lib/services/traderRealtimeSyncService.js
# Should be 500ms (line 178)

# 2. Check actual storage usage
du -sh data/traders/
# Should match runbook estimate (32KB for 2 traders)

# 3. Check Arbiscan API calls per day
# Inngest dashboard → sync-trader-payouts → View runs
# Count: 12 runs/hour × 24 hours × 10 traders × 2 calls
# = 5,760 calls/day (matches runbook)
```

**Additions Needed:**

Add monitoring section to runbook:

```markdown
## Monitoring Queries

### Check sync health
```sql
-- Recent sync status
SELECT
  wallet_address,
  last_synced_at,
  sync_error,
  EXTRACT(EPOCH FROM (NOW() - last_synced_at))/60 AS minutes_since_sync
FROM trader_records
WHERE last_synced_at > NOW() - INTERVAL '1 hour'
ORDER BY last_synced_at DESC;

-- Failed syncs
SELECT wallet_address, sync_error, last_synced_at
FROM trader_records
WHERE sync_error IS NOT NULL;
```

### Check storage growth
```bash
# Total traders
psql $DATABASE_URL -c "SELECT COUNT(*) FROM profiles WHERE wallet_address IS NOT NULL;"

# JSON files count
find data/traders -type f -name "*.json" | wc -l

# Storage size
du -sh data/traders/
```
```

**Dependencies:** None

**Files to Update:**
- [documents/runbooks/traders-payouts-sync.md](../../documents/runbooks/traders-payouts-sync.md) (add monitoring section)

---

## Sprint Summary

### High-Level Breakdown

| Epic | Tickets | Story Points | Priority |
|------|---------|--------------|----------|
| Authentication & Wallet Linking | 3 | 11 | P0-P1 |
| Data Sync Verification | 3 | 10 | P0-P1 |
| Firm Subscriptions Polish | 3 | 8 | P1-P3 |
| Rate Limits & Scaling | 1 | 2 | P2 |
| **Total** | **10** | **31** | — |

### Critical Path (Must Complete for Alpha)

1. **TICKET-S7-001:** Test auth flows (3 pts) ⚠️ **BLOCKER** — *Pending*
2. **TICKET-S7-002:** ~~Verify/create backfill script~~ ✅ **Done**
3. **TICKET-S7-004:** ~~Verify database tables~~ ✅ **Done**
4. **TICKET-S7-005:** Test real-time sync (5 pts) ⚠️ **BLOCKER** — *Next*
5. **TICKET-S7-007:** ~~Auto-subscribe new users~~ ✅ **Done** (DB trigger)

**Remaining Critical Path:** ~8 pts (S7-001 + S7-005)

### Nice-to-Have (Can Defer)

- TICKET-S7-003: Error handling polish (3 pts)
- TICKET-S7-006: Combined data loader tests (3 pts)
- TICKET-S7-008: Bulk subscribe UI (3 pts)
- TICKET-S7-009: Subscription stats panel (2 pts)
- TICKET-S7-010: Documentation updates (2 pts)

---

## Key Insights

### What's Already Working ✅

- Authentication infrastructure is solid (OAuth + wallet linking)
- Backfill script exists (`scripts/backfill-trader-history.js`), writes to `trader_history_payouts`
- Database tables exist: `trader_records`, `trader_recent_payouts` (migrations 06, 08, 24)
- Auto-subscribe on signup via DB trigger `auto_subscribe_new_user`
- Real-time sync architecture mirrors proven firm sync
- Firm subscription UI is complete and polished
- Rate limits are well within safe thresholds

### What Needs Verification / Polish ❌

- **S7-001:** End-to-end test of both auth flows (manual QA)
- **S7-005:** End-to-end test of Inngest real-time sync
- **S7-003:** `backfill_error` column + error handling in OAuth callback (optional polish)
- **S7-006:** Unit tests for `traderDataLoader.js` (optional)
- **S7-008 / S7-009 / S7-010:** Bulk UI, subscription stats, docs (nice-to-have)

### Remaining Risks 🔴

1. **Auth/sync not validated:** Manual testing of flows and Inngest job still pending
2. **Scaling:** No clear monitoring or alerting when approaching limits

---

## Next Steps (updated 2026-02-19)

1. **TICKET-S7-001:** Test both auth flows end-to-end (Google first → wallet, wallet first → Google; edge cases)
2. **TICKET-S7-005:** Test real-time sync (Inngest `sync-trader-payouts`, verify `trader_recent_payouts` + `trader_records`)
3. **TICKET-S7-003** (optional): Add `backfill_error` column and `updateBackfillError` in OAuth callback for debugging
4. **TICKET-S7-006** (optional): Add tests for `lib/services/traderDataLoader.js`
5. **TICKET-S7-008 / S7-009 / S7-010:** Bulk subscribe UI, subscription stats API/panel, runbook monitoring section

---

**Sprint Start Date:** 2026-02-16
**Estimated Completion:** 2026-02-23 (1 week)
**Tech Lead:** [Your Name]
