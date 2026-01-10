"use client";

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';

/**
 * Weekly Bar Chart Component
 * Shows week-over-week profits for a single strategy
 * Similar to the reference image provided
 */
export default function WeeklyBarChart({ strategyId, weeklyData, height = 400 }) {
  // Prepare chart data
  const chartData = useMemo(() => {
    if (!weeklyData?.weeks) return [];

    return weeklyData.weeks.map(week => ({
      week: `Week ${week.weekNumber}`,
      weekNumber: week.weekNumber,
      profit: week[strategyId] || 0,
      // For tooltip
      startDate: week.startDate,
      endDate: week.endDate,
      totalWeekR: week.totalR,
    }));
  }, [weeklyData, strategyId]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    const profit = data.profit;
    const isPositive = profit >= 0;

    return (
      <div className="bg-base-100 border border-base-300 rounded-lg shadow-lg p-4">
        <p className="font-bold text-base-content mb-2">
          Week {data.weekNumber}
        </p>
        <p className="text-sm text-base-content/70 mb-2">
          {new Date(data.startDate).toLocaleDateString()} - {new Date(data.endDate).toLocaleDateString()}
        </p>
        <p className={`text-lg font-bold ${isPositive ? 'text-success' : 'text-error'}`}>
          {isPositive ? '+' : ''}{profit.toFixed(2)}R
        </p>
        <p className="text-xs text-base-content/60 mt-1">
          Total Week: {data.totalWeekR > 0 ? '+' : ''}{data.totalWeekR}R
        </p>
      </div>
    );
  };

  // Custom bar colors based on profit/loss
  const getBarColor = (value) => {
    return value >= 0 ? 'hsl(var(--su))' : 'hsl(var(--er))';
  };

  // Get strategy name for display
  const getStrategyName = (id) => {
    const names = {
      'AS_1': 'AS 1',
      'AS_2': 'AS 2',
      'EU': 'EU',
      'NQI': 'NQI',
      'GOLD_1': 'GOLD 1',
      'GOLD_2': 'GOLD 2',
    };
    return names[id] || id;
  };

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-base-200 rounded-lg">
        <p className="text-base-content/50">No weekly data available</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-xl font-bold mb-4 text-base-content">
        Week-over-week profits - {getStrategyName(strategyId)}
      </h3>

      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--bc) / 0.1)" />

          <XAxis
            dataKey="week"
            tick={{ fill: 'hsl(var(--bc) / 0.7)', fontSize: 12 }}
            axisLine={{ stroke: 'hsl(var(--bc) / 0.2)' }}
          />

          <YAxis
            label={{ value: 'Profit ($)', angle: -90, position: 'insideLeft', fill: 'hsl(var(--bc) / 0.7)' }}
            tick={{ fill: 'hsl(var(--bc) / 0.7)', fontSize: 12 }}
            axisLine={{ stroke: 'hsl(var(--bc) / 0.2)' }}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--bc) / 0.05)' }} />

          <ReferenceLine y={0} stroke="hsl(var(--bc) / 0.3)" strokeWidth={2} />

          <Bar
            dataKey="profit"
            radius={[8, 8, 0, 0]}
            maxBarSize={60}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.profit)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Summary Stats Below Chart */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <div className="stat bg-base-200 rounded-lg p-4">
          <div className="stat-title text-xs">Total Weeks</div>
          <div className="stat-value text-2xl">{chartData.length}</div>
        </div>

        <div className="stat bg-base-200 rounded-lg p-4">
          <div className="stat-title text-xs">Profitable Weeks</div>
          <div className="stat-value text-2xl text-success">
            {chartData.filter(d => d.profit > 0).length}
          </div>
        </div>

        <div className="stat bg-base-200 rounded-lg p-4">
          <div className="stat-title text-xs">Losing Weeks</div>
          <div className="stat-value text-2xl text-error">
            {chartData.filter(d => d.profit < 0).length}
          </div>
        </div>

        <div className="stat bg-base-200 rounded-lg p-4">
          <div className="stat-title text-xs">Avg Weekly R</div>
          <div className="stat-value text-2xl">
            {(chartData.reduce((sum, d) => sum + d.profit, 0) / chartData.length).toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}
