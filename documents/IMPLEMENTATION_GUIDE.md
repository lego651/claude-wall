# Implementation Guide: Step-by-Step

This document provides actionable steps to implement the database schema and data architecture.

---

## Phase 1: Foundation (Week 1-2)

### Step 1.1: Create Directory Structure

```bash
# Create data directories
mkdir -p data/firms
mkdir -p schemas
mkdir -p scripts

# Create first firm folder as example
mkdir -p data/firms/ftmo/history
```

### Step 1.2: Define JSON Schemas

**File: `/schemas/firm.schema.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://propfirmdirectory.com/schemas/firm.schema.json",
  "title": "Prop Firm Metadata",
  "type": "object",
  "required": ["firmId", "name", "slug", "status", "metadata"],
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
    },
    "slug": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$"
    },
    "status": {
      "type": "string",
      "enum": ["active", "inactive", "suspended"]
    },
    "metadata": {
      "type": "object",
      "required": ["website", "country"],
      "properties": {
        "website": {
          "type": "string",
          "format": "uri"
        },
        "country": {
          "type": "string"
        },
        "founded": {
          "type": "integer",
          "minimum": 2000,
          "maximum": 2030
        },
        "logo": {
          "type": "string"
        },
        "description": {
          "type": "string",
          "maxLength": 500
        }
      }
    },
    "features": {
      "type": "object",
      "properties": {
        "platforms": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "instruments": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "maxCapital": {
          "type": "integer"
        },
        "minCapital": {
          "type": "integer"
        }
      }
    },
    "updatedAt": {
      "type": "string",
      "format": "date-time"
    },
    "verified": {
      "type": "boolean"
    }
  }
}
```

**File: `/schemas/rules.schema.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://propfirmdirectory.com/schemas/rules.schema.json",
  "title": "Prop Firm Rules Configuration",
  "type": "object",
  "required": ["firmId", "version", "challengeTypes"],
  "properties": {
    "firmId": {
      "type": "string"
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "effectiveDate": {
      "type": "string",
      "format": "date-time"
    },
    "challengeTypes": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "name", "type", "accountConfigurations"],
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "type": {
            "type": "string",
            "enum": ["1-step", "2-step", "3-step", "instant"]
          },
          "accountConfigurations": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["id", "accountSize", "currency"],
              "properties": {
                "id": {
                  "type": "string"
                },
                "accountSize": {
                  "type": "integer",
                  "minimum": 1000
                },
                "currency": {
                  "type": "string",
                  "enum": ["USD", "EUR", "GBP"]
                },
                "fee": {
                  "type": "object",
                  "properties": {
                    "amount": {
                      "type": "number"
                    },
                    "currency": {
                      "type": "string"
                    },
                    "refundable": {
                      "type": "boolean"
                    }
                  }
                },
                "phases": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "phaseNumber": {
                        "type": "integer"
                      },
                      "name": {
                        "type": "string"
                      },
                      "rules": {
                        "type": "object"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### Step 1.3: Create Validation Script

**File: `/scripts/validate-schemas.js`**

```javascript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

// Load schemas
const firmSchema = JSON.parse(
  fs.readFileSync('./schemas/firm.schema.json', 'utf8')
);
const rulesSchema = JSON.parse(
  fs.readFileSync('./schemas/rules.schema.json', 'utf8')
);

const validateFirm = ajv.compile(firmSchema);
const validateRules = ajv.compile(rulesSchema);

let hasErrors = false;

// Validate all firm.json files
console.log('Validating firm metadata files...');
const firmFiles = glob.sync('./data/firms/*/firm.json');

firmFiles.forEach((firmFile) => {
  const data = JSON.parse(fs.readFileSync(firmFile, 'utf8'));
  const valid = validateFirm(data);

  if (!valid) {
    console.error(`\n❌ Invalid: ${firmFile}`);
    console.error(validateFirm.errors);
    hasErrors = true;
  } else {
    console.log(`✅ Valid: ${firmFile}`);
  }
});

// Validate all rules.json files
console.log('\nValidating rules files...');
const rulesFiles = glob.sync('./data/firms/*/rules.json');

