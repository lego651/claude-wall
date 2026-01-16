# 🤖 Claude Code Context - Trading Log System

> **Purpose:** This file helps Claude Code remember the trading log system in future conversations.
> When the user mentions trading logs or weekly screenshots, read this file first!

---

## 📋 System Overview

This is a **trading log system** that tracks R-multiples for 6 trading strategies across weekly timeframes.

**User's workflow:**
1. Takes screenshot of weekly results (Mon-Fri grid)
2. Saves to `screenshots/YYYY-MM-DD.png`
3. Tells Claude: "Here's my trading log for the week"
4. Claude parses screenshot → creates JSON → generates report → aggregates data

---

## 📸 Screenshot Format

User provides screenshots that look like this:

| Day  | AS 1 | AS 2 | EU   | NQI  | GOLD 1 | GOLD 2 |
|------|------|------|------|------|--------|--------|
| Mon  | +2.4 | +1   | +1   |      |        | -1     |
| Tue  | -1.5 | +1.5 | -1   | +1.5 | +1.5   | -1     |
| Wed  |      | -1.5 | -1   | +1.5 |        | +1.5   |
| Thu  | -1   | +1.5 | +1.4 |      | +1.5   | +1.5   |
| Fri  |      |      |      |      |        |        |

**Key points:**
- Green numbers = winning trades (positive R)
- Red numbers = losing trades (negative R)
- Empty cells = no trade taken (store as null)
- Mon-Fri = most recent complete trading week (use current date to calculate dates)

---

## 🎯 What to Do When User Provides Screenshot

### Step 1: Determine Week Dates
```javascript
// If user says "here's this week's log" on Jan 9 (Thursday)
// Most recent complete week = Jan 5-9 (Mon-Fri)
// If today is Friday, use this week
// If today is Mon-Thu, use last week
```

### Step 2: Parse Screenshot Data
Map the grid to this structure:
```javascript
{
  "2026-01-05": { "AS_1": 2.4, "AS_2": 1, "EU": 1, "NQI": null, "GOLD_1": null, "GOLD_2": -1 },
  "2026-01-06": { "AS_1": -1.5, "AS_2": 1.5, "EU": -1, "NQI": 1.5, "GOLD_1": 1.5, "GOLD_2": -1 },
  // ... etc
}
```

### Step 3: Calculate Summaries
Use `scripts/calculate.js` functions:
- `calculateDaySummary()` - daily totals, averages, win rate
- `calculateStrategySummary()` - per strategy for the week
- `calculateAllSummaries()` - complete summary object

### Step 4: Create Weekly JSON & Process
1. **Create Weekly JSON**: `data/YYYY/week-WW.json` (see schema below)
2. **Run Complete Workflow**: `node scripts/process-weekly-data.js data/YYYY/week-WW.json`
   - This ONE command does everything:
     - Generates markdown report
     - Syncs to web app (copies MD + updates reports.js)
     - Aggregates all data

### Step 5: Show User Summary
Display:
- Total R for the week
- Win rate
- Best/worst day
- Top 3 strategies
- Location of created files

---

## 📁 File Schema

### Weekly JSON (`data/2026/week-02.json`)
```json
{
  "weekNumber": 2,
  "year": 2026,
  "startDate": "2026-01-05",
  "endDate": "2026-01-09",
  "trades": {
    "YYYY-MM-DD": { "AS_1": 2.4, "AS_2": 1, "EU": 1, "NQI": null, "GOLD_1": null, "GOLD_2": -1 }
  },
  "summary": {
    "byDay": {
      "YYYY-MM-DD": { "totalR": 3.4, "averageR": 0.68, "trades": 5, "winning": 4, "losing": 1 }
    },
    "byStrategy": {
      "AS_1": { "totalR": -0.1, "averageR": -0.03, "trades": 3, "winning": 1, "losing": 2, "winRate": 33.3 }
    },
    "weekly": {
      "totalR": 8.3,
      "averageR": 0.44,
      "totalTrades": 19,
      "winning": 13,
      "losing": 6,
      "winRate": 68.4,
      "bestDay": { "date": "2026-01-08", "totalR": 4.9 },
      "worstDay": { "date": "2026-01-07", "totalR": -0.5 }
    }
  }
}
```

---

## 🎨 Strategy Names Mapping

Screenshot shows → Store as:
- **AS 1** → `AS_1`
- **AS 2** → `AS_2`
- **EU** → `EU`
- **NQI** → `NQI`
- **GOLD 1** → `GOLD_1`
- **GOLD 2** → `GOLD_2`

---

## 🔄 Complete Workflow (Automated)

**ONE COMMAND DOES IT ALL:**

```bash
# After creating weekly JSON file, run this ONE command:
cd trading-logs/scripts
node process-weekly-data.js ../data/2026/week-03.json
```

