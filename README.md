# 🏛 Prop Firm Directory — Open Source, AI-Driven, Community Powered

A directory and rule-tracking platform for prop firm traders, inspired by cursor.directory.

Our mission is simple:

> **Become the #1 open-source, real-time, trusted source of truth for prop firm rules, payouts, challenges, discounts, and updates.**

This platform centralizes rule data from prop firms, tracks changes automatically, and empowers the community to submit updates via pull requests. Everything is transparent, open, and versioned in GitHub.

---

## 🚀 What This Project Does

### ✔ Prop Firm Directory
Each firm has:
- Rules (DD, trailing, payout %, scaling)
- Challenge types
- Prices
- News
- History (auto-tracked)

### ✔ Rule Change Diff Engine
Automatically detects when a firm updates its:
- Drawdown model
- Payout rules
- Min days
- Scaling
- Prices

Generates:
- Human readable summary
- Diff view
- News post
- Alerts (v2+)

### ✔ Community Contributions
Users submit updates → GitHub PR → AI agent verifies → merge → auto publish.

### ✔ Comparison Engine
Compare up to 5 firms on:
- Rules
- Evaluation model
- Weekend policy
- Payout schedule
- Scaling logic

### ✔ Payout Transparency (v2)
Leaderboard + verified payout data.

### ✔ Intelligence Feed (Alpha)
Curated signals from Trustpilot reviews: scraped daily, classified with AI, aggregated into weekly incidents, and optional email digests. Pipeline: **scrape → classify → incidents → weekly email**. See [Intelligence Feed runbook](documents/runbooks/intelligence-feed-system-architecture.md) and [Daily scraper + weekly incidents & reports](documents/runbooks/daily-scraper-weekly-incidents-reports-operations.md).

### ✔ Discount Aggregator (v2)
Track all current prop firm discounts.

### ✔ Marketplace + Tools (v3)
Risk calculators, challenge simulators, dashboards, jobs, etc.

---

## 🧱 Technical Overview

- **Frontend**: Next.js 15 + React 19 + Tailwind CSS v4 + DaisyUI v5
- **Backend**: Hybrid Architecture (GitHub + Supabase)
- **Data Storage**: GitHub as source of truth (JSON files) + Supabase for performance
- **Automation**: GitHub Actions + AI Agents
- **Deployment**: Vercel
- **Auth**: Supabase Auth
- **Payments**: Stripe (future)

### Architecture Highlights

**Hybrid Storage Strategy:**
- GitHub stores all firm data (transparent, versioned, community-editable)
- Supabase provides fast queries, user features, and real-time updates
- One-way sync: GitHub → Supabase (GitHub is always the source of truth)

**Community Workflow:**
1. Fork repo → Edit JSON → Create PR
2. Automated validation (JSON schema, business rules)
3. Human review → Merge
4. Auto-sync to Supabase → Trigger deployment
5. Live in production

---

## Intelligence Feed (Alpha)

The Intelligence Feed ingests Trustpilot reviews for prop firms, classifies them with OpenAI, detects incidents (e.g. payout delays, support issues), and optionally sends weekly email digests to subscribers.

**Pipeline (daily):** Scrape reviews → Classify with AI → Detect incidents. **Weekly (Monday):** Send digest emails.

### GitHub Actions workflows

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| `step1-sync-trustpilot-reviews-daily.yml` | Daily 3 AM PST | Scrape Trustpilot for all firms with `trustpilot_url` |
| `step2-sync-classify-reviews-daily.yml` | Daily 4 AM PST | Classify unclassified reviews (OpenAI batch) |
| `step3-run-daily-incidents-daily.yml` | Daily 5 AM PST | Aggregate reviews into weekly incidents |
| `step4-send-weekly-reports-weekly.yml` | Weekly Monday 2 PM UTC | Send weekly digest emails to subscribers |

### Environment variables (Intelligence Feed)

Required for the pipeline and admin dashboard:

```env
# Supabase (required for all)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Intelligence pipeline
OPENAI_API_KEY=...          # Classification + incident summaries
RESEND_API_KEY=...          # Weekly digest emails
CRON_SECRET=...             # Auth for cron API (e.g. step4-send-weekly-reports-weekly)
ALERT_EMAIL=...             # Optional: critical pipeline alerts (throttled)
```

See [daily-scraper-weekly-incidents-reports-operations.md](documents/runbooks/daily-scraper-weekly-incidents-reports-operations.md) for manual triggers, debugging, and adding new firms.

---

## 📚 Documentation

### Technical Design Documents

**Intelligence Feed:**
- [intelligence-feed-system-architecture.md](documents/runbooks/intelligence-feed-system-architecture.md) - Pipeline, data flow, monitoring
- [daily-scraper-weekly-incidents-reports-operations.md](documents/runbooks/daily-scraper-weekly-incidents-reports-operations.md) - Daily scraper, weekly incidents & reports: manual triggers, debugging, email logs, adding firms

**Database Schema & Architecture:**
- [EXECUTIVE_SUMMARY.md](documents/EXECUTIVE_SUMMARY.md) - High-level overview and key decisions
- [TECHNICAL_DESIGN.md](documents/TECHNICAL_DESIGN.md) - Complete database schema, Supabase tables, migration strategy
- [SCHEMA_EXAMPLES.md](documents/SCHEMA_EXAMPLES.md) - Real-world examples, edge cases, 10+ scenarios
- [DATA_ARCHITECTURE.md](documents/DATA_ARCHITECTURE.md) - System diagrams, data flow, query patterns
- [IMPLEMENTATION_GUIDE.md](documents/IMPLEMENTATION_GUIDE.md) - Step-by-step implementation instructions

**Project Planning:**
- [roadmap.md](documents/roadmap.md) - Product roadmap (v1, v2, v3)
- [OKRs.md](documents/OKRs.md) - Objectives and Key Results
- [sprints.md](documents/sprints.md) - Sprint planning (6 sprints)
- [folder-structure.md](documents/folder-structure.md) - Directory structure

---

## 🗺 Roadmap

See [documents/roadmap.md](documents/roadmap.md)

## 🎯 OKRs

See [documents/OKRs.md](documents/OKRs.md)

## 🏃 Sprint Backlog

See [documents/sprints.md](documents/sprints.md)

---
