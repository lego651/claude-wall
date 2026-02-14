# Schema Quick Reference Guide

A condensed reference for the database schema and JSON structure.

---

## File Structure

```
/data/firms/{firm-slug}/
  ├── firm.json          # Required - Firm metadata
  ├── rules.json         # Required - Rules configuration
  ├── discounts.json     # Optional - Active discounts
  ├── payouts.json       # Optional - Community payouts
  └── history/           # Auto-generated - Snapshots
      └── YYYY-MM-DD.json
```

---

## firm.json Template

```json
{
  "firmId": "example-firm",
  "name": "Example Prop Firm",
  "slug": "example-firm",
  "status": "active",
  "metadata": {
    "website": "https://example.com",
    "country": "United States",
    "founded": 2020,
    "logo": "/logos/example-firm.png",
    "description": "Brief description (max 500 chars)",
    "trustpilot": {
      "rating": 4.5,
      "reviewCount": 1000,
      "url": "https://trustpilot.com/review/example.com"
    },
    "social": {
      "twitter": "@example",
      "discord": "https://discord.gg/example",
      "youtube": "https://youtube.com/@example"
    }
  },
  "features": {
    "platforms": ["MetaTrader 4", "MetaTrader 5"],
    "instruments": ["Forex", "Indices", "Commodities"],
    "maxCapital": 200000,
    "minCapital": 5000,
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

---

## rules.json Template

**IMPORTANT:** The schema uses **inheritance with selective overrides** to minimize duplication.

### Inheritance Hierarchy

```
globalRules (base - applies to all)
  ↓
challengeType.ruleOverrides (overrides for this challenge type)
  ↓
accountConfiguration.ruleOverrides (overrides for this account size)
  ↓
