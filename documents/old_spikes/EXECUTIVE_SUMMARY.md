# Executive Summary: Database Schema & Architecture

**Project:** Prop Firm Directory
**Date:** 2025-11-28
**Author:** Tech Lead Agent

---

## Overview

This document summarizes the comprehensive database schema and architecture design for the Prop Firm Directory platform. The design supports tracking rules, challenges, discounts, and payouts across multiple proprietary trading firms with maximum flexibility and community contribution workflow.

---

## Key Decision: Hybrid Storage Architecture

### Recommendation: GitHub + Supabase

**GitHub (Primary Storage):**
- Stores all firm data in JSON files
- Version controlled via Git
- Community contribution via Pull Requests
- Transparent and auditable

**Supabase (Secondary Layer):**
- Indexes for fast queries
- User accounts and favorites
- Computed/aggregated data
- Real-time features

**Sync Strategy:** One-way sync from GitHub to Supabase via GitHub Actions

---

## Why This Approach Wins

| Requirement | GitHub | Supabase | Hybrid |
|-------------|--------|----------|--------|
| Community PRs | ✅ Perfect | ❌ No workflow | ✅ Best |
| Version Control | ✅ Git native | ⚠️ Manual | ✅ Best |
| Query Speed | ❌ Slow | ✅ Fast | ✅ Best |
| Transparency | ✅ Public | ⚠️ Limited | ✅ Best |
| User Features | ❌ None | ✅ Full | ✅ Best |
| Cost | ✅ Free | ⚠️ Scales | ✅ Moderate |

**Winner:** Hybrid approach combines the best of both worlds.

---

## Schema Design Philosophy

### Problem Statement

Prop firm rules vary across THREE dimensions:

1. **By Firm** - Each firm is unique
2. **By Challenge Type** - Same firm, different models (1-step, 2-step, instant)
3. **By Account Size** - Same challenge, different sizes have different rules

**Examples:**
- FTMO: Standard (10% target) vs Aggressive (20% target)
- TopStep: $50K account (4 min days) vs $150K account (7 min days)
- TTT Markets: Instant funding (no phases) vs Traditional challenge

### Solution: Inheritance-Based Hierarchical Structure

**Key Innovation:** Rules use **inheritance with selective overrides** to eliminate duplication and maximize maintainability.

```
globalRules (base layer - applies to ALL)
  ↓
challengeType.ruleOverrides (optional)
  ↓
accountConfiguration.ruleOverrides (optional)
  ↓
phase.ruleOverrides (most specific - wins!)
```

**Benefits:**
- **~60-70% reduction in file size** - Common rules defined once
- **Clearer intent** - Override = "this is different/special"
- **Easier maintenance** - Update once, affects all (unless overridden)
- **DRY principle** - Don't repeat yourself

**Example:**

```json
{
  "globalRules": {
    "maxDailyLoss": { "value": 5 },
    "maxTotalLoss": { "value": 10 },
    "minTradingDays": { "value": 4 }
  },
  "challengeTypes": [{
    "id": "aggressive",
    "ruleOverrides": {
      "maxDailyLoss": { "value": 10 }  // Override for aggressive
    },
    "phases": [{
      "ruleOverrides": {
        "profitTarget": { "value": 20 }  // Only specify target
      }
      // Inherits: maxDailyLoss: 10%, maxTotalLoss: 10%, minTradingDays: 4
    }]
  }]
}
```

This structure handles:
- ✅ Multiple challenge types per firm
- ✅ Different rules per account size
- ✅ Multi-phase evaluations
- ✅ Instant funding (zero phases)
- ✅ Complex scaling logic
- ✅ Edge cases (trailing drawdown, tiered splits)
- ✅ **Minimal duplication** (NEW!)

---

## Data Structure Overview

### GitHub JSON Files

```
/data/firms/{firm-slug}/
  ├── firm.json          # Company metadata
  ├── rules.json         # Complete rules configuration
  ├── discounts.json     # Active discounts
  ├── payouts.json       # Community-submitted payouts
  └── history/
      ├── 2025-01-15.json # Historical snapshot
      └── 2025-02-20.json
```