rulesFiles.forEach((rulesFile) => {
  const data = JSON.parse(fs.readFileSync(rulesFile, 'utf8'));
  const valid = validateRules(data);

  if (!valid) {
    console.error(`\n❌ Invalid: ${rulesFile}`);
    console.error(validateRules.errors);
    hasErrors = true;
  } else {
    console.log(`✅ Valid: ${rulesFile}`);
  }
});

if (hasErrors) {
  console.error('\n❌ Validation failed!');
  process.exit(1);
} else {
  console.log('\n✅ All files are valid!');
  process.exit(0);
}
```

**Add to `package.json`:**

```json
{
  "scripts": {
    "validate": "node scripts/validate-schemas.js",
    "validate:watch": "nodemon --watch data --exec npm run validate"
  },
  "devDependencies": {
    "ajv": "^8.12.0",
    "ajv-formats": "^2.1.1",
    "glob": "^10.3.10"
  }
}
```

### Step 1.4: Create First Firm Profile

**File: `/data/firms/ftmo/firm.json`**

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
    "description": "FTMO is one of the largest proprietary trading firms offering funded trading accounts up to $2,000,000."
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
  "verified": true
}
```

**File: `/data/firms/ftmo/rules.json`**

(Use the comprehensive example from TECHNICAL_DESIGN.md Section 4.1.2)

### Step 1.5: Test Validation

```bash
npm install
npm run validate
```

Expected output:
```
✅ Valid: ./data/firms/ftmo/firm.json
✅ Valid: ./data/firms/ftmo/rules.json
✅ All files are valid!
```

---

## Phase 2: Next.js Integration (Week 2-3)

### Step 2.1: Create Data Utilities

**File: `/libs/data/firms.js`**

```javascript
import fs from 'fs';
import path from 'path';

const FIRMS_DIR = path.join(process.cwd(), 'data/firms');

export function getAllFirmSlugs() {
  return fs.readdirSync(FIRMS_DIR);
}

export function getFirmData(slug) {
  const firmDir = path.join(FIRMS_DIR, slug);

  const firm = JSON.parse(
    fs.readFileSync(path.join(firmDir, 'firm.json'), 'utf8')
  );

  const rules = JSON.parse(
    fs.readFileSync(path.join(firmDir, 'rules.json'), 'utf8')
  );

  return {
    ...firm,
    rules,
  };
}

export function getAllFirms() {
  const slugs = getAllFirmSlugs();

  return slugs.map((slug) => {
    const firm = JSON.parse(
      fs.readFileSync(path.join(FIRMS_DIR, slug, 'firm.json'), 'utf8')
    );
    return {
      slug,
      ...firm,
    };
  }).filter(firm => firm.status === 'active');
}
```

### Step 2.1b: Rule Inheritance Resolution

**IMPORTANT:** Since we're using inheritance with selective overrides, we need a utility function to resolve the final rules for any phase.

**File: `/libs/data/resolveRules.js`**

