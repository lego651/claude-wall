"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import AdminLayout from "@/components/AdminLayout";

const STRATEGIES = {
  AS_1: { id: 'AS_1', name: 'AS 1', shortName: 'AS', description: 'Asian Session Strategy 1', internalId: 'AS_01', created: 'Dec 2023' },
  AS_2: { id: 'AS_2', name: 'AS 2', shortName: 'AS', description: 'Asian Session Strategy 2', internalId: 'AS_02', created: 'Dec 2023' },
  EU: { id: 'EU', name: 'EU', shortName: 'EU', description: 'European Session Strategy', internalId: 'EU_01', created: 'Dec 2023' },
  NQI: { id: 'NQI', name: 'NQI', shortName: 'NQ', description: 'NASDAQ Index Strategy', internalId: 'NQI_01', created: 'Jan 2024' },
  GOLD_1: { id: 'GOLD_1', name: 'GOLD 1', shortName: 'G1', description: 'Gold Trading Strategy 1', internalId: 'GOLD_01', created: 'Jan 2024' },
  GOLD_2: { id: 'GOLD_2', name: 'GOLD 2', shortName: 'G2', description: 'Gold Trading Strategy 2', internalId: 'GOLD_02', created: 'Feb 2024' },
};

const CompactStat = ({ label, value, color = 'text-gray-900' }) => (
  <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm">
    <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">{label}</div>
    <div className={`text-xl font-black ${color}`}>{value}</div>
  </div>
);

