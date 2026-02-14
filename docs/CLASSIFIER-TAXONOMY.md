# Classifier Taxonomy & Incident Rules (Phase 1 – Option B)

**Status:** Implemented as of Phase 1 refactor.  
**See also:** [TECH-LEAD-INTELLIGENCE-FEEDBACK.md](TECH-LEAD-INTELLIGENCE-FEEDBACK.md), PM/Tech Lead agreement on Option B for launch.

---

## 1. Single-label categories (AI classifier output)

The classifier returns **one** `category` per review. Allowed values:

| Category | Description | Incident? | Sentiment |
|----------|-------------|-----------|-----------|
| **payout_delay** | Payouts late, processing delays | Yes (spike) | Negative |
| **payout_denied** | Payout refused, withheld | Yes (spike) | Negative |
| **kyc_withdrawal_issue** | KYC blocks, withdrawal method limits, verification delays | Yes (spike) | Negative |
| **platform_technical_issue** | Login, charts, platform downtime, bugs | Yes (spike) | Negative |
| **support_issue** | Slow reply, ticket ignored, rude/unprofessional support | Yes (spike) | Negative |
| **rules_dispute** | Unfair termination, rule disagreements | Yes (spike) | Negative |
| **pricing_fee_complaint** | Challenge fees, resets, hidden costs | Yes (spike) | Negative |
| **execution_conditions** | Slippage, spreads, execution quality | Yes (spike) | Negative |
| **high_risk_allegation** | Fraud/scam allegations, exit scam fears (UI: "High-risk allegations reported") | Yes (severity override) | Negative |
| **positive_experience** | Success stories, praise, recommendations | No | Positive |
| **neutral_mixed** | Questions, general discussion, mixed feedback | No | Neutral |
| **spam_template** | Templated praise, affiliate-driven | No | — |
| **low_info** | One-line, uninformative | No | — |
| **off_topic** | Irrelevant, not about the firm | No | — |

**Renames from previous taxonomy:**

- `scam_warning` → **high_risk_allegation**
- `rule_violation` → **rules_dispute**
- `platform_issue` → **platform_technical_issue**
- `payout_issue` (lumped) → **payout_delay** and **payout_denied**
- `positive` → **positive_experience**
- `neutral` → **neutral_mixed**
- `noise` → **spam_template**, **low_info**, **off_topic**

---

## 2. Incident rules

Incidents represent **repeatable, non-random signals** (volume + recency). They are **not** "any negative review."

### A) Spike-based incidents (normal negative categories)

- **Trigger:** `count(category = X, last_7d) >= 3` for X in spike categories.
- **Categories:** payout_delay, payout_denied, kyc_withdrawal_issue, platform_technical_issue, support_issue, rules_dispute, pricing_fee_complaint, execution_conditions.
- **Optional (future):** `count(this_7d) >= 2 × count(prev_7d)` to require a spike vs prior week; not required for Phase 1.

### B) Severity override (high-risk)

- **Trigger:** `count(high_risk_allegation, last_7d) >= 1` (or 2 if we want to be stricter). Config: `MIN_HIGH_RISK_FOR_INCIDENT = 1`.
- **UI:** Always show "High-risk allegations reported" with sample size, links, disclaimers, confidence.

### C) Never create incidents from

- spam_template, low_info, off_topic, positive_experience, neutral_mixed.

Implementation: we only consider reviews whose `category` is in the spike list or in the severity-override list; the "never" list is simply excluded (not in those sets).

---

## 3. Digest sentiment (weekly report / email)

- **Positive:** `category === 'positive_experience'`
- **Neutral:** `category === 'neutral_mixed'`
- **Negative:** `category` in all incident-eligible negative categories (spike list + high_risk_allegation). Excludes spam/low_info/off_topic and positive/neutral_mixed.

So sentiment counts are derived from the same single `category` field; no separate sentiment column in Phase 1.

---

## 4. Backward compatibility & migration

- **Existing rows:** May still have old category values (`payout_issue`, `scam_warning`, `platform_issue`, `rule_violation`, `positive`, `neutral`, `noise`). Options:
  - **New-only:** Only new classifications use the new taxonomy; old rows are left as-is. Consumers can map old → new for display/incidents (e.g. scam_warning → high_risk_allegation).
  - **Reclassify:** Run batch classifier again with new prompt; cost = API × existing rows.
- **Phase 1 choice:** We support **both** old and new values in DB CHECK and in code: incident aggregator and digest treat old values as follows:
  - `payout_issue` → treat as payout_delay for spike (or both payout_delay/payout_denied if we want to map).
  - `scam_warning` → high_risk_allegation (severity override).
  - `platform_issue` → platform_technical_issue.
  - `rule_violation` → rules_dispute.
  - `positive` → positive_experience.
  - `neutral` → neutral_mixed.
  - `noise` → off_topic (never incident).
  So existing data keeps working without reclassify; new data uses new taxonomy.

---

## 5. Phase 2 (3-axis: topic + sentiment + risk_flags)

When we add schema columns `topic`, `sentiment`, `risk_flags`:

- **Incident (topic + sentiment):** Create when `topic = T` and `sentiment = 'negative'` and `mentions >= N` in `W = 7` days (N = 3 or 2).
- **Incident (risk override):** Create when `risk_flags` contains `high_risk_allegation` and count >= 1–2 in 7d.
- **Mixed:** Does not trigger incidents; can feed "watchlist" later.
- **Backward compat:** Keep `category`; aggregator reads new fields first, falls back to `category`; backfill last 90 days only.

This doc will be updated when Phase 2 is implemented.

---

## 6. Database migration

Run once to allow new (and keep legacy) category/incident_type values:

- **[migrations/14_update-classifier-taxonomy.sql](../migrations/14_update-classifier-taxonomy.sql)**  
  - Expands `trustpilot_reviews.valid_category` to allow all new + legacy categories.  
  - Expands `weekly_incidents.incident_type` CHECK to allow new + legacy incident types.