phase.ruleOverrides (most specific - wins!)
```

### Minimal Example (Using Inheritance Pattern)

```json
{
  "firmId": "example-firm",
  "version": "1.0.0",
  "effectiveDate": "2025-01-01T00:00:00Z",

  "globalRules": {
    "description": "Base rules that apply to ALL challenges and phases",
    "maxDailyLoss": {
      "type": "percentage",
      "value": 5,
      "calculationBase": "balance"
    },
    "maxTotalLoss": {
      "type": "percentage",
      "value": 10
    },
    "minTradingDays": {
      "type": "integer",
      "value": 5
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
      "id": "example-2step",
      "name": "2-Step Challenge",
      "type": "2-step",
      "description": "Traditional two-phase evaluation",

      "ruleOverrides": {},  // No challenge-level overrides

      "accountConfigurations": [
        {
          "id": "example-2step-10k",
          "accountSize": 10000,
          "currency": "USD",
          "fee": {
            "amount": 99,
            "currency": "USD",
            "refundable": true
          },

          "ruleOverrides": {},  // No account-level overrides

          "phases": [
            {
              "phaseNumber": 1,
              "name": "Phase 1",
              "ruleOverrides": {
                "profitTarget": {
                  "type": "percentage",
                  "value": 10
                }
              }
              // Inherits: maxDailyLoss: 5%, maxTotalLoss: 10%, minTradingDays: 5
            },
            {
              "phaseNumber": 2,
              "name": "Phase 2",
              "ruleOverrides": {
                "profitTarget": {
                  "type": "percentage",
                  "value": 5
                }
              }
              // Also inherits global rules
            }
          ],

          "fundedAccountRules": {
            "profitSplit": {
              "initial": 80,
              "scaled": 90
            },
            "withdrawalSchedule": {
              "frequency": "bi-weekly",
              "minDays": 14
            }
            // Also inherits maxDailyLoss and maxTotalLoss from global
          }
        }
      ]
    }
  ]
}
```

**Key Benefits:**
- **~70% less duplication** - Common rules defined once in `globalRules`
- **Clearer intent** - Overrides clearly show what's different
- **Easier maintenance** - Update a rule once, affects all unless overridden

### Example with Challenge-Level Override

```json
{
  "globalRules": {
    "maxDailyLoss": { "value": 5 },
    "maxTotalLoss": { "value": 10 }
  },
  "challengeTypes": [
    {
      "id": "aggressive-challenge",
      "name": "Aggressive Challenge",

      "ruleOverrides": {
        // Override global rules for this challenge type
        "maxDailyLoss": { "value": 10 },  // 10% instead of 5%
        "maxTotalLoss": { "value": 20 }   // 20% instead of 10%
      },

      "accountConfigurations": [{
        "ruleOverrides": {},
        "phases": [{
          "ruleOverrides": {
            "profitTarget": { "value": 20 }  // Only specify profit target
          }
          // Inherits maxDailyLoss: 10% and maxTotalLoss: 20% from challengeType
        }]
      }]
    }
  ]
}
```

### Example with Account-Level Override

```json
{
  "globalRules": {
    "minTradingDays": { "value": 5 }
  },
  "challengeTypes": [{
    "ruleOverrides": {},
    "accountConfigurations": [
      {
        "accountSize": 50000,
        "ruleOverrides": {}  // Uses global minTradingDays: 5
      },
      {
        "accountSize": 150000,
        "ruleOverrides": {
          // Larger accounts require more trading days
          "minTradingDays": { "value": 7 }
        }
      }
    ]
  }]
}
```

---

## Common Rule Fields

### Profit Target

```json
"profitTarget": {
  "type": "percentage",     // or "fixed_amount"
  "value": 10,              // 10% or $1000
  "currency": "USD",        // if fixed_amount
  "description": "10% profit target",
  "calculationBase": "initial_balance"  // or "current_balance"
}
```

### Drawdown Rules

```json
"maxDailyLoss": {
  "type": "percentage",
  "value": 5,
  "description": "5% maximum daily loss",
  "calculationBase": "balance",      // or "equity"
  "calculationType": "balance_based"  // or "equity_based", "trailing"
}
```

### Trading Days

```json
"minTradingDays": { "value": 5, "description": "Minimum 5 trading days" },
"maxTradingDays": { "value": 30, "description": "Maximum 30 days" }
```

### Weekend Holding

```json
"weekendHolding": {
  "allowed": true,
  "required": false,
  "description": "Weekend holding allowed but not required"
}
```

---

## Challenge Type Variations

### 1-Step Challenge

```json
{
  "type": "1-step",
  "phases": [
    {
      "phaseNumber": 1,
      "name": "Evaluation",
      "rules": { ... }
    }
  ]
}
```

### 2-Step Challenge

```json
{
  "type": "2-step",
  "phases": [
    { "phaseNumber": 1, "name": "Challenge", "rules": { ... } },
    { "phaseNumber": 2, "name": "Verification", "rules": { ... } }
  ]
}
```

### Instant Funding

```json
{
  "type": "instant",
  "phases": [],
  "fundedAccountRules": {
    "profitSplit": { "initial": 80 },
    "maxDailyLoss": { "value": 5 },
    "scaling": {
      "enabled": true,
      "conditions": [
        {
          "threshold": "12% profit",
          "action": "Double account size",
          "cost": 0
        }
      ]
    }
  }
}
```

---

## Field Types Reference

### Required Fields

**firm.json:**
- `firmId` (string, lowercase-hyphenated)
- `name` (string)
- `slug` (string, lowercase-hyphenated)
- `status` ("active" | "inactive" | "suspended")
- `metadata.website` (URL string)
- `metadata.country` (string)

**rules.json:**
- `firmId` (string, must match firm.json)
- `version` (string, semver format "1.0.0")
- `challengeTypes` (array, min 1 item)
- `challengeTypes[].id` (string, unique)
- `challengeTypes[].name` (string)
- `challengeTypes[].type` ("1-step" | "2-step" | "3-step" | "instant")
- `challengeTypes[].accountConfigurations` (array)

### Optional Fields

- `metadata.founded` (integer, year)
- `metadata.logo` (string, path)
- `metadata.description` (string, max 500 chars)
- `metadata.trustpilot` (object)
- `metadata.social` (object)
- `features` (object)
- `globalRules` (object)

---

## Validation Rules

### Business Logic

1. **Profit targets must be positive:** `profitTarget.value > 0`
2. **Daily loss < Total loss:** `maxDailyLoss.value < maxTotalLoss.value`
3. **Min days ≤ Max days:** `minTradingDays ≤ maxTradingDays`
4. **Account size minimum:** `accountSize >= 1000`
5. **Valid dates:** `effectiveDate` must be ISO 8601 format

### Data Types

- **firmId, slug:** `/^[a-z0-9-]+$/` (lowercase, numbers, hyphens)
- **version:** `/^\d+\.\d+\.\d+$/` (semantic versioning)
- **URLs:** Must start with `http://` or `https://`
- **Dates:** ISO 8601 format `YYYY-MM-DDTHH:MM:SSZ`
- **Currency codes:** ISO 4217 (USD, EUR, GBP)

