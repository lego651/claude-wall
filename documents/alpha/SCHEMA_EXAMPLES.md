# Schema Examples and Use Cases

This document provides concrete examples of how different prop firms map to the proposed schema.

---

## Inheritance Pattern Overview

**IMPORTANT:** The schema uses **inheritance with selective overrides** to eliminate duplication and improve maintainability.

### Inheritance Hierarchy

```
globalRules (applies to ALL challenges and funded accounts)
  ↓
challengeType.ruleOverrides (optional - overrides for this challenge type)
  ↓
accountConfiguration.ruleOverrides (optional - overrides for this account size)
  ↓
phase.ruleOverrides (most specific - overrides for this phase)
  ↓
fundedAccountRules (final state)
```

**Resolution Rule:** Most specific wins (phase > account > challenge type > global)

### Quick Example

```json
{
  "globalRules": {
    "maxDailyLoss": { "value": 5 },
    "minTradingDays": { "value": 4 }
  },
  "challengeTypes": [{
    "ruleOverrides": {
      "maxDailyLoss": { "value": 10 }  // Override for aggressive challenge
    },
    "accountConfigurations": [{
      "ruleOverrides": {},  // No account-level overrides
      "phases": [{
        "ruleOverrides": {
          "profitTarget": { "value": 10 }  // Only specify what's different
        }
      }]
    }]
  }]
}

// Resolved Phase 1 rules:
// maxDailyLoss: 10% (from challengeType override)
// minTradingDays: 4 (inherited from global)
// profitTarget: 10% (from phase override)
```

**Benefits:**
- ~60-70% reduction in JSON file size
- Update a rule once, affects all challenges (unless overridden)
- Clear semantic meaning: override = "this is special"
- Easy to spot differences between challenge types

---

## Example 1: FTMO (Multiple Challenge Types + Account Variations)

### Firm Profile (`/data/firms/ftmo/firm.json`)

```json
{
  "firmId": "ftmo",
  "name": "FTMO",
  "slug": "ftmo",
  "status": "active",
  "metadata": {
    "website": "https://ftmo.com",
    "country": "Czech Republic",
    "founded": 2015,
    "logo": "/logos/ftmo.png",
    "description": "FTMO is one of the largest and most established proprietary trading firms in the forex industry, offering traders capital up to $2,000,000.",
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
    "platforms": ["MetaTrader 4", "MetaTrader 5", "cTrader", "DXtrade"],
    "instruments": ["Forex", "Indices", "Commodities", "Crypto"],
    "maxCapital": 2000000,
    "minCapital": 10000,
    "profitSplit": {
      "min": 80,
      "max": 90
    }
  },
  "updatedAt": "2025-01-28T10:30:00Z",
  "updatedBy": "ftmo-official",
  "verified": true
}
```

### Rules Configuration - Using Inheritance Pattern

**Full example showing Standard and Aggressive challenge types:**

