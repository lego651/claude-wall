"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

/**
 * Reusable Monthly Payout Chart Component
 * Displays a bar chart of monthly payout history with period selector.
 * When hasNoWallet and no data, shows Connect Wallet CTA instead of generic empty text.
 */
export default function MonthlyPayoutChart({ transactions = [], loading = false, hasNoWallet = false, onConnectWallet }) {
  const [chartPeriod, setChartPeriod] = useState('6M');

  // Filter chart data based on selected period
  const chartData = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return [];
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    let monthsToShow = 6; // Default 6M
    if (chartPeriod === '1Y') {
      monthsToShow = 12;
    } else if (chartPeriod === 'ALL') {
      // For ALL, find the earliest transaction and show all months from then
      const earliestTx = transactions[transactions.length - 1];
      if (earliestTx) {
        const earliestDate = new Date(earliestTx.timestamp * 1000);
        const mostRecentDate = new Date(transactions[0].timestamp * 1000);
        const diffMonths = (mostRecentDate.getFullYear() - earliestDate.getFullYear()) * 12 + 
                          (mostRecentDate.getMonth() - earliestDate.getMonth());
        monthsToShow = Math.max(diffMonths + 1, 6); // At least 6 months
      }
    }

    // Use the most recent transaction date as reference point
    const mostRecentTx = transactions[0];
    const referenceDate = new Date(mostRecentTx.timestamp * 1000);

    const monthlyData = [];

    for (let i = monthsToShow - 1; i >= 0; i--) {
      const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
      const monthName = months[d.getMonth()];
      const monthStart = d.getTime() / 1000;
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime() / 1000;

      const monthTxs = transactions.filter(tx => tx.timestamp >= monthStart && tx.timestamp <= monthEnd);
      const amount = monthTxs.reduce((sum, tx) => sum + tx.amountUSD, 0);

      monthlyData.push({
        month: monthName,
        monthFull: chartPeriod === 'ALL' ? `${monthName} ${d.getFullYear()}` : monthName,
        year: d.getFullYear(),
        amount: Math.round(amount),
      });
    }

    return monthlyData;
  }, [transactions, chartPeriod]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Monthly Payout History</h3>
          <p className="text-sm text-slate-400 mt-1">On-chain verified inflows per month</p>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setChartPeriod('6M')}
            className={`px-4 py-2 shadow-sm rounded-lg text-xs font-bold transition-all ${
              chartPeriod === '6M'
                ? 'bg-slate-900 text-white'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            6M
          </button>
          <button
            onClick={() => setChartPeriod('1Y')}
            className={`px-4 py-2 shadow-sm rounded-lg text-xs font-bold transition-all ${
              chartPeriod === '1Y'
                ? 'bg-slate-900 text-white'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            1Y
          </button>
          <button
            onClick={() => setChartPeriod('ALL')}
            className={`px-4 py-2 shadow-sm rounded-lg text-xs font-bold transition-all ${
              chartPeriod === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            ALL
          </button>
        </div>
      </div>

      <div className="h-[300px] w-full">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gray-300 border-r-transparent"></div>
              <p className="mt-4 text-sm text-gray-400">Loading chart data...</p>
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            {hasNoWallet && onConnectWallet ? (
              <>
                <p className="text-sm text-gray-500">Connect your wallet to see payout history</p>
                <button
                  type="button"
                  onClick={onConnectWallet}
                  className="px-6 py-2.5 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                  style={{ backgroundColor: '#635BFF' }}
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#5a52e6'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = '#635BFF'; }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a2.25 2.25 0 01-2.25-2.25V6a2.25 2.25 0 012.25-2.25h2.25A2.25 2.25 0 0121 6v2.25a2.25 2.25 0 01-2.25 2.25H21m0-2.25v2.25m0-9V15m2.25 2.25 0 001.5 0V15m2.25-2.25h-9m-9 0H3m2.25 2.25H3m9 0h9M3 15v2.25M21 15V15" />
                  </svg>
                  Connect Wallet
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-400">No chart data available</p>
            )}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey={chartPeriod === 'ALL' ? 'monthFull' : 'month'}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#94a3b8", fontWeight: 500 }}
                dy={10}
                angle={chartPeriod === 'ALL' ? -45 : 0}
                textAnchor={chartPeriod === 'ALL' ? 'end' : 'middle'}
                height={chartPeriod === 'ALL' ? 60 : 30}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#94a3b8", fontWeight: 500 }}
                tickFormatter={(value) => `$${value / 1000}k`}
              />
              <Tooltip
                cursor={{ fill: "#f1f5f9" }}
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.75rem',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
                formatter={(value) => [`$${value.toLocaleString()}`, 'Amount']}
                labelFormatter={(label, payload) => {
                  if (payload && payload.length > 0 && payload[0].payload) {
                    const data = payload[0].payload;
                    return chartPeriod === 'ALL' ? `${data.month} ${data.year}` : data.month;
                  }
                  return label;
                }}
              />
              <Bar dataKey="amount" radius={[12, 12, 12, 12]} maxBarSize={60}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.amount > 0 ? "#0f172a" : "#e5e7eb"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
