# 🌐 Web Integration Guide

This guide explains how trading reports are integrated into the Next.js app and deployed to Vercel.

---

## 📁 File Structure

```
app/trading-logs/
├── _assets/
│   ├── components/
│   │   └── MarkdownRenderer.js      # Custom markdown parser
│   ├── reports.js                    # Reports metadata
│   └── week-02-2026.md              # Markdown report files
├── reports/
│   └── [reportId]/
│       └── page.js                   # Dynamic report detail page
└── page.js                           # Reports index/listing page

trading-logs/
├── data/                             # Source JSON files
├── reports/                          # Source markdown files
└── scripts/
    ├── generate-report.js            # Generate markdown from JSON
    ├── publish-report.js             # Publish report to Next.js app
    └── aggregate-data.js             # Create aggregated data
```

---

## 🚀 Publishing Workflow

### Option 1: Automated (Recommended)

After creating a weekly report JSON and generating the markdown:

```bash
cd trading-logs

# 1. Generate the markdown report
node scripts/generate-report.js data/2026/week-02.json

# 2. Publish to Next.js app
node scripts/publish-report.js data/2026/week-02.json

# 3. Build and test
cd ..
npm run build
npm run dev

# 4. Commit and deploy
git add .
git commit -m "feat: add week 2 trading report"
git push
```

### Option 2: Manual

1. **Copy the markdown file:**
   ```bash
   cp trading-logs/reports/week-02-2026.md app/trading-logs/_assets/
   ```

2. **Add metadata to `app/trading-logs/_assets/reports.js`:**
   ```javascript
   {
     slug: 'week-02-2026',
     type: reportTypes.weekly,
     title: 'Week 2, 2026',
     period: '2026-01-05 to 2026-01-09',
     weekNumber: 2,
     year: 2026,
     publishedAt: '2026-01-10',
     summary: {
       totalR: 11.20,
       winRate: 60.9,
       totalTrades: 23,
       bestDay: 'Thursday (+4.90R)',
     },
     getContent: () => getMarkdownContent('week-02-2026.md'),
   },
   ```

3. **Build and test:**
   ```bash
   npm run build
   npm run dev
   ```

---

## 📊 How Reports Are Rendered

### 1. Markdown Parser (`MarkdownRenderer.js`)

The custom markdown renderer preserves:
- ✅ **ASCII Charts** - Pre-formatted progress bars and performance charts
- ✅ **Tables** - Styled with DaisyUI table classes
- ✅ **Emojis** - All emojis render correctly
- ✅ **Formatting** - Headers, lists, bold, inline code

**Key Features:**
- No external dependencies (no `react-markdown` needed)
- Preserves exact spacing for ASCII art
- Mobile-responsive tables with horizontal scroll
- Consistent styling with the rest of the app

### 2. Dynamic Routes

**Index Page:** `/trading-logs`
- Lists all reports (weekly and monthly)
- Shows aggregate stats (total R, avg win rate, total trades)
- Card-based layout with quick stats preview

**Report Detail:** `/trading-logs/reports/[reportId]`
- Full markdown content
- Quick stats header (Total R, Win Rate, Trades, Best Day)
- Proper SEO metadata
- Back navigation

### 3. Static Generation

Reports are **statically generated** at build time:
- Fast page loads
- SEO-friendly
- Deployed to Vercel CDN

---

## 🎨 Styling

Reports use DaisyUI components and Tailwind CSS:

### Quick Stats Cards
```javascript
<div className="card bg-base-200 card-sm">
  <div className="card-body">
    <div className="text-sm text-base-content/70">Total R</div>
    <div className="text-2xl font-bold text-success">+11.20R</div>
  </div>
</div>
```

### Tables
```javascript
<table className="table table-sm md:table-md w-full">
  <thead>...</thead>
  <tbody>...</tbody>
</table>
```

### ASCII Charts Preservation
```javascript
<pre className="bg-base-300 p-4 rounded-lg overflow-x-auto my-4 font-mono text-sm whitespace-pre">
  {asciiContent}
</pre>
```

---

## 🔄 Deployment to Vercel

### Automatic Deployment

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "feat: add weekly report"
   git push origin main
   ```

2. **Vercel auto-deploys** from the `main` branch
3. **Live in ~2 minutes** at your Vercel URL

### Build Validation

Before pushing, always run:
```bash
npm run build
```

This ensures:
- No build errors
- All static pages generate correctly
- Markdown parses without issues

---

## 📱 Responsive Design

Reports are fully responsive:

### Desktop
- 3-column grid for report cards
- Wide tables with all columns visible
- Side-by-side quick stats

### Tablet
- 2-column grid for report cards
- Horizontal scroll for tables
- Stacked quick stats

### Mobile
- 1-column layout
- Card-based quick stats (2x2 grid)
- Touch-friendly navigation
- Horizontal scroll for ASCII charts

---

## 🔍 SEO Optimization

Each report page includes:

```javascript
export async function generateMetadata({ params }) {
  return getSEOTags({
    title: `Trading Report - Week 2, 2026`,
    description: `Total R: +11.20R, Win Rate: 60.9%`,
    canonicalUrlRelative: `/trading-logs/reports/week-02-2026`,
  });
}
```

**Benefits:**
- Proper Open Graph tags
- Twitter Cards
- Search engine friendly
- Dynamic titles and descriptions

---

## 🧪 Testing Checklist

Before deploying a new report:

- [ ] Markdown file copied to `app/trading-logs/_assets/`
- [ ] Metadata added to `reports.js`
- [ ] `npm run build` succeeds
- [ ] Report visible at `/trading-logs`
- [ ] Report detail page loads at `/trading-logs/reports/[slug]`
- [ ] ASCII charts render correctly
- [ ] Tables display properly
- [ ] Mobile layout looks good
- [ ] Quick stats show correct data

---

## 🆕 Adding New Report Types

### For Monthly Reports:

1. **Update `reportTypes` in `reports.js`:**
   ```javascript
   export const reportTypes = {
     weekly: 'weekly',
     monthly: 'monthly', // Already exists
   };
   ```

2. **Add monthly report:**
   ```javascript
   {
     slug: 'month-01-2026',
     type: reportTypes.monthly,
     title: 'January 2026',
     period: '2026-01-01 to 2026-01-31',
     month: 1,
     year: 2026,
     // ... summary data
   }
   ```

3. **Monthly reports automatically:**
   - Get different badge color
   - Show in separate section
   - Calculate different stats

---

## 🐛 Troubleshooting

### Issue: ASCII charts not displaying correctly
**Solution:** Ensure `whitespace-pre` class is on the `<pre>` tag

### Issue: Tables overflow on mobile
**Solution:** Wrapper div has `overflow-x-auto` class

### Issue: Build fails with "Module not found"
**Solution:** Check markdown filename matches `getContent()` call

### Issue: Report not showing on index page
**Solution:** Verify report added to `reports` array in `reports.js`

---

## 📈 Future Enhancements

Potential improvements:

1. **Charts Integration**
   - Add interactive charts with Recharts
   - Visual equity curve
   - Strategy comparison charts

2. **Filtering & Search**
   - Filter by strategy
   - Search by date range
   - Filter by profitability

3. **Export Features**
   - Download as PDF
   - Export data as CSV
   - Share specific reports

4. **Authentication**
   - Private reports for internal team
   - Public reports for customers
   - Role-based access

---

## 📞 Questions?

If you encounter issues or need help:

1. Check `trading-logs/README.md` for data generation
2. Review `CLAUDE.md` for project context
3. Test locally with `npm run dev` before deploying

---

**Last Updated:** 2026-01-10
**Version:** 1.0.0
