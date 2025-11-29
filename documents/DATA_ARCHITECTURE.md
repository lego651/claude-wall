# Data Architecture & Flow Diagrams

This document visualizes the data architecture, workflows, and system interactions.

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        GITHUB REPOSITORY                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  /data/firms/{firm-slug}/                                  │ │
│  │    ├── firm.json          (Metadata)                       │ │
│  │    ├── rules.json         (Rules Configuration)            │ │
│  │    ├── discounts.json     (Active Discounts)               │ │
│  │    ├── payouts.json       (Community Payouts)              │ │
│  │    └── history/                                            │ │
│  │        ├── 2025-01-15.json                                 │ │
│  │        └── 2025-02-20.json                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Git Push
                              ▼
                    ┌──────────────────┐
                    │ GITHUB ACTIONS   │
                    │                  │
                    │ 1. Validate JSON │
                    │ 2. Run Schema    │
                    │    Checks        │
                    │ 3. Generate Diff │
                    │ 4. Create News   │
                    │ 5. Sync to DB    │
                    └──────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
          ┌──────────────────┐  ┌──────────────────┐
          │   SUPABASE DB    │  │   NEXT.JS APP    │
          │                  │  │                  │
          │  - firms         │  │  - /firms        │
          │  - challenge_    │  │  - /firms/[slug] │
          │    types         │  │  - /compare      │
          │  - rule_index    │  │  - /news         │
          │  - news_posts    │  │  - /payouts      │
          │  - payouts       │  │                  │
          │  - user_data     │  │  (Static Gen +   │
          │                  │  │   ISR)           │
          └──────────────────┘  └──────────────────┘
                    │                   │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   END USERS      │
                    │                  │
                    │  - Browse firms  │
                    │  - Compare rules │
                    │  - Track changes │
                    │  - Submit PRs    │
                    └──────────────────┘
```

---

## 2. Data Flow: Community Contribution

```
┌──────────────┐
│ CONTRIBUTOR  │
└──────┬───────┘
       │ 1. Fork repo
       ▼
┌────────────────────┐
│ Local Development  │
│                    │
│ - Edit JSON files  │
│ - Add new firm     │
│ - Update rules     │
└─────────┬──────────┘
          │ 2. Create PR
          ▼
┌─────────────────────┐
│  GITHUB PR          │
│                     │
│ Triggers:           │
│ ✓ JSON validation   │
│ ✓ Schema check      │
│ ✓ Lint rules        │
│ ✓ Generate preview  │
└──────────┬──────────┘
           │ 3. Auto-checks pass
           ▼
     ┌───────────┐
     │  REVIEW   │ ◄──── Maintainer
     └─────┬─────┘       reviews
           │ 4. Approve
           ▼
     ┌───────────┐
     │   MERGE   │
     └─────┬─────┘
           │ 5. Post-merge hooks
           ▼
┌──────────────────────────┐
│ GITHUB ACTIONS           │
│                          │
│ 1. Generate diff         │
│ 2. Create history/       │
│    {timestamp}.json      │
│ 3. AI summarize changes  │
│ 4. Create news post      │
│ 5. Sync to Supabase      │
│ 6. Trigger ISR rebuild   │
└────────┬─────────────────┘
         │
         ▼
   ┌────────────┐
   │  DEPLOYED  │
   │   LIVE     │
   └────────────┘
```

---

## 3. Data Schema: Entity Relationship

```
┌─────────────────────────┐
│       FIRMS             │
│─────────────────────────│
│ PK: id (UUID)           │
│ UK: firm_id (TEXT)      │
│ UK: slug (TEXT)         │
│     name                │
│     status              │
│     website             │
│     country             │
│     verified            │
│     github_path         │
└───────────┬─────────────┘
            │
            │ 1:N
            ▼
┌─────────────────────────┐
│   CHALLENGE_TYPES       │
│─────────────────────────│
│ PK: id                  │
│ FK: firm_id             │
│     challenge_id        │
│     name                │
│     type (1/2/3-step)   │
│     is_active           │
└───────────┬─────────────┘
            │
            │ 1:N
            ▼
