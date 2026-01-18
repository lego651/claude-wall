"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import AdminLayout from "@/components/AdminLayout";

const STRATEGIES = [
  { id: 'AS_1', name: 'AS 1', description: 'Asian Session Strategy 1', color: 'primary' },
  { id: 'AS_2', name: 'AS 2', description: 'Asian Session Strategy 2', color: 'secondary' },
  { id: 'EU', name: 'EU', description: 'European Session Strategy', color: 'accent' },
  { id: 'NQI', name: 'NQI', description: 'NASDAQ Index Strategy', color: 'info' },
  { id: 'GOLD_1', name: 'GOLD 1', description: 'Gold Trading Strategy 1', color: 'warning' },
  { id: 'GOLD_2', name: 'GOLD 2', description: 'Gold Trading Strategy 2', color: 'error' },
];

// Compact weekly performance card
function WeeklyStrategyCard({ strategy, weekData, weekSummary }) {
  const strategyR = weekData?.[strategy.id] || 0;
  const isPositive = strategyR >= 0;
  const strategyStats = weekSummary?.byStrategy?.[strategy.id];

  // Map colors to badge classes
  const badgeColors = {
    primary: 'bg-slate-900 text-white',
    secondary: 'bg-slate-900 text-white',
    accent: 'bg-slate-900 text-white',
    info: 'bg-slate-900 text-white',
    warning: 'bg-slate-900 text-white',
    error: 'bg-slate-900 text-white',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className={`${badgeColors[strategy.color]} px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide`}>
          {strategy.name}
        </div>
        <div className={`text-2xl font-bold leading-none tracking-tight ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
          {isPositive ? '+' : ''}{strategyR.toFixed(1)}R
        </div>
      </div>

      {strategyStats && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 uppercase font-bold tracking-wider">Win Rate: {strategyStats.winRate}%</span>
          <span className="text-slate-900 font-medium">
            {strategyStats.winning}W / {strategyStats.losing}L
          </span>
        </div>
      )}
    </div>
  );
}

// Cumulative strategy card with mini bar chart
function CumulativeStrategyCard({ strategy, strategyData, weeklyData }) {
  const isPositive = strategyData?.totalR >= 0;

  // Prepare chart data
  const chartData = weeklyData?.weeks.map(week => ({
    week: `W${week.weekNumber}`,
    value: week[strategy.id] || 0,
  })) || [];

  // Calculate avg R per month (extrapolate from available weeks)
  const weeksCount = weeklyData?.weeks.length || 1;
  const avgWeeksPerMonth = 4;
  const avgRPerMonth = strategyData ? (strategyData.totalR / weeksCount) * avgWeeksPerMonth : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-white border-2 border-slate-900 rounded-lg text-xs font-bold tracking-wide">
            {strategy.id.replace('_', '')}
          </div>
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
      </div>

      <h3 className="text-xl font-bold text-slate-900 mb-6">{strategy.description}</h3>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-2">Total R</div>
          <div className={`text-xl font-bold leading-none ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
            {isPositive ? '+' : ''}{strategyData?.totalR.toFixed(1) || '0'}R
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-2">Avg/Mo</div>
          <div className="text-xl font-bold leading-none text-slate-900">
            {avgRPerMonth >= 0 ? '+' : ''}{avgRPerMonth.toFixed(1)}R
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-2">Win Rate</div>
          <div className={`text-xl font-bold leading-none ${strategyData?.winRate >= 60 ? 'text-emerald-600' : 'text-slate-900'}`}>
            {strategyData?.winRate || 0}%
          </div>
        </div>
      </div>

      {/* Mini Bar Chart */}
      <div className="h-40 w-full mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="week"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip
              cursor={{ fill: '#f1f5f9' }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const value = payload[0].value;
                const isPos = value >= 0;
                return (
                  <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-lg">
                    <p className={`text-sm font-bold ${isPos ? 'text-emerald-600' : 'text-red-500'}`}>
                      {isPos ? '+' : ''}{value.toFixed(1)}R
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={50}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.value >= 0 ? '#10b981' : '#ef4444'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Stats */}
      <div className="flex justify-between items-center mb-4 pt-4 border-t border-slate-100">
        <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">
          Trades Breakdown
        </div>
        <div className="text-xs font-semibold text-slate-900">
          {strategyData?.trades || 0} Trades • {strategyData?.winning || 0}W / {strategyData?.losing || 0}L
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">
          Avg Risk:Reward
        </div>
        <div className="text-xs font-semibold text-indigo-600">
          {strategyData?.averageR?.toFixed(2) || '0.00'}R
        </div>
      </div>

      {/* View Details Button */}
      <Link
        href={`/strategies/${strategy.id}`}
        className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-slate-800 transition-colors group"
      >
        View Strategy Details
        <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </Link>
    </div>
  );
}

export default function PortfolioPage() {
  const [yearlyStats, setYearlyStats] = useState({});
  const [weeklyData, setWeeklyData] = useState(null);
  const [lastWeekDetail, setLastWeekDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch yearly summary for cumulative stats
        const yearlyRes = await fetch('/api/trading-data/2026/aggregated/yearly-summary.json');
        const yearlyJson = await yearlyRes.json();

        // Fetch weekly data
        const weeklyRes = await fetch('/api/trading-data/2026/aggregated/weekly-by-strategy.json');
        const weeklyJson = await weeklyRes.json();

        setYearlyStats(yearlyJson.summary.byStrategy);
        setWeeklyData(weeklyJson);

        // Fetch the last week's detailed data
        if (weeklyJson.weeks && weeklyJson.weeks.length > 0) {
          const lastWeek = weeklyJson.weeks[weeklyJson.weeks.length - 1];
          const weekFile = `/api/trading-data/${lastWeek.year}/week-${String(lastWeek.weekNumber).padStart(2, '0')}.json`;

          try {
            const weekDetailRes = await fetch(weekFile);
            const weekDetailJson = await weekDetailRes.json();
            setLastWeekDetail(weekDetailJson);
          } catch (err) {
            console.warn('Could not fetch week detail:', err);
          }
        }
      } catch (error) {
        console.error('Error fetching portfolio data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Get last week's data
  const lastWeek = weeklyData?.weeks[weeklyData.weeks.length - 1];

  // Calculate last week overview stats
  const lastWeekTotalR = lastWeek?.totalR || 0;
  const lastWeekStrategies = lastWeek ? STRATEGIES.map(s => ({
    ...s,
    r: lastWeek[s.id] || 0
  })) : [];
  const lastWeekProfitable = lastWeekStrategies.filter(s => s.r > 0).length;

  // Sort strategies by last week performance (highest to lowest)
  const sortedWeeklyStrategies = [...STRATEGIES].sort((a, b) => {
    const aR = lastWeek?.[a.id] || 0;
    const bR = lastWeek?.[b.id] || 0;
    return bR - aR; // Descending order
  });

  // Sort strategies by cumulative performance (highest to lowest)
  const sortedCumulativeStrategies = [...STRATEGIES].sort((a, b) => {
    const aTotal = yearlyStats[a.id]?.totalR || 0;
    const bTotal = yearlyStats[b.id]?.totalR || 0;
    return bTotal - aTotal; // Descending order
  });

  // Calculate last week trades (we'll need to approximate or fetch from week data)
  const lastWeekTrades = Object.values(yearlyStats).reduce((sum, s) => sum + (s.trades || 0), 0);
  const lastWeekWinRate = Object.values(yearlyStats).length > 0
    ? Object.values(yearlyStats).reduce((sum, s) => sum + (s.winRate || 0), 0) / Object.values(yearlyStats).length
    : 0;

  return (
    <AdminLayout>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* HEADER */}
      <div className="mb-12">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 rounded-full">
              <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-1">
                Portfolio Performance
              </h1>
              <p className="text-sm text-slate-500">
                Weekly and cumulative performance analytics for multi-strategy trading portfolios.
              </p>
            </div>
          </div>

          {!loading && lastWeek && (
            <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-center">
                <div className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold mb-1">
                  Reporting Period
                </div>
                <div className="font-bold text-slate-900 text-sm whitespace-nowrap">
                  Week {lastWeek.weekNumber} • {new Date(lastWeek.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(lastWeek.endDate).toLocaleDateString('en-US', { day: 'numeric' })}, {new Date(lastWeek.endDate).toLocaleDateString('en-US', { year: 'numeric' })}
                </div>
              </div>
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      )}

      {!loading && lastWeek && (
        <>
          {/* SECTION 1: LAST WEEK PERFORMANCE */}
          <div className="mb-12">
            {/* Last Week Overview Stats - Compact */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-4">
                  Total R
                </div>
                <div className="text-2xl font-bold text-emerald-600 leading-none tracking-tight">
                  +{lastWeekTotalR.toFixed(1)}R
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-4">
                  Avg Win Rate
                </div>
                <div className="text-2xl font-bold text-indigo-600 leading-none tracking-tight">
                  {lastWeekWinRate.toFixed(1)}%
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-4">
                  Total Trades
                </div>
                <div className="text-2xl font-bold text-slate-900 leading-none tracking-tight">
                  {lastWeekTrades}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-4">
                  Profitable
                </div>
                <div className="text-2xl font-bold text-amber-600 leading-none tracking-tight">
                  {lastWeekProfitable}/{STRATEGIES.length}
                </div>
              </div>
            </div>

            {/* Section Title */}
            <div className="flex items-center gap-3 mb-8 mt-2">
              <div className="w-1 h-6 bg-indigo-600 rounded-full"></div>
              <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
                Last Week Snapshots
              </h2>
            </div>

            {/* Last Week Strategy Cards - Compact Grid (Sorted by Performance) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {sortedWeeklyStrategies.map((strategy) => (
                <WeeklyStrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  weekData={lastWeek}
                  weekSummary={lastWeekDetail?.summary}
                />
              ))}
            </div>
          </div>

          {/* SECTION 2: CUMULATIVE PERFORMANCE */}
          <div>
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 bg-slate-900 rounded-sm"></div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
                      Strategy Deep Dive
                    </h2>
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mt-0.5">
                      Year-to-Date Detailed Performance
                    </p>
                  </div>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  Full History Archive
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Cumulative Strategy Cards (Sorted by Total Performance) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedCumulativeStrategies.map((strategy) => (
                <CumulativeStrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  strategyData={yearlyStats[strategy.id]}
                  weeklyData={weeklyData}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
    </AdminLayout>
  );
}