**Key Features:**
- Human-readable JSON
- JSON Schema validation
- Git-based versioning
- Community editable

### Supabase Tables

**Core Tables:**
1. `firms` - Firm index and metadata
2. `challenge_types` - Challenge models per firm
3. `account_configurations` - Account sizes and fees
4. `rule_index` - Denormalized rules for fast queries
5. `news_posts` - Auto-generated change notifications
6. `discounts` - Time-limited offers
7. `payouts` - Verified community payouts
8. `user_favorites` - User watchlists

**Benefits:**
- Indexed queries (< 100ms)
- Relational integrity
- Real-time subscriptions
- User authentication

---

## Community Contribution Workflow

```
1. User forks repo
2. Edits JSON files
3. Creates Pull Request
   ↓
4. GitHub Actions validate:
   ✓ JSON syntax
   ✓ Schema compliance
   ✓ Business rules
   ↓
5. Maintainer reviews PR
6. Merge to main
   ↓
7. Post-merge automation:
   ✓ Detect changes (diff)
   ✓ Generate AI summary
   ✓ Create history snapshot
   ✓ Create news post
   ✓ Sync to Supabase
   ✓ Trigger site rebuild
   ↓
8. Live in production
```

**Validation Layers:**
- Pre-commit hooks (local)
- PR validation (GitHub Actions)
- Post-merge safety checks

---

## Rule Change Detection (The Diff Engine)

**Automated Rule Tracking:**

1. **Detect:** Git diff finds changed `rules.json` files
2. **Compare:** Script compares old vs new versions
3. **Summarize:** Claude AI generates human-readable summary
4. **Archive:** Create history snapshot with changes
5. **Publish:** Auto-generate news post
6. **Notify:** Sync to Supabase for user alerts

**Example Output:**

```markdown
# FTMO Increases Profit Targets

**Date:** January 15, 2025

FTMO has updated their Standard Challenge rules:

**Changes:**
- Phase 1 profit target: 8% → 10% ⬆️
- Challenge fee: €145 → €155 ⬆️

**Impact:**
Traders will need to achieve higher returns to pass
the evaluation. This affects all Standard Challenge
account sizes from $10K to $200K.

**Affected Accounts:** 5 account sizes
```

---

## Comparison Engine

**Use Case:** Compare FTMO vs MyForexFunds vs TopStep

**Query Strategy:**
```sql
SELECT * FROM rule_index
WHERE firm_id IN ('ftmo', 'mff', 'topstep')
  AND account_size = 50000
  AND phase_number = 1
```

**Result Matrix:**

| Criteria | FTMO | MFF | TopStep |
|----------|------|-----|---------|
| Profit Target | 10% | 8% | $3,000 (6%) |
| Daily Loss | 5% | 5% | $2,000 (4%) |
| Total Loss | 10% | 12% | $2,500 trailing |
| Min Days | 4 | 5 | 5 |
| Fee | €345 | $299 | $165 |
| Refundable | ✅ Yes | ✅ Yes | ❌ No |

**Scoring Algorithm:**
- Difficulty Score: (profit_target * 2 + max_loss * 1.5 + min_days * 0.5)
- Value Score: (profit_split + refundable_bonus - fee_penalty)

**AI Recommendation:**
> "For a $50K account, TopStep has the easiest profit targets
> but a non-refundable fee. MyForexFunds offers the best overall
> value with a refundable fee and lower profit requirements."

---

## Flexibility Examples

### Example 1: Simple Firm (Uniform Rules)

**FundedNext:** Same rules for all account sizes

```json
{
  "challengeTypes": [{
    "globalRules": {
      "profitTarget": 10,
      "maxDailyLoss": 5,
      "maxTotalLoss": 10
    },
    "accountConfigurations": [
      { "accountSize": 10000, "fee": 49 },
      { "accountSize": 25000, "fee": 99 }
    ]
  }]
}
```