┌─────────────────────────┐
│ ACCOUNT_CONFIGURATIONS  │
│─────────────────────────│
│ PK: id                  │
│ FK: challenge_type_id   │
│     config_id           │
│     account_size        │
│     currency            │
│     fee_amount          │
│     fee_refundable      │
└───────────┬─────────────┘
            │
            │ 1:N
            ▼
┌─────────────────────────┐
│     RULE_INDEX          │
│─────────────────────────│
│ PK: id                  │
│ FK: firm_id             │
│ FK: challenge_type_id   │
│ FK: account_config_id   │
│     phase_number        │
│     profit_target_pct   │ ◄── Denormalized
│     max_daily_loss_pct  │     for fast queries
│     max_total_loss_pct  │
│     rules_json (JSONB)  │ ◄── Full rule details
└─────────────────────────┘


   ┌─────────────┐
   │   FIRMS     │
   └──────┬──────┘
          │ 1:N
          ▼
   ┌─────────────┐
   │ NEWS_POSTS  │
   │─────────────│
   │ PK: id      │
   │ FK: firm_id │
   │     slug    │
   │     title   │
   │     content │
   │     type    │
   └─────────────┘


   ┌─────────────┐
   │   FIRMS     │
   └──────┬──────┘
          │ 1:N
          ▼
   ┌─────────────┐
   │  DISCOUNTS  │
   │─────────────│
   │ PK: id      │
   │ FK: firm_id │
   │     code    │
   │     value   │
   │     valid_  │
   │     from/to │
   └─────────────┘


   ┌─────────────┐
   │   FIRMS     │
   └──────┬──────┘
          │ 1:N
          ▼
   ┌─────────────┐
   │  PAYOUTS    │
   │─────────────│
   │ PK: id      │
   │ FK: firm_id │
   │     amount  │
   │     date    │
   │     status  │
   └─────────────┘
```

---

## 4. JSON Structure Hierarchy

```
rules.json
│
├── firmId: "ftmo"
├── version: "2.1.0"
├── effectiveDate: "2025-01-01"
│
├── challengeTypes: [...]  ◄────┐
│   │                            │ LEVEL 1: Challenge Type
│   ├── [0]                      │
│   │   ├── id: "ftmo-standard"  │
│   │   ├── name: "Standard Challenge"
│   │   ├── type: "2-step"
│   │   │
│   │   └── accountConfigurations: [...]  ◄────┐
│   │       │                                   │ LEVEL 2: Account Config
│   │       ├── [0]                             │
│   │       │   ├── id: "ftmo-standard-10k"     │
│   │       │   ├── accountSize: 10000
│   │       │   ├── fee: {...}
│   │       │   │
│   │       │   └── phases: [...]  ◄────┐
│   │       │       │                    │ LEVEL 3: Phase
│   │       │       ├── [0]              │
│   │       │       │   ├── phaseNumber: 1
│   │       │       │   ├── name: "Challenge"
│   │       │       │   │
│   │       │       │   └── rules: {...}  ◄────┐
│   │       │       │       │                   │ LEVEL 4: Rules
│   │       │       │       ├── profitTarget    │
│   │       │       │       ├── maxDailyLoss    │
│   │       │       │       ├── maxTotalLoss    │
│   │       │       │       ├── minTradingDays  │
│   │       │       │       └── ...              │
│   │       │       │                            │
│   │       │       └── [1] Phase 2             │
│   │       │           └── rules: {...}        │
│   │       │                                    │
│   │       ├── [1] 25K account                 │
│   │       ├── [2] 50K account                 │
│   │       └── ...                              │
│   │                                            │
│   ├── [1] Aggressive Challenge                │
│   └── [2] Swing Challenge                     │
│                                                │
└── globalRules: {...}  ◄────────────────────────┘
    │                   Rules applying to all
    ├── trading
    └── compliance
```

---

## 5. Query Patterns

### Pattern 1: Get All Firms (Directory Page)

```
REQUEST: GET /api/firms

