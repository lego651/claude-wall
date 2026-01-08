# Quick Reference - Trading Log Entry

## When you provide a screenshot at end of week:

### Method 1: Tell Claude Code (Recommended)
Simply say: "Here's my trading log for the week" and attach/show the screenshot. I'll:
1. Parse the data from the image
2. Calculate the correct dates for Mon-Fri of that week
3. Compute all summaries (daily totals/averages, strategy stats, weekly stats)
4. Create the JSON file in the correct location
5. Generate a beautiful weekly report
6. Show you a summary

**To use:** Save screenshot to `screenshots/YYYY-MM-DD.png` and mention it to me!

### Method 2: Interactive Script (Manual Entry)
```bash
node trading-logs/scripts/add-week.js
```
Then follow the prompts to enter each R-value.

## Reading Screenshot Format

| Day  | AS 1 | AS 2 | EU | NQI | GOLD 1 | GOLD 2 |
|------|------|------|----|----|--------|--------|
| Mon  | +2.4 | +1   | +1 |    |        | -1     |

- **Green numbers** = Winning trades (positive R)
- **Red numbers** = Losing trades (negative R)
- **Empty cells** = No trade taken (stored as null)
- **Days**: Mon-Fri refer to the most recent complete trading week

## What Gets Calculated

### For Each Day:
- Total R (sum of all trades)
- Average R per trade
- Number of trades
- Winning vs losing trades

### For Each Strategy:
- Total R for the week
- Average R per trade
- Number of trades
- Win rate (%)

### For the Week:
- Total R across all strategies
- Average R per trade
- Total number of trades
- Overall win rate
- Best performing day
- Worst performing day

## File Location
Data is saved to: `trading-logs/data/YYYY/week-WW.json`

Example: `trading-logs/data/2026/week-02.json`

## Viewing Data

### Generate Weekly Report (with charts!)
```bash
node trading-logs/scripts/generate-report.js data/2026/week-02.json
```
Or just tell me: **"Generate report for week 2"**

Reports saved to: `trading-logs/reports/week-XX-YYYY.md`

### View raw data:
```bash
cat trading-logs/data/2026/week-02.json
```

### List all weeks:
```bash
ls -la trading-logs/data/2026/
```

## Strategy Names

Screenshots show these headers, stored with these keys:
- **AS 1** → `AS_1`
- **AS 2** → `AS_2`
- **EU** → `EU`
- **NQI** → `NQI`
- **GOLD 1** → `GOLD_1`
- **GOLD 2** → `GOLD_2`

## Tips

1. Save screenshots to `trading-logs/screenshots/` with date: `YYYY-MM-DD.png`
2. Enter data at end of week while it's fresh
3. Empty cells = no trade (use empty string when prompted)
4. Negative R-values should include the minus sign: `-1.5`
5. Use decimals for partial R: `1.5`, `2.4`, etc.

## Example Weekly Summary Output

```
=== WEEKLY SUMMARY ===
Total R: 8.3
Average R: 0.44
Total Trades: 19
Win Rate: 68.4%
Best Day: 2026-01-08 (4.9R)
Worst Day: 2026-01-07 (-0.5R)

=== BY STRATEGY ===
AS 1: -0.1R (3 trades, 33.3% win rate)
AS 2: 2.5R (4 trades, 75.0% win rate)
EU: 0.4R (4 trades, 50.0% win rate)
NQI: 3.0R (2 trades, 100.0% win rate)
GOLD 1: 3.0R (2 trades, 100.0% win rate)
GOLD 2: 1.0R (4 trades, 50.0% win rate)
```