Rules apply uniformly across all sizes.

### Example 2: Complex Firm (Size-Specific Rules)

**TopStep:** Different min days for larger accounts

```json
{
  "accountConfigurations": [
    {
      "accountSize": 50000,
      "rules": { "minTradingDays": 5 }
    },
    {
      "accountSize": 150000,
      "rules": { "minTradingDays": 7 }
    }
  ]
}
```

Larger accounts have stricter requirements.

### Example 3: Multiple Challenge Types

**FTMO:** Standard, Aggressive, Swing

```json
{
  "challengeTypes": [
    {
      "id": "ftmo-standard",
      "rules": { "profitTarget": 10, "maxDailyLoss": 5 }
    },
    {
      "id": "ftmo-aggressive",
      "rules": { "profitTarget": 20, "maxDailyLoss": 10 }
    },
    {
      "id": "ftmo-swing",
      "rules": {
        "profitTarget": 10,
        "weekendHolding": { "required": true }
      }
    }
  ]
}
```

Different challenge models for different trading styles.

---

## Performance Optimization

### Static Generation (Build Time)
- All firm pages pre-rendered
- Directory page pre-rendered
- Zero database queries on page load
- Served as static HTML from CDN

### Incremental Static Regeneration (ISR)
- Pages auto-rebuild every hour
- Manual trigger after data updates
- Background regeneration (no user wait)

### Query Optimization
- Denormalized `rule_index` table
- Indexes on filter columns
- < 100ms query response time
- JSONB for complex rule structures

### Caching Strategy
1. **Build time:** Static HTML generation
2. **Runtime:** ISR (1 hour revalidation)
3. **Client:** React Query (5 min cache)
4. **Database:** Materialized views (future)

---

## Security & Validation

### Data Validation
- **JSON Schema:** Enforces structure and types
- **Pre-commit hooks:** Catch errors locally
- **GitHub Actions:** Block invalid PRs
- **Business rules:** Logical validation (e.g., daily loss < total loss)

### Security Measures
- **Read-only GitHub:** Public can fork, not push
- **PR review:** All changes reviewed by maintainers
- **Schema enforcement:** Invalid data rejected
- **PII protection:** Payout screenshots must be blurred
- **Row Level Security:** Supabase RLS for user data

---

## Scalability & Extensibility

### Current Capacity
- **Firms:** Unlimited (JSON files)
- **Challenge types:** ~5-10 per firm
- **Account sizes:** ~5-10 per challenge
- **Rules:** Unlimited complexity (JSONB)

### Growth Path
- **20 firms:** MVP (Sprint 1-3)
- **50 firms:** v1 Launch (Week 6)
- **100+ firms:** v2 (Week 12)
- **500+ firms:** v3 (Future)

### Adding New Fields
1. Update JSON schema (optional field)
2. Update example firm
3. Update validation script
4. Update UI components
5. Backward compatible (existing data valid)

---

## Implementation Timeline

### Week 1-2: Foundation
- Create directory structure
- Define JSON schemas
- Add 5 firms
- Build validation scripts

### Week 3-4: Next.js Integration
- Firm directory page
- Firm detail pages
- Rule viewer components
- GitHub Actions (PR validation)

### Week 5-6: Diff Engine
- Change detection script
- AI summarization
- History snapshots
- News generation

### Week 7-8: Supabase Layer
- Create tables
- Build sync script
- User authentication
- Favorites/watchlists

### Week 9-10: Advanced Features
- Comparison engine
- Payout leaderboard
- Discount tracker
- Public API

### Week 11-12: Polish & Launch
- SEO optimization
- Performance tuning
- Documentation
- Community guidelines

---

## Success Metrics

### Technical KPIs
- ✅ 100% of firms pass validation
- ✅ < 100ms query response time
- ✅ > 90 Lighthouse score
- ✅ Zero production errors
- ✅ < 2 second page load time

