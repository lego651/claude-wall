# 📈 Strategy Profile Pages - Complete Guide

## Overview

This document explains the strategy profile system that displays weekly bar charts and detailed statistics for each of the 6 trading strategies.

---

## 🎯 Features Implemented

### 1. **Weekly Bar Chart**
- Week-over-week profit visualization (similar to reference image)
- Color-coded bars (green for profit, red for loss)
- Interactive tooltips with detailed week information
- Responsive design for all screen sizes
- Summary stats below chart

### 2. **Strategy Profile Pages**
- Individual page for each strategy (`/strategies/[strategyId]`)
- Key metrics dashboard (Total R, Win Rate, Avg R, etc.)
- Performance insights and recommendations
- Auto-updating from JSON data

### 3. **Strategies Overview**
- Grid view of all 6 strategies (`/strategies`)
- Sortable/filterable cards
- Quick stats preview
- Total performance across all strategies

---

## 📊 Data Structure

### Current Aggregated Files

```
public/data/trading/
├── yearly-summary.json         # Overall stats by strategy
├── weekly-by-strategy.json     # NEW: Week-by-week data for charts
├── daily-index.json            # Daily trade data
├── 2026-01.json               # Monthly aggregations
└── index.json                 # Navigation metadata
```

### Weekly By Strategy Format

```json
{
  "year": 2026,
  "weeks": [
    {
      "weekNumber": 2,
      "year": 2026,
      "startDate": "2026-01-05",
      "endDate": "2026-01-09",
      "AS_1": 1.4,
      "AS_2": 1.9,
      "EU": -0.6,
      "NQI": 3.0,
      "GOLD_1": 3.0,
      "GOLD_2": 2.5,
      "totalR": 11.2
    }
  ]
}
```

---

## 🔄 Auto-Update System

### How It Works

1. **User adds new weekly data** → Updates JSON file in `trading-logs/data/2026/`
2. **Run aggregation** → `node scripts/aggregate-data.js 2026`
3. **Sync to Next.js** → `bash scripts/sync-to-nextjs.sh`
4. **Next.js fetches** → Components fetch from `/data/trading/*.json`
5. **UI updates automatically** → No code changes needed!

### Automatic Sync

When using `publish-report.js`, data syncs automatically:

```bash
node scripts/publish-report.js data/2026/week-02.json
# ↓ Automatically runs:
# 1. aggregate-data.js
# 2. sync-to-nextjs.sh
```

### Manual Sync

If you update data manually:

```bash
cd trading-logs

# 1. Regenerate aggregated files
node scripts/aggregate-data.js 2026

# 2. Sync to Next.js public folder
bash scripts/sync-to-nextjs.sh

# 3. Rebuild app (for production)
cd ..
npm run build
```

---

## 📁 File Structure

```
app/
├── strategies/
│   ├── _components/
│   │   └── WeeklyBarChart.js      # Recharts bar chart component
│   ├── [strategyId]/
│   │   └── page.js                # Individual strategy page
│   └── page.js                    # Strategies overview

public/data/trading/               # Auto-synced from trading-logs
├── weekly-by-strategy.json
├── yearly-summary.json
└── ... (other aggregated files)

trading-logs/
├── scripts/
│   ├── aggregate-data.js          # Enhanced with weekly summaries
│   ├── sync-to-nextjs.sh          # New: Syncs data to public/
│   └── publish-report.js          # Updated with auto-sync
└── data/2026/aggregated/          # Source of truth
```

---

## 🚀 Usage Guide

### View Strategy Profiles

**Live URLs** (once deployed):
- All strategies: `https://your-domain.com/strategies`
- Individual: `https://your-domain.com/strategies/AS_1`

**Local Development:**
```bash
npm run dev
# Visit http://localhost:3000/strategies
```

### Strategy IDs

| Strategy | ID | Description |
|----------|-----|-------------|
| AS 1 | `AS_1` | Asian Session Strategy 1 |
| AS 2 | `AS_2` | Asian Session Strategy 2 |
| EU | `EU` | European Session Strategy |
| NQI | `NQI` | NASDAQ Index Strategy |
| GOLD 1 | `GOLD_1` | Gold Trading Strategy 1 |
| GOLD 2 | `GOLD_2` | Gold Trading Strategy 2 |

---

## 🎨 Components

### WeeklyBarChart

```jsx
<WeeklyBarChart
  strategyId="AS_1"
  weeklyData={weeklyData}
  height={450}
/>
```

**Props:**
- `strategyId` - Strategy identifier (AS_1, AS_2, etc.)
- `weeklyData` - Data from `weekly-by-strategy.json`
- `height` - Chart height in pixels (default: 400)

**Features:**
- ✅ Auto-colored bars (green/red)
- ✅ Interactive tooltips
- ✅ Reference line at y=0
- ✅ Responsive container
- ✅ Summary stats grid

---

## 📋 Data Flow

```
┌─────────────────────┐
│ User adds weekly    │
│ trading data        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ generate-report.js  │  Creates markdown
│ publish-report.js   │  Publishes to app
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ aggregate-data.js   │  Generates:
│                     │  - yearly-summary.json
│                     │  - weekly-by-strategy.json
│                     │  - daily-index.json
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ sync-to-nextjs.sh   │  Copies to:
│                     │  public/data/trading/
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Next.js App         │  Components fetch:
│ - /strategies       │  - GET /data/trading/*.json
│ - /strategies/AS_1  │  - Auto-updates UI
└─────────────────────┘
```