```javascript
/**
 * Deep merge utility - merges objects recursively
 * Later objects override earlier objects
 */
function deepMerge(target, ...sources) {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) {
          Object.assign(target, { [key]: {} });
        }
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}

function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Resolves final rules for a specific phase by applying inheritance hierarchy
 *
 * Hierarchy (most specific wins):
 * globalRules → challengeType.ruleOverrides → accountConfig.ruleOverrides → phase.ruleOverrides
 *
 * @param {Object} globalRules - Base rules that apply to all
 * @param {Object} challengeType - Challenge type object with optional ruleOverrides
 * @param {Object} accountConfig - Account configuration with optional ruleOverrides
 * @param {Object} phase - Phase object with ruleOverrides
 * @returns {Object} Resolved rules for this phase
 */
export function resolvePhaseRules(globalRules, challengeType, accountConfig, phase) {
  // Start with global rules (base layer)
  let resolved = { ...globalRules };

  // Apply challenge type overrides
  if (challengeType?.ruleOverrides) {
    resolved = deepMerge(resolved, challengeType.ruleOverrides);
  }

  // Apply account configuration overrides
  if (accountConfig?.ruleOverrides) {
    resolved = deepMerge(resolved, accountConfig.ruleOverrides);
  }

  // Apply phase-specific overrides (most specific, wins!)
  if (phase?.ruleOverrides) {
    resolved = deepMerge(resolved, phase.ruleOverrides);
  }

  return resolved;
}

/**
 * Resolves funded account rules
 * Funded account rules inherit from global but not from phases
 */
export function resolveFundedAccountRules(globalRules, challengeType, accountConfig, fundedAccountRules) {
  // Start with global rules
  let resolved = { ...globalRules };

  // Apply challenge type overrides
  if (challengeType?.ruleOverrides) {
    resolved = deepMerge(resolved, challengeType.ruleOverrides);
  }

  // Apply account configuration overrides
  if (accountConfig?.ruleOverrides) {
    resolved = deepMerge(resolved, accountConfig.ruleOverrides);
  }

  // Merge funded account specific rules (profit split, scaling, etc.)
  if (fundedAccountRules) {
    resolved = deepMerge(resolved, fundedAccountRules);
  }

  return resolved;
}

/**
 * Enriches firm data with resolved rules for easy access
 * Adds a `resolvedRules` property to each phase and fundedAccountRules
 */
export function enrichFirmWithResolvedRules(firmData) {
  const { rules } = firmData;
  const globalRules = rules.globalRules || {};

  // Clone the rules to avoid mutation
  const enrichedRules = JSON.parse(JSON.stringify(rules));

  enrichedRules.challengeTypes.forEach((challengeType) => {
    challengeType.accountConfigurations.forEach((accountConfig) => {
      // Resolve rules for each phase
      accountConfig.phases.forEach((phase) => {
        phase.resolvedRules = resolvePhaseRules(
          globalRules,
          challengeType,
          accountConfig,
          phase
        );
      });

      // Resolve funded account rules
      if (accountConfig.fundedAccountRules) {
        accountConfig.fundedAccountRules.resolvedRules = resolveFundedAccountRules(
          globalRules,
          challengeType,
          accountConfig,
          accountConfig.fundedAccountRules
        );
      }
    });
  });

  return {
    ...firmData,
    rules: enrichedRules,
  };
}

// Example usage:
// const firmData = getFirmData('ftmo');
// const enriched = enrichFirmWithResolvedRules(firmData);
//
// // Access resolved rules:
// const phase1Rules = enriched.rules.challengeTypes[0]
//   .accountConfigurations[0]
//   .phases[0]
//   .resolvedRules;
//
// console.log(phase1Rules.maxDailyLoss); // { type: "percentage", value: 5 }
// console.log(phase1Rules.profitTarget);  // { type: "percentage", value: 10 }
```

**Update `/libs/data/firms.js` to use enrichment:**

```javascript
import fs from 'fs';
import path from 'path';
import { enrichFirmWithResolvedRules } from './resolveRules.js';

const FIRMS_DIR = path.join(process.cwd(), 'data/firms');

export function getAllFirmSlugs() {
  return fs.readdirSync(FIRMS_DIR);
}

export function getFirmData(slug) {
  const firmDir = path.join(FIRMS_DIR, slug);

  const firm = JSON.parse(
    fs.readFileSync(path.join(firmDir, 'firm.json'), 'utf8')
  );

  const rules = JSON.parse(
    fs.readFileSync(path.join(firmDir, 'rules.json'), 'utf8')
  );

  const firmData = {
    ...firm,
    rules,
  };

  // Enrich with resolved rules
  return enrichFirmWithResolvedRules(firmData);
}

export function getAllFirms() {
  const slugs = getAllFirmSlugs();

  return slugs.map((slug) => {
    const firm = JSON.parse(
      fs.readFileSync(path.join(FIRMS_DIR, slug, 'firm.json'), 'utf8')
    );
    return {
      slug,
      ...firm,
    };
  }).filter(firm => firm.status === 'active');
}
```

**Key Benefits:**

1. **Automatic Resolution:** Pages don't need to manually merge rules
2. **Access Pattern:** `phase.resolvedRules.maxDailyLoss` gives you the final value
3. **Preserves Original:** Still have access to `phase.ruleOverrides` for diff tracking
4. **Performance:** Resolution happens once during data fetch, not on every render

**Testing the resolver:**

