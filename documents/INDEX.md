# Documentation Index

Complete documentation for the Prop Firm Directory database schema and architecture.

---

## Overview

This directory contains comprehensive technical design documentation created by the Tech Lead Agent on 2025-11-28. The documentation covers database schema design, architecture decisions, implementation guides, and real-world examples.

**Total Documentation:** ~140KB across 10 files

---

## Documentation Structure

### 🎯 Start Here

**For Executives/Product Managers:**
1. [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md) (13KB)
   - High-level overview
   - Key architectural decisions
   - Storage strategy recommendation (GitHub + Supabase)
   - Success metrics and timeline
   - 15 min read

**For Developers:**
1. [SCHEMA_QUICK_REFERENCE.md](SCHEMA_QUICK_REFERENCE.md) (10KB)
   - Quick reference guide
   - JSON templates
   - Common patterns
   - Validation rules
   - 10 min read

---

## Technical Documentation

### Database Schema & Design

**[TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md)** (40KB)
- Complete database schema specification
- GitHub JSON structure (firm.json, rules.json)
- Supabase table definitions (SQL)
- Migration strategy
- Data storage recommendation analysis
- Version control strategy
- 45 min read

**Key Sections:**
- Requirements Analysis
- Storage Strategy (GitHub vs Supabase vs Hybrid)
- Complete JSON schemas with examples
- Supabase relational schema (9 tables)
- Migration roadmap
- Validation strategy

---

### Real-World Examples

**[SCHEMA_EXAMPLES.md](SCHEMA_EXAMPLES.md)** (18KB)
- 10+ complete firm examples
- Edge case handling
- Comparison queries
- Payout submissions
- Discount tracking
- Historical snapshots
- 30 min read

**Featured Examples:**
1. FTMO - Multiple challenge types (Standard, Aggressive, Swing)
2. TopStep - Fixed dollar amounts with trailing drawdown
3. TTT Markets - Instant funding with automatic scaling
4. Simple firms - Uniform rules across account sizes
5. Complex firms - Size-specific rule variations

---

### System Architecture

**[DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md)** (37KB)
- System architecture diagrams (ASCII art)
- Data flow visualizations
- Query patterns and optimization
- Caching strategies
- Sync mechanisms
- Security considerations
- 40 min read

**Covered Topics:**
- Architecture overview
- Community contribution workflow
- Entity relationship diagrams
- JSON structure hierarchy
- Search & filter implementation
- Rule change detection flow
- Performance optimization

---

### Implementation

**[IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)** (23KB)
- Step-by-step implementation instructions
- Code examples and scripts
- GitHub Actions workflows
- Validation setup
- Supabase integration
- Testing procedures
- Troubleshooting guide
- 35 min read

**Implementation Phases:**
1. Foundation (Week 1-2) - Directory structure, schemas, validation
2. Next.js Integration (Week 2-3) - Pages, components, data utilities
3. GitHub Actions (Week 3-4) - PR validation, diff detection
4. Supabase Integration (Week 7-8) - Tables, sync script
5. Testing & Deployment - Full workflow verification

---

## Project Planning

### Product Roadmap

**[roadmap.md](roadmap.md)** (1.3KB)
- v1: Directory + Rules Engine (Weeks 1-6)
- v2: Automation + Payout Transparency (Weeks 7-12)
- v3: Marketplace + Community (Future)
- Success criteria per version

### Goals & Metrics

**[OKRs.md](OKRs.md)** (742 bytes)
- Objective 1: Deliver usable v1
- Objective 2: Build automation + payout transparency
- Objective 3: Establish community & growth
- Key Results with measurable targets

### Sprint Planning

**[sprints.md](sprints.md)** (1.9KB)
- 6 sprints × 2 weeks each
- Detailed task breakdown per sprint
- Goals and deliverables
- 12-week timeline

### Directory Structure

**[folder-structure.md](folder-structure.md)** (626 bytes)
- File organization
- Folder naming conventions
- Data directory structure

---

## Quick Reference

### File Sizes Summary

| File | Size | Time to Read | Audience |
|------|------|--------------|----------|
| EXECUTIVE_SUMMARY.md | 13KB | 15 min | Everyone |
| SCHEMA_QUICK_REFERENCE.md | 10KB | 10 min | Developers |
| TECHNICAL_DESIGN.md | 40KB | 45 min | Tech Leads |
| SCHEMA_EXAMPLES.md | 18KB | 30 min | Developers |
| DATA_ARCHITECTURE.md | 37KB | 40 min | Architects |
| IMPLEMENTATION_GUIDE.md | 23KB | 35 min | Developers |
| roadmap.md | 1.3KB | 5 min | Product |
| OKRs.md | 742B | 3 min | Product |
| sprints.md | 1.9KB | 5 min | Project Managers |
| folder-structure.md | 626B | 2 min | Developers |

**Total:** ~140KB, ~3 hours of comprehensive reading

---

## Documentation Coverage

### Fully Documented Topics

- [x] Database schema design rationale
- [x] Storage strategy (GitHub vs Supabase)
- [x] JSON structure specifications
- [x] Supabase table definitions
- [x] Rule flexibility patterns
- [x] Edge case handling
- [x] Community contribution workflow
- [x] Data validation strategy
- [x] Version control integration
- [x] Change detection mechanism
- [x] Query optimization patterns
- [x] Caching strategies
- [x] Security measures
- [x] Migration roadmap
- [x] Implementation steps
- [x] Code examples
- [x] Testing procedures
- [x] Troubleshooting guide
- [x] Real-world firm examples
- [x] Comparison engine design
- [x] Performance benchmarks
- [x] Scalability considerations

### Not Yet Implemented