FLOW:
┌──────────────┐
│  Next.js API │
└──────┬───────┘
       │ Query Supabase
       ▼
┌──────────────────────────┐
│ SELECT * FROM firms      │
│ WHERE status = 'active'  │
│ ORDER BY name            │
└────────┬─────────────────┘
         │ Fast! (Indexed)
         ▼
┌──────────────┐
│ Return JSON  │ → [{ firm1 }, { firm2 }, ...]
└──────────────┘

ALTERNATIVE (Static):
┌──────────────┐
│  Build Time  │
└──────┬───────┘
       │ Read all GitHub files
       ▼
┌──────────────────────┐
│ fs.readdir()         │
│ Parse all firm.json  │
└────────┬─────────────┘
         │ Generate static
         ▼
┌──────────────┐
│ Static HTML  │
└──────────────┘
```

### Pattern 2: Get Firm Details

```
REQUEST: GET /firms/ftmo

FLOW:
┌──────────────┐
│  Next.js SSG │
└──────┬───────┘
       │ getStaticProps
       ▼
┌──────────────────────────────┐
│ Read GitHub JSON:            │
│ - /data/firms/ftmo/firm.json │
│ - /data/firms/ftmo/rules.json│
└────────┬─────────────────────┘
         │ Parse & Transform
         ▼
┌──────────────────────────────┐
│ Enrich with Supabase:        │
│ - Latest news                │
│ - Payout count               │
│ - Active discounts           │
└────────┬─────────────────────┘
         │ Combine data
         ▼
┌──────────────┐
│ Render Page  │
└──────────────┘
```

### Pattern 3: Compare Firms

```
REQUEST: GET /compare?firms=ftmo,mff,topstep&size=50000

FLOW:
┌──────────────┐
│  User Input  │
└──────┬───────┘
       │ Select firms + filters
       ▼
┌────────────────────────────────┐
│ Query rule_index table:        │
│                                │
│ SELECT * FROM rule_index       │
│ WHERE firm_id IN (...)         │
│   AND account_size = 50000     │
│   AND phase_number = 1         │
└────────┬───────────────────────┘
         │ Returns denormalized data
         ▼
┌────────────────────────────────┐
│ Transform to comparison matrix │
│                                │
│      │ FTMO │ MFF │ TopStep   │
│ ─────┼──────┼─────┼──────     │
│ PT   │ 10%  │ 8%  │ $3000     │
│ DD   │ 5%   │ 5%  │ $2000     │
│ ...                            │
└────────┬───────────────────────┘
         │ Render table
         ▼
┌──────────────┐
│ Display UI   │
└──────────────┘
```

### Pattern 4: Rule Change Detection

```
TRIGGER: Git push to main

FLOW:
┌──────────────┐
│  Git Commit  │
└──────┬───────┘
       │ Changed: rules.json
       ▼
┌────────────────────────────┐
│ GitHub Action:             │
│ scripts/diff-rules.js      │
└────────┬───────────────────┘
         │ Compare HEAD vs HEAD~1
         ▼
┌────────────────────────────┐
│ Generate Diff Object:      │
│                            │
│ {                          │
│   changes: [               │
│     {                      │
│       path: "...",         │
│       oldValue: 8,         │
│       newValue: 10         │
│     }                      │
│   ]                        │
│ }                          │
└────────┬───────────────────┘
         │ AI Summarize
         ▼
┌────────────────────────────┐
│ Claude API:                │
│ "Summarize these changes   │
│  in plain English"         │
└────────┬───────────────────┘
         │ Generate text
         ▼
┌────────────────────────────┐
│ Create History Snapshot:   │
│ /history/2025-01-15.json   │
│                            │
│ Create News Post:          │
│ /news/2025-01-15-ftmo.md   │
└────────┬───────────────────┘
         │ Commit to repo
         ▼
┌────────────────────────────┐
│ Sync to Supabase:          │
│ INSERT INTO news_posts     │
└────────┬───────────────────┘
         │ Trigger rebuild
         ▼
