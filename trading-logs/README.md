# Trading Logs - Standard Operating Procedure (SOP)

## Overview
This system tracks R-multiples for multiple trading strategies across weekly timeframes.

## 🚀 Quick Start - Your Weekly Workflow

Every week, follow these simple steps:

1. **📸 Take screenshot** of your trading results (Mon-Fri grid)
2. **💾 Save it** to `screenshots/w3.png` (or any name)
3. **💬 Tell Claude**: "Here's my trading log for the week" (attach/mention screenshot)
4. **✅ Done!** Claude will automatically:
   - Parse the screenshot data
   - Create JSON file: `data/YYYY/week-XX.json`
   - Generate markdown report: `reports/week-XX-YYYY.md`
   - **🌐 Sync to web app** (`app/reports/_assets/`)
   - **📊 Update reports.js** (makes it live on website)
   - Create aggregated files for frontend
   - Show you a summary

5. **🌐 View online**: http://localhost:3000/reports

**That's it!** No manual data entry needed. Everything auto-syncs to the web app!

---

## Data Entry Process

### When you provide a screenshot at end of week:

1. **Identify the week**: Look at the date when the screenshot is provided
2. **Map the days**: Mon-Fri refer to the most recent complete trading week
3. **Extract R-multiples**: Each cell contains the R value for that strategy on that day
4. **Empty cells**: Represent no trade taken (recorded as null)

### Data Format

Weekly data is stored in JSON format under `/trading-logs/data/YYYY/week-WW.json`

```json
{
  "weekNumber": 1,
  "year": 2026,
  "startDate": "2026-01-05",
  "endDate": "2026-01-09",
  "trades": {
    "2026-01-05": {
      "AS_1": 2.4,
      "AS_2": 1,
      "EU": 1,
      "NQI": null,
      "GOLD_1": null,
      "GOLD_2": -1
    }
  },
  "summary": {
    "byStrategy": {
      "AS_1": {
        "totalR": 0,
        "averageR": 0,
        "trades": 0
      }
    },
    "byDay": {
      "2026-01-05": {
        "totalR": 3.4,
        "averageR": 0.68,
        "trades": 5
      }
    },
    "weekly": {
      "totalR": 0,
      "averageR": 0,
      "totalTrades": 0,
      "winRate": 0
    }
  }
}
```

### Strategies Tracked
- **AS 1**: Asian Session Strategy 1
- **AS 2**: Asian Session Strategy 2
- **EU**: European Session Strategy
- **NQI**: NASDAQ Strategy
- **GOLD 1**: Gold Strategy 1
- **GOLD 2**: Gold Strategy 2

## Quick Start Guide

### Step 1: Save the screenshot
Save your weekly screenshot to `/trading-logs/screenshots/YYYY-MM-DD.png`

### Step 2: Run the input script
```bash
node trading-logs/scripts/add-week.js
```

### Step 3: Follow the prompts
- Enter the week ending date (Friday's date)
- Paste or enter R-values for each day/strategy
- Script will auto-calculate summaries

### Step 4: Commit the data
```bash
git add trading-logs/data/
git commit -m "Add trading log for week ending YYYY-MM-DD"
```

## Calculations Performed

### Daily Summary
- **Total R**: Sum of all R-values for that day (excluding nulls)
- **Average R**: Total R / number of trades taken
- **Trades**: Count of non-null entries

### Strategy Summary (per week)
- **Total R**: Sum of all R-values for that strategy
- **Average R**: Total R / number of trades
- **Trades**: Number of trades taken
- **Win Rate**: Percentage of positive R trades

### Weekly Summary
- **Total R**: Sum of all R-values across all strategies
- **Average R**: Total R / total trades
- **Total Trades**: Count of all trades
- **Win Rate**: Overall percentage of winning trades

## File Structure

```
trading-logs/
├── README.md                   # This file - SOP and technical docs
├── WORKFLOW.md                 # Your simple weekly workflow guide
├── QUICK-GUIDE.md              # Quick reference for commands
├── FRONTEND-GUIDE.md           # Frontend integration examples
├── DATA-ARCHITECTURE.md        # Data structure explanation
│
├── data/
│   └── 2026/
│       ├── week-01.json        # Weekly data (source of truth)
│       ├── week-02.json
│       └── aggregated/         # Auto-generated for frontend
│           ├── index.json      # Navigation index
│           ├── daily-index.json # Fast day lookups
│           ├── 2026-01.json    # Monthly aggregation
│           └── yearly-summary.json # Year overview
│
├── reports/
│   ├── week-01-2026.md         # Auto-generated weekly reports
│   └── week-02-2026.md         # With charts and insights
│
├── screenshots/
│   └── 2026-01-09.png          # Your weekly screenshots
│
└── scripts/
    ├── add-week.js             # Manual data entry (optional)
    ├── calculate.js            # Calculation utilities
    ├── generate-report.js      # Report generator
    ├── aggregate-data.js       # Create aggregated files
    └── process-weekly-screenshot.js # Full workflow automation
```

## Frontend Integration (Ready!)

The system generates **aggregated files** for optimal frontend performance:

### Query Performance
- **Single day**: 1 lookup in `daily-index.json` ⚡
- **Single week**: 1 file `week-XX.json` ⚡
- **Date range** (e.g., Jan 13 - Mar 31): 3 monthly files 🚀
- **Monthly view**: 1 file `YYYY-MM.json` ⚡
- **Yearly overview**: 1 file `yearly-summary.json` ⚡

See [FRONTEND-GUIDE.md](FRONTEND-GUIDE.md) for detailed integration examples.

## Notes

- R-multiples are stored as numbers (can be negative)
- Empty cells = no trade = null (not included in averages)
- Week numbers follow ISO 8601 standard
- All dates in ISO format (YYYY-MM-DD)
