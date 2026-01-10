"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import WeeklyBarChart from '../_components/WeeklyBarChart';
import DailyPerformanceChart from '../_components/DailyPerformanceChart';

const STRATEGIES = {
  'AS_1': { name: 'AS 1', description: 'Asian Session Strategy 1' },
  'AS_2': { name: 'AS 2', description: 'Asian Session Strategy 2' },
  'EU': { name: 'EU', description: 'European Session Strategy' },
  'NQI': { name: 'NQI', description: 'NASDAQ Index Strategy' },
  'GOLD_1': { name: 'GOLD 1', description: 'Gold Trading Strategy 1' },
  'GOLD_2': { name: 'GOLD 2', description: 'Gold Trading Strategy 2' },
};

export default function StrategyPage({ params }) {
  const [strategyData, setStrategyData] = useState(null);
  const [weeklyData, setWeeklyData] = useState(null);
  const [dailyData, setDailyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [strategyId, setStrategyId] = useState(null);

  useEffect(() => {
    // Unwrap params in useEffect
    Promise.resolve(params).then(p => {
      setStrategyId(p.strategyId);
    });
  }, [params]);

  useEffect(() => {
    if (!strategyId) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch yearly summary for strategy stats
        const yearlyRes = await fetch('/data/trading/yearly-summary.json');
        const yearlyJson = await yearlyRes.json();

        // Fetch weekly data for chart
        const weeklyRes = await fetch('/data/trading/weekly-by-strategy.json');
        const weeklyJson = await weeklyRes.json();

        // Fetch daily data for cumulative chart
        const dailyRes = await fetch('/data/trading/daily-index.json');
        const dailyJson = await dailyRes.json();

        setStrategyData(yearlyJson.summary.byStrategy[strategyId]);
        setWeeklyData(weeklyJson);
        setDailyData(dailyJson);
      } catch (error) {
        console.error('Error fetching strategy data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [strategyId]);

  if (loading || !strategyId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    );
  }

  const strategy = STRATEGIES[strategyId];

  if (!strategy || !strategyData) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h1 className="text-4xl font-bold mb-4">Strategy Not Found</h1>
        <p className="text-base-content/70 mb-8">
          The strategy you're looking for doesn't exist.
        </p>
        <Link href="/strategies" className="btn btn-primary">
          Back to Strategies
        </Link>
      </div>
    );
  }

  const isPositive = strategyData.totalR >= 0;
  const winRateGood = strategyData.winRate >= 60;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* BACK LINK */}
      <div className="mb-6">
        <Link
          href="/strategies"
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
          Back to Strategies
        </Link>
      </div>

      {/* HEADER */}
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3">
          {strategy.name}
        </h1>
        <p className="text-lg text-base-content/70">
          {strategy.description}
        </p>
      </div>

      {/* KEY METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
        <div className={`card card-border ${isPositive ? 'bg-success/10' : 'bg-error/10'}`}>
          <div className="card-body">
            <div className="text-sm text-base-content/70 mb-1">Total R</div>
            <div className={`text-3xl font-bold ${isPositive ? 'text-success' : 'text-error'}`}>
              {isPositive ? '+' : ''}{strategyData.totalR}R
            </div>
          </div>
        </div>

        <div className="card bg-base-200 card-border">
          <div className="card-body">
            <div className="text-sm text-base-content/70 mb-1">Avg R/Trade</div>
            <div className="text-3xl font-bold">{strategyData.averageR}R</div>
          </div>
        </div>

        <div className={`card card-border ${winRateGood ? 'bg-success/10' : 'bg-base-200'}`}>
          <div className="card-body">
            <div className="text-sm text-base-content/70 mb-1">Win Rate</div>
            <div className={`text-3xl font-bold ${winRateGood ? 'text-success' : 'text-base-content'}`}>
              {strategyData.winRate}%
            </div>
          </div>
        </div>

        <div className="card bg-base-200 card-border">
          <div className="card-body">
            <div className="text-sm text-base-content/70 mb-1">Total Trades</div>
            <div className="text-3xl font-bold">{strategyData.trades}</div>
          </div>
        </div>

        <div className="card bg-base-200 card-border">
          <div className="card-body">
            <div className="text-sm text-base-content/70 mb-1">W/L</div>
            <div className="text-3xl font-bold">
              <span className="text-success">{strategyData.winning}</span>
              <span className="text-base-content/50">/</span>
              <span className="text-error">{strategyData.losing}</span>
            </div>
          </div>
        </div>
      </div>

      {/* DAILY CUMULATIVE CHART */}
      <div className="card bg-base-100 card-border p-6 mb-12">
        <DailyPerformanceChart strategyId={strategyId} dailyData={dailyData} height={450} />
      </div>

      {/* WEEKLY BAR CHART */}
      <div className="card bg-base-100 card-border p-6 mb-12">
        <WeeklyBarChart strategyId={strategyId} weeklyData={weeklyData} height={450} />
      </div>

      {/* PERFORMANCE INSIGHTS */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card bg-base-200 card-border">
          <div className="card-body">
            <h3 className="card-title text-xl mb-4">📊 Performance Insights</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-base-content/70">Expected Value per Trade:</span>
                <span className="font-bold">{strategyData.averageR}R</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-base-content/70">Win Rate:</span>
                <span className={`font-bold ${winRateGood ? 'text-success' : 'text-warning'}`}>
                  {strategyData.winRate}% {winRateGood ? '✓' : '⚠'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-base-content/70">Profit Factor:</span>
                <span className="font-bold">
                  {strategyData.losing > 0
                    ? (strategyData.winning / strategyData.losing).toFixed(2)
                    : '∞'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-base-200 card-border">
          <div className="card-body">
            <h3 className="card-title text-xl mb-4">💡 Recommendations</h3>
            <ul className="space-y-2">
              {isPositive ? (
                <li className="flex items-start gap-2">
                  <span className="text-success">✓</span>
                  <span className="text-sm">Strategy is profitable overall</span>
                </li>
              ) : (
                <li className="flex items-start gap-2">
                  <span className="text-error">⚠</span>
                  <span className="text-sm">Review and optimize entry/exit criteria</span>
                </li>
              )}

              {winRateGood ? (
                <li className="flex items-start gap-2">
                  <span className="text-success">✓</span>
                  <span className="text-sm">Win rate is healthy (&gt;60%)</span>
                </li>
              ) : (
                <li className="flex items-start gap-2">
                  <span className="text-warning">⚠</span>
                  <span className="text-sm">Consider improving trade selection</span>
                </li>
              )}

              {strategyData.trades < 10 ? (
                <li className="flex items-start gap-2">
                  <span className="text-info">ℹ</span>
                  <span className="text-sm">Need more data for statistical significance</span>
                </li>
              ) : (
                <li className="flex items-start gap-2">
                  <span className="text-success">✓</span>
                  <span className="text-sm">Sufficient sample size ({strategyData.trades} trades)</span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
