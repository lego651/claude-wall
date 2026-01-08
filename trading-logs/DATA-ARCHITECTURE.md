# Data Architecture Overview

## 📊 Hybrid Storage Strategy

We use **both weekly files AND aggregated files** for optimal performance.

```
data/2026/
│
├── week-01.json ──────────┐
├── week-02.json ──────────┤
├── week-03.json ──────────┤  Raw weekly data
├── week-04.json ──────────┤  (source of truth)
├── ...                    │
└── week-52.json ──────────┘
    │
    │ Run: node scripts/aggregate-data.js 2026
    │
    ↓
    aggregated/
    ├── index.json ─────────→ Navigation (weeks, months available)
    ├── daily-index.json ───→ All days, flat (fast single-day lookup)
    ├── 2026-01.json ───────→ January data (all weeks in Jan)
    ├── 2026-02.json ───────→ February data
    ├── 2026-03.json ───────→ March data
    ├── ...
    └── yearly-summary.json → Full year stats
```

---

## 🎯 Query Performance

| Query Type | Files Needed | Speed | Use Case |
|------------|--------------|-------|----------|
| **Single day** | 1 lookup in daily-index | ⚡ Instant | "Show me Jan 15" |
| **Single week** | 1 weekly file | ⚡ Instant | Weekly detail view |
| **Month view** | 1 monthly file | ⚡ Instant | Monthly dashboard |
| **Date range (3 months)** | 3 monthly files | 🚀 Fast | "Jan 13 - Mar 31" |
| **Year overview** | 1 yearly summary | ⚡ Instant | Yearly stats |
| **All years** | N yearly summaries | 🚀 Fast | Multi-year comparison |

---

## 📁 File Structure Details

### Weekly File (`week-02.json`)
```json
{
  "weekNumber": 2,
  "year": 2026,
  "startDate": "2026-01-05",
  "endDate": "2026-01-09",
  "trades": {
    "2026-01-05": { "AS_1": 2.4, "AS_2": 1, ... },
    "2026-01-06": { "AS_1": -1.5, "AS_2": 1.5, ... }
  },
  "summary": {
    "byDay": { ... },
    "byStrategy": { ... },
    "weekly": { ... }
  }
}
```
**Purpose:** Source of truth, detailed weekly data

---

### Daily Index (`daily-index.json`)
```json
{
  "2026-01-05": {
    "AS_1": 2.4,
    "AS_2": 1,
    "EU": 1,
    "weekNumber": 2,
    "summary": { "totalR": 3.4, "averageR": 0.68, "trades": 5 }
  },
  "2026-01-06": { ... }
}
```
**Purpose:** Fast single-day lookup (no need to search through weeks)

---

### Monthly File (`2026-01.json`)
```json
{
  "month": "2026-01",
  "trades": {
    "2026-01-05": { "AS_1": 2.4, ... },
    "2026-01-06": { "AS_1": -1.5, ... },
    "2026-01-07": { ... }
    // All days in January
  },
  "weeks": [1, 2, 3, 4, 5],
  "summary": {
    "totalR": 25.6,
    "averageR": 0.52,
    "totalTrades": 95,
    "winRate": 65.3,
    "tradingDays": 22,
    "byStrategy": { "AS_1": {...}, "AS_2": {...} }
  }
}
```
**Purpose:** Monthly view, date-range queries within a month

---

### Yearly Summary (`yearly-summary.json`)
```json
{
  "year": 2026,
  "summary": {
    "totalR": 150.5,
    "averageR": 0.48,
    "totalTrades": 1250,
    "winRate": 68.4,
    "totalWeeks": 52,
    "byStrategy": {
      "AS_1": { "totalR": 25, "averageR": 0.5, "winRate": 65 },
      "AS_2": { ... }
    },
    "byMonth": [
      { "month": "2026-01", "totalR": 25.6, "trades": 95 },
      { "month": "2026-02", "totalR": 18.3, "trades": 85 },
      // ... all 12 months
    ]
  }
}
```
**Purpose:** Year overview, month-over-month trends

---

