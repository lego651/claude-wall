"use client";

import { useState, useEffect } from 'react';
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

  // Map colors to specific Tailwind classes
  const colorClasses = {
    primary: 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30',
    secondary: 'bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/30',
    accent: 'bg-gradient-to-br from-accent/10 to-accent/5 border-accent/30',
    info: 'bg-gradient-to-br from-info/10 to-info/5 border-info/30',
    warning: 'bg-gradient-to-br from-warning/10 to-warning/5 border-warning/30',
    error: 'bg-gradient-to-br from-error/10 to-error/5 border-error/30',
  };

  return (
    <div className={`card ${colorClasses[strategy.color]} card-border p-3`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`badge badge-${strategy.color} badge-sm`}>
          {strategy.name}
        </div>
        <div className={`text-2xl font-bold ${isPositive ? 'text-success' : 'text-error'}`}>
          {isPositive ? '+' : ''}{strategyR}R
        </div>
      </div>
      <div className="text-xs text-base-content/60 mb-2">{strategy.description}</div>

      {strategyStats && (
        <div className="space-y-1">
          <div className="text-xs text-base-content/60">
            {strategyStats.trades} trades • {strategyStats.winning}W / {strategyStats.losing}L
          </div>
          <div className="text-xs text-base-content/60">
            Win Rate: <span className={`font-semibold ${strategyStats.winRate >= 60 ? 'text-success' : 'text-base-content'}`}>
              {strategyStats.winRate}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Cumulative strategy card with mini bar chart
function CumulativeStrategyCard({ strategy, strategyData, weeklyData }) {
  const isPositive = strategyData?.totalR >= 0;

  // Map colors to specific Tailwind classes
  const colorClasses = {
    primary: 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20',
    secondary: 'bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20',
    accent: 'bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20',
    info: 'bg-gradient-to-br from-info/10 to-info/5 border-info/20',
    warning: 'bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20',
    error: 'bg-gradient-to-br from-error/10 to-error/5 border-error/20',
  };

  // Prepare chart data
  const chartData = weeklyData?.weeks.map(week => ({
    week: `W${week.weekNumber}`,
    value: week[strategy.id] || 0,
  })) || [];

  // Custom tooltip for mini chart
  const MiniTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;
    const value = payload[0].value;
    const isPos = value >= 0;

    return (
      <div className="bg-base-100 border border-base-300 rounded px-2 py-1 shadow-lg">
        <p className={`text-sm font-bold ${isPos ? 'text-success' : 'text-error'}`}>
          {isPos ? '+' : ''}{value.toFixed(1)}R
        </p>
      </div>
    );
  };

  // Calculate avg R per month (extrapolate from available weeks)
  const weeksCount = weeklyData?.weeks.length || 1;
  const avgWeeksPerMonth = 4;
  const avgRPerMonth = strategyData ? (strategyData.totalR / weeksCount) * avgWeeksPerMonth : 0;

  return (
    <div className={`card ${colorClasses[strategy.color]} card-border`}>
      <div className="card-body p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold">{strategy.name}</h3>
              <div className={`badge badge-${strategy.color} badge-sm`}>
                {strategy.name}
              </div>
            </div>
            <p className="text-xs text-base-content/60">{strategy.description}</p>
          </div>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <div className="text-xs text-base-content/60 mb-1">Total R</div>
            <div className={`text-xl font-bold ${isPositive ? 'text-success' : 'text-error'}`}>
              {isPositive ? '+' : ''}{strategyData?.totalR || 0}R
            </div>
          </div>
          <div>
            <div className="text-xs text-base-content/60 mb-1">Avg/Month</div>
            <div className="text-xl font-bold">
              {avgRPerMonth >= 0 ? '+' : ''}{avgRPerMonth.toFixed(1)}R
            </div>
          </div>
          <div>
            <div className="text-xs text-base-content/60 mb-1">Win Rate</div>
            <div className={`text-xl font-bold ${strategyData?.winRate >= 60 ? 'text-success' : 'text-base-content'}`}>
              {strategyData?.winRate || 0}%
            </div>
          </div>
        </div>

        {/* Mini Bar Chart */}
        <div className="h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--bc) / 0.1)" />
              <XAxis
                dataKey="week"
                tick={{ fill: 'hsl(var(--bc) / 0.6)', fontSize: 10 }}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: 'hsl(var(--bc) / 0.6)', fontSize: 10 }}
                axisLine={false}
                width={30}
              />
              <Tooltip content={<MiniTooltip />} cursor={{ fill: 'hsl(var(--bc) / 0.05)' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.value >= 0 ? '#86efac' : '#fca5a5'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Footer Stats */}
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-base-300">
          <div className="text-xs text-base-content/60">
            {strategyData?.trades || 0} trades • {strategyData?.winning || 0}W / {strategyData?.losing || 0}L
          </div>
          <div className="text-xs">
            Avg: {strategyData?.averageR || 0}R
          </div>
        </div>
      </div>
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3">
          📊 Portfolio Performance
        </h1>
        <p className="text-lg text-base-content/70 max-w-2xl">
          Track weekly and cumulative performance across all trading strategies
        </p>
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
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">
                Last Week Performance
              </h2>
              <div className="text-sm text-base-content/60">
                Week {lastWeek.weekNumber} • {new Date(lastWeek.startDate).toLocaleDateString()} - {new Date(lastWeek.endDate).toLocaleDateString()}
              </div>
            </div>

            {/* Last Week Overview Stats - Compact */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="card bg-gradient-to-br from-success/20 to-success/5 card-border p-4">
                <div className="text-xs text-base-content/70 mb-1">Total R</div>
                <div className="text-2xl font-bold text-success">
                  +{lastWeekTotalR.toFixed(1)}R
                </div>
              </div>

              <div className="card bg-gradient-to-br from-primary/20 to-primary/5 card-border p-4">
                <div className="text-xs text-base-content/70 mb-1">Avg Win Rate</div>
                <div className="text-2xl font-bold text-primary">
                  {lastWeekWinRate.toFixed(1)}%
                </div>
              </div>

              <div className="card bg-gradient-to-br from-info/20 to-info/5 card-border p-4">
                <div className="text-xs text-base-content/70 mb-1">Total Trades</div>
                <div className="text-2xl font-bold text-info">
                  {lastWeekTrades}
                </div>
              </div>

              <div className="card bg-gradient-to-br from-warning/20 to-warning/5 card-border p-4">
                <div className="text-xs text-base-content/70 mb-1">Profitable</div>
                <div className="text-2xl font-bold text-warning">
                  {lastWeekProfitable}/{STRATEGIES.length}
                </div>
              </div>
            </div>

            {/* Last Week Strategy Cards - Compact Grid (Sorted by Performance) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">
                Cumulative Performance
              </h2>
              <p className="text-sm text-base-content/60">
                Year-to-date statistics and weekly breakdown for each strategy
              </p>
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
  );
}
