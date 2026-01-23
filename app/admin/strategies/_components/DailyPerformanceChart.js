"use client";

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from 'recharts';

/**
 * Daily Performance Chart Component
 * Shows cumulative R-multiple performance day-by-day for a single strategy
 * Beautiful line chart with gradient fill
 */
export default function DailyPerformanceChart({ strategyId, dailyData, height = 400 }) {
  // Prepare chart data with cumulative calculation
  const chartData = useMemo(() => {
    if (!dailyData) return [];

    // Get all dates and sort them
    const dates = Object.keys(dailyData).sort();

    let cumulativeR = 0;

    return dates.map(date => {
      const dayData = dailyData[date];
      const tradeR = dayData[strategyId];

      // Only add to cumulative if there was a trade
      if (tradeR !== null) {
        cumulativeR += tradeR;
      }

      return {
        date,
        displayDate: new Date(date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        }),
        fullDate: new Date(date).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }),
        tradeR: tradeR,
        cumulativeR: parseFloat(cumulativeR.toFixed(2)),
        hasTrade: tradeR !== null,
        dayTotalR: dayData.summary?.totalR || 0,
        dayTrades: dayData.summary?.trades || 0,
        weekNumber: dayData.weekNumber,
      };
    });
  }, [dailyData, strategyId]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    const isPositive = data.cumulativeR >= 0;
    const tradeIsPositive = data.tradeR >= 0;

    return (
      <div className="bg-base-100 border-2 border-base-300 rounded-xl shadow-2xl p-4 min-w-[200px]">
        <p className="font-bold text-base-content mb-2 text-base">
          {data.fullDate}
        </p>

        {data.hasTrade ? (
          <>
            <div className="mb-2 pb-2 border-b border-base-300">
              <p className="text-xs text-base-content/60 mb-1">Trade Result</p>
              <p className={`text-xl font-bold ${tradeIsPositive ? 'text-success' : 'text-error'}`}>
                {tradeIsPositive ? '+' : ''}{data.tradeR.toFixed(2)}R
              </p>
            </div>

            <div className="mb-2">
              <p className="text-xs text-base-content/60 mb-1">Cumulative Total</p>
              <p className={`text-lg font-bold ${isPositive ? 'text-success' : 'text-error'}`}>
                {isPositive ? '+' : ''}{data.cumulativeR.toFixed(2)}R
              </p>
            </div>

            <div className="text-xs text-base-content/50 mt-2 pt-2 border-t border-base-300">
              <p>Week {data.weekNumber} • Day Total: {data.dayTotalR > 0 ? '+' : ''}{data.dayTotalR}R</p>
            </div>
          </>
        ) : (
          <div>
            <p className="text-sm text-base-content/50 italic mb-2">No trade this day</p>
            <div>
              <p className="text-xs text-base-content/60 mb-1">Cumulative Total</p>
              <p className={`text-lg font-bold ${isPositive ? 'text-success' : 'text-error'}`}>
                {isPositive ? '+' : ''}{data.cumulativeR.toFixed(2)}R
              </p>
            </div>
          </div>
        )}
      </div>
    );
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

  // Calculate performance metrics
  const metrics = useMemo(() => {
    const tradeDays = chartData.filter(d => d.hasTrade);
    const profitDays = tradeDays.filter(d => d.tradeR > 0);
    const lossDays = tradeDays.filter(d => d.tradeR < 0);

    const finalR = chartData.length > 0 ? chartData[chartData.length - 1].cumulativeR : 0;
    const bestDay = tradeDays.length > 0
      ? Math.max(...tradeDays.map(d => d.tradeR))
      : 0;
    const worstDay = tradeDays.length > 0
      ? Math.min(...tradeDays.map(d => d.tradeR))
      : 0;

    return {
      finalR,
      tradeDays: tradeDays.length,
      profitDays: profitDays.length,
      lossDays: lossDays.length,
      bestDay,
      worstDay,
    };
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-base-200 rounded-lg">
        <p className="text-base-content/50">No daily data available</p>
      </div>
    );
  }

  const finalIsPositive = metrics.finalR >= 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-base-content">
          Daily Cumulative Performance - {getStrategyName(strategyId)}
        </h3>
        <div className={`badge badge-lg ${finalIsPositive ? 'badge-success' : 'badge-error'}`}>
          {finalIsPositive ? '+' : ''}{metrics.finalR}R Total
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <defs>
            <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={finalIsPositive ? "hsl(var(--su))" : "hsl(var(--er))"}
                stopOpacity={0.3}
              />
              <stop
                offset="95%"
                stopColor={finalIsPositive ? "hsl(var(--su))" : "hsl(var(--er))"}
                stopOpacity={0}
              />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--bc) / 0.1)" />

          <XAxis
            dataKey="displayDate"
            tick={{ fill: 'hsl(var(--bc) / 0.7)', fontSize: 11 }}
            axisLine={{ stroke: 'hsl(var(--bc) / 0.2)' }}
            angle={-15}
            textAnchor="end"
            height={60}
          />

          <YAxis
            label={{
              value: 'Cumulative R-Multiple',
              angle: -90,
              position: 'insideLeft',
              fill: 'hsl(var(--bc) / 0.7)',
              style: { textAnchor: 'middle' }
            }}
            tick={{ fill: 'hsl(var(--bc) / 0.7)', fontSize: 12 }}
            axisLine={{ stroke: 'hsl(var(--bc) / 0.2)' }}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--bc) / 0.3)', strokeWidth: 2 }} />

          <ReferenceLine y={0} stroke="hsl(var(--bc) / 0.4)" strokeWidth={2} strokeDasharray="5 5" />

          <Area
            type="monotone"
            dataKey="cumulativeR"
            stroke={finalIsPositive ? "hsl(var(--su))" : "hsl(var(--er))"}
            strokeWidth={3}
            fill="url(#colorCumulative)"
            dot={(props) => {
              const { cx, cy, payload } = props;
              if (!payload.hasTrade) return null;

              const dotColor = payload.tradeR >= 0
                ? "hsl(var(--su))"
                : "hsl(var(--er))";

              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={5}
                  fill={dotColor}
                  stroke="white"
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{
              r: 7,
              stroke: 'white',
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Summary Stats Below Chart */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <div className="stat bg-base-200 rounded-lg p-4">
          <div className="stat-title text-xs">Trading Days</div>
          <div className="stat-value text-2xl">{metrics.tradeDays}</div>
          <div className="stat-desc text-xs mt-1">
            {metrics.profitDays}W / {metrics.lossDays}L
          </div>
        </div>

        <div className="stat bg-success/10 rounded-lg p-4">
          <div className="stat-title text-xs">Best Day</div>
          <div className="stat-value text-2xl text-success">
            +{metrics.bestDay.toFixed(2)}R
          </div>
        </div>

        <div className="stat bg-error/10 rounded-lg p-4">
          <div className="stat-title text-xs">Worst Day</div>
          <div className="stat-value text-2xl text-error">
            {metrics.worstDay.toFixed(2)}R
          </div>
        </div>

        <div className={`stat rounded-lg p-4 ${finalIsPositive ? 'bg-success/20' : 'bg-error/20'}`}>
          <div className="stat-title text-xs">Final Result</div>
          <div className={`stat-value text-2xl ${finalIsPositive ? 'text-success' : 'text-error'}`}>
            {finalIsPositive ? '+' : ''}{metrics.finalR.toFixed(2)}R
          </div>
          <div className="stat-desc text-xs mt-1">
            Avg: {(metrics.finalR / metrics.tradeDays).toFixed(2)}R per day
          </div>
        </div>
      </div>
    </div>
  );
}
