# Frontend Integration Guide

## 📊 Data Architecture

We use a **hybrid approach** for optimal performance:

```
data/2026/
├── week-01.json              # Individual weeks (detailed)
├── week-02.json
├── ...
└── aggregated/
    ├── index.json            # Navigation index
    ├── daily-index.json      # All days, flat structure
    ├── 2026-01.json          # Monthly aggregation
    ├── 2026-02.json
    ├── 2026-03.json
    └── yearly-summary.json   # Full year stats
```

### Why This Works:

✅ **Weekly files**: Detailed data, easy to add new weeks
✅ **Aggregated files**: Fast date-range queries, monthly/yearly stats
✅ **Run aggregation**: After adding new week data (I'll do this automatically)

---

## 🚀 Frontend Query Patterns

### Query 1: Show a Specific Week
```javascript
// Fast - single file
const week = await fetch('/data/2026/week-02.json').then(r => r.json());

// Access data
console.log(week.summary.weekly.totalR); // 8.3
console.log(week.summary.byDay);         // Daily breakdown
console.log(week.summary.byStrategy);    // Strategy stats
```

### Query 2: Show a Specific Day
```javascript
// Super fast - single lookup
const dailyIndex = await fetch('/data/2026/aggregated/daily-index.json').then(r => r.json());
const dayData = dailyIndex['2026-01-08'];

console.log(dayData.AS_1);    // -1
console.log(dayData.summary); // { totalR: 4.9, averageR: 0.98, ... }
```

### Query 3: Date Range (e.g., Jan 13 - March 31)
```javascript
// Step 1: Determine which months are needed
const months = ['2026-01', '2026-02', '2026-03'];

// Step 2: Fetch monthly files (only 3 requests!)
const monthlyData = await Promise.all(
  months.map(m => fetch(`/data/2026/aggregated/${m}.json`).then(r => r.json()))
);

// Step 3: Filter by date range
const startDate = '2026-01-13';
const endDate = '2026-03-31';

const rangeData = monthlyData.flatMap(month =>
  Object.entries(month.trades)
    .filter(([date]) => date >= startDate && date <= endDate)
    .map(([date, trades]) => ({
      date,
      trades,
      summary: month.summary // Monthly context
    }))
);

console.log(rangeData); // All days in range
```

### Query 4: Monthly View
```javascript
// Single file per month
const january = await fetch('/data/2026/aggregated/2026-01.json').then(r => r.json());

console.log(january.summary.totalR);      // Month total
console.log(january.summary.byStrategy);  // Strategy breakdown
console.log(january.trades);              // All days in month
console.log(january.weeks);               // [1, 2, 3, 4, 5] - week numbers
```

### Query 5: Year Overview
```javascript
// Single file for entire year
const yearSummary = await fetch('/data/2026/aggregated/yearly-summary.json').then(r => r.json());

console.log(yearSummary.summary.totalR);       // Year total
console.log(yearSummary.summary.byStrategy);   // Strategy performance
console.log(yearSummary.summary.byMonth);      // Month-by-month array

// Chart month-over-month
const monthlyTrend = yearSummary.summary.byMonth.map(m => ({
  month: m.month,
  totalR: m.totalR,
  winRate: m.winRate
}));
```

### Query 6: Navigation / Index
```javascript
// Get overview of available data
const index = await fetch('/data/2026/aggregated/index.json').then(r => r.json());

console.log(index.weeks);   // All weeks with dates and quick stats
console.log(index.months);  // ['2026-01', '2026-02', ...]
console.log(index.year);    // 2026
```

---

## 📈 Example: Chart Components

### Daily Chart (Single Week)
```javascript
async function DailyChart({ weekNumber, year }) {
  const week = await fetch(`/data/${year}/week-${weekNumber}.json`).then(r => r.json());

  const chartData = Object.entries(week.summary.byDay).map(([date, stats]) => ({
    date,
    totalR: stats.totalR,
    trades: stats.trades,
    winRate: stats.winRate
  }));

  return <LineChart data={chartData} />;
}
```

### Strategy Comparison (Custom Range)
```javascript
async function StrategyComparison({ startDate, endDate }) {
  // Get year and determine months needed
  const year = startDate.substring(0, 4);
  const startMonth = startDate.substring(0, 7);
  const endMonth = endDate.substring(0, 7);

  // Fetch monthly files
  const months = getMonthsInRange(startMonth, endMonth);
  const monthlyData = await Promise.all(
    months.map(m => fetch(`/data/${year}/aggregated/${m}.json`).then(r => r.json()))
  );

  // Aggregate strategies across months
  const strategies = ['AS_1', 'AS_2', 'EU', 'NQI', 'GOLD_1', 'GOLD_2'];
  const strategyData = strategies.map(strategy => {
    const totalR = monthlyData.reduce((sum, month) =>
      sum + (month.summary.byStrategy[strategy]?.totalR || 0), 0
    );
    return { strategy, totalR };
  });

  return <BarChart data={strategyData} />;
}
```

### Year-over-Year Comparison
```javascript
async function YearOverYear({ years }) {
  const yearData = await Promise.all(
    years.map(year =>
      fetch(`/data/${year}/aggregated/yearly-summary.json`).then(r => r.json())
    )
  );

  const comparison = yearData.map(data => ({
    year: data.year,
    totalR: data.summary.totalR,
    winRate: data.summary.winRate,
    trades: data.summary.totalTrades
  }));

  return <LineChart data={comparison} />;
}
```

---

## ⚡ Performance Optimization

### Strategy: Lazy Load with Caching

```javascript
class TradingDataService {
  constructor() {
    this.cache = new Map();
  }

  async fetchWeek(year, weekNumber) {
    const key = `week-${year}-${weekNumber}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const data = await fetch(`/data/${year}/week-${weekNumber}.json`).then(r => r.json());
    this.cache.set(key, data);
    return data;
  }

  async fetchMonth(year, month) {
    const key = `month-${year}-${month}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const data = await fetch(`/data/${year}/aggregated/${year}-${month}.json`).then(r => r.json());
    this.cache.set(key, data);
    return data;
  }

  async fetchDateRange(startDate, endDate) {
    // Determine if monthly files are more efficient
    const dayCount = getDaysBetween(startDate, endDate);

    if (dayCount <= 7) {
      // Small range - use daily index
      return this.fetchFromDailyIndex(startDate, endDate);
    } else {
      // Larger range - use monthly aggregations
      return this.fetchFromMonthly(startDate, endDate);
    }
  }
}
```

---

## 🎯 Answer to Your Question

### "What if frontend wants Jan 13 - March 31?"

**Before aggregation:**
- ❌ Fetch 11+ separate weekly JSON files
- ❌ Filter and merge manually
- ❌ Slow and inefficient

**After aggregation:**
- ✅ Fetch only 3 monthly files: `2026-01.json`, `2026-02.json`, `2026-03.json`
- ✅ Filter by date range (built-in)
- ✅ Fast and efficient

**Code:**
```javascript
// Easy date range query
const months = ['2026-01', '2026-02', '2026-03'];
const data = await Promise.all(
  months.map(m => fetch(`/data/2026/aggregated/${m}.json`).then(r => r.json()))
);

// Filter exact range
const filtered = data.flatMap(month =>
  Object.entries(month.trades)
    .filter(([date]) => date >= '2026-01-13' && date <= '2026-03-31')
);
```

---

## 🔄 Workflow

1. **Add new week data** (via screenshot)
2. **Run aggregation**: `node scripts/aggregate-data.js 2026` (I'll do this automatically)
3. **Frontend re-fetches** updated aggregated files

---

## 📦 File Sizes (Estimated)

- Weekly file: ~2-5 KB
- Daily index: ~10-20 KB per year
- Monthly file: ~5-10 KB
- Yearly summary: ~3-5 KB

**Total for 1 year (52 weeks):**
- Weekly files: ~100-250 KB
- Aggregated files: ~50-100 KB
- **Combined: ~150-350 KB** (tiny!)

---

## ✨ Best Practices

1. **Use weekly files** for detailed weekly views
2. **Use daily index** for single-day lookups
3. **Use monthly files** for date ranges and monthly charts
4. **Use yearly summary** for year overview and trends
5. **Cache aggressively** - data rarely changes after creation
6. **Prefetch** index.json on app load for navigation

---

**TL;DR:** Yes, it's easy! Monthly aggregated files make date-range queries simple and fast. 🚀