---

## 🧪 Testing Checklist

Before deploying:

- [ ] Run `node scripts/aggregate-data.js 2026`
- [ ] Run `bash scripts/sync-to-nextjs.sh`
- [ ] Check files exist in `public/data/trading/`
- [ ] Run `npm run build` (should succeed)
- [ ] Test `/strategies` page loads
- [ ] Test `/strategies/AS_1` shows chart
- [ ] Verify chart data matches weekly data
- [ ] Check responsive design (mobile/tablet)
- [ ] Verify colors (green=profit, red=loss)

---

## 🔧 Customization

### Adding More Chart Types

Create new components in `app/strategies/_components/`:

```jsx
// Example: Equity curve chart
import { LineChart, Line, ... } from 'recharts';

export default function EquityCurveChart({ strategyId, data }) {
  // Implementation
}
```

### Changing Chart Colors

Edit `WeeklyBarChart.js`:

```jsx
const getBarColor = (value) => {
  return value >= 0
    ? 'hsl(var(--su))'  // Success color (green)
    : 'hsl(var(--er))'; // Error color (red)
};
```

### Adding New Metrics

Update strategy page to fetch additional data:

```jsx
// In strategies/[strategyId]/page.js
const monthlyRes = await fetch('/data/trading/2026-01.json');
const monthlyData = await monthlyRes.json();
```

---

## 🐛 Troubleshooting

### Chart Not Showing

**Issue:** Chart appears empty or shows "No data available"

**Solution:**
1. Check `public/data/trading/weekly-by-strategy.json` exists
2. Verify JSON structure is correct
3. Run `bash scripts/sync-to-nextjs.sh`
4. Clear browser cache and refresh

### Data Not Updating

**Issue:** Old data still showing after adding new week

**Solution:**
```bash
# 1. Regenerate aggregated files
cd trading-logs
node scripts/aggregate-data.js 2026

# 2. Sync to Next.js
bash scripts/sync-to-nextjs.sh

# 3. Rebuild (for production) or hard refresh (dev)
cd ..
npm run build
```

### Build Failing

**Issue:** `npm run build` fails with module errors

**Solution:**
- Check all imports are correct
- Verify Recharts is installed: `npm install recharts`
- Check file paths are relative from root
- Ensure all components are client components (`"use client"`)

---

## 📈 Performance

### Static vs Dynamic

- **Strategies Index** (`/strategies`): Client-side rendering, fetches data on mount
- **Strategy Profile** (`/strategies/[strategyId]`): Client-side rendering, dynamic route
- **Data Files**: Served statically from `/public/data/`

### Optimization Tips

1. **Caching:** Data is fetched from static JSON files (cached by browser)
2. **Build Time:** Pages are built dynamically (not pre-rendered) to always show latest data
3. **Bundle Size:** Recharts adds ~100KB (gzipped) - acceptable for charts

---

## 🆕 Adding New Weeks

Complete workflow:

```bash
# 1. Add new week's data
cd trading-logs
node scripts/generate-report.js data/2026/week-03.json

# 2. Publish to Next.js (auto-syncs data!)
node scripts/publish-report.js data/2026/week-03.json

# 3. Build and deploy
cd ..
npm run build
git add .
git commit -m "feat: add week 3 trading data"
git push
```

**What happens automatically:**
- ✅ Markdown report generated
- ✅ Report added to app
- ✅ Aggregated data regenerated
- ✅ Data synced to `public/data/trading/`
- ✅ Chart will show new week on next visit

---

## 📚 API Reference

### Fetch Strategy Data

```javascript
// Get yearly summary for all strategies
const res = await fetch('/data/trading/yearly-summary.json');
const data = await res.json();
const as1Stats = data.summary.byStrategy.AS_1;

// Get weekly chart data
const weeklyRes = await fetch('/data/trading/weekly-by-strategy.json');
const weeklyData = await weeklyRes.json();
const weeks = weeklyData.weeks; // Array of weekly data
```

### Data Schema

```typescript
interface WeeklyByStrategy {
  year: number;
  weeks: Array<{
    weekNumber: number;
    year: number;
    startDate: string;  // ISO date
    endDate: string;    // ISO date
    AS_1: number;       // R-multiple for week
    AS_2: number;
    EU: number;
    NQI: number;
    GOLD_1: number;
    GOLD_2: number;
    totalR: number;     // Sum of all strategies
  }>;
}
```

---

## 🎉 Summary

### What You Have Now:

1. ✅ **Weekly bar charts** - Similar to reference image
2. ✅ **Strategy profile pages** - Detailed stats for each strategy
3. ✅ **Auto-updating system** - No code changes needed for new data
4. ✅ **Responsive design** - Works on all devices
5. ✅ **Recharts integration** - Professional, interactive charts

### Next Enhancements (Optional):

- 📊 Equity curve chart (cumulative R over time)
- 📈 Monthly aggregation chart
- 🔍 Strategy comparison view
- 📱 Mobile-optimized charts
- 💾 Export data as CSV
- 🔔 Performance alerts

---

**Last Updated:** 2026-01-10
**Version:** 1.0.0