### Index (`index.json`)
```json
{
  "year": 2026,
  "weeks": [
    { "weekNumber": 1, "startDate": "2026-01-01", "totalR": 5.2 },
    { "weekNumber": 2, "startDate": "2026-01-05", "totalR": 8.3 }
  ],
  "months": ["2026-01", "2026-02", "2026-03"],
  "generated": "2026-01-08T19:38:42.982Z"
}
```
**Purpose:** Navigation, quick stats, data availability

---

## 🚀 Frontend Query Examples

### Example 1: Date Range (Jan 13 - Mar 31)

**Without aggregation:**
```javascript
// ❌ Inefficient: Need to fetch 11-12 weekly files
const weeks = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const data = await Promise.all(
  weeks.map(w => fetch(`/data/2026/week-${w}.json`))
);
// Then filter by date...
```

**With aggregation:**
```javascript
// ✅ Efficient: Only 3 monthly files
const months = ['2026-01', '2026-02', '2026-03'];
const data = await Promise.all(
  months.map(m => fetch(`/data/2026/aggregated/${m}.json`))
);

// Filter exact range
const filtered = data.flatMap(month =>
  Object.entries(month.trades)
    .filter(([date]) => date >= '2026-01-13' && date <= '2026-03-31')
);
```

**Performance:**
- Before: 11 requests (~50 KB total)
- After: 3 requests (~20 KB total)
- **Result: 73% fewer requests, 60% less data**

---

### Example 2: Year Trend Chart

**Without aggregation:**
```javascript
// ❌ Need to fetch all 52 weekly files and aggregate manually
const allWeeks = await Promise.all(
  Array.from({length: 52}, (_, i) =>
    fetch(`/data/2026/week-${i+1}.json`)
  )
);
// Then calculate monthly totals...
```

**With aggregation:**
```javascript
// ✅ Single file with monthly breakdown
const year = await fetch('/data/2026/aggregated/yearly-summary.json')
  .then(r => r.json());

const monthlyTrend = year.summary.byMonth; // Ready to chart!
```

**Performance:**
- Before: 52 requests (~200 KB)
- After: 1 request (~5 KB)
- **Result: 98% fewer requests, 97.5% less data**

---

## 🔄 Data Flow

```
1. Weekly Screenshot
   ↓
2. Parse & Create week-XX.json
   ↓
3. Generate weekly report (week-XX-YYYY.md)
   ↓
4. Run aggregation script
   ↓
5. Update aggregated files:
   - daily-index.json
   - YYYY-MM.json (current month)
   - yearly-summary.json
   - index.json
   ↓
6. Frontend re-fetches (automatic with cache invalidation)
```

---

## 💾 Storage Efficiency

**For 1 year (52 weeks):**

| File Type | Count | Size Each | Total |
|-----------|-------|-----------|-------|
| Weekly files | 52 | ~3 KB | ~150 KB |
| Monthly files | 12 | ~8 KB | ~96 KB |
| Daily index | 1 | ~20 KB | ~20 KB |
| Yearly summary | 1 | ~5 KB | ~5 KB |
| Index | 1 | ~2 KB | ~2 KB |
| **TOTAL** | **67** | — | **~273 KB** |

**Tiny!** Less than a single image. Easy to:
- Store in Git
- Deploy to CDN
- Fetch quickly
- Cache aggressively

---

## ✅ Benefits Summary

✅ **Weekly files**: Detailed data, easy updates, source of truth
✅ **Aggregated files**: Fast queries, optimized for frontend
✅ **Hybrid approach**: Best of both worlds
✅ **Scalable**: Efficient for 1 week or 10 years
✅ **Flexible**: Support all query patterns
✅ **Performant**: Minimal requests, small files
✅ **Maintainable**: Clear structure, automatic generation

---

## 🎯 Answer: "Is it good enough?"

**YES!** With aggregation:

| Query | Efficient? | Files Needed |
|-------|------------|--------------|
| Show week 2 | ✅ Yes | 1 weekly file |
| Show Jan 15 | ✅ Yes | 1 lookup in daily-index |
| Jan 13 - Mar 31 | ✅ Yes | 3 monthly files |
| Full year trend | ✅ Yes | 1 yearly summary |
| Compare 3 years | ✅ Yes | 3 yearly summaries |

**Bottom line:** Frontend can query any date range efficiently. 🚀