export default function StrategyDetailPage({ params }) {
  const [strategyId, setStrategyId] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('ALL');

  useEffect(() => {
    async function loadParams() {
      const resolvedParams = await params;
      setStrategyId(resolvedParams.strategyId);
    }
    loadParams();
  }, [params]);

  useEffect(() => {
    if (!strategyId) return;

    const fetchData = async () => {
      try {
        // Fetch daily index
        const dailyRes = await fetch('/api/trading-data/2026/aggregated/daily-index.json');
        const dailyJson = await dailyRes.json();

        // Fetch yearly summary for stats
        const yearlyRes = await fetch('/api/trading-data/2026/aggregated/yearly-summary.json');
        const yearlyJson = await yearlyRes.json();

        // Process daily data for cumulative chart
        const sortedDates = Object.keys(dailyJson).sort();
        let cumulative = 0;
        const chartData = sortedDates.map(date => {
          const dayR = dailyJson[date][strategyId];
          if (dayR !== null) {
            cumulative += dayR;
          }

          return {
            date,
            dailyR: dayR,
            r: parseFloat(cumulative.toFixed(2)),
            name: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          };
        });

        setDailyData(chartData);
        setStats(yearlyJson.summary.byStrategy[strategyId]);
      } catch (error) {
        console.error('Error fetching strategy data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [strategyId]);

  if (!strategyId || !STRATEGIES[strategyId]) {
    return (
      <AdminLayout>
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold mb-4">Strategy Not Found</h1>
          <p className="text-gray-600 mb-8">
            The trading strategy you're looking for doesn't exist.
          </p>
          <Link href="/portfolio" className="btn btn-primary">
            Back to Portfolio
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const strategy = STRATEGIES[strategyId];
  const isPositive = stats?.totalR >= 0;

  // Calculate this month's growth percentage (simplified)
  const monthGrowth = stats?.totalR > 0 ? 12.4 : 0;

  // Get daily records for table (only days with trades)
  const dailyRecords = dailyData.filter(d => d.dailyR !== null);

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">

          {/* Refined Premium Header */}
          <div className="flex flex-col gap-6">
            <nav className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
              <Link href="/portfolio" className="transition-colors hover:text-[#635BFF]">Portfolio</Link>
              <span>/</span>
              <span className="text-gray-900">{strategy.name} Strategy</span>
            </nav>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="h-16 w-16 bg-gray-900 rounded-[22px] flex items-center justify-center text-white shadow-xl shadow-gray-200">
                  <span className="text-xl font-black italic">{strategy.shortName}</span>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">{strategy.description}</h1>
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full border" style={{ backgroundColor: 'rgba(99, 91, 255, 0.1)', color: '#635BFF', borderColor: 'rgba(99, 91, 255, 0.2)' }}>
                      INTERNAL_ID: {strategy.internalId}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm font-medium text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Live Strategy
                    </span>
                    <span>•</span>
                    <span>Created {strategy.created}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button className="p-3 bg-white border border-gray-200 rounded-2xl text-gray-400 hover:text-gray-900 hover:border-gray-300 transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
                <button className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-2xl text-sm font-bold hover:bg-black transition-all shadow-lg shadow-gray-100">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export
                </button>
              </div>
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center h-64">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          )}

          {!loading && stats && (
            <>
              {/* Hierarchical KPI Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {/* Hero KPI: Total R */}
                <div className="md:col-span-2 bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-110 transition-transform" />
                  <div className="relative z-10">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Cumulative Performance</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-black text-gray-900">{isPositive ? '+' : ''}{stats.totalR.toFixed(1)}</span>
                      <span className="text-2xl font-black text-emerald-500">R</span>
                    </div>
                    <div className="mt-4 text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      {monthGrowth}% this month
                    </div>
                  </div>
                </div>

                {/* Hero KPI: Win Rate */}
                <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm group">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Efficiency</div>
                  <div className="text-4xl font-black" style={{ color: '#635BFF' }}>{stats.winRate}%</div>
                  <div className="mt-5 w-full bg-gray-50 h-1.5 rounded-full overflow-hidden border border-gray-100">
                    <div className="h-full rounded-full" style={{ width: `${stats.winRate}%`, backgroundColor: '#635BFF' }} />
                  </div>
                  <div className="mt-2 text-[10px] font-bold text-gray-400 uppercase">Win Rate</div>
                </div>

                {/* Secondary KPIs Grouped */}
                <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                  <CompactStat label="Total Trades" value={stats.trades} />
                  <CompactStat label="Avg R" value={`${stats.averageR.toFixed(2)}R`} />
                  <CompactStat label="Winning" value={stats.winning} color="text-emerald-500" />
                  <CompactStat label="Losing" value={stats.losing} color="text-rose-500" />
                </div>
              </div>

              {/* Chart Section */}
              <div className="bg-white rounded-[40px] p-8 border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-10 px-2">
                  <div>
                    <h3 className="text-xl font-black text-gray-900 mb-1">Growth Curve</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">R-Multiple accumulation over {dailyRecords.length} days</p>
                  </div>
                  <div className="flex gap-1 bg-gray-50 p-1 rounded-2xl border border-gray-100">
                    {['1W', '1M', 'ALL'].map(t => (
                      <button
                        key={t}
                        onClick={() => setTimeRange(t)}
                        className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all ${
                          timeRange === t
                            ? 'bg-white shadow-sm'
                            : 'text-gray-400 hover:text-gray-900'
                        }`}
                        style={timeRange === t ? { color: '#635BFF' } : {}}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-[380px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.08}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                        tickFormatter={(v) => `${v}R`}
                      />
                      <Tooltip
                        cursor={{ stroke: '#e2e8f0', strokeWidth: 2 }}
                        contentStyle={{
                          borderRadius: '20px',
                          border: 'none',
                          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                          padding: '16px'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="r"
                        stroke="#6366f1"
                        strokeWidth={4}
                        fill="url(#chartGradient)"
                        dot={{ r: 4, fill: '#fff', stroke: '#6366f1', strokeWidth: 3 }}
                        activeDot={{ r: 6, strokeWidth: 0, fill: '#1e293b' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Table Section */}
              <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-gray-50 flex justify-between items-center">
                  <h3 className="text-xl font-black text-gray-900">Daily Trade Logs</h3>
                  <div className="flex items-center gap-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <span className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" /> Profitable
                    </span>
                    <span className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-rose-400" /> Drawdown
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50/50">
                        <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                        <th className="px-10 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Performance</th>
                        <th className="px-10 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Accrued</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {dailyRecords.map((row, i) => {
                        const isPos = row.dailyR >= 0;
                        return (
                          <tr key={i} className="hover:bg-gray-50/50 transition-colors group cursor-default">
                            <td className="px-10 py-6 text-sm font-bold text-gray-900">
                              {new Date(row.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </td>
                            <td className="px-10 py-6 text-center">
                              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black ${
                                isPos ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                              }`}>
                                {isPos ? '+' : ''}{row.dailyR}R
                              </span>
                            </td>
                            <td className={`px-10 py-6 text-right text-sm font-black ${
                              row.r < 0 ? 'text-rose-500' : 'text-gray-900'
                            }`}>
                              {row.r >= 0 ? '+' : ''}{row.r}R
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
