import Link from "next/link";
import { reports, getReportBySlug } from "@/data/reports/reports";
import { getSEOTags } from "@/lib/seo";
import AdminLayout from "@/components/AdminLayout";
import ReportContent from "./ReportContent";

export async function generateMetadata({ params }) {
  const { reportId } = await params;
  const report = getReportBySlug(reportId);

  if (!report) {
    return getSEOTags({
      title: "Report Not Found",
      description: "The requested trading report could not be found.",
    });
  }

  return getSEOTags({
    title: `Trading Report - ${report.title}`,
    description: `Trading performance report for ${report.period}. Total R: ${report.summary.totalR > 0 ? '+' : ''}${report.summary.totalR}R, Win Rate: ${report.summary.winRate}%`,
    canonicalUrlRelative: `/reports/${report.slug}`,
  });
}

export async function generateStaticParams() {
  return reports.map((report) => ({
    reportId: report.slug,
  }));
}

export default async function ReportPage({ params }) {
  const { reportId } = await params;
  const report = getReportBySlug(reportId);

  if (!report) {
    return (
      <AdminLayout>
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold mb-4">Report Not Found</h1>
          <p className="text-gray-600 mb-8">
            The trading report you're looking for doesn't exist.
          </p>
          <Link href="/admin/reports" className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-2xl font-bold transition-colors hover:bg-[#5548E6]" style={{ backgroundColor: '#635BFF' }}>
            Back to Reports
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const fullContent = report.getContent();
  
  // Parse markdown to extract Weekly Overview data
  const parseWeeklyOverview = (content) => {
    const overviewMatch = content.match(/\| \*\*Total R\*\* \| (🟢|🔴) ([+-]?\d+\.?\d*)R \|/);
    const avgRMatch = content.match(/\| \*\*Average R\/Trade\*\* \| (🟢|🔴) ([+-]?\d+\.?\d*)R \|/);
    const tradesMatch = content.match(/\| \*\*Total Trades\*\* \| (\d+) \|/);
    const winningMatch = content.match(/\| \*\*Winning Trades\*\* \| (\d+) (🟢|🔴) \|/);
    const losingMatch = content.match(/\| \*\*Losing Trades\*\* \| (\d+) (🟢|🔴) \|/);
    const winRateMatch = content.match(/\| \*\*Win Rate\*\* \| ([\d.]+)% \|/);
    const bestDayMatch = content.match(/\| \*\*Best Day\*\* \| ([\d-]+) \((🟢|🔴) ([+-]?\d+\.?\d*)R\) \|/);
    const worstDayMatch = content.match(/\| \*\*Worst Day\*\* \| ([\d-]+) \((🟢|🔴) ([+-]?\d+\.?\d*)R\) \|/);
    
    return {
      totalR: overviewMatch ? parseFloat(overviewMatch[2]) : report.summary.totalR,
      avgRPerTrade: avgRMatch ? parseFloat(avgRMatch[2]) : (report.summary.totalR / report.summary.totalTrades).toFixed(2),
      totalTrades: tradesMatch ? parseInt(tradesMatch[1]) : report.summary.totalTrades,
      winningTrades: winningMatch ? parseInt(winningMatch[1]) : null,
      losingTrades: losingMatch ? parseInt(losingMatch[1]) : null,
      winRate: winRateMatch ? parseFloat(winRateMatch[1]) : report.summary.winRate,
      bestDay: bestDayMatch ? { date: bestDayMatch[1], value: parseFloat(bestDayMatch[3]) } : null,
      worstDay: worstDayMatch ? { date: worstDayMatch[1], value: parseFloat(worstDayMatch[3]) } : null,
    };
  };

  const overview = parseWeeklyOverview(fullContent);
  
  // Parse best day from summary string
  const bestDayMatch = report.summary.bestDay?.match(/\(([+-]?\d+\.?\d*)R\)/);
  const bestDayValue = bestDayMatch ? bestDayMatch[1] : '';
  const bestDayLabel = report.summary.bestDay?.split(' (')[0] || '';
  
  // Calculate winning/losing trades if not in markdown
  const winningTrades = overview.winningTrades ?? Math.round((report.summary.winRate / 100) * report.summary.totalTrades);
  const losingTrades = overview.losingTrades ?? (report.summary.totalTrades - winningTrades);
  const avgRPerTrade = parseFloat(overview.avgRPerTrade) || (report.summary.totalR / report.summary.totalTrades).toFixed(2);
  
  // Parse daily performance data
  const parseDailyPerformance = (content) => {
    const lines = content.split('\n');
    const dailyData = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.match(/^\| (Mon|Tue|Wed|Thu|Fri) \|/)) {
        const match = line.match(/^\| (Mon|Tue|Wed|Thu|Fri) \| ([\d-]+) \| ([+-]?[\d.]+)R \| ([+-]?[\d.]+)R \| (\d+) \| ([\d.]+)% \|/);
        if (match) {
          const avgRStr = match[4].replace(/^\+-/, '-'); // Fix "+-0.27R" to "-0.27R"
          dailyData.push({
            day: match[1],
            date: match[2],
            totalR: parseFloat(match[3]),
            avgR: parseFloat(avgRStr),
            trades: parseInt(match[5]),
            winRate: parseFloat(match[6])
          });
        }
      }
    }
    
    return dailyData;
  };

  const dailyData = parseDailyPerformance(fullContent);
  
  // Parse strategy performance data
  const parseStrategyPerformance = (content) => {
    const lines = content.split('\n');
    const strategyData = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.match(/^\| (AS \d+|NQI|EU|GOLD \d+) \|/)) {
        const match = line.match(/^\| (AS \d+|NQI|EU|GOLD \d+) \| ([+-]?[\d.]+)R \| ([+-]?[\d.]+)R \| (\d+) \| (\d+) \| (\d+) \| ([\d.]+)% \|/);
        if (match) {
          strategyData.push({
            name: match[1],
            totalR: parseFloat(match[2]),
            avgR: parseFloat(match[3]),
            trades: parseInt(match[4]),
            win: parseInt(match[5]),
            loss: parseInt(match[6]),
            winRate: parseFloat(match[7])
          });
        }
      }
    }
    
    return strategyData;
  };

  const strategyData = parseStrategyPerformance(fullContent);
  
  // Parse Highlights data
  const parseHighlights = (content) => {
    const lines = content.split('\n');
    const topPerformers = [];
    let improvement = null;
    let inHighlights = false;
    let inTopPerformers = false;
    let inImprovement = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('## 🏆 Highlights')) {
        inHighlights = true;
        continue;
      }
      if (inHighlights && line.includes('### Top Performers')) {
        inTopPerformers = true;
        continue;
      }
      if (inHighlights && line.includes('### Areas for Improvement')) {
        inTopPerformers = false;
        inImprovement = true;
        continue;
      }
      if (inHighlights && line.includes('---')) {
        break;
      }
      if (inTopPerformers) {
        const match = line.match(/🥇|🥈|🥉/);
        if (match) {
          const perfMatch = line.match(/(🥇|🥈|🥉) \*\*(.+?)\*\* - ([\d.]+)R \(([\d.]+)% win rate, (\d+) trades\)/);
          if (perfMatch) {
            topPerformers.push({
              name: perfMatch[2],
              totalR: parseFloat(perfMatch[3]),
              winRate: parseFloat(perfMatch[4]),
              trades: parseInt(perfMatch[5])
            });
          }
        }
      }
      if (inImprovement) {
        const match = line.match(/^_(.+?)_$/);
        if (match) {
          improvement = match[1];
        }
      }
    }
    
    return { topPerformers, improvement };
  };

  // Parse Key Insights
  const parseKeyInsights = (content) => {
    const lines = content.split('\n');
    const insights = [];
    let inInsights = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('## 📝 Key Insights')) {
        inInsights = true;
        continue;
      }
      if (inInsights && line.includes('---')) {
        break;
      }
      if (inInsights && line.match(/^- /)) {
        const text = line.replace(/^- /, '').replace(/✅|📊|📈|🌟/g, '').trim();
        if (text) {
          insights.push(text);
        }
      }
    }
    
    return insights;
  };

  // Parse Recommendations
  const parseRecommendations = (content) => {
    const lines = content.split('\n');
    const recs = [];
    let inRecs = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('## 💡 Recommendations')) {
        inRecs = true;
        continue;
      }
      if (inRecs && (line.includes('---') || line.includes('*Report'))) {
        break;
      }
      if (inRecs && line.match(/^- 💎/)) {
        const match = line.match(/- 💎 \*\*(.+?)\*\*: (.+?)$/);
        if (match) {
          recs.push({ title: match[1], description: match[2] });
        }
      }
    }
    
    return recs;
  };

  const highlights = parseHighlights(fullContent);
  const keyInsights = parseKeyInsights(fullContent);
  const recommendations = parseRecommendations(fullContent);

  // Extract only serializable data from report (no functions)
  const reportData = {
    slug: report.slug,
    type: report.type,
    title: report.title,
    period: report.period,
    weekNumber: report.weekNumber,
    year: report.year,
    publishedAt: report.publishedAt,
    summary: report.summary,
  };

  return (
    <AdminLayout>
      <ReportContent
        report={reportData}
        overview={overview}
        dailyData={dailyData}
        strategyData={strategyData}
        recommendations={recommendations}
        bestDayLabel={bestDayLabel}
        bestDayValue={bestDayValue}
        avgRPerTrade={avgRPerTrade}
        winningTrades={winningTrades}
        losingTrades={losingTrades}
      />
    </AdminLayout>
  );
}
