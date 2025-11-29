# Technical Design Document: Prop Firm Directory Database Schema

**Version:** 1.0
**Date:** 2025-11-28
**Author:** Tech Lead Agent
**Project:** Prop Firm Directory (claude-wall)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Requirements Analysis](#requirements-analysis)
3. [Data Storage Strategy Recommendation](#data-storage-strategy-recommendation)
4. [Database Schema Design](#database-schema-design)
5. [Example Data Structures](#example-data-structures)
6. [Migration Strategy](#migration-strategy)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Appendices](#appendices)

---

## 1. Executive Summary

### Key Decisions

**Storage Solution:** **Hybrid Approach - GitHub as Primary Database with Supabase for Metadata**

**Rationale:**
- Prop firm rules stored in GitHub (JSON files) for community contribution workflow
- Supabase stores metadata, indexes, user interactions, and computed data
- Best of both worlds: transparency + performance

**Schema Flexibility:** Entity-Attribute-Value (EAV) hybrid pattern for rules to handle maximum variation across firms

**Data Versioning:** Git-native versioning for rules, timestamp-based snapshots for historical tracking

---

## 2. Requirements Analysis

### 2.1 Core Entities

Based on the documentation review, the system must track:

1. **Prop Firms** - Company information, contact, reputation
2. **Challenge Types** - 1-step, 2-step, 3-step, instant funding
3. **Account Configurations** - Different sizes and risk profiles
4. **Rules** - Highly variable across firms, challenge types, and account sizes
5. **Discounts** - Time-limited promotional offers
6. **Payouts** - Community-submitted payout proofs
7. **News/Updates** - Auto-generated change notifications
8. **History** - Version tracking for all rule changes

### 2.2 Rule Complexity Analysis

From research, rules vary across THREE dimensions:

1. **By Firm** - Each firm has unique base rules
2. **By Challenge Type** - Same firm, different challenge models
3. **By Account Configuration** - Same challenge type, different sizes/risk levels

**Examples of Rule Variations:**

**FTMO:**
- Standard Account: 10% profit target (Challenge), 5% daily loss, 10% max loss
- Aggressive Account: 20% profit target (Challenge), 10% daily loss, 20% max loss
- Swing Account: Different holding requirements

**MyForexFunds:**
- Phase 1: 8% profit target, 5% daily DD, 12% max DD
- Phase 2: 5% profit target, same DD limits

**TTT Markets:**
- Instant Funding: 12% profit for scaling
- Regular Challenge: Different targets

### 2.3 Key Use Cases

1. **Directory Viewing** - Browse all firms with summary stats
2. **Detailed Comparison** - Compare up to 5 firms side-by-side
3. **Rule Change Detection** - Automated diff detection and news generation
4. **Community Contribution** - Submit updates via GitHub PR
5. **Search & Filter** - Find firms by specific criteria
6. **Historical Analysis** - Track how rules evolved over time
7. **Payout Transparency** - View verified payouts by firm

---

## 3. Data Storage Strategy Recommendation

### 3.1 Recommended Approach: Hybrid Storage

#### GitHub (Primary) - Rule Data

**What to Store:**
```
/data/firms/{firm-slug}/
  ├── firm.json              # Firm metadata
  ├── rules.json             # Current rules configuration
  ├── discounts.json         # Active discounts
  ├── payouts.json           # Community payouts
  └── history/
      ├── 2025-01-15.json    # Historical snapshot
      └── 2025-02-20.json
```

**Advantages:**
- Native versioning via Git (complete audit trail)
- Community contribution workflow (PR-based)
- Transparent review process
- Free storage
- Easy rollback/diff
- Human-readable format
- Works well with Next.js static generation

**Disadvantages:**
- Not ideal for complex queries
- Slower for real-time filtering
- No relational integrity enforcement
- Limited to file-based operations

#### Supabase (Secondary) - Metadata & Computed Data

**What to Store:**
- Firm index/search metadata
- User accounts and favorites
- Computed comparison matrices
- News/changelog entries
- Payout verification status
- Search indexes
- Analytics events

**Advantages:**
- Fast queries and filtering
- Real-time subscriptions
- User authentication
- Relational data integrity
- Built-in RLS (Row Level Security)
- Great for user-specific data

**Disadvantages:**
- Not transparent for community review
- Costs scale with usage
- Requires migration for schema changes

### 3.2 Comparison Matrix

| Criteria | GitHub Only | Supabase Only | Hybrid (Recommended) |
|----------|-------------|---------------|---------------------|
| Community Workflow | ★★★★★ | ★☆☆☆☆ | ★★★★★ |
| Version Control | ★★★★★ | ★★☆☆☆ | ★★★★★ |
| Query Performance | ★★☆☆☆ | ★★★★★ | ★★★★☆ |
| Transparency | ★★★★★ | ★★☆☆☆ | ★★★★★ |
| User Features | ★☆☆☆☆ | ★★★★★ | ★★★★★ |
| Cost | ★★★★★ | ★★★☆☆ | ★★★★☆ |
| Complexity | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ |
| Schema Validation | ★★☆☆☆ | ★★★★★ | ★★★★☆ |

### 3.3 Implementation Strategy

**Phase 1 (MVP):** GitHub-only for rules
- Rapid development
- Zero infrastructure cost
- Focus on content quality

**Phase 2 (Growth):** Add Supabase layer
- User accounts
- Favorites/watchlists
- Search indexes
- Payout verification

**Sync Strategy:**
- GitHub Actions trigger on merge
- Sync script updates Supabase indexes
- Supabase never writes to GitHub (one-way sync)

---

## 4. Database Schema Design

### 4.1 GitHub JSON Schema

#### 4.1.1 Firm Metadata (`firm.json`)

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "firmId": "ftmo",
  "name": "FTMO",
  "slug": "ftmo",
  "status": "active",
  "metadata": {
    "website": "https://ftmo.com",
    "country": "Czech Republic",
    "founded": 2015,
    "logo": "/logos/ftmo.png",
    "description": "FTMO is one of the largest prop trading firms...",
    "trustpilot": {
      "rating": 4.5,
      "reviewCount": 12500,
      "url": "https://trustpilot.com/review/ftmo.com"
    },
    "social": {
      "twitter": "@FTMO_com",
      "discord": "https://discord.gg/ftmo",
      "youtube": "https://youtube.com/@ftmo"
    }
  },
  "features": {
    "platforms": ["MetaTrader 4", "MetaTrader 5", "cTrader"],
    "instruments": ["Forex", "Indices", "Commodities", "Crypto"],
    "maxCapital": 2000000,
    "minCapital": 10000,
    "profitSplit": {
      "min": 80,
      "max": 90
    }
  },
  "updatedAt": "2025-01-28T10:30:00Z",
  "updatedBy": "community",
  "verified": true
}
```

#### 4.1.2 Rules Configuration (`rules.json`)

This is the most critical schema. It uses **inheritance with selective overrides** to minimize duplication and maximize maintainability.

**Inheritance Hierarchy:**
```
globalRules (base layer - applies to ALL)
  ↓
challengeType.ruleOverrides (optional - overrides for this challenge type)
  ↓
accountConfiguration.ruleOverrides (optional - overrides for this account size)
  ↓
phase.ruleOverrides (most specific - overrides for this phase)
  ↓
fundedAccountRules (final state)
```

**Resolution Order:** Most specific wins (phase > account > challenge type > global)

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "firmId": "ftmo",
  "version": "2.1.0",
  "effectiveDate": "2025-01-01T00:00:00Z",

  "globalRules": {
    "description": "Base rules that apply to ALL challenges and funded accounts unless overridden",
    "maxDailyLoss": {
      "type": "percentage",
      "value": 5,
      "description": "5% maximum daily loss",
      "calculationBase": "balance",
      "calculationType": "balance_based"
    },
    "maxTotalLoss": {
      "type": "percentage",
      "value": 10,
      "description": "10% maximum overall loss",
      "calculationBase": "initial_balance",
      "calculationType": "balance_based"
    },
    "minTradingDays": {
      "type": "integer",
      "value": 4,
      "description": "Minimum 4 trading days"
    },
    "maxTradingDays": {
      "type": "integer",
      "value": null,
      "description": "No time limit"
    },
    "weekendHolding": {
      "allowed": true,
      "description": "Weekend holding allowed"
    },
    "newsTrading": {
      "allowed": true,
      "restrictions": []
    },
    "expertAdvisors": {
      "allowed": true,
      "restrictions": ["No high-frequency scalping"]
    },
    "copyTrading": {
      "allowed": false
    },
    "trading": {
      "hedging": true,
      "martingale": false,
      "tickScalping": false
    },
    "compliance": {
      "kycRequired": true,
      "regions": {
        "allowed": ["worldwide"],
        "restricted": ["USA", "Canada", "Iran", "North Korea"]
      }
    }
  },

  "challengeTypes": [
    {
      "id": "ftmo-standard",
      "name": "Standard Challenge",
      "type": "2-step",
      "description": "Traditional two-phase evaluation",

      "ruleOverrides": {},

      "accountConfigurations": [
        {
          "id": "ftmo-standard-10k",
          "accountSize": 10000,
          "currency": "USD",
          "fee": {
            "amount": 155,
            "currency": "EUR",
            "refundable": true,
            "refundConditions": "Upon receiving first profit split"
          },

          "ruleOverrides": {},

          "phases": [
            {
              "phaseNumber": 1,
              "name": "FTMO Challenge",
              "ruleOverrides": {
                "profitTarget": {
                  "type": "percentage",
                  "value": 10,
                  "description": "10% profit target",
                  "calculationBase": "initial_balance"
                }
              }
            },
            {
              "phaseNumber": 2,
              "name": "FTMO Verification",
              "ruleOverrides": {
                "profitTarget": {
                  "type": "percentage",
                  "value": 5,
                  "description": "5% profit target"
                }
              }
            }
          ],

          "fundedAccountRules": {
            "profitSplit": {
              "initial": 80,
              "scaled": 90,
              "scalingCondition": "After first withdrawal"
            },
            "withdrawalSchedule": {
              "frequency": "bi-weekly",
              "minDays": 14,
              "description": "Withdrawals every 14 days"
            },
            "scaling": {
              "enabled": true,
              "maxSize": 400000,
              "conditions": [
                {
                  "threshold": "10% profit + withdrawal",
                  "action": "Can add another account",
                  "maxCombinedSize": 400000
                }
              ]
            }
          }
        },
        {
          "id": "ftmo-standard-25k",
          "accountSize": 25000,
          "currency": "USD",
          "fee": {
            "amount": 250,
            "currency": "EUR",
            "refundable": true
          },

          "ruleOverrides": {},

          "phases": [
            {
              "phaseNumber": 1,
              "name": "FTMO Challenge",
              "ruleOverrides": {
                "profitTarget": {
                  "type": "percentage",
                  "value": 10
                }
              }
            },
            {
              "phaseNumber": 2,
              "name": "FTMO Verification",
              "ruleOverrides": {
                "profitTarget": {
                  "type": "percentage",
                  "value": 5
                }
              }
            }
          ],

          "fundedAccountRules": {
            "profitSplit": {
              "initial": 80,
              "scaled": 90
            },
            "scaling": {
              "enabled": true,
              "maxSize": 400000
            }
          }
        }
      ]
    },

    {
      "id": "ftmo-aggressive",
      "name": "Aggressive Challenge",
      "type": "2-step",
      "description": "Higher targets and limits for aggressive traders",

      "ruleOverrides": {
        "maxDailyLoss": {
          "type": "percentage",
          "value": 10,
          "description": "10% maximum daily loss - aggressive"
        },
        "maxTotalLoss": {
          "type": "percentage",
          "value": 20,
          "description": "20% maximum overall loss"
        }
      },

      "accountConfigurations": [
        {
          "id": "ftmo-aggressive-10k",
          "accountSize": 10000,
          "currency": "USD",
          "fee": {
            "amount": 250,
            "currency": "EUR",
            "refundable": true
          },

          "ruleOverrides": {},

          "phases": [
            {
              "phaseNumber": 1,
              "name": "FTMO Challenge",
              "ruleOverrides": {
                "profitTarget": {
                  "type": "percentage",
                  "value": 20,
                  "description": "20% profit target - aggressive"
                }
              }
            },
            {
              "phaseNumber": 2,
              "name": "FTMO Verification",
              "ruleOverrides": {
                "profitTarget": {
                  "type": "percentage",
                  "value": 10,
                  "description": "10% profit target"
                }
              }
            }
          ],

          "fundedAccountRules": {
            "profitSplit": {
              "initial": 80,
              "scaled": 90
            },
            "scaling": {
              "enabled": true,
              "maxSize": 200000,
              "description": "Capped at 200K due to higher risk"
            }
          }
        }
      ]
    },

    {
      "id": "ftmo-swing",
      "name": "Swing Challenge",
      "type": "2-step",
      "description": "For swing traders with longer holding periods",

      "ruleOverrides": {
        "maxDailyLoss": {
          "calculationBase": "equity",
          "calculationType": "equity_based",
          "description": "Equity-based for swing traders"
        },
        "maxTotalLoss": {
          "calculationBase": "equity"
        },
        "weekendHolding": {
          "allowed": true,
          "required": true,
          "description": "Must hold positions over weekends"
        }
      },

      "accountConfigurations": [
        {
          "id": "ftmo-swing-10k",
          "accountSize": 10000,
          "currency": "USD",
          "fee": {
            "amount": 155,
            "currency": "EUR",
            "refundable": true
          },

          "ruleOverrides": {},

          "phases": [
            {
              "phaseNumber": 1,
              "name": "Swing Challenge",
              "ruleOverrides": {
                "profitTarget": {
                  "type": "percentage",
                  "value": 10
                }
              }
            }
          ]
        }
      ]
    }
  ],

  "metadata": {
    "lastUpdated": "2025-01-28T10:30:00Z",
    "updatedBy": "ftmo-official",
    "changeLog": "Updated to inheritance-based schema v2.1.0",
    "source": "https://ftmo.com/en/challenge-rules/",
    "verified": true,
    "verifiedBy": "admin",
    "verifiedDate": "2025-01-28T12:00:00Z"
  }
}
```

**Key Benefits of Inheritance Approach:**

1. **Reduced Duplication:** Common rules (maxDailyLoss: 5%, minTradingDays: 4) defined once in `globalRules`
2. **Clearer Intent:** Override = "this is different/special for this challenge/phase"
3. **Easier Maintenance:** Update a rule once, affects all challenges (unless overridden)
4. **Smaller Files:** ~60% reduction in JSON size for firms with uniform rules
5. **Flexible Overrides:** Can override at any level (challenge type, account size, or phase)

**Resolution Logic Example:**

```javascript
function resolveRules(global, challengeType, accountConfig, phase) {
  // Start with global rules
  let resolved = { ...global };

  // Apply challenge type overrides
  if (challengeType?.ruleOverrides) {
    resolved = deepMerge(resolved, challengeType.ruleOverrides);
  }

  // Apply account configuration overrides
  if (accountConfig?.ruleOverrides) {
    resolved = deepMerge(resolved, accountConfig.ruleOverrides);
  }

  // Apply phase-specific overrides (most specific wins)
  if (phase?.ruleOverrides) {
    resolved = deepMerge(resolved, phase.ruleOverrides);
  }

  return resolved;
}

// Usage:
const phase1Rules = resolveRules(
  globalRules,
  challengeTypes[0],           // ftmo-standard
  accountConfigurations[0],    // 10k account
  phases[0]                     // Phase 1
);

// Result: { maxDailyLoss: 5%, profitTarget: 10%, minTradingDays: 4, ... }
```

#### 4.1.3 Discounts (`discounts.json`)

```json
{
  "firmId": "ftmo",
  "activeDiscounts": [
    {
      "id": "ftmo-black-friday-2025",
      "name": "Black Friday 2025",
      "code": "BLACKFRIDAY25",
      "description": "25% off all challenge fees",
      "discountType": "percentage",
      "discountValue": 25,
      "applicableTo": {
        "challengeTypes": ["all"],
        "accountSizes": ["all"],
        "newUsersOnly": false
      },
      "validFrom": "2025-11-25T00:00:00Z",
      "validUntil": "2025-11-30T23:59:59Z",
      "active": true,
      "url": "https://ftmo.com/en/blackfriday",
      "addedBy": "community",
      "addedDate": "2025-11-20T10:00:00Z",
      "verified": true
    }
  ]
}
```

#### 4.1.4 Payouts (`payouts.json`)

```json
{
  "firmId": "ftmo",
  "payouts": [
    {
      "id": "payout-001",
      "submittedBy": "user-hash-abc123",
      "submittedDate": "2025-01-15T14:30:00Z",
      "accountSize": 100000,
      "profitAmount": 8500,
      "currency": "USD",
      "payoutDate": "2025-01-10T00:00:00Z",
      "tradingPeriod": {
        "start": "2024-12-01",
        "end": "2025-01-10"
      },
      "evidence": {
        "imageUrl": "/payouts/ftmo/payout-001-proof.png",
        "imageHash": "sha256:abc123...",
        "blurred": true,
        "description": "Screenshot of withdrawal confirmation"
      },
      "verification": {
        "status": "verified",
        "verifiedBy": "admin",
        "verifiedDate": "2025-01-16T09:00:00Z",
        "notes": "Verified via email confirmation"
      },
      "metadata": {
        "platform": "MetaTrader 5",
        "strategy": "Swing Trading",
        "challengeType": "ftmo-standard"
      }
    }
  ],
  "statistics": {
    "totalPayouts": 1,
    "totalAmount": 8500,
    "averageAmount": 8500,
    "largestPayout": 8500,
    "lastUpdated": "2025-01-16T09:00:00Z"
  }
}
```

#### 4.1.5 History Snapshots (`history/YYYY-MM-DD.json`)

```json
{
  "snapshotDate": "2025-01-15T00:00:00Z",
  "firmId": "ftmo",
  "type": "rule_change",
  "previousVersion": "2.0.0",
  "newVersion": "2.1.0",
  "changes": [
    {
      "path": "challengeTypes[0].accountConfigurations[0].phases[0].rules.profitTarget.value",
      "oldValue": 8,
      "newValue": 10,
      "changeType": "increased",
      "impact": "significant",
      "description": "Profit target increased from 8% to 10%"
    }
  ],
  "summary": "FTMO increased profit targets for standard challenges",
  "aiGeneratedSummary": "FTMO has made their standard challenge more challenging by increasing the Phase 1 profit target from 8% to 10%. This affects all account sizes in the standard challenge type.",
  "impactedAccounts": ["ftmo-standard-10k", "ftmo-standard-25k", "ftmo-standard-50k"],
  "newsPost": {
    "generated": true,
    "slug": "2025-01-15-ftmo-increases-profit-targets",
    "published": true
  }
}
```

### 4.2 Supabase Schema (Relational Database)

For performance, search, and user features, we use Supabase as a secondary layer.

#### 4.2.1 Table: `firms`

```sql
CREATE TABLE firms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id TEXT UNIQUE NOT NULL,          -- matches GitHub folder name
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active, inactive, suspended
  website TEXT,
  country TEXT,
  founded INTEGER,
  logo_url TEXT,
  description TEXT,
  trustpilot_rating DECIMAL(2,1),
  trustpilot_reviews INTEGER,
  max_capital BIGINT,
  min_capital BIGINT,
  profit_split_min INTEGER,
  profit_split_max INTEGER,
  verified BOOLEAN DEFAULT false,
  github_path TEXT NOT NULL,             -- /data/firms/{firm-slug}
  rules_version TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_firms_slug ON firms(slug);
CREATE INDEX idx_firms_status ON firms(status);
CREATE INDEX idx_firms_verified ON firms(verified);
```

#### 4.2.2 Table: `challenge_types`

```sql
CREATE TABLE challenge_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  challenge_id TEXT NOT NULL,            -- e.g., "ftmo-standard"
  name TEXT NOT NULL,
  type TEXT NOT NULL,                    -- "1-step", "2-step", "instant"
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(firm_id, challenge_id)
);

CREATE INDEX idx_challenge_types_firm ON challenge_types(firm_id);
CREATE INDEX idx_challenge_types_type ON challenge_types(type);
```

#### 4.2.3 Table: `account_configurations`

```sql
CREATE TABLE account_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_type_id UUID REFERENCES challenge_types(id) ON DELETE CASCADE,
  config_id TEXT NOT NULL,               -- e.g., "ftmo-standard-10k"
  account_size BIGINT NOT NULL,
  currency TEXT DEFAULT 'USD',
  fee_amount DECIMAL(10,2),
  fee_currency TEXT,
  fee_refundable BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(challenge_type_id, config_id)
);

CREATE INDEX idx_account_configs_challenge ON account_configurations(challenge_type_id);
CREATE INDEX idx_account_configs_size ON account_configurations(account_size);
```

#### 4.2.4 Table: `rule_index`

```sql
-- Denormalized table for fast queries and comparisons
CREATE TABLE rule_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  challenge_type_id UUID REFERENCES challenge_types(id) ON DELETE CASCADE,
  account_config_id UUID REFERENCES account_configurations(id) ON DELETE CASCADE,
  phase_number INTEGER,

  -- Common rule fields (denormalized for fast filtering)
  profit_target_pct DECIMAL(5,2),
  max_daily_loss_pct DECIMAL(5,2),
  max_total_loss_pct DECIMAL(5,2),
  daily_loss_type TEXT,                  -- "balance", "equity"
  min_trading_days INTEGER,
  max_trading_days INTEGER,
  weekend_holding BOOLEAN,
  news_trading BOOLEAN,
  expert_advisors BOOLEAN,

  -- JSON for flexibility (full rule details)
  rules_json JSONB NOT NULL,

  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rule_index_firm ON rule_index(firm_id);
CREATE INDEX idx_rule_index_profit_target ON rule_index(profit_target_pct);
CREATE INDEX idx_rule_index_max_loss ON rule_index(max_total_loss_pct);
CREATE INDEX idx_rule_index_rules_json ON rule_index USING GIN(rules_json);
```

#### 4.2.5 Table: `news_posts`

```sql
CREATE TABLE news_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,                 -- Markdown content
  change_type TEXT,                      -- "rule_change", "new_discount", "payout"
  published_at TIMESTAMPTZ DEFAULT NOW(),
  github_snapshot_path TEXT,             -- Link to history file
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_news_posts_firm ON news_posts(firm_id);
CREATE INDEX idx_news_posts_published ON news_posts(published_at DESC);
CREATE INDEX idx_news_posts_type ON news_posts(change_type);
```

#### 4.2.6 Table: `discounts`

```sql
CREATE TABLE discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL,           -- "percentage", "fixed"
  discount_value DECIMAL(10,2) NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  url TEXT,
  added_by TEXT,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_discounts_firm ON discounts(firm_id);
CREATE INDEX idx_discounts_active ON discounts(is_active, valid_until);
```

#### 4.2.7 Table: `payouts`

```sql
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  submitted_by UUID,                     -- User ID if authenticated
  account_size BIGINT NOT NULL,
  profit_amount DECIMAL(15,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  payout_date DATE NOT NULL,
  trading_period_start DATE,
  trading_period_end DATE,
  evidence_url TEXT,
  evidence_hash TEXT,
  verification_status TEXT DEFAULT 'pending', -- pending, verified, rejected
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  platform TEXT,
  strategy TEXT,
  challenge_type_id UUID REFERENCES challenge_types(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payouts_firm ON payouts(firm_id);
CREATE INDEX idx_payouts_status ON payouts(verification_status);
CREATE INDEX idx_payouts_date ON payouts(payout_date DESC);
```

#### 4.2.8 Table: `user_favorites`

```sql
CREATE TABLE user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,                 -- From Supabase auth.users
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, firm_id)
);

CREATE INDEX idx_favorites_user ON user_favorites(user_id);
```

#### 4.2.9 Table: `comparison_sessions`

```sql
CREATE TABLE comparison_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,                          -- Optional, null for anonymous
  firm_ids UUID[] NOT NULL,              -- Array of firm IDs being compared
  filters JSONB,                         -- Selected filters/criteria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accessed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comparison_user ON comparison_sessions(user_id);
CREATE INDEX idx_comparison_accessed ON comparison_sessions(accessed_at);
```

---

## 5. Example Data Structures

### 5.1 Simple Firm (MyForexFunds - Uniform Rules)

**Scenario:** Firm with one challenge type, same rules for all account sizes

**Using Inheritance:** Demonstrates how global rules eliminate duplication

```json
{
  "firmId": "myforexfunds",

  "globalRules": {
    "maxDailyLoss": {
      "type": "percentage",
      "value": 5
    },
    "maxTotalLoss": {
      "type": "percentage",
      "value": 12
    },
    "minTradingDays": {
      "type": "integer",
      "value": 4
    },
    "weekendHolding": {
      "allowed": true
    }
  },

  "challengeTypes": [
    {
      "id": "mff-2step",
      "name": "2-Step Challenge",
      "type": "2-step",

      "ruleOverrides": {},

      "accountConfigurations": [
        {
          "id": "mff-2step-10k",
          "accountSize": 10000,
          "fee": { "amount": 99, "currency": "USD" },

          "ruleOverrides": {},

          "phases": [
            {
              "phaseNumber": 1,
              "ruleOverrides": {
                "profitTarget": {
                  "type": "percentage",
                  "value": 8
                }
              }
            },
            {
              "phaseNumber": 2,
              "ruleOverrides": {
                "profitTarget": {
                  "type": "percentage",
                  "value": 5
                }
              }
            }
          ]
        },
        {
          "id": "mff-2step-25k",
          "accountSize": 25000,
          "fee": { "amount": 199, "currency": "USD" },

          "ruleOverrides": {},

          "phases": [
            {
              "phaseNumber": 1,
              "ruleOverrides": {
                "profitTarget": {
                  "type": "percentage",
                  "value": 8
                }
              }
            },
            {
              "phaseNumber": 2,
              "ruleOverrides": {
                "profitTarget": {
                  "type": "percentage",
                  "value": 5
                }
              }
            }
          ]
        }
      ]
    }
  ]
}
```

**Key Point:** Only profit targets need to be specified per phase. All other rules (maxDailyLoss: 5%, maxTotalLoss: 12%, minTradingDays: 4) are inherited from `globalRules`. **~70% reduction in duplication!**

### 5.2 Complex Firm (FTMO - Multiple Challenge Types with Variations)

Already shown in Section 4.1.2 - demonstrates:
- Multiple challenge types (Standard, Aggressive, Swing)
- Different rules per challenge type
- Same challenge type with multiple account sizes
- Phase-specific rules
- Funded account rules

### 5.3 Edge Case: Account Size-Specific Rules

**Scenario:** Same challenge type, but rules differ by account size (TopStep has different min days for larger accounts)

**Using Inheritance:** Global rules set defaults, account-level overrides for size-specific differences

```json
{
  "firmId": "topstep",

  "globalRules": {
    "minTradingDays": {
      "type": "integer",
      "value": 5,
      "description": "Default for most account sizes"
    },
    "maxDailyLoss": {
      "type": "fixed",
      "calculationType": "trailing",
      "description": "Trailing daily loss"
    },
    "maxTotalLoss": {
      "type": "fixed",
      "calculationType": "trailing"
    },
    "weekendHolding": {
      "allowed": true
    }
  },

  "challengeTypes": [
    {
      "id": "topstep-combine",
      "name": "Trading Combine",
      "type": "1-step",

      "ruleOverrides": {},

      "accountConfigurations": [
        {
          "id": "topstep-50k",
          "accountSize": 50000,
          "fee": { "amount": 165, "currency": "USD" },

          "ruleOverrides": {},

          "phases": [
            {
              "phaseNumber": 1,
              "ruleOverrides": {
                "profitTarget": {
                  "type": "fixed",
                  "value": 3000
                },
                "maxDailyLoss": {
                  "value": 2000
                },
                "maxTotalLoss": {
                  "value": 2500
                }
              }
            }
          ]
        },
        {
          "id": "topstep-100k",
          "accountSize": 100000,
          "fee": { "amount": 275, "currency": "USD" },

          "ruleOverrides": {},

          "phases": [
            {
              "phaseNumber": 1,
              "ruleOverrides": {
                "profitTarget": {
                  "type": "fixed",
                  "value": 6000
                },
                "maxDailyLoss": {
                  "value": 4000
                },
                "maxTotalLoss": {
                  "value": 5000
                }
              }
            }
          ]
        },
        {
          "id": "topstep-150k",
          "accountSize": 150000,
          "fee": { "amount": 375, "currency": "USD" },

          "ruleOverrides": {
            "minTradingDays": {
              "type": "integer",
              "value": 7,
              "description": "Larger accounts require more trading days"
            }
          },

          "phases": [
            {
              "phaseNumber": 1,
              "ruleOverrides": {
                "profitTarget": {
                  "type": "fixed",
                  "value": 9000
                },
                "maxDailyLoss": {
                  "value": 6000
                },
                "maxTotalLoss": {
                  "value": 7500
                }
              }
            }
          ]
        }
      ]
    }
  ]
}
```

**Key Point:**
- Global rule: `minTradingDays: 5` applies to 50K and 100K accounts
- Account-level override: 150K account overrides with `minTradingDays: 7`
- Profit targets and loss limits vary by size but inherit the `type: "fixed"` and `calculationType: "trailing"` from global rules
- **Clear semantic meaning:** Only the 150K account is "special" with extra trading days required

### 5.4 Instant Funding (TTT Markets)

**Scenario:** Instant funding (no evaluation phases) - all rules apply to funded account

**Using Inheritance:** Global rules define funded account limits, no phase overrides needed

```json
{
  "firmId": "ttt-markets",

  "globalRules": {
    "maxDailyLoss": {
      "type": "percentage",
      "value": 5
    },
    "maxTotalLoss": {
      "type": "percentage",
      "value": 10
    },
    "weekendHolding": {
      "allowed": true
    },
    "newsTrading": {
      "allowed": true
    }
  },

  "challengeTypes": [
    {
      "id": "ttt-instant",
      "name": "Instant Funding",
      "type": "instant",
      "description": "Instant access to funded account, no evaluation",

      "ruleOverrides": {},

      "accountConfigurations": [
        {
          "id": "ttt-instant-10k",
          "accountSize": 10000,
          "fee": { "amount": 99, "currency": "USD", "refundable": false },

          "ruleOverrides": {},

          "phases": [],

          "fundedAccountRules": {
            "profitSplit": {
              "initial": 80
            },
            "scaling": {
              "enabled": true,
              "conditions": [
                {
                  "threshold": "12% profit",
                  "action": "Double account size (no cost)",
                  "maxSize": 20000
                }
              ]
            }
          }
        }
      ]
    }
  ]
}
```

**Key Point:**
- Empty `phases` array = instant funding
- Funded account rules inherit `maxDailyLoss: 5%` and `maxTotalLoss: 10%` from global rules
- Only need to specify profit split and scaling logic
- **Scaling is the unique selling point**, not evaluation phases

---

## 6. Migration Strategy

### 6.1 Initial Setup (Sprint 1)

**Week 1:**
1. Create GitHub folder structure
2. Define JSON schemas with examples
3. Setup schema validation (JSON Schema)
4. Create 5 firm profiles manually

**Week 2:**
5. Build Next.js data fetching utilities
6. Create basic UI rendering from JSON
7. Test with real firm data

### 6.2 Phase 2: Supabase Integration (Sprint 4)

**Prerequisites:**
- At least 20 firms in GitHub
- Diff engine working
- News generation functional

**Migration Steps:**

1. **Setup Supabase:**
```sql
-- Run all table creation scripts
-- Enable RLS (Row Level Security)
-- Create indexes
```

2. **Build Sync Script:**
```javascript
// scripts/sync-github-to-supabase.js
// Reads all GitHub JSON files
// Upserts into Supabase tables
// Runs on GitHub Actions after merge
```

3. **Dual-Source Data Fetching:**
```javascript
// lib/data/firms.js
export async function getFirm(slug) {
  // Try Supabase first (fast)
  const dbFirm = await supabase
    .from('firms')
    .select('*')
    .eq('slug', slug)
    .single();

  // Fallback to GitHub if needed
  if (!dbFirm) {
    const githubFirm = await fetchGitHubFirm(slug);
    return githubFirm;
  }

  return dbFirm;
}
```

4. **User Features:**
```sql
-- Enable user accounts
-- Add favorites
-- Add comparison sessions
```

### 6.3 Data Validation Strategy

**Pre-commit Hooks:**
```bash
# .husky/pre-commit
npm run validate-schemas
```

**Validation Script:**
```javascript
// scripts/validate-schemas.js
import Ajv from 'ajv';
import fs from 'fs';

const ajv = new Ajv();
const firmSchema = JSON.parse(fs.readFileSync('./schemas/firm.schema.json'));
const rulesSchema = JSON.parse(fs.readFileSync('./schemas/rules.schema.json'));

// Validate all firm files
const firms = glob.sync('./data/firms/*/firm.json');
firms.forEach(firmFile => {
  const data = JSON.parse(fs.readFileSync(firmFile));
  const valid = ajv.validate(firmSchema, data);
  if (!valid) {
    console.error(`Invalid: ${firmFile}`, ajv.errors);
    process.exit(1);
  }
});
```

**GitHub Actions Workflow:**
```yaml
# .github/workflows/validate-data.yml
name: Validate Firm Data
on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm run validate-schemas
      - run: npm run generate-types
```

---

## 7. Implementation Roadmap

### Sprint 1 (Weeks 1-2): Foundation

**Goals:**
- [x] Define complete JSON schema
- [x] Create folder structure
- [ ] Add 5 firms manually
- [ ] Build basic rendering

**Deliverables:**
- `/data/firms/` structure created
- `/schemas/` with JSON Schema definitions
- Validation scripts working
- 5 firms: FTMO, MyForexFunds, TopStep, FundedNext, The5ers

### Sprint 2 (Weeks 3-4): Directory & UI

**Goals:**
- [ ] Firm list page
- [ ] Firm detail pages
- [ ] Rule viewer component
- [ ] Add 15 more firms (total 20)

**Deliverables:**
- `/app/firms/page.js` - Directory listing
- `/app/firms/[slug]/page.js` - Detail view
- Rule comparison component
- Search & filter functionality

### Sprint 3 (Weeks 5-6): Diff Engine

**Goals:**
- [ ] Build diff detection
- [ ] Auto-generate summaries (AI)
- [ ] Create news posts
- [ ] History tracking

**Deliverables:**
- `scripts/diff-rules.js` - Compares versions
- `scripts/generate-summary.js` - AI summarization
- News board at `/news`
- Automated GitHub Action on merge

### Sprint 4 (Weeks 7-8): Supabase Layer

**Goals:**
- [ ] Setup Supabase tables
- [ ] Build sync script
- [ ] User accounts
- [ ] Favorites/watchlists

**Deliverables:**
- All Supabase tables created
- `scripts/sync-github-to-supabase.js`
- User authentication
- Favorite functionality

### Sprint 5 (Weeks 9-10): Advanced Features

**Goals:**
- [ ] Payout leaderboard
- [ ] Discount tracker
- [ ] Advanced comparison (5 firms)
- [ ] Public API

**Deliverables:**
- `/app/payouts/page.js`
- `/app/discounts/page.js`
- `/app/compare/page.js`
- `/app/api/v1/` endpoints

### Sprint 6 (Weeks 11-12): Polish & Launch

**Goals:**
- [ ] SEO optimization
- [ ] Performance tuning
- [ ] Mobile responsive
- [ ] Community docs

**Deliverables:**
- Complete SEO meta tags
- Lighthouse score > 90
- Mobile-first design
- Contribution guidelines

---

## 8. Appendices

### A. Pros and Cons Summary

#### GitHub-as-Database Pros:
1. **Transparency:** Every change is visible and auditable
2. **Community-Friendly:** PR workflow is familiar to developers
3. **Version Control:** Git provides best-in-class versioning
4. **Free:** No database hosting costs
5. **Portability:** Data is not locked in proprietary format
6. **Review Process:** Changes can be reviewed before merge
7. **Rollback:** Easy to revert bad data
8. **Static Generation:** Perfect for Next.js SSG

#### GitHub-as-Database Cons:
1. **Query Performance:** No SQL-like filtering
2. **No Relational Integrity:** Manual enforcement of relationships
3. **Limited Real-time:** Not suitable for frequent updates
4. **File Size Limits:** Large JSON files can be slow
5. **No Transactions:** Can't update multiple files atomically
6. **Complex Queries:** Requires loading all data into memory

#### Supabase Pros:
1. **Fast Queries:** Indexed, optimized SQL queries
2. **Relational Integrity:** Foreign keys, constraints
3. **Real-time:** Built-in subscriptions
4. **User Features:** Authentication, RLS
5. **Scalability:** Handles large datasets well
6. **Complex Filtering:** Advanced WHERE clauses
7. **Analytics:** Easy aggregations and reporting

#### Supabase Cons:
1. **Opacity:** Changes not visible in GitHub
2. **Cost:** Scales with usage
3. **Lock-in:** Migration requires effort
4. **Schema Changes:** Require migrations
5. **Not Community-Friendly:** No PR workflow for data

### B. Alternative Approaches Considered

#### 1. Supabase-Only (Rejected)

**Reason:** Loses community contribution workflow and transparency. Contributors would need database access, which creates security risks and removes the PR review process.

#### 2. MongoDB + GitHub (Rejected)

**Reason:** Adds unnecessary complexity. MongoDB's document model doesn't provide enough benefit over JSON files for this use case.

#### 3. Notion API (Rejected)

**Reason:** Not open-source, not version-controlled, vendor lock-in, costs scale quickly.

#### 4. Airtable + Sync (Rejected)

**Reason:** Good for non-technical contributors but loses GitHub's version control benefits and adds API complexity.

### C. Schema Evolution Strategy

**Adding New Fields:**
- Add to JSON schema with `required: false`
- Document in changelog
- Existing data remains valid (backward compatible)

**Removing Fields:**
- Mark as deprecated first
- Wait one version
- Remove in major version bump

**Changing Field Types:**
- Create new field with different name
- Migrate data in background
- Deprecate old field
- Remove after migration

**Version Bumping:**
- Major: Breaking changes (field removals, type changes)
- Minor: New optional fields
- Patch: Documentation updates, examples

### D. Query Performance Optimization

**For GitHub JSON:**
1. Use Next.js `getStaticProps` for build-time data fetching
2. Generate static pages for all firms
3. Use Incremental Static Regeneration (ISR) for updates
4. Cache parsed JSON in memory during build

**For Supabase:**
1. Create materialized views for common queries
2. Use database indexes on filter columns
3. Implement caching layer (Redis/Next.js cache)
4. Use database connection pooling

### E. Security Considerations

**GitHub Data:**
- Public repository (read-only)
- PR review required for all changes
- Schema validation prevents malicious data
- GitHub Actions validate before merge

**Supabase:**
- Row Level Security (RLS) enabled
- User data isolated per user
- API keys in environment variables
- Rate limiting on public endpoints

**User Submissions:**
- Payout proofs must be blurred (PII protection)
- Email verification for submissions
- Admin approval required for verification
- Evidence stored with SHA-256 hashes

### F. JSON Schema Files

**Location:** `/schemas/`

**Files to Create:**
- `firm.schema.json` - Firm metadata validation
- `rules.schema.json` - Rules configuration validation
- `discounts.schema.json` - Discount validation
- `payouts.schema.json` - Payout validation
- `history.schema.json` - History snapshot validation

**Example Schema Structure:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://propfirmdirectory.com/schemas/firm.schema.json",
  "title": "Prop Firm Metadata",
  "type": "object",
  "required": ["firmId", "name", "slug", "status"],
  "properties": {
    "firmId": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$",
      "description": "Unique identifier (lowercase, hyphenated)"
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100
    }
  }
}
```

---

## Conclusion

This hybrid approach provides:

1. **Community Transparency** via GitHub PR workflow
2. **Performance** via Supabase indexes
3. **Flexibility** via nested JSON rules structure
4. **Scalability** via denormalized Supabase tables
5. **Maintainability** via JSON Schema validation
6. **Version Control** via Git history

**Recommended Next Steps:**

1. Review this design with stakeholders
2. Create JSON schema files in `/schemas/`
3. Build 5 example firm profiles
4. Implement validation script
5. Build basic Next.js rendering
6. Test with real data
7. Iterate based on learnings

**Success Metrics:**

- [ ] Can represent 20+ diverse prop firms accurately
- [ ] Can handle all rule variations documented
- [ ] Validation catches 95%+ of data errors
- [ ] Contributors can submit PRs without deep technical knowledge
- [ ] Query performance < 100ms for firm listings
- [ ] Can generate diff summaries in < 5 seconds

---

**Document End**