┌──────────────┐
│ ISR Rebuild  │ → Users see update
└──────────────┘
```

---

## 6. Sync Strategy: GitHub ↔ Supabase

```
┌─────────────────────────────────────────────────────────┐
│                    SYNC SCRIPT                          │
│  scripts/sync-github-to-supabase.js                     │
│─────────────────────────────────────────────────────────│
│                                                         │
│  1. Read all /data/firms/*/firm.json files              │
│                                                         │
│     ┌──────────────┐                                    │
│     │ fs.readdir() │ → Get all firm folders            │
│     └──────────────┘                                    │
│                                                         │
│  2. For each firm:                                      │
│                                                         │
│     ┌──────────────────────────────────┐               │
│     │ Parse firm.json, rules.json      │               │
│     └──────────────────────────────────┘               │
│              │                                          │
│              ▼                                          │
│     ┌──────────────────────────────────┐               │
│     │ UPSERT INTO firms                │               │
│     │ (firm_id, name, slug, ...)       │               │
│     └──────────────────────────────────┘               │
│              │                                          │
│              ▼                                          │
│     ┌──────────────────────────────────┐               │
│     │ For each challengeType:          │               │
│     │   UPSERT INTO challenge_types    │               │
│     └──────────────────────────────────┘               │
│              │                                          │
│              ▼                                          │
│     ┌──────────────────────────────────┐               │
│     │ For each accountConfiguration:   │               │
│     │   UPSERT INTO account_configs    │               │
│     └──────────────────────────────────┘               │
│              │                                          │
│              ▼                                          │
│     ┌──────────────────────────────────┐               │
│     │ For each phase:                  │               │
│     │   UPSERT INTO rule_index         │               │
│     │   (denormalize common fields)    │               │
│     └──────────────────────────────────┘               │
│                                                         │
│  3. Clean up stale records                              │
│                                                         │
│     ┌──────────────────────────────────┐               │
│     │ DELETE FROM firms                │               │
│     │ WHERE github_path NOT IN         │               │
│     │   (current folder list)          │               │
│     └──────────────────────────────────┘               │
│                                                         │
│  4. Update sync timestamp                               │
│                                                         │
│     ┌──────────────────────────────────┐               │
│     │ UPDATE firms                     │               │
│     │ SET last_synced_at = NOW()       │               │
│     └──────────────────────────────────┘               │
│                                                         │
└─────────────────────────────────────────────────────────┘

RUNS ON:
  - Every merge to main (GitHub Actions)
  - Manual trigger via workflow_dispatch
  - Scheduled cron: daily at 00:00 UTC (safety sync)
```

---

## 7. Search & Filter Architecture

```
USER INTERFACE
┌────────────────────────────────────────┐
│  Search: "drawdown 10%"                │
│                                        │
│  Filters:                              │
│  ☑ Profit target < 10%                 │
│  ☑ Max loss > 10%                      │
│  ☑ Fee refundable                      │
│  ☐ Instant funding                     │
└────────────┬───────────────────────────┘
             │ Submit query
             ▼
┌────────────────────────────────────────┐
│  API: /api/firms/search                │
│                                        │
│  Build SQL query:                      │
│                                        │
│  SELECT DISTINCT f.*                   │
│  FROM firms f                          │
│  JOIN rule_index r ON f.id = r.firm_id │
│  WHERE                                 │
│    r.profit_target_pct <= 10 AND       │
│    r.max_total_loss_pct >= 10 AND      │
│    EXISTS (                            │
│      SELECT 1 FROM account_configs ac  │
│      WHERE ac.challenge_type_id IN     │
│        (SELECT id FROM challenge_types │
│         WHERE firm_id = f.id)          │
│        AND ac.fee_refundable = true    │
│    )                                   │
└────────────┬───────────────────────────┘
             │ Execute query
             ▼
┌────────────────────────────────────────┐
│  SUPABASE (Indexed Query)              │
│                                        │
│  Returns: 15 firms in ~50ms            │
└────────────┬───────────────────────────┘
             │ Return results
             ▼
┌────────────────────────────────────────┐
│  Display Results                       │
│                                        │
│  1. FTMO - 10% target, 10% loss, €155  │
│  2. FundedNext - 10% target, ...       │
│  ...                                   │
└────────────────────────────────────────┘

PERFORMANCE:
  ✓ Indexes on: profit_target_pct, max_total_loss_pct
  ✓ Denormalized data (no JSON parsing in query)
  ✓ Cached results (Next.js cache)
  ✓ Target: < 100ms response time
```

---

## 8. Caching Strategy

```
┌──────────────────────────────────────────────────────┐
│                    CACHING LAYERS                     │
└──────────────────────────────────────────────────────┘

LAYER 1: Static Generation (Build Time)
┌────────────────────────────────────┐
│ Next.js Build                      │
│                                    │
│ - All firm pages                   │
│ - Directory page                   │
│ - News posts                       │
│                                    │
│ Generated once, served as HTML     │
│ Revalidated on: ISR trigger        │
└────────────────────────────────────┘

LAYER 2: ISR (Incremental Static Regeneration)
┌────────────────────────────────────┐
│ revalidate: 3600 (1 hour)          │
│                                    │
│ Pages auto-rebuild after 1 hour    │
│ if accessed                        │
│                                    │
│ Manual trigger via:                │
│ - API: /api/revalidate?path=...    │
│ - GitHub Action after sync         │
└────────────────────────────────────┘

LAYER 3: Client-Side Cache
┌────────────────────────────────────┐
│ React Query / SWR                  │
│                                    │
│ staleTime: 5 minutes               │
│ cacheTime: 10 minutes              │
│                                    │
│ Used for:                          │
│ - Comparison results               │
│ - Search results                   │
│ - User favorites                   │
└────────────────────────────────────┘

LAYER 4: Database Query Cache (Future)
┌────────────────────────────────────┐
│ Redis                              │
│                                    │
│ Cache common queries:              │
│ - All firms list                   │
│ - Popular comparisons              │
│                                    │
│ TTL: 15 minutes                    │
└────────────────────────────────────┘

CACHE INVALIDATION:
  Trigger: Git push to main
  Flow:
    1. GitHub Action runs sync script
    2. Sync script updates Supabase
    3. Script calls Next.js revalidate API
    4. ISR rebuilds affected pages
    5. Users get fresh content
```

---

## 9. Data Validation Pipeline

```
┌─────────────────────────────────────────────────────┐
│              VALIDATION PIPELINE                     │
└─────────────────────────────────────────────────────┘

STEP 1: Pre-commit (Local)
┌────────────────────────────┐
│ Husky Hook                 │
│                            │
│ npm run validate-schemas   │
└────────┬───────────────────┘
         │ Validates all JSON
         ▼
┌────────────────────────────┐
│ Ajv JSON Schema Validator  │
│                            │
│ ✓ firm.json                │
│ ✓ rules.json               │
│ ✓ discounts.json           │
│ ✓ payouts.json             │
└────────┬───────────────────┘
         │ Pass/Fail
         ▼
     [Commit]

STEP 2: GitHub PR
┌────────────────────────────┐
│ GitHub Actions Workflow    │
│                            │
│ .github/workflows/         │
│   validate-pr.yml          │
└────────┬───────────────────┘
         │ On: pull_request
         ▼
┌────────────────────────────┐
│ Jobs:                      │
│                            │
│ 1. validate-json           │
│    - JSON Schema check     │
│    - Syntax validation     │
│                            │
│ 2. validate-structure      │
│    - Required fields       │
│    - Data types            │
│    - Relationships         │
│                            │
│ 3. validate-business-rules │
│    - Profit target > 0     │
│    - Daily loss < Total    │
│    - Dates are future      │
│                            │
│ 4. generate-preview        │
│    - Build preview site    │
│    - Deploy to Vercel      │
└────────┬───────────────────┘
         │ All checks pass
         ▼
     [Ready for Review]

STEP 3: Post-Merge
┌────────────────────────────┐
│ Post-Merge Actions         │
│                            │
│ 1. Re-validate (safety)    │
│ 2. Sync to Supabase        │
│ 3. Verify sync success     │
│ 4. Trigger deployment      │
└────────────────────────────┘

ERROR HANDLING:
  ✗ Pre-commit fails    → Block commit
  ✗ PR validation fails → Block merge
  ✗ Sync fails          → Rollback + alert
```

---

## 10. Rule Comparison Algorithm

```
INPUT: Compare FTMO vs MFF vs TopStep (50K accounts)

┌──────────────────────────────────────────────────────┐
│  STEP 1: Fetch Data                                  │
└──────────────────────────────────────────────────────┘
  Query:
    SELECT * FROM rule_index
    WHERE firm_id IN ('ftmo', 'mff', 'topstep')
      AND account_size = 50000
    ORDER BY firm_id, phase_number

  Result: 6 rows (2 phases × 3 firms)

┌──────────────────────────────────────────────────────┐
│  STEP 2: Normalize Data Structures                   │
└──────────────────────────────────────────────────────┘
  Problem: Different firms use different units
    - FTMO: Percentage (10%)
    - TopStep: Fixed dollars ($3000)

  Solution: Normalize to comparable format
    {
      firm: "ftmo",
      profitTarget: { value: 10, unit: "%", absolute: 5000 },
      ...
    }
    {
      firm: "topstep",
      profitTarget: { value: 3000, unit: "$", percentage: 6 },
      ...
    }

┌──────────────────────────────────────────────────────┐
│  STEP 3: Build Comparison Matrix                     │
└──────────────────────────────────────────────────────┘
  Create table structure:

  Criteria        │ FTMO        │ MFF         │ TopStep
  ────────────────┼─────────────┼─────────────┼───────────
  Profit Target   │ 10% ($5k)   │ 8% ($4k)    │ $3k (6%)
  Phase 1 DD      │ 5% ($2.5k)  │ 5% ($2.5k)  │ $2k (4%)
  Total DD        │ 10% ($5k)   │ 12% ($6k)   │ $2.5k (5%)
  Min Days        │ 4 days      │ 5 days      │ 5 days
  Fee             │ €345        │ $299        │ $165
  Refundable      │ Yes         │ Yes         │ No
  Profit Split    │ 80-90%      │ 80-90%      │ 90%

┌──────────────────────────────────────────────────────┐
│  STEP 4: Calculate Scores                            │
└──────────────────────────────────────────────────────┘
  Scoring algorithm:

  difficulty_score = (
    profit_target_pct * 2 +
    (100 - max_loss_pct) * 1.5 +
    min_trading_days * 0.5
  )

  value_score = (
    profit_split_avg +
    (fee_refundable ? 10 : 0) -
    (fee_amount / 10)
  )

  Results:
    FTMO:     difficulty=45, value=72
    MFF:      difficulty=38, value=75
    TopStep:  difficulty=30, value=65

┌──────────────────────────────────────────────────────┐
│  STEP 5: Rank & Recommend                            │
└──────────────────────────────────────────────────────┘
  Easiest:     TopStep (lowest difficulty score)
  Best Value:  MFF (highest value score)
  Most Strict: FTMO (highest difficulty score)

  Recommendation:
    "For a $50k account, TopStep has the easiest profit
     targets but non-refundable fee. MFF offers best
     overall value with refundable fee and lower targets."
```

---

## Summary

This architecture provides:

1. **GitHub as Source of Truth** - Transparent, versioned, community-friendly
2. **Supabase for Performance** - Fast queries, user features, real-time updates
3. **Hybrid Sync Strategy** - One-way sync from GitHub to DB
4. **Multi-layer Caching** - Static generation, ISR, client cache
5. **Robust Validation** - Pre-commit, PR checks, post-merge verification
6. **Intelligent Comparison** - Normalized data, scored ranking, AI insights

All components work together to deliver a fast, reliable, and transparent prop firm directory.
