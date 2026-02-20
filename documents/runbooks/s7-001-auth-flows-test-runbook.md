# S7-001: Auth Flows Manual Test Runbook

**Ticket:** TICKET-S7-001 — Test Both Authentication Flows  
**Purpose:** Verify Google-first and wallet-first signup, wallet validation errors, profile creation, and backfill trigger.

**Prerequisites:**
- App running locally (`npm run dev`) or a known staging URL
- Supabase auth configured with Google OAuth (redirect URL whitelisted)
- At least one test Google account (two recommended for duplicate-wallet test)
- Optional: server logs visible (for backfill trigger check)

**Test data:**

| Use case        | Value |
|-----------------|--------|
| Valid wallet (Flow 1 add) | `0x1c969652d758f8fc23c443758f8911086f676216` |
| Valid wallet (Flow 2)     | `0x0074fa9c170e12351afabd7df0ebd0aed2a5eab3` |
| Prop firm address        | `0x1e198Ad0608476EfA952De1cD8e574dB68df5f16` (FundingPips) |
| Invalid format           | `not-a-wallet` |
| Duplicate wallet         | Use same address already linked to another account (see steps) |

---

## Flow 1: Google OAuth First → Add Wallet in Settings

**Entry:** Sign in with Google only, then add wallet in settings.

| # | Step | Expected |
|---|------|----------|
| 1 | Open `/signin` (or root that redirects to signin). | Sign-in page with “Sign in with Google”. |
| 2 | Sign in with Google (no wallet yet). | Redirect to callback then to dashboard/callbackUrl. |
| 3 | Check profile: display name and handle. | Profile has `display_name` and `handle` from Google (or email prefix). |
| 4 | Go to **Settings**: `/user/settings` (or User → Settings). | Settings page with profile and wallet section. |
| 5 | Add wallet: paste `0x1c969652d758f8fc23c443758f8911086f676216`, submit. | Success; `wallet_address` saved on profile. |
| 6 | Check server logs (if available). | Log line containing `[OAuth Backfill]` or backfill triggered (e.g. from profile API). |

**Validation errors (same flow, repeat with different inputs):**

| # | Step | Expected |
|---|------|----------|
| 7 | Add wallet already linked to **another** user. | Error: *“This wallet address is already linked to another account”* (or “already being used by another account”). |
| 8 | Add prop firm address `0x1e198Ad0608476EfA952De1cD8e574dB68df5f16`. | Error: *“This wallet address belongs to a prop firm and cannot be linked”* (or similar). |
| 9 | Add invalid value `not-a-wallet`. | Error: *“Invalid wallet address format”* (or similar). |
| 10 | Add the **same** wallet that is already linked to **this** user. | Allowed (valid; same user). |

---

## Flow 2: Wallet Address First → Google

**Entry:** Enter wallet on connect-wallet page, then sign in with Google.

| # | Step | Expected |
|---|------|----------|
| 1 | Open `/connect-wallet`. | Page with wallet address input and CTA to continue. |
| 2 | Enter wallet: `0x0074fa9c170e12351afabd7df0ebd0aed2a5eab3`. | Accepted (valid format). |
| 3 | Submit / Continue. | Validation runs; redirect to `/signin`. |
| 4 | On sign-in page. | UI shows pending wallet (e.g. “This wallet will be linked…”). |
| 5 | Click “Sign in with Google” and complete OAuth. | Redirect to `/api/auth/callback` then to dashboard. |
| 6 | Check profile (DB or UI). | Profile has `wallet_address` = that address (lowercase). |
| 7 | Check server logs. | Backfill triggered (e.g. `[OAuth Backfill]`). |
| 8 | After callback. | `pending_wallet` cookie cleared (no cookie after redirect). |

**Optional (browser devtools):** Before step 5, check cookie `pending_wallet` is set for the domain. After redirect from callback, confirm cookie is gone.

---

## Edge Cases

| # | Scenario | Steps | Expected |
|---|----------|--------|----------|
| 1 | No `full_name` in Google | Sign in with a Google account that has no full name set. | Profile gets display_name from email prefix (or similar fallback). |
| 2 | Email prefix &lt; 3 chars | Use Google account with very short local part (e.g. `ab@example.com`). | Handle derived and padded (e.g. to 3 chars with zeros) per callback logic. |
| 3 | Wallet already linked to self | In Flow 1, add wallet A; try adding wallet A again in settings. | Validation allows it (same user); no “already linked to another account” error. |
| 4 | Wallet mixed case | Use `0x1C969652d758f8fc23c443758f8911086f676216` (mixed case). | Stored normalized (e.g. lowercase) and validation accepts. |

---

## Quick Reference: App Routes

- **Sign-in (Google):** `/signin`  
- **Wallet-first flow start:** `/connect-wallet`  
- **After sign-in (default):** config `auth.callbackUrl` (e.g. `/dashboard` or `/user/dashboard`)  
- **Add wallet (Flow 1):** `/user/settings` (wallet / profile section)  
- **OAuth callback:** `/api/auth/callback` (server-only; no direct open)

---

## Sign-off

- [ ] Flow 1 (Google first → add wallet) passed  
- [ ] Flow 1 validation errors (duplicate, prop firm, invalid format, same user) passed  
- [ ] Flow 2 (wallet first → Google) passed  
- [ ] Cookie cleared after Flow 2 callback  
- [ ] Edge cases (optional) checked  
- [ ] Backfill trigger seen in logs for new wallet link (Flow 1 or 2)

**Tester:** _________________ **Date:** _________________