- [ ] Actual code implementation
- [ ] Test coverage
- [ ] Performance metrics (benchmarks)
- [ ] Production deployment
- [ ] Community contribution guidelines (detailed)
- [ ] API documentation
- [ ] UI/UX design specifications

---

## Key Decisions Documented

### 1. Storage Architecture: Hybrid (GitHub + Supabase)

**Decision:** Use GitHub as source of truth, Supabase for performance
**Rationale:**
- GitHub enables transparent community workflow
- Supabase provides fast queries and user features
- One-way sync keeps data integrity simple

**Documented In:**
- EXECUTIVE_SUMMARY.md (Section: Key Decision)
- TECHNICAL_DESIGN.md (Section 3: Data Storage Strategy)
- DATA_ARCHITECTURE.md (Section 1: System Architecture)

### 2. Schema Design: Nested Hierarchical Structure

**Decision:** Firm → Challenge Type → Account Config → Phases → Rules
**Rationale:**
- Handles all rule variations and edge cases
- Extensible without breaking changes
- Mirrors real-world firm organization

**Documented In:**
- TECHNICAL_DESIGN.md (Section 4: Database Schema Design)
- SCHEMA_EXAMPLES.md (All examples)
- SCHEMA_QUICK_REFERENCE.md (Templates)

### 3. Validation Strategy: Multi-Layer

**Decision:** Pre-commit + PR checks + Post-merge validation
**Rationale:**
- Catch errors early (developer machine)
- Block invalid PRs (automated)
- Safety net after merge

**Documented In:**
- IMPLEMENTATION_GUIDE.md (Phase 3: GitHub Actions)
- DATA_ARCHITECTURE.md (Section 9: Data Validation Pipeline)

### 4. Change Detection: Git-Native Diff

**Decision:** Use git diff + AI summarization
**Rationale:**
- Leverages Git's native capabilities
- Automatic historical tracking
- Human-readable summaries via AI

**Documented In:**
- DATA_ARCHITECTURE.md (Section 4: Rule Change Detection)
- IMPLEMENTATION_GUIDE.md (Step 3.3: Diff Detection)

---

## Usage Scenarios

### Scenario 1: I'm a developer starting implementation

**Read This:**
1. SCHEMA_QUICK_REFERENCE.md - Learn the structure
2. IMPLEMENTATION_GUIDE.md - Follow step-by-step
3. SCHEMA_EXAMPLES.md - Reference real examples

**Estimated Time:** 1.5 hours

### Scenario 2: I'm reviewing the architecture

**Read This:**
1. EXECUTIVE_SUMMARY.md - Understand decisions
2. TECHNICAL_DESIGN.md - Deep dive on schema
3. DATA_ARCHITECTURE.md - System design

**Estimated Time:** 2 hours

### Scenario 3: I need to add a new firm

**Read This:**
1. SCHEMA_QUICK_REFERENCE.md - Templates section
2. SCHEMA_EXAMPLES.md - Find similar firm
3. IMPLEMENTATION_GUIDE.md - Validation process

**Estimated Time:** 30 minutes

### Scenario 4: I'm building the comparison feature

**Read This:**
1. SCHEMA_EXAMPLES.md - Example 9 (Comparison Query)
2. DATA_ARCHITECTURE.md - Section 10 (Comparison Algorithm)
3. TECHNICAL_DESIGN.md - Section 4.2.4 (rule_index table)

**Estimated Time:** 1 hour

---

## Next Steps

After reading this documentation:

1. **For Product Team:**
   - Review EXECUTIVE_SUMMARY.md
   - Approve hybrid storage approach
   - Confirm timeline in roadmap.md

2. **For Development Team:**
   - Set up development environment
   - Follow IMPLEMENTATION_GUIDE.md Phase 1
   - Create first 5 firm profiles

3. **For Design Team:**
   - Review SCHEMA_EXAMPLES.md for UI data
   - Design comparison table layout
   - Create firm detail page mockups

4. **For QA Team:**
   - Review validation rules
   - Prepare test cases based on edge cases
   - Plan testing strategy

---

## Document Maintenance

### Versioning

All documents follow semantic versioning:
- **Major:** Breaking schema changes
- **Minor:** New sections or examples
- **Patch:** Typo fixes, clarifications

Current version: **1.0.0** (Initial release)

### Update Process

1. Changes to schema → Update TECHNICAL_DESIGN.md
2. New examples → Add to SCHEMA_EXAMPLES.md
3. Implementation changes → Update IMPLEMENTATION_GUIDE.md
4. Architecture changes → Update DATA_ARCHITECTURE.md
5. High-level changes → Update EXECUTIVE_SUMMARY.md

### Feedback

Questions or suggestions:
- Open GitHub issue with label `documentation`
- Tag specific document in issue title
- Reference section number

---

## Glossary

**Hybrid Storage:** Using both GitHub (source of truth) and Supabase (performance layer)

**Rule Index:** Denormalized Supabase table with common rule fields for fast queries

**Challenge Type:** Evaluation model (1-step, 2-step, 3-step, or instant funding)

**Account Configuration:** Specific account size within a challenge type

**Phase:** Evaluation stage (Phase 1, Phase 2, etc.)

**Funded Account Rules:** Rules that apply after passing evaluation

**Diff Engine:** System that detects and summarizes rule changes

**ISR:** Incremental Static Regeneration (Next.js feature)

**RLS:** Row Level Security (Supabase feature)

---

## Contributors

**Tech Lead Agent** - Initial design and documentation (2025-11-28)

---

## License

This documentation is part of the Prop Firm Directory open-source project.

---

**Last Updated:** 2025-11-28
**Documentation Version:** 1.0.0
