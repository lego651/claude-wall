import Link from "next/link";
import { reports, getAllYears, getReportsByYear, reportTypes } from "@/app/reports/_assets/reports";
import { getSEOTags } from "@/libs/seo";
import AdminLayout from "@/components/AdminLayout";

export const metadata = getSEOTags({
  title: "Trading Logs | Performance Reports",
  description: "View detailed trading performance reports with R-multiples, win rates, and strategy breakdowns.",
  canonicalUrlRelative: "/reports",
});

const MiniStat = ({ label, value, color = "text-gray-900" }) => (
  <div className="space-y-1.5">
    <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</div>
    <div className={`text-xl font-black ${color}`}>{value}</div>
  </div>
);

const ReportCard = ({ report }) => {
  const totalRColor = report.summary.totalR > 0 ? 'text-emerald-500' : 'text-rose-500';
  const totalR = report.summary.totalR > 0 ? `+${report.summary.totalR}R` : `${report.summary.totalR}R`;

  return (
    <Link href={`/admin/reports/${report.slug}`}>
      <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-200/50 hover:-translate-y-1 transition-all duration-300 group overflow-hidden">
        <div className="p-10 space-y-10">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h3 className="text-2xl font-black text-gray-900">{report.title}</h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{report.period}</p>
            </div>
            <span className="text-white text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-widest shadow-lg" style={{ backgroundColor: '#635BFF', boxShadow: '0 10px 15px -3px rgba(99, 91, 255, 0.1)' }}>
              {report.type === reportTypes.weekly ? 'Weekly' : 'Monthly'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <MiniStat label="Total R" value={totalR} color={totalRColor} />
            <MiniStat label="Win Rate" value={`${report.summary.winRate}%`} />
            <MiniStat label="Trades" value={report.summary.totalTrades} />
          </div>

          <div className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100 flex items-center justify-between group-hover:bg-white group-hover:border-[#635BFF] group-hover:border-opacity-20 transition-colors">
            <div className="space-y-1">
              <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Performance Highlight</div>
              <div className="text-sm font-bold text-gray-700">Best Day: <span className="text-emerald-500">{report.summary.bestDay}</span></div>
            </div>
            <button className="bg-white p-3 rounded-xl border border-gray-200 text-gray-400 hover:text-[#635BFF] hover:border-[#635BFF] hover:border-opacity-60 transition-all shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
              </svg>
            </button>
          </div>
        </div>

        <div className="px-10 py-5 bg-gray-50/30 border-t border-gray-50 flex justify-between items-center text-[9px] font-black text-gray-400 uppercase tracking-widest transition-colors group-hover:bg-[#635BFF] group-hover:bg-opacity-5">
          <span>Verified Performance</span>
          <span className="hover:underline" style={{ color: '#635BFF' }}>View Full Report</span>
        </div>
      </div>
    </Link>
  );
};

export default function TradingLogsPage() {
  const years = getAllYears();
  const weeklyReports = reports.filter(r => r.type === reportTypes.weekly);
  const monthlyReports = reports.filter(r => r.type === reportTypes.monthly);

  // Calculate aggregate stats
  const totalR = reports.reduce((sum, r) => sum + r.summary.totalR, 0);
  const avgWinRate = reports.reduce((sum, r) => sum + r.summary.winRate, 0) / reports.length;
  const totalTrades = reports.reduce((sum, r) => sum + r.summary.totalTrades, 0);

  return (
    <AdminLayout>
      <div className="space-y-16 max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">

        {/* Premium Header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-gray-100 pb-12">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl text-white shadow-lg" style={{ backgroundColor: '#635BFF', boxShadow: '0 10px 15px -3px rgba(99, 91, 255, 0.1)' }}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight">Trading Performance Reports</h1>
            </div>
            <p className="text-lg text-gray-400 font-medium max-w-2xl leading-relaxed">
              Detailed weekly and monthly trading reports tracking R-multiples across <span className="text-gray-900 font-bold">6 verified strategies</span>. View comprehensive breakdowns and key performance insights.
            </p>
          </div>
        </section>

        {/* Hero KPI Stats */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-emerald-50/50 border border-emerald-100 p-10 rounded-[40px] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100/50 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-110 transition-transform" />
            <div className="relative z-10">
              <div className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-4">Total R (All Time)</div>
              <div className="text-5xl font-black text-emerald-500 tracking-tighter">+{totalR.toFixed(2)}R</div>
              <div className="mt-6 flex items-center gap-2 text-xs font-bold text-emerald-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                Top 5% of Portfolio
              </div>
            </div>
          </div>

          <div className="border p-10 rounded-[40px] group" style={{ backgroundColor: 'rgba(99, 91, 255, 0.05)', borderColor: 'rgba(99, 91, 255, 0.2)' }}>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-4" style={{ color: '#635BFF' }}>Average Win Rate</div>
            <div className="text-5xl font-black tracking-tighter" style={{ color: '#635BFF' }}>{avgWinRate.toFixed(1)}%</div>
            <div className="mt-8 w-full bg-white h-1.5 rounded-full overflow-hidden border" style={{ borderColor: 'rgba(99, 91, 255, 0.2)' }}>
              <div className="h-full rounded-full" style={{ width: `${avgWinRate.toFixed(1)}%`, backgroundColor: '#635BFF' }} />
            </div>
          </div>

          <div className="bg-white border border-gray-100 p-10 rounded-[40px] shadow-sm">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Total Trades</div>
            <div className="text-5xl font-black text-gray-900 tracking-tighter">{totalTrades}</div>
            <div className="mt-6 text-xs font-bold text-gray-400 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-200" /> Across {reports.length} Weeks
            </div>
          </div>
        </section>

        {/* Weekly Reports Section */}
        {weeklyReports.length > 0 && (
          <section className="space-y-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-2xl">📅</span>
                <h2 className="text-2xl font-black text-gray-900">Weekly Reports</h2>
                <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-lg text-xs font-black">{weeklyReports.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors">Sort by Date</button>
                <button className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors">Filters</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {weeklyReports
                .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
                .map((report) => (
                  <ReportCard key={report.slug} report={report} />
                ))}
            </div>
          </section>
        )}

        {/* Monthly Reports Section */}
        {monthlyReports.length > 0 && (
          <section className="space-y-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-2xl">📆</span>
                <h2 className="text-2xl font-black text-gray-900">Monthly Reports</h2>
                <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-lg text-xs font-black">{monthlyReports.length}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {monthlyReports
                .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
                .map((report) => (
                  <ReportCard key={report.slug} report={report} />
                ))}
            </div>
          </section>
        )}

        {/* EMPTY STATE */}
        {reports.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-2xl font-bold mb-2">No Reports Yet</h3>
            <p className="text-gray-600">
              Trading reports will appear here once they are generated.
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