### Data Quality KPIs
- ✅ 20+ firms at v1 launch
- ✅ 95%+ data accuracy
- ✅ 100% schema compliance
- ✅ 24-hour update latency max

### Community KPIs
- ✅ 50+ community PRs by week 12
- ✅ 100% PR review within 48 hours
- ✅ 10+ verified payout submissions

---

## Risk Mitigation

### Risk 1: Invalid Community Data

**Mitigation:**
- Multi-layer validation (local, PR, post-merge)
- Human review before merge
- Rollback capability via Git

### Risk 2: GitHub API Rate Limits

**Mitigation:**
- Use GitHub Actions (unlimited for private repos)
- Cache data in Supabase
- Fallback to local file reads

### Risk 3: Schema Evolution Breaking Changes

**Mitigation:**
- Semantic versioning (major.minor.patch)
- Backward compatibility requirements
- Migration scripts for breaking changes

### Risk 4: Supabase Sync Failures

**Mitigation:**
- Idempotent sync script (can re-run)
- Error alerting via GitHub Actions
- Manual sync capability
- Primary data still in Git (can rebuild DB)

---

## Documentation Deliverables

All documentation is located in `/documents/`:

1. **TECHNICAL_DESIGN.md** (90 pages)
   - Complete schema specifications
   - Supabase table definitions
   - Example data structures
   - Migration strategy

2. **SCHEMA_EXAMPLES.md** (40 pages)
   - Real-world firm examples
   - Edge case handling
   - Comparison queries
   - 10+ detailed scenarios

3. **DATA_ARCHITECTURE.md** (50 pages)
   - System architecture diagrams
   - Data flow visualizations
   - Query patterns
   - Sync strategies

4. **IMPLEMENTATION_GUIDE.md** (45 pages)
   - Step-by-step instructions
   - Code examples
   - GitHub Actions workflows
   - Troubleshooting guide

5. **EXECUTIVE_SUMMARY.md** (This document)
   - High-level overview
   - Key decisions and rationale
   - Timeline and metrics

---

## Conclusion

The hybrid GitHub + Supabase architecture provides:

✅ **Community-Friendly:** PR-based contribution workflow
✅ **Transparent:** All data changes visible in Git
✅ **Performant:** Fast queries via Supabase indexes
✅ **Flexible:** Handles all rule variations and edge cases
✅ **Scalable:** From 20 to 500+ firms without redesign
✅ **Maintainable:** Clear structure, validated data, comprehensive docs

**Recommendation:** Proceed with implementation using the phased approach outlined in IMPLEMENTATION_GUIDE.md.

**Next Action:** Review with stakeholders, then begin Week 1 implementation (directory structure + JSON schemas).

---

## Questions & Answers

**Q: Why not use a CMS like Contentful or Sanity?**
A: CMSs hide changes from the community. GitHub provides transparency, version control, and a familiar PR workflow for developers.

**Q: Why JSON instead of a database-first approach?**
A: JSON files are human-readable, Git-friendly, and easy for community contributors to edit. We use Supabase as a performance layer, not the source of truth.

**Q: How do we handle conflicts when multiple people edit the same firm?**
A: Git's merge conflict resolution handles this. Maintainers review and merge conflicting PRs sequentially.

**Q: What if Supabase goes down?**
A: The site still works! All data is in GitHub. Supabase only provides performance optimizations and user features. We can rebuild the entire database from GitHub files.

**Q: Can we add new rule types in the future?**
A: Yes! The JSON structure is extensible. Add new fields to the schema and update validation. Existing data remains valid (backward compatibility).

**Q: How do we verify community-submitted data?**
A: Multi-step process: JSON schema validation → automated checks → human review → merge → published. Verified firms get a badge.

---

**End of Executive Summary**

For detailed implementation, refer to the accompanying documentation:
- `/documents/TECHNICAL_DESIGN.md`
- `/documents/SCHEMA_EXAMPLES.md`
- `/documents/DATA_ARCHITECTURE.md`
- `/documents/IMPLEMENTATION_GUIDE.md`