```javascript
// Example test
const ftmoData = getFirmData('ftmo');
const standardChallenge = ftmoData.rules.challengeTypes.find(c => c.id === 'ftmo-standard');
const account10k = standardChallenge.accountConfigurations.find(a => a.accountSize === 10000);
const phase1 = account10k.phases[0];

console.log('Phase 1 Resolved Rules:', phase1.resolvedRules);
// Expected output:
// {
//   maxDailyLoss: { type: "percentage", value: 5 },  // from global
//   maxTotalLoss: { type: "percentage", value: 10 }, // from global
//   minTradingDays: { type: "integer", value: 4 },   // from global
//   profitTarget: { type: "percentage", value: 10 }, // from phase override
//   weekendHolding: { allowed: true },                // from global
//   newsTrading: { allowed: true },                   // from global
//   ...
// }
```

### Step 2.2: Create Firm Pages

**File: `/app/firms/page.js`**

```javascript
import { getAllFirms } from '@/lib/data/firms';
import Link from 'next/link';

export default function FirmsDirectory() {
  const firms = getAllFirms();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Prop Firm Directory</h1>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {firms.map((firm) => (
          <Link
            key={firm.slug}
            href={`/firms/${firm.slug}`}
            className="card card-border p-6 hover:shadow-lg transition"
          >
            <h2 className="text-2xl font-bold mb-2">{firm.name}</h2>
            <p className="text-sm opacity-70 mb-4">
              {firm.metadata.country} • {firm.metadata.founded}
            </p>
            <p className="line-clamp-2">{firm.metadata.description}</p>

            <div className="mt-4 flex gap-2">
              <span className="badge badge-primary">
                {firm.features.minCapital / 1000}K - {firm.features.maxCapital / 1000}K
              </span>
              <span className="badge badge-secondary">
                {firm.features.profitSplit.min}-{firm.features.profitSplit.max}% Split
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

**File: `/app/firms/[slug]/page.js`**

```javascript
import { getFirmData, getAllFirmSlugs } from '@/lib/data/firms';
import { notFound } from 'next/navigation';