This automatically:
1. ✅ Generates markdown report (`reports/week-03-2026.md`)
2. ✅ Copies markdown to web app (`app/reports/_assets/`)
3. ✅ Updates `app/reports/_assets/reports.js` with metadata
4. ✅ Aggregates all data for the year
5. ✅ Makes it live on http://localhost:3000/reports

**Manual steps (if needed):**
```bash
# Just generate report + sync to webapp
node generate-report.js ../data/2026/week-03.json

# Just sync existing week to webapp
node sync-to-webapp.js ../data/2026/week-03.json

# Just aggregate data
node aggregate-data.js 2026
```

---

## 📊 What Gets Created

### For Each Week:
1. **Weekly JSON**: `data/YYYY/week-WW.json` (detailed trade data)
2. **Weekly Report**: `reports/week-WW-YYYY.md` (markdown with ASCII charts, insights, recommendations)
3. **Web App Report**: `app/reports/_assets/week-WW-YYYY.md` (auto-copied)
4. **Web App Metadata**: `app/reports/_assets/reports.js` (auto-updated)

### Aggregated (for frontend):
5. **Daily Index**: `data/YYYY/aggregated/daily-index.json` (all days, flat structure)
6. **Monthly Files**: `data/YYYY/aggregated/YYYY-MM.json` (month aggregations)
7. **Yearly Summary**: `data/YYYY/aggregated/yearly-summary.json` (full year stats)
8. **Navigation Index**: `data/YYYY/aggregated/index.json` (metadata)

### Web App URLs:
- **All Reports**: http://localhost:3000/reports
- **Single Report**: http://localhost:3000/reports/week-WW-YYYY

---

## 💡 Important Rules

### ✅ DO:
- Parse screenshot visually (color doesn't matter, just values)
- Calculate week dates based on when screenshot is provided
- Store empty cells as `null` (not 0)
- Round to 2 decimal places for R values
- Auto-run aggregation after creating weekly file
- Show user a nice summary with key metrics

### ❌ DON'T:
- Ask user to manually enter data (parse the screenshot!)
- Use 0 for empty cells (use null)
- Forget to run aggregation (frontend needs it!)
- Skip the weekly report generation
- Forget to calculate ISO week number

---

## 🎯 Common User Requests

### "Here's my trading log for the week" (with screenshot)
→ Parse screenshot, create all files, show summary

### "Generate report for week 2"
→ Run: `node scripts/generate-report.js data/2026/week-02.json`

### "What was my best week this month?"
→ Read: `data/2026/aggregated/2026-01.json` and compare weeks

### "Show me all my Gold 1 trades"
→ Read: `data/2026/aggregated/daily-index.json` and filter

### "Update the aggregated files"
→ Run: `node scripts/aggregate-data.js 2026`

---

## 📚 Documentation Files

- **README.md**: Complete SOP and technical docs
- **WORKFLOW.md**: User's simple weekly workflow
- **QUICK-GUIDE.md**: Quick reference and commands
- **FRONTEND-GUIDE.md**: Frontend integration examples
- **DATA-ARCHITECTURE.md**: Data structure explanation
- **CLAUDE-CONTEXT.md**: This file (for Claude)

---

## 🧮 Calculation Formulas

### Total R
```javascript
totalR = trades.filter(t => t !== null).reduce((sum, t) => sum + t, 0)
```

### Average R
```javascript
averageR = totalR / trades.filter(t => t !== null).length
```

### Win Rate
```javascript
winRate = (winning.length / totalTrades) * 100
```

### Best Day
```javascript
bestDay = Object.entries(byDay)
  .reduce((best, [date, stats]) => stats.totalR > best.totalR ? {date, totalR: stats.totalR} : best)
```

---

## 🔍 Week Number Calculation

Use ISO 8601 week numbering:
```javascript
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
```

---

## 🎉 Example Summary to Show User

```
✅ Trading log processed for Week 2, 2026 (Jan 5-9)

📊 Weekly Summary:
   Total R: +8.30R
   Win Rate: 68.4% (13 wins, 6 losses)
   Best Day: Thursday (+4.90R)

🏆 Top Performers:
   🥇 NQI: +3.00R (100% win rate)
   🥈 GOLD 1: +3.00R (100% win rate)
   🥉 AS 2: +2.50R (75% win rate)

📁 Files Created:
   - data/2026/week-02.json
   - reports/week-02-2026.md
   - data/2026/aggregated/* (updated)

📄 View full report: trading-logs/reports/week-02-2026.md
```

---

## 🚨 Edge Cases

### No trades on Friday
Store as: `{"AS_1": null, "AS_2": null, ...}` for that day

### Partial week (holiday)
Still use Mon-Fri structure, fill missing days with nulls

### Week spans two months
Use Friday's month for the monthly aggregation

### New year (week 1 spans Dec-Jan)
Week belongs to the year that contains Thursday

---

**Last Updated:** 2026-01-08
**System Version:** 1.0
**Example Week:** Week 2, 2026 (Jan 5-9)
