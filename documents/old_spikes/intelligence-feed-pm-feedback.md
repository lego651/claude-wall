# Intelligence Feed — PM Feedback & Product Review

Date: 2026-03-07
Based on: screenshot of `/propfirms/fundednext/intelligence` + tech summary

---

## User Persona

**Primary: The Cautious Prop Trader**
- Has passed a challenge (or considering one) and is about to risk real money with a firm
- Has heard mixed things on Discord/Twitter — wants a neutral third party view
- Asks: *"Is FundedNext paying people out right now? Are there any red flags I should know about?"*
- Needs: A fast, scannable verdict. Not a list of incidents to decode — a clear answer.

**Secondary: The Multi-Firm Researcher**
- Shopping between 2–3 firms before committing to a challenge
- Compares payout velocity, community sentiment, recent issues
- Asks: *"Which firm is the safest bet this month?"*
- Needs: Consistent signal types across firms so comparison is easy.

**Who is NOT the user (yet):**
- Quant traders / institutions — too niche
- Firm employees monitoring their own profile — different product

---

## Core Value Statement (what this page should answer)

> "Should I trust this firm with my money **right now**?"

The page should answer this in the first 3 seconds. It does not today.

---

## Honest Feedback — What Is Broken

### 1. No value proposition above the fold
The page opens with "Firm Intelligence Feed — Curated, summarized, and classified signals from the last 30 days." This is a description of the mechanism, not the value. A first-time user reads this and thinks "OK, but why do I care?"

**What it should say in 1 line:** Something like "Is FundedNext safe to trade with right now? Here's what the community is saying."

---

### 2. The dot system is unexplained and inconsistent
A user sees a red dot on "Allegations of Fraud and Payout Delays" and a yellow dot on "Customer Support Delays." They have no idea:
- What red vs yellow means
- Whether yellow is bad or neutral
- Why the OPERATIONAL badge is blue but the dot is yellow
- What HIGH vs MEDIUM confidence means (it's never shown to the user)

The dot color depends on category + confidence, but **confidence is invisible** to the user. This means two REPUTATION cards look identical (same amber badge) but one has a red dot and one has an amber dot, with no explanation.

**What a user needs:** Either kill the dots and just use badge color, or explain the dots with a visible 1-line legend (e.g. "● Red = high risk alert, ● Amber = issue detected, ● Green = positive signal").

---

### 3. Five categories is too many — and one is dead
OPERATIONAL, REPUTATION, REGULATORY, POSITIVE, INFORMATIONAL.

- REGULATORY has zero signals in production. It shows up in the filter dropdown but selecting it always gives empty results. This erodes trust.
- OPERATIONAL vs REPUTATION distinction is not intuitive. A "Payout Delay" feels like a reputation issue too. A "Rules Dispute" could be operational.
- Users filter by category but don't know what they're filtering for.

**Proposed simplification:** Reduce to 3 user-facing buckets:
- 🔴 **Risk Alerts** — anything that could cost you money (fraud, payout denied, scam allegations)
- 🟡 **Watch List** — issues to monitor but not panic-level (support delays, rule changes, KYC friction)
- 🟢 **Positive Signals** — fast payouts, community praise, policy improvements

INFORMATIONAL could merge into Watch List. REGULATORY is removed until there's actual data.

---

### 4. The sidebar lies
- "Intelligence Status: **STABLE**" — hardcoded. For every firm. Even if they have 4 red signals. This is actively misleading.
- "Consistent daily payout volume with high velocity" — hardcoded. Same for FundedNext and every other firm.
- "Reliable customer support signals and frequent positive mentions" — hardcoded.
- "High discussion around new scaling rules on social media" — hardcoded.

These are placeholder copy from the design phase that was never wired to real data. A first-time user reads these and thinks they're seeing live data — then looks at a feed full of fraud allegations and is confused why the sidebar says "STABLE."

**This is the highest priority fix.** The sidebar needs to either show real data or be removed. Showing false data destroys trust faster than showing nothing.

---

### 5. References are meaningless
"Trustpilot Review #1, Trustpilot Review #2, Trustpilot Review #3..."

These are links to the actual reviews which is great, but the labeling gives zero context. A user doesn't know if Review #1 is from yesterday or 6 months ago. They can't tell which review is the most alarming.

**What it should show:** Either a short excerpt ("1-star: 'They closed my account without warning'") or at minimum the star rating + date inline.

---

### 6. No clear verdict / score
There is no summary. A user has to read 8 cards and synthesize their own judgment. This is exactly the job that AI should do.

Compare this to what a user gets from reading a Trustpilot page — at least Trustpilot shows "4.2 / 5" at the top. PropPulse shows a list of incidents with no top-level summary.

**What a user needs first:** A headline verdict — "FundedNext has 3 active risk signals this month, including allegations of payout delays" before diving into the list.

---

### 7. Call-to-action mismatch
The "Enable Notifications" CTA at the bottom requires an account and is not wired. The "Setup Alerts" in the sidebar is also not wired. Two fake CTAs that do nothing.

If the product doesn't support notifications yet, remove the CTAs. Dead buttons signal an unfinished product.

---

## What Is Working

- The card layout is clean and readable
- The AI summaries are good — the 2–3 sentence synopses are accurate and useful
- References (links to actual Trustpilot reviews) add credibility
- The Trustpilot sparkline (S10-009) is the right idea — trend over time is valuable signal
- Composite ranking (S10-003) ensures the most important signals surface at the top
- Positive signals (S10-005) are correctly included — the feed shouldn't be pure negativity

---

## Summary of Issues by Priority

| Priority | Issue | Impact |
|----------|-------|--------|
| P0 | Sidebar shows fake data ("STABLE", hardcoded copy) | Destroys trust |
| P0 | No value proposition on page load | High bounce rate for new users |
| P0 | Dots are unexplained and color logic is inconsistent | Confusing |
| P1 | 5 categories too complex, REGULATORY is dead | Users ignore the filter |
| P1 | References say "Trustpilot Review #1" not what the review said | Low credibility |
| P1 | No top-level verdict / summary score | Users must self-synthesize |
| P2 | Two fake CTAs ("Enable Notifications", "Setup Alerts") | Unfinished feel |
| P2 | "Updated hourly" is inaccurate (it's daily/weekly) | Trust erosion |

---

## PM Recommendation

Before adding more signals or data sources, fix the credibility gap. The page currently shows accurate content buried under fake UI elements (hardcoded status, hardcoded copy, non-functional buttons). A new user encountering the STABLE badge and then reading fraud allegations will conclude the product is broken, not the UI.

**The one-sentence brief for the next sprint:**
> Fix the sidebar to show real data, add a top-level verdict, and simplify to 3 signal categories with a visible legend.