export async function generateStaticParams() {
  const slugs = getAllFirmSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default function FirmDetailPage({ params }) {
  const { slug } = params;
  const firm = getFirmData(slug);

  if (!firm) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-5xl font-bold mb-4">{firm.name}</h1>
        <p className="text-xl opacity-80">{firm.metadata.description}</p>
      </div>

      {/* Firm Info */}
      <div className="grid md:grid-cols-2 gap-8 mb-12">
        <div className="card card-border p-6">
          <h3 className="text-2xl font-bold mb-4">Overview</h3>
          <div className="space-y-2">
            <p><strong>Country:</strong> {firm.metadata.country}</p>
            <p><strong>Founded:</strong> {firm.metadata.founded}</p>
            <p><strong>Website:</strong> <a href={firm.metadata.website} className="link">{firm.metadata.website}</a></p>
            <p><strong>Profit Split:</strong> {firm.features.profitSplit.min}-{firm.features.profitSplit.max}%</p>
          </div>
        </div>

        <div className="card card-border p-6">
          <h3 className="text-2xl font-bold mb-4">Trading</h3>
          <div className="space-y-2">
            <p><strong>Platforms:</strong> {firm.features.platforms.join(', ')}</p>
            <p><strong>Instruments:</strong> {firm.features.instruments.join(', ')}</p>
            <p><strong>Capital Range:</strong> ${firm.features.minCapital.toLocaleString()} - ${firm.features.maxCapital.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Challenge Types */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold mb-6">Challenge Types</h2>

        {firm.rules.challengeTypes.map((challenge) => (
          <div key={challenge.id} className="card card-border p-6 mb-6">
            <h3 className="text-2xl font-bold mb-2">{challenge.name}</h3>
            <p className="badge badge-primary mb-4">{challenge.type}</p>
            <p className="mb-4">{challenge.description}</p>

            {/* Account Sizes */}
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>Account Size</th>
                    <th>Fee</th>
                    <th>Phase 1 Target</th>
                    <th>Phase 2 Target</th>
                    <th>Max Daily Loss</th>
                    <th>Max Total Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {challenge.accountConfigurations.map((config) => (
                    <tr key={config.id}>
                      <td>${config.accountSize.toLocaleString()}</td>
                      <td>
                        {config.fee.currency}{config.fee.amount}
                        {config.fee.refundable && <span className="badge badge-sm ml-2">Refundable</span>}
                      </td>
                      {/* Use resolvedRules for final merged rules */}
                      <td>{config.phases[0]?.resolvedRules?.profitTarget?.value}%</td>
                      <td>{config.phases[1]?.resolvedRules?.profitTarget?.value}%</td>
                      <td>{config.phases[0]?.resolvedRules?.maxDailyLoss?.value}%</td>
                      <td>{config.phases[0]?.resolvedRules?.maxTotalLoss?.value}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Step 2.3: Test Pages

```bash
npm run dev
```

Visit:
- `http://localhost:3000/firms` - Directory
- `http://localhost:3000/firms/ftmo` - FTMO detail page

---

## Phase 3: GitHub Actions (Week 3-4)

### Step 3.1: Pre-commit Hook

**File: `.husky/pre-commit`**

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npm run validate
```

Install Husky:

```bash
npm install --save-dev husky
npx husky install
npx husky add .husky/pre-commit "npm run validate"
```

### Step 3.2: PR Validation Workflow

**File: `.github/workflows/validate-pr.yml`**

```yaml
name: Validate Pull Request

on:
  pull_request:
    paths:
      - 'data/firms/**'
      - 'schemas/**'

jobs:
  validate:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Validate JSON schemas
        run: npm run validate

      - name: Check for syntax errors
        run: |
          find data/firms -name "*.json" -exec node -c {} \;

      - name: Build test
        run: npm run build

      - name: Comment on PR
        if: success()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '✅ All validation checks passed!'
            })
```

### Step 3.3: Diff Detection Script

**File: `/scripts/diff-rules.js`**

```javascript
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Get changed files
const changedFiles = execSync('git diff --name-only HEAD~1 HEAD')
  .toString()
  .split('\n')
  .filter(file => file.includes('rules.json'));

changedFiles.forEach((file) => {
  if (!fs.existsSync(file)) return;

  const firmSlug = path.dirname(file).split('/').pop();
  const newRules = JSON.parse(fs.readFileSync(file, 'utf8'));

  // Get old version
  const oldContent = execSync(`git show HEAD~1:${file}`).toString();
  const oldRules = JSON.parse(oldContent);

  // Detect changes
  const changes = detectChanges(oldRules, newRules);

  if (changes.length > 0) {
    // Create history snapshot
    const timestamp = new Date().toISOString().split('T')[0];
    const historyPath = path.join(
      path.dirname(file),
      'history',
      `${timestamp}.json`
    );

    const snapshot = {
      snapshotDate: new Date().toISOString(),
      firmId: firmSlug,
      type: 'rule_change',
      previousVersion: oldRules.version,
      newVersion: newRules.version,
      changes: changes,
      summary: generateSummary(changes),
    };

    fs.writeFileSync(historyPath, JSON.stringify(snapshot, null, 2));

    console.log(`✅ Created history snapshot: ${historyPath}`);
  }
});

function detectChanges(oldRules, newRules) {
  // Simple diff - can be enhanced
  const changes = [];

  // Compare versions
  if (oldRules.version !== newRules.version) {
    changes.push({
      path: 'version',
      oldValue: oldRules.version,
      newValue: newRules.version,
      changeType: 'version_bump',
    });
  }

  // Deep comparison would go here
  // For now, just flag that rules changed

  return changes;
}

function generateSummary(changes) {
  return `${changes.length} rule change(s) detected`;
}
```

---

## Phase 4: Supabase Integration (Week 7-8)

### Step 4.1: Create Supabase Tables

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to project
supabase link --project-ref your-project-ref
```

**File: `/supabase/migrations/001_initial_schema.sql`**

```sql
-- Firms table
CREATE TABLE firms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  website TEXT,
  country TEXT,
  founded INTEGER,
  logo_url TEXT,
  description TEXT,
  max_capital BIGINT,
  min_capital BIGINT,
  profit_split_min INTEGER,
  profit_split_max INTEGER,
  verified BOOLEAN DEFAULT false,
  github_path TEXT NOT NULL,
  rules_version TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_firms_slug ON firms(slug);
CREATE INDEX idx_firms_status ON firms(status);

-- Challenge types table
CREATE TABLE challenge_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  challenge_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(firm_id, challenge_id)
);

CREATE INDEX idx_challenge_types_firm ON challenge_types(firm_id);

-- Run migration
-- supabase db push
```

### Step 4.2: Sync Script

**File: `/scripts/sync-github-to-supabase.js`**

```javascript
import { createClient } from '@supabase/supabase-js';
import { getAllFirms, getFirmData } from '../libs/data/firms.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncAllFirms() {
  const firms = getAllFirms();

  for (const firm of firms) {
    const fullData = getFirmData(firm.slug);

    // Upsert firm
    const { data: firmRecord, error } = await supabase
      .from('firms')
      .upsert({
        firm_id: fullData.firmId,
        slug: fullData.slug,
        name: fullData.name,
        status: fullData.status,
        website: fullData.metadata.website,
        country: fullData.metadata.country,
        founded: fullData.metadata.founded,
        description: fullData.metadata.description,
        max_capital: fullData.features.maxCapital,
        min_capital: fullData.features.minCapital,
        profit_split_min: fullData.features.profitSplit.min,
        profit_split_max: fullData.features.profitSplit.max,
        verified: fullData.verified,
        github_path: `/data/firms/${fullData.slug}`,
        rules_version: fullData.rules.version,
        last_synced_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error(`Error syncing ${firm.slug}:`, error);
      continue;
    }

    console.log(`✅ Synced: ${firm.name}`);

    // Sync challenge types
    for (const challenge of fullData.rules.challengeTypes) {
      await supabase.from('challenge_types').upsert({
        firm_id: firmRecord.id,
        challenge_id: challenge.id,
        name: challenge.name,
        type: challenge.type,
        description: challenge.description,
      });
    }
  }

  console.log('\n✅ Sync complete!');
}

syncAllFirms().catch(console.error);
```

**Add to package.json:**

```json
{
  "scripts": {
    "sync": "node scripts/sync-github-to-supabase.js"
  }
}
```

### Step 4.3: GitHub Action for Auto-Sync

**File: `.github/workflows/sync-on-merge.yml`**

```yaml
name: Sync to Supabase

on:
  push:
    branches:
      - main
    paths:
      - 'data/firms/**'

jobs:
  sync:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Sync to Supabase
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: npm run sync
```

---

## Phase 5: Testing & Deployment

### Step 5.1: Add 5 Firms

Create firm profiles for:
1. FTMO (already done)
2. MyForexFunds
3. TopStep
4. FundedNext
5. The5ers

### Step 5.2: Test Full Workflow

```bash
# 1. Create a new firm in a branch
git checkout -b add-myfundednext

# 2. Add firm files
mkdir -p data/firms/fundednext
# Create firm.json and rules.json

# 3. Validate locally
npm run validate

# 4. Commit and push
git add data/firms/fundednext
git commit -m "Add FundedNext"
git push origin add-fundednext

# 5. Create PR on GitHub
# 6. Wait for validation checks
# 7. Merge PR
# 8. Verify auto-sync ran
```

### Step 5.3: Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

---

## Checklist

- [ ] Directory structure created
- [ ] JSON schemas defined
- [ ] Validation script working
- [ ] First firm (FTMO) added
- [ ] Next.js pages rendering correctly
- [ ] Pre-commit hooks installed
- [ ] GitHub Actions workflows added
- [ ] Supabase tables created
- [ ] Sync script working
- [ ] 5 firms added and validated
- [ ] Deployed to production

---

## Troubleshooting

### Issue: Validation fails

**Solution:**
```bash
# Check JSON syntax
node -c data/firms/ftmo/firm.json

# Verbose validation
npm run validate -- --verbose
```

### Issue: Sync fails

**Solution:**
```bash
# Check environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# Test connection
npm run sync -- --dry-run
```

### Issue: Build fails

**Solution:**
```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build
```

---

## Next Steps

After completing this implementation:

1. **Add more firms** - Target 20 firms for v1
2. **Build comparison feature** - Use Supabase for queries
3. **Add news generation** - Integrate Claude API
4. **Implement search** - Add search UI and filters
5. **Add user accounts** - Supabase Auth
6. **Build payout leaderboard** - Community submissions

Refer to ROADMAP.md for the complete feature timeline.
