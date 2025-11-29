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

### ✔ Discount Aggregator (v2)
Track all current prop firm discounts.

### ✔ Marketplace + Tools (v3)
Risk calculators, challenge simulators, dashboards, jobs, etc.

---

## 🧱 Technical Overview

- **Frontend**: Next.js + Tailwind  
- **Backend**: GitHub-as-DB (JSON rules)  
- **Automation**: GitHub Actions + Codex Agents  
- **Deployment**: Vercel  
- **Cron Jobs**: Automatically watch firm websites and detect rule changes.

---

## 🗺 Roadmap

See `ROADMAP.md`

## 🎯 OKRs

See `OKRs.md`

## 🏃 Sprint Backlog

See `SPRINTS.md`

## 🤖 AI Agent Instructions

See `AGENTS.md`

---
