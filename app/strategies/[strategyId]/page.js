"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import Footer from "@/components/Footer";

const STRATEGIES = {
  AS_1: { id: 'AS_1', name: 'AS 1', description: 'Asian Session Strategy 1', color: 'primary' },
  AS_2: { id: 'AS_2', name: 'AS 2', description: 'Asian Session Strategy 2', color: 'secondary' },
  EU: { id: 'EU', name: 'EU', description: 'European Session Strategy', color: 'accent' },
  NQI: { id: 'NQI', name: 'NQI', description: 'NASDAQ Index Strategy', color: 'info' },
  GOLD_1: { id: 'GOLD_1', name: 'GOLD 1', description: 'Gold Trading Strategy 1', color: 'warning' },
  GOLD_2: { id: 'GOLD_2', name: 'GOLD 2', description: 'Gold Trading Strategy 2', color: 'error' },
};

export default function StrategyDetailPage({ params }) {
  const [strategyId, setStrategyId] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

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
            cumulativeR: parseFloat(cumulative.toFixed(2)),
            formattedDate: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
      <>
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold mb-4">Strategy Not Found</h1>
        <p className="text-base-content/70 mb-8">
          The trading strategy you're looking for doesn't exist.
        </p>
        <Link href="/portfolio" className="btn btn-primary">
          Back to Portfolio
        </Link>
      </div>
      <Footer />
      </>
    );
  }

  const strategy = STRATEGIES[strategyId];
  const isPositive = stats?.totalR >= 0;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;
    const data = payload[0].payload;

    return (
      <div className="bg-base-100 border-2 border-base-300 rounded-lg px-4 py-3 shadow-xl">
        <p className="font-semibold mb-2">{data.formattedDate}</p>
        {data.dailyR !== null && (
          <p className={`text-sm ${data.dailyR >= 0 ? 'text-success' : 'text-error'}`}>
            Daily: {data.dailyR >= 0 ? '+' : ''}{data.dailyR}R
          </p>
        )}
        <p className={`text-sm font-bold ${data.cumulativeR >= 0 ? 'text-success' : 'text-error'}`}>
          Cumulative: {data.cumulativeR >= 0 ? '+' : ''}{data.cumulativeR}R
        </p>
      </div>
    );
  };

  return (
    <>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* BACK LINK */}
      <div className="mb-6">
        <Link
          href="/portfolio"
          className="link !no-underline text-base-content/80 hover:text-base-content inline-flex items-center gap-1"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M15 10a.75.75 0 01-.75.75H7.612l2.158 1.96a.75.75 0 11-1.04 1.08l-3.5-3.25a.75.75 0 010-1.08l3.5-3.25a.75.75 0 111.04 1.08L7.612 9.25h6.638A.75.75 0 0115 10z"
              clipRule="evenodd"
            />
          </svg>
          Back to Portfolio
        </Link>
      </div>

      {/* HEADER */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            {strategy.name}
          </h1>
          <div className={`badge badge-${strategy.color} badge-lg`}>
            {strategy.name}
          </div>
        </div>
        <p className="text-lg text-base-content/70">
          {strategy.description}
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      )}

      {!loading && stats && (
        <>
          {/* KEY METRICS */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            <div className="card bg-gradient-to-br from-success/20 to-success/5 card-border p-4">
              <div className="text-xs text-base-content/70 mb-1">Total R</div>
              <div className={`text-2xl font-bold ${isPositive ? 'text-success' : 'text-error'}`}>
                {isPositive ? '+' : ''}{stats.totalR}R
              </div>
            </div>

            <div className="card bg-gradient-to-br from-primary/20 to-primary/5 card-border p-4">
              <div className="text-xs text-base-content/70 mb-1">Avg R</div>
              <div className="text-2xl font-bold text-primary">
                {stats.averageR}R
              </div>
            </div>

            <div className="card bg-gradient-to-br from-info/20 to-info/5 card-border p-4">
              <div className="text-xs text-base-content/70 mb-1">Win Rate</div>
              <div className={`text-2xl font-bold ${stats.winRate >= 60 ? 'text-success' : 'text-info'}`}>
                {stats.winRate}%
              </div>
            </div>

            <div className="card bg-gradient-to-br from-warning/20 to-warning/5 card-border p-4">
              <div className="text-xs text-base-content/70 mb-1">Total Trades</div>
              <div className="text-2xl font-bold text-warning">
                {stats.trades}
              </div>
            </div>

            <div className="card bg-gradient-to-br from-success/10 to-success/5 card-border p-4">
              <div className="text-xs text-base-content/70 mb-1">Winning</div>
              <div className="text-2xl font-bold text-success">
                {stats.winning}
              </div>
            </div>

            <div className="card bg-gradient-to-br from-error/10 to-error/5 card-border p-4">
              <div className="text-xs text-base-content/70 mb-1">Losing</div>
              <div className="text-2xl font-bold text-error">
                {stats.losing}
              </div>
            </div>
          </div>

          {/* CUMULATIVE CHART */}
          <div className="card bg-base-200 card-border mb-8">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4">Cumulative Performance</h2>
              <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--bc) / 0.1)" />
                    <XAxis
                      dataKey="formattedDate"
                      tick={{ fill: 'hsl(var(--bc) / 0.7)', fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      tick={{ fill: 'hsl(var(--bc) / 0.7)', fontSize: 12 }}
                      label={{ value: 'Cumulative R', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--bc) / 0.7)' } }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="hsl(var(--bc) / 0.3)" strokeDasharray="3 3" />
                    <Line
                      type="monotone"
                      dataKey="cumulativeR"
                      stroke={isPositive ? '#10b981' : '#ef4444'}
                      strokeWidth={3}
                      dot={{ r: 4, fill: isPositive ? '#10b981' : '#ef4444' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 text-sm text-base-content/60 text-center">
                Shows cumulative R-multiple performance over time for {strategy.name}
              </div>
            </div>
          </div>

          {/* DAILY BREAKDOWN TABLE */}
          <div className="card bg-base-200 card-border">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4">Daily Breakdown</h2>
              <div className="overflow-x-auto">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Daily R</th>
                      <th>Cumulative R</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyData.filter(d => d.dailyR !== null).map((day) => (
                      <tr key={day.date}>
                        <td>{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                        <td>
                          <span className={`font-semibold ${day.dailyR >= 0 ? 'text-success' : 'text-error'}`}>
                            {day.dailyR >= 0 ? '+' : ''}{day.dailyR}R
                          </span>
                        </td>
                        <td>
                          <span className={`font-bold ${day.cumulativeR >= 0 ? 'text-success' : 'text-error'}`}>
                            {day.cumulativeR >= 0 ? '+' : ''}{day.cumulativeR}R
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
    <Footer />
    </>
  );
}