```json
{
  "firmId": "ftmo",
  "version": "2.1.0",
  "effectiveDate": "2025-01-01T00:00:00Z",

  "globalRules": {
    "description": "Base rules that apply to ALL FTMO challenges unless overridden",
    "maxDailyLoss": {
      "type": "percentage",
      "value": 5,
      "calculationBase": "balance"
    },
    "maxTotalLoss": {
      "type": "percentage",
      "value": 10,
      "calculationBase": "initial_balance"
    },
    "minTradingDays": {
      "type": "integer",
      "value": 4
    },
    "weekendHolding": {
      "allowed": true
    },
    "newsTrading": {
      "allowed": true
    },
    "expertAdvisors": {
      "allowed": true,
      "restrictions": ["No high-frequency scalping"]
    }
  },

  "challengeTypes": [
    {
      "id": "ftmo-standard",
      "name": "Standard Challenge",
      "type": "2-step",

      "ruleOverrides": {},  // Uses all global rules

      "accountConfigurations": [
        {
          "id": "ftmo-standard-10k",
          "accountSize": 10000,
          "currency": "USD",
          "fee": { "amount": 155, "currency": "EUR", "refundable": true },

          "ruleOverrides": {},  // No account-specific overrides

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
              // maxDailyLoss: 5%, maxTotalLoss: 10%, minTradingDays: 4 inherited
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
          ]
        }
      ]
    },

    {
      "id": "ftmo-aggressive",
      "name": "Aggressive Challenge",
      "type": "2-step",

      "ruleOverrides": {
        // Override global rules for aggressive challenge
        "maxDailyLoss": {
          "value": 10  // 10% instead of 5%
        },
        "maxTotalLoss": {
          "value": 20  // 20% instead of 10%
        }
      },

      "accountConfigurations": [
        {
          "id": "ftmo-aggressive-10k",
          "accountSize": 10000,
          "fee": { "amount": 250, "currency": "EUR" },

          "ruleOverrides": {},

          "phases": [
            {
              "phaseNumber": 1,
              "ruleOverrides": {
                "profitTarget": {
                  "value": 20  // 20% profit target
                }
              }
              // Inherits maxDailyLoss: 10% and maxTotalLoss: 20% from challengeType
            },
            {
              "phaseNumber": 2,
              "ruleOverrides": {
                "profitTarget": {
                  "value": 10
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

**Key Observations:**

1. **Standard Challenge:**
   - No challenge-level or account-level overrides
   - Only specifies profit targets per phase
   - Inherits: maxDailyLoss (5%), maxTotalLoss (10%), minTradingDays (4), weekend holding, news trading, EA rules

2. **Aggressive Challenge:**
   - Challenge-level overrides: maxDailyLoss (10%), maxTotalLoss (20%)
   - Phases only override profit targets
   - Still inherits: minTradingDays (4), weekend holding, news trading, EA rules

3. **File Size Reduction:**
   - Without inheritance: ~200 lines per challenge type
   - With inheritance: ~50 lines per challenge type
   - **75% reduction in duplication!**

---

## Example 2: TopStep (Fixed Dollar Amounts + Account-Level Overrides)

### Rules Configuration - Using Inheritance

**Demonstrates account-level overrides for size-specific minimum trading days:**

```json
{
  "firmId": "topstep",
  "version": "1.0.0",

  "globalRules": {
    "minTradingDays": {
      "type": "integer",
      "value": 5,
      "description": "Default for most account sizes"
    },
    "maxDailyLoss": {
      "type": "fixed",
      "calculationType": "trailing"
    },
    "maxTotalLoss": {
      "type": "fixed",
      "calculationType": "trailing",
      "description": "Trailing based on end-of-day balance"
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
          "currency": "USD",
          "fee": { "amount": 165, "currency": "USD" },

          "ruleOverrides": {},  // Uses global minTradingDays: 5

          "phases": [
            {
              "phaseNumber": 1,
              "name": "Evaluation",
              "ruleOverrides": {
                "profitTarget": {
                  "type": "fixed",
                  "value": 3000,
                  "currency": "USD"
                },
                "maxDailyLoss": {
                  "value": 2000,
                  "currency": "USD"
                },
                "maxTotalLoss": {
                  "value": 2500,
                  "currency": "USD"
                }
              }
              // Inherits: minTradingDays: 5, calculationType: trailing
            }
          ],

          "fundedAccountRules": {
            "profitSplit": {
              "initial": 100,
              "description": "First $10k is 100% yours",
              "afterThreshold": {
                "threshold": 10000,
                "split": 90
              }
            }
          }
        },

        {
          "id": "topstep-150k",
          "accountSize": 150000,
          "currency": "USD",
          "fee": { "amount": 375, "currency": "USD" },

          "ruleOverrides": {
            // ACCOUNT-LEVEL OVERRIDE: Larger accounts need more trading days
            "minTradingDays": {
              "value": 7,
              "description": "Larger accounts require 7 minimum trading days"
            }
          },

          "phases": [
            {
              "phaseNumber": 1,
              "ruleOverrides": {
                "profitTarget": {
                  "value": 9000,
                  "currency": "USD"
                },
                "maxDailyLoss": {
                  "value": 6000
                },
                "maxTotalLoss": {
                  "value": 7500
                }
              }
              // Inherits: minTradingDays: 7 (from account-level override!)
            }
          ]
        }
      ]
    }
  ]
}
```

**Key Observations:**

1. **Global Rules Define:**
   - Default minTradingDays: 5 (used by 50K account)
   - Calculation type: "trailing" for both daily and total loss
   - Weekend holding allowed

2. **Account-Level Override:**
   - 150K account overrides minTradingDays to 7
   - This shows the power of account-level overrides for size-specific rules

3. **Phase-Level Overrides:**
   - Only specify profit targets and loss amounts (vary by account size)
   - Inherit calculation type from global rules

4. **Unique TopStep Features:**
   - Uses `fixed` amounts instead of percentages
   - Trailing drawdown (end-of-day balance based)
   - Tiered profit split (100% first $10k, then 90%)

5. **File Size:**
   - Without inheritance: Would repeat "minTradingDays: 5" across 50K, 100K accounts
   - With inheritance: Specify once in global, override only for 150K
   - **Clear semantic intent:** "150K account is special"

---

## Example 3: TTT Markets (Instant Funding)

### Rules Configuration

```json
{
  "firmId": "ttt-markets",
  "version": "1.0.0",
  "challengeTypes": [
    {
      "id": "ttt-instant",
      "name": "Instant Funding",
      "type": "instant",
      "description": "Get funded immediately, no evaluation needed",
      "accountConfigurations": [
        {
          "id": "ttt-instant-10k",
          "accountSize": 10000,
          "currency": "USD",
          "fee": { "amount": 199, "currency": "USD", "refundable": false },
          "phases": [],
          "fundedAccountRules": {
            "profitSplit": {
              "initial": 80,
              "scaled": 80,
              "description": "80% profit split at all levels"
            },
            "maxDailyLoss": { "type": "percentage", "value": 5 },
            "maxTotalLoss": { "type": "percentage", "value": 10 },
            "scaling": {
              "enabled": true,
              "automatic": true,
              "conditions": [
                {
                  "threshold": "12% profit",
                  "action": "Double account size",
                  "cost": 0,
                  "maxSize": 20000,
                  "description": "Hit 12% profit to double from $10k to $20k at no extra cost"
                },
                {
                  "threshold": "12% profit on $20k account",
                  "action": "Increase to $40k",
                  "cost": 0,
                  "maxSize": 40000
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

**Key Differences:**
- No phases (instant funding)
- Automatic scaling based on profit milestones
- All rules are in `fundedAccountRules`

---

## Example 4: Simple Firm (Uniform Rules)

### Example: FundedNext

```json
{
  "firmId": "fundednext",
  "version": "1.0.0",
  "challengeTypes": [
    {
      "id": "fundednext-express",
      "name": "Express Model",
      "type": "2-step",
      "accountConfigurations": [
        {
          "id": "fundednext-express-5k",
          "accountSize": 5000,
          "fee": { "amount": 49, "currency": "USD", "refundable": true },
          "phases": [
            { "phaseNumber": 1, "rules": { "profitTarget": { "value": 10 } } },
            { "phaseNumber": 2, "rules": { "profitTarget": { "value": 5 } } }
          ]
        },
        {
          "id": "fundednext-express-15k",
          "accountSize": 15000,
          "fee": { "amount": 99, "currency": "USD", "refundable": true },
          "phases": [
            { "phaseNumber": 1, "rules": { "profitTarget": { "value": 10 } } },
            { "phaseNumber": 2, "rules": { "profitTarget": { "value": 5 } } }
          ]
        }
      ]
    }
  ],
  "globalRules": {
    "description": "These rules apply to all challenges",
    "trading": {
      "maxDailyLoss": { "type": "percentage", "value": 5 },
      "maxTotalLoss": { "type": "percentage", "value": 10 },
      "minTradingDays": { "value": 3 }
    }
  }
}
```

**Key Differences:**
- Uniform rules across all account sizes
- Uses `globalRules` to avoid repetition
- Minimal configuration per account size

---

## Example 5: Complex Rules (Alpha Capital Group - 3-Step)

```json
{
  "firmId": "alpha-capital",
  "version": "1.0.0",
  "challengeTypes": [
    {
      "id": "alpha-3step",
      "name": "3-Step Challenge",
      "type": "3-step",
      "accountConfigurations": [
        {
          "id": "alpha-3step-25k",
          "accountSize": 25000,
          "phases": [
            {
              "phaseNumber": 0,
              "name": "Phase 0 - Low Risk",
              "rules": {
                "profitTarget": { "value": 4, "description": "4% profit target" },
                "maxDailyLoss": { "value": 3, "description": "3% daily loss" },
                "maxTotalLoss": { "value": 6 },
                "riskRequirement": {
                  "description": "Must maintain lower risk profile",
                  "maxRiskPerTrade": 1,
                  "emphasis": "consistency"
                }
              }
            },
            {
              "phaseNumber": 1,
              "name": "Phase 1",
              "rules": {
                "profitTarget": { "value": 8 },
                "maxDailyLoss": { "value": 4 },
                "maxTotalLoss": { "value": 8 }
              }
            },
            {
              "phaseNumber": 2,
              "name": "Phase 2",
              "rules": {
                "profitTarget": { "value": 5 },
                "maxDailyLoss": { "value": 4 },
                "maxTotalLoss": { "value": 8 }
              }
            }
          ]
        }
      ]
    }
  ]
}
```

**Key Differences:**
- 3 phases instead of 2
- Phase 0 has unique risk management requirements
- Progressive difficulty

---

## Example 6: Payout Submission

### Verified Payout

```json
{
  "id": "payout-ftmo-001",
  "submittedBy": "user-hash-abc123",
  "submittedDate": "2025-01-15T14:30:00Z",
  "accountSize": 100000,
  "profitAmount": 8500,
  "currency": "USD",
  "payoutDate": "2025-01-10T00:00:00Z",
  "tradingPeriod": {
    "start": "2024-12-01",
    "end": "2025-01-10",
    "days": 41
  },
  "evidence": {
    "imageUrl": "/payouts/ftmo/payout-001-proof.png",
    "imageHash": "sha256:abc123def456...",
    "blurred": true,
    "description": "Screenshot of withdrawal confirmation email with personal details redacted"
  },
  "verification": {
    "status": "verified",
    "verifiedBy": "admin-user-xyz",
    "verifiedDate": "2025-01-16T09:00:00Z",
    "verificationMethod": "email_confirmation",
    "notes": "User provided original unblurred screenshot via secure channel for verification"
  },
  "metadata": {
    "platform": "MetaTrader 5",
    "strategy": "Swing Trading",
    "instruments": ["EUR/USD", "GBP/USD", "Gold"],
    "challengeType": "ftmo-standard",
    "accountConfig": "ftmo-standard-100k"
  }
}
```

---

## Example 7: Discount

### Black Friday Discount

```json
{
  "id": "ftmo-bf-2025",
  "name": "Black Friday 2025",
  "code": "BLACKFRIDAY25",
  "description": "25% off all challenge fees for Black Friday weekend",
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
  "termsAndConditions": [
    "Discount applies to new challenge purchases only",
    "Not combinable with other offers",
    "Refund policy still applies"
  ],
  "addedBy": "community-user-123",
  "addedDate": "2025-11-20T10:00:00Z",
  "verified": true,
  "verifiedBy": "admin",
  "verifiedDate": "2025-11-20T15:00:00Z"
}
```

---

## Example 8: History Snapshot (Rule Change)

### FTMO Rule Change - January 2025

```json
{
  "snapshotDate": "2025-01-15T00:00:00Z",
  "firmId": "ftmo",
  "type": "rule_change",
  "previousVersion": "2.0.0",
  "newVersion": "2.1.0",
  "changes": [
    {
      "path": "challengeTypes[id=ftmo-standard].accountConfigurations[id=ftmo-standard-10k].phases[0].rules.profitTarget.value",
      "oldValue": 8,
      "newValue": 10,
      "changeType": "increased",
      "impact": "significant",
      "description": "Phase 1 profit target increased from 8% to 10%",
      "affectedAccountSizes": [10000, 25000, 50000, 100000, 200000]
    },
    {
      "path": "challengeTypes[id=ftmo-standard].accountConfigurations[id=ftmo-standard-10k].fee.amount",
      "oldValue": 145,
      "newValue": 155,
      "changeType": "increased",
      "impact": "moderate",
      "description": "Challenge fee increased from €145 to €155"
    }
  ],
  "summary": "FTMO increased profit targets and fees for standard challenges",
  "aiGeneratedSummary": {
    "headline": "FTMO Makes Standard Challenge More Difficult",
    "content": "On January 15, 2025, FTMO updated their Standard Challenge rules, making it more challenging for traders. The Phase 1 profit target increased from 8% to 10%, meaning traders now need to achieve higher returns to progress. Additionally, the challenge fee increased from €145 to €155 for the $10K account. These changes affect all Standard Challenge account sizes.",
    "tradingImpact": "Traders will need to adjust their strategies to hit the higher 10% profit target while maintaining the same 5% daily and 10% total loss limits.",
    "sentiment": "negative_for_traders"
  },
  "impactedAccounts": [
    "ftmo-standard-10k",
    "ftmo-standard-25k",
    "ftmo-standard-50k",
    "ftmo-standard-100k",
    "ftmo-standard-200k"
  ],
  "newsPost": {
    "generated": true,
    "slug": "2025-01-15-ftmo-increases-profit-targets",
    "title": "FTMO Increases Standard Challenge Profit Target to 10%",
    "published": true,
    "publishedAt": "2025-01-15T12:00:00Z"
  },
  "communityReaction": {
    "upvotes": 45,
    "downvotes": 12,
    "comments": 23
  }
}
```

---

## Example 9: Comparison Query

### User Comparing 3 Firms

**Request:**
```json
{
  "firms": ["ftmo", "myforexfunds", "topstep"],
  "filters": {
    "accountSize": 50000,
    "challengeType": "2-step"
  },
  "criteria": [
    "profitTarget",
    "maxDailyLoss",
    "maxTotalLoss",
    "fee",
    "profitSplit",
    "minTradingDays"
  ]
}
```

**Response (Computed):**
```json
{
  "comparison": [
    {
      "firm": "ftmo",
      "challengeType": "ftmo-standard",
      "accountConfig": "ftmo-standard-50k",
      "fee": { "amount": 345, "currency": "EUR", "refundable": true },
      "phase1": {
        "profitTarget": "10%",
        "maxDailyLoss": "5%",
        "maxTotalLoss": "10%",
        "minTradingDays": 4
      },
      "phase2": {
        "profitTarget": "5%",
        "maxDailyLoss": "5%",
        "maxTotalLoss": "10%",
        "minTradingDays": 4
      },
      "profitSplit": "80-90%",
      "totalTarget": "15%",
      "difficulty": "moderate"
    },
    {
      "firm": "myforexfunds",
      "challengeType": "mff-2step",
      "accountConfig": "mff-2step-50k",
      "fee": { "amount": 299, "currency": "USD", "refundable": true },
      "phase1": {
        "profitTarget": "8%",
        "maxDailyLoss": "5%",
        "maxTotalLoss": "12%",
        "minTradingDays": 5
      },
      "phase2": {
        "profitTarget": "5%",
        "maxDailyLoss": "5%",
        "maxTotalLoss": "12%",
        "minTradingDays": 5
      },
      "profitSplit": "80-90%",
      "totalTarget": "13%",
      "difficulty": "easier"
    },
    {
      "firm": "topstep",
      "challengeType": "topstep-combine",
      "accountConfig": "topstep-50k",
      "fee": { "amount": 165, "currency": "USD", "refundable": false },
      "phase1": {
        "profitTarget": "$3,000",
        "maxDailyLoss": "$2,000",
        "maxTotalLoss": "$2,500 (trailing)",
        "minTradingDays": 5
      },
      "profitSplit": "100% first $10k, then 90%",
      "totalTarget": "6%",
      "difficulty": "easiest"
    }
  ],
  "summary": {
    "lowestFee": "topstep",
    "highestProfitSplit": "topstep",
    "easiestProfitTarget": "topstep",
    "mostGenerous": "topstep",
    "mostStrictRules": "ftmo"
  }
}
```

---

## Example 10: Edge Cases

### Case A: Weekend Holding Requirement

```json
{
  "rules": {
    "weekendHolding": {
      "allowed": true,
      "required": false,
      "description": "Allowed but not required"
    }
  }
}
```

vs.

```json
{
  "rules": {
    "weekendHolding": {
      "allowed": true,
      "required": true,
      "minimumPositions": 1,
      "description": "Must hold at least 1 position over weekend for swing accounts"
    }
  }
}
```

### Case B: News Trading Restrictions

```json
{
  "rules": {
    "newsTrading": {
      "allowed": true,
      "restrictions": [
        {
          "type": "time_restriction",
          "description": "No trading 2 minutes before and after high-impact news",
          "events": ["NFP", "FOMC", "CPI"]
        }
      ]
    }
  }
}
```

### Case C: Copy Trading

```json
{
  "rules": {
    "copyTrading": {
      "allowed": true,
      "restrictions": [
        {
          "type": "signal_provider_verification",
          "description": "Must use approved signal providers",
          "approvedProviders": ["MQL5 Signals"]
        }
      ]
    }
  }
}
```

### Case D: Account-Specific Instrument Restrictions

```json
{
  "accountConfigurations": [
    {
      "id": "ftmo-standard-200k",
      "accountSize": 200000,
      "rules": {
        "instrumentRestrictions": {
          "crypto": {
            "allowed": true,
            "maxPositionSize": "5%",
            "description": "Crypto limited to 5% of account on large accounts"
          }
        }
      }
    }
  ]
}
```

---

## Summary

The schema successfully handles:

1. **Multiple challenge types per firm** (FTMO: Standard, Aggressive, Swing)
2. **Different rule structures** (Percentage vs. Fixed Dollar)
3. **Account size variations** (Same rules vs. different rules)
4. **Phase flexibility** (1-step, 2-step, 3-step, instant)
5. **Complex conditions** (Scaling, tiered profit splits, trailing drawdowns)
6. **Edge cases** (Weekend requirements, news restrictions, copy trading)

The key to this flexibility is:
- Nested structure (Firm → Challenge Type → Account Config → Phases → Rules)
- Typed fields with descriptive metadata
- JSON structure allows for arbitrary rule complexity
- Global rules for shared properties
- Extensible without breaking existing data