---

## Supabase Tables Reference

### firms

```sql
id UUID PRIMARY KEY
firm_id TEXT UNIQUE NOT NULL
slug TEXT UNIQUE NOT NULL
name TEXT NOT NULL
status TEXT NOT NULL DEFAULT 'active'
website TEXT
country TEXT
verified BOOLEAN DEFAULT false
last_synced_at TIMESTAMPTZ
```

### challenge_types

```sql
id UUID PRIMARY KEY
firm_id UUID REFERENCES firms(id)
challenge_id TEXT NOT NULL
name TEXT NOT NULL
type TEXT NOT NULL  -- 1-step, 2-step, instant
```

### rule_index

```sql
id UUID PRIMARY KEY
firm_id UUID REFERENCES firms(id)
challenge_type_id UUID REFERENCES challenge_types(id)
account_config_id UUID REFERENCES account_configurations(id)
phase_number INTEGER

-- Denormalized for fast queries
profit_target_pct DECIMAL(5,2)
max_daily_loss_pct DECIMAL(5,2)
max_total_loss_pct DECIMAL(5,2)

-- Full rules (JSONB)
rules_json JSONB NOT NULL
```

---

## Common Queries

### Get all active firms

```javascript
const firms = getAllFirms(); // From GitHub

// Or from Supabase
const { data } = await supabase
  .from('firms')
  .select('*')
  .eq('status', 'active')
  .order('name');
```

### Get firm with rules

```javascript
const firm = getFirmData('ftmo'); // Reads both firm.json and rules.json
```

### Compare firms

```sql
SELECT * FROM rule_index
WHERE firm_id IN ('ftmo', 'mff', 'topstep')
  AND account_size = 50000
  AND phase_number = 1
```

### Find firms with low profit targets

```sql
SELECT DISTINCT f.*
FROM firms f
JOIN rule_index r ON f.id = r.firm_id
WHERE r.profit_target_pct <= 8
  AND r.phase_number = 1
```

---

## Example Workflows

### Adding a New Firm

1. Create folder: `mkdir -p data/firms/new-firm/history`
2. Copy template: `cp templates/firm.json data/firms/new-firm/`
3. Edit firm.json and rules.json
4. Validate: `npm run validate`
5. Commit: `git add data/firms/new-firm && git commit -m "Add New Firm"`
6. Create PR

### Updating Rules

1. Edit: `data/firms/ftmo/rules.json`
2. Bump version: `"version": "2.1.0"` → `"version": "2.2.0"`
3. Update `effectiveDate`
4. Validate: `npm run validate`
5. Commit and create PR

### Detecting Changes

```bash
# GitHub Action runs automatically on merge
npm run diff
# Creates: data/firms/ftmo/history/2025-01-28.json
# Creates: news/2025-01-28-ftmo-rule-change.md
```

---

## Error Messages

### Common Validation Errors

**Invalid firmId format:**
```
Error: firmId must be lowercase with hyphens only
Example: "ftmo" not "FTMO" or "ftmo_firm"
```

**Missing required field:**
```
Error: Missing required field 'metadata.website'
File: data/firms/example/firm.json
```

**Invalid version format:**
```
Error: Version must follow semver (e.g., "1.0.0")
Found: "1.0" (invalid)
```

**Schema mismatch:**
```
Error: challengeTypes must be an array
File: data/firms/example/rules.json
Path: challengeTypes
```

---

## Tips & Best Practices

1. **Use descriptive IDs:** `ftmo-standard-10k` not `ftmo-s-10`
2. **Always bump version:** Even for small changes
3. **Add descriptions:** Help users understand rules
4. **Test locally:** Run `npm run validate` before committing
5. **Keep history:** Never delete history snapshots
6. **Verify data:** Cross-reference with firm's official website
7. **Blurred screenshots:** Always blur PII in payout proofs
8. **Consistent formatting:** Use 2-space indentation in JSON

---

## Next Steps

- Read [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) for setup
- See [SCHEMA_EXAMPLES.md](SCHEMA_EXAMPLES.md) for real examples
- Review [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md) for complete specs

---

**Version:** 1.0
**Last Updated:** 2025-11-28
