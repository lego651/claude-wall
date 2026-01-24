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

// Compact weekly performance card with bar chart
function WeeklyStrategyCard({ strategy, weekData, weekSummary, maxR }) {
  const strategyR = weekData?.[strategy.id] || 0;
  const isPositive = strategyR >= 0;
  const strategyStats = weekSummary?.byStrategy?.[strategy.id];
  
  // Calculate bar height as percentage of max R (minimum height for visibility)
  const maxHeight = 160; // Maximum bar height in pixels
  const minHeight = 12; // Minimum bar height for very small values
  const barHeight = maxR > 0 
    ? Math.max(minHeight, (Math.abs(strategyR) / maxR) * maxHeight)
    : minHeight;

  return (
    <div className="flex flex-col items-center flex-1 min-w-0">
      {/* Vertical bar chart container */}
      <div className="w-full my-6 flex items-end justify-center px-8" style={{ height: `${maxHeight}px` }}>
        <div 
          className="rounded-t-lg"
          style={{ 
            width: '45%',
            height: `${barHeight}px`,
            backgroundColor: '#94a3b8',
            backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.3) 1px, transparent 1px)',
            backgroundSize: '4px 4px',
            minHeight: `${minHeight}px`
          }}
        />
      </div>
      
      {/* R value - green for positive, red for negative */}
      <div className={`text-sm font-bold mb-2 text-center ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
        {isPositive ? '+' : ''}{strategyR.toFixed(1)}R
      </div>
      
      {/* Strategy name badge */}
      <Link href={`/admin/strategies/${strategy.id}`}>
        <div className="bg-slate-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold uppercase mb-2 hover:bg-slate-700 transition-colors cursor-pointer">
          {strategy.name}
        </div>
      </Link>
      
      {strategyStats && (
        <>
          {/* W/L record - bold, slate-700 */}
          <div className="text-xs font-bold text-slate-700 mb-1 text-center">
            {strategyStats.winning}W / {strategyStats.losing}L
          </div>
          {/* Win rate - bold, theme color */}
          <div className="text-xs font-bold text-center" style={{ color: '#635BFF' }}>
            {strategyStats.winRate}% WR
          </div>
        </>
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
    <Link 
      href={`/admin/strategies/${strategy.id}`}
      className="block bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 p-6 relative cursor-pointer"
    >
      {/* Clickable icon in top right */}
      <div className="absolute top-6 right-6 z-10 pointer-events-none">
        <svg 
          className="w-5 h-5 transition-colors" 
          style={{ color: '#635BFF' }}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </div>

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
          <div className="text-xl font-bold leading-none" style={{ color: '#635BFF' }}>
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

      <div className="flex justify-between items-center">
        <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">
          Avg Risk:Reward
        </div>
        <div className="text-xs font-semibold" style={{ color: '#635BFF' }}>
          {strategyData?.averageR?.toFixed(2) || '0.00'}R
        </div>
      </div>
    </Link>
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
        
        // Sort weeks by weekNumber to ensure correct ordering
        if (weeklyJson.weeks && weeklyJson.weeks.length > 0) {
          weeklyJson.weeks.sort((a, b) => a.weekNumber - b.weekNumber);
        }
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

  // Get last week's data (weeks should already be sorted, but ensure it)
  const sortedWeeks = weeklyData?.weeks ? [...weeklyData.weeks].sort((a, b) => a.weekNumber - b.weekNumber) : [];
  const lastWeek = sortedWeeks.length > 0 ? sortedWeeks[sortedWeeks.length - 1] : null;

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

  // Calculate last week trades and win rate from week detail data
  const lastWeekTrades = lastWeekDetail?.summary?.weekly?.totalTrades || 0;
  const lastWeekWinRate = lastWeekDetail?.summary?.weekly?.winRate || 0;

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
            <Link href={`/admin/reports/week-${String(lastWeek.weekNumber).padStart(2, '0')}-${lastWeek.year}`}>
              <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer">
                <div className="text-center">
                  <div className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold mb-1">
                    Reporting Period
                  </div>
                  <div className="font-bold text-slate-900 text-sm whitespace-nowrap">
                    Week {lastWeek.weekNumber} • {new Date(lastWeek.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(lastWeek.endDate).toLocaleDateString('en-US', { day: 'numeric' })}, {new Date(lastWeek.endDate).toLocaleDateString('en-US', { year: 'numeric' })}
                  </div>
                </div>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#635BFF' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </Link>
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
            {/* Section Title */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-1 h-6 rounded-full" style={{ backgroundColor: '#635BFF' }}></div>
              <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
                LAST WEEK SNAPSHOTS
              </h2>
            </div>

            {/* Last Week Strategy Cards - Horizontal Row with Bar Charts */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 p-8">
              {/* Header Section */}
              <div className="flex items-start justify-between mb-8 mt-6 px-8">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-4xl font-bold text-slate-900">
                      Week {lastWeek?.weekNumber}, {lastWeek?.year}
                    </h1>
                    <span className="text-white text-[9px] font-black px-2 py-0.5 rounded-md tracking-widest uppercase" style={{ backgroundColor: '#635BFF' }}>
                      WEEKLY
                    </span>
                  </div>
                  <p className="text-base text-slate-500 font-normal">
                    {lastWeek?.startDate && lastWeek?.endDate && `${lastWeek.startDate} to ${lastWeek.endDate}`}
                  </p>
                </div>
                
                {/* Top Performer Badge */}
                {sortedWeeklyStrategies.length > 0 && lastWeek && (() => {
                  const topStrategy = sortedWeeklyStrategies[0];
                  const topStrategyR = lastWeek[topStrategy.id] || 0;
                  return (
                    <Link href={`/admin/strategies/${topStrategy.id}`}>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-emerald-100 hover:border-emerald-300 transition-colors cursor-pointer">
                        <span className="text-xl">🥇</span>
                        <div>
                          <div className="text-[9px] font-black text-emerald-700 uppercase tracking-widest block">TOP PERFORMER</div>
                          <div className="text-sm font-bold text-slate-900">
                            {topStrategy.name} <span className="text-emerald-600 ml-1">+{topStrategyR.toFixed(2)}R</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })()}
              </div>

              {/* Summary Metrics - Above Bar Charts */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 px-8">
                <div className="bg-slate-50 rounded-xl p-5">
                  <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase mb-2">
                    TOTAL R
                  </div>
                  <div className="text-2xl font-bold text-emerald-600 leading-none tracking-tight">
                    +{lastWeekTotalR.toFixed(1)}R
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-5">
                  <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase mb-2">
                    WIN RATE
                  </div>
                  <div className="text-2xl font-bold leading-none tracking-tight" style={{ color: '#635BFF' }}>
                    {lastWeekWinRate.toFixed(1)}%
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-5">
                  <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase mb-2">
                    TOTAL TRADES
                  </div>
                  <div className="text-2xl font-bold text-slate-900 leading-none tracking-tight">
                    {lastWeekTrades}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-5">
                  <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase mb-2">
                    BEST DAY
                  </div>
                  {lastWeekDetail?.summary?.weekly?.bestDay && (
                    <>
                      <div className="text-2xl font-bold text-slate-900 leading-none tracking-tight">
                        {new Date(lastWeekDetail.summary.weekly.bestDay.date).toLocaleDateString('en-US', { weekday: 'long' })}
                      </div>
                      <div className="text-sm font-normal text-slate-500 mt-0.5">
                        ({lastWeekDetail.summary.weekly.bestDay.totalR > 0 ? '+' : ''}{lastWeekDetail.summary.weekly.bestDay.totalR.toFixed(2)}R)
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Bar Charts */}
              <div className="flex items-end justify-between gap-2 px-8">
                {sortedWeeklyStrategies.map((strategy) => {
                  // Calculate max R value for scaling bars (use absolute values)
                  const maxR = Math.max(...sortedWeeklyStrategies.map(s => Math.abs(lastWeek?.[s.id] || 0)), 1);
                  
                  return (
                    <WeeklyStrategyCard
                      key={strategy.id}
                      strategy={strategy}
                      weekData={lastWeek}
                      weekSummary={lastWeekDetail?.summary}
                      maxR={maxR}
                    />
                  );
                })}
              </div>
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
