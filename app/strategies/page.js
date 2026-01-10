"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

const STRATEGIES = [
  { id: 'AS_1', name: 'AS 1', description: 'Asian Session Strategy 1', color: 'primary' },
  { id: 'AS_2', name: 'AS 2', description: 'Asian Session Strategy 2', color: 'secondary' },
  { id: 'EU', name: 'EU', description: 'European Session Strategy', color: 'accent' },
  { id: 'NQI', name: 'NQI', description: 'NASDAQ Index Strategy', color: 'info' },
  { id: 'GOLD_1', name: 'GOLD 1', description: 'Gold Trading Strategy 1', color: 'warning' },
  { id: 'GOLD_2', name: 'GOLD 2', description: 'Gold Trading Strategy 2', color: 'error' },
];

function StrategyCard({ strategy, data }) {
  const isPositive = data?.totalR >= 0;
  const winRateGood = data?.winRate >= 60;

  return (
    <Link href={`/strategies/${strategy.id}`} className="block group">
      <div className="card bg-base-200 hover:bg-base-300 transition-all duration-200 card-border group-hover:shadow-lg h-full">
        <div className="card-body">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="card-title text-2xl mb-1">{strategy.name}</h3>
              <p className="text-sm text-base-content/70">{strategy.description}</p>
            </div>
            <div className={`badge badge-${strategy.color} badge-lg`}>
              {strategy.name}
            </div>
          </div>

          {data ? (
            <>
              {/* Key Metric - Total R */}
              <div className={`p-4 rounded-lg mb-4 ${isPositive ? 'bg-success/10' : 'bg-error/10'}`}>
                <div className="text-sm text-base-content/70 mb-1">Total R</div>
                <div className={`text-3xl font-bold ${isPositive ? 'text-success' : 'text-error'}`}>
                  {isPositive ? '+' : ''}{data.totalR}R
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <div className="text-xs text-base-content/70">Win Rate</div>
                  <div className={`text-lg font-bold ${winRateGood ? 'text-success' : 'text-base-content'}`}>
                    {data.winRate}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-base-content/70">Avg R</div>
                  <div className="text-lg font-bold">{data.averageR}R</div>
                </div>
                <div>
                  <div className="text-xs text-base-content/70">Trades</div>
                  <div className="text-lg font-bold">{data.trades}</div>
                </div>
              </div>

              {/* Win/Loss Breakdown */}
              <div className="flex gap-2 text-sm">
                <span className="text-success">{data.winning}W</span>
                <span className="text-base-content/50">/</span>
                <span className="text-error">{data.losing}L</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <span className="loading loading-spinner loading-md"></span>
            </div>
          )}

          <div className="card-actions justify-end mt-4">
            <span className="text-sm text-primary group-hover:underline inline-flex items-center gap-1">
              View Details
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function StrategiesPage() {
  const [strategyStats, setStrategyStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/data/trading/yearly-summary.json');
        const data = await res.json();
        setStrategyStats(data.summary.byStrategy);
      } catch (error) {
        console.error('Error fetching strategy data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate overview stats
  const totalR = Object.values(strategyStats).reduce((sum, s) => sum + (s.totalR || 0), 0);
  const totalTrades = Object.values(strategyStats).reduce((sum, s) => sum + (s.trades || 0), 0);
  const avgWinRate = Object.values(strategyStats).length > 0
    ? Object.values(strategyStats).reduce((sum, s) => sum + (s.winRate || 0), 0) / Object.values(strategyStats).length
    : 0;

  const profitableStrategies = Object.values(strategyStats).filter(s => s.totalR > 0).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* HEADER */}
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
          📈 Trading Strategies
        </h1>
        <p className="text-lg text-base-content/70 max-w-2xl">
          Compare performance across all 6 trading strategies. Each strategy has its own profile
          with detailed statistics, charts, and insights.
        </p>
      </div>

      {/* OVERVIEW STATS */}
      {!loading && Object.keys(strategyStats).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          <div className="card bg-gradient-to-br from-success/20 to-success/5 card-border">
            <div className="card-body">
              <div className="text-sm text-base-content/70 mb-2">Total R (All Strategies)</div>
              <div className="text-3xl font-bold text-success">
                +{totalR.toFixed(2)}R
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-primary/20 to-primary/5 card-border">
            <div className="card-body">
              <div className="text-sm text-base-content/70 mb-2">Avg Win Rate</div>
              <div className="text-3xl font-bold text-primary">
                {avgWinRate.toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-info/20 to-info/5 card-border">
            <div className="card-body">
              <div className="text-sm text-base-content/70 mb-2">Total Trades</div>
              <div className="text-3xl font-bold text-info">
                {totalTrades}
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-warning/20 to-warning/5 card-border">
            <div className="card-body">
              <div className="text-sm text-base-content/70 mb-2">Profitable Strategies</div>
              <div className="text-3xl font-bold text-warning">
                {profitableStrategies}/{STRATEGIES.length}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STRATEGIES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {STRATEGIES.map((strategy) => (
          <StrategyCard
            key={strategy.id}
            strategy={strategy}
            data={strategyStats[strategy.id]}
          />
        ))}
      </div>

      {/* LOADING STATE */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      )}

      {/* HELPFUL INFO */}
      <div className="mt-16 pt-8 border-t border-base-content/10">
        <div className="card bg-base-200 card-border">
          <div className="card-body">
            <h3 className="card-title mb-4">📚 Understanding the Metrics</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-bold mb-2">Total R</h4>
                <p className="text-sm text-base-content/70">
                  Cumulative R-multiple profit/loss for the strategy. Positive values indicate profitability.
                </p>
              </div>
              <div>
                <h4 className="font-bold mb-2">Win Rate</h4>
                <p className="text-sm text-base-content/70">
                  Percentage of winning trades. A win rate above 60% is considered good.
                </p>
              </div>
              <div>
                <h4 className="font-bold mb-2">Average R</h4>
                <p className="text-sm text-base-content/70">
                  Average R-multiple per trade. Higher values indicate better risk-reward execution.
                </p>
              </div>
              <div>
                <h4 className="font-bold mb-2">W/L Ratio</h4>
                <p className="text-sm text-base-content/70">
                  Number of winning trades vs losing trades. Helps assess consistency.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
