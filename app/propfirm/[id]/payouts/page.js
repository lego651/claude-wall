"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import FirmWeeklyReportCard from "@/components/FirmWeeklyReportCard";
import { timeSince } from "@/lib/utils/timeSince";

const PERIOD_30D = "30d";

export default function PropFirmPayoutsPage() {
  const params = useParams();
  const firmId = params?.id;
  const [chartPeriod, setChartPeriod] = useState(PERIOD_30D);

  const [chartData, setChartData] = useState(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState(null);

  const [topPayouts, setTopPayouts] = useState([]);
  const [topPayoutsLoading, setTopPayoutsLoading] = useState(true);

  const [latestPayouts, setLatestPayouts] = useState([]);
  const [latestPayoutsLoading, setLatestPayoutsLoading] = useState(true);

  useEffect(() => {
    if (!firmId || chartPeriod !== PERIOD_30D) return;
    let cancelled = false;
    setChartLoading(true);
    setChartError(null);
    fetch(`/api/v2/propfirms/${firmId}/chart?period=30d`)
      .then((r) => {
        if (!r.ok) {
          return r.json().then((err) => {
            throw new Error(err.error || "Failed to load data");
          });
        }
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setChartData(data);
      })
      .catch((err) => {
        if (!cancelled) setChartError(err.message);
      })
      .finally(() => {
        if (!cancelled) setChartLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [firmId, chartPeriod]);

  useEffect(() => {
    if (!firmId) return;
    let cancelled = false;
    setTopPayoutsLoading(true);
    fetch(`/api/v2/propfirms/${firmId}/top-payouts?period=30d`)
      .then((r) => (r.ok ? r.json() : { payouts: [] }))
      .then((data) => {
        if (!cancelled) setTopPayouts(data.payouts || []);
      })
      .finally(() => {
        if (!cancelled) setTopPayoutsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [firmId]);

  useEffect(() => {
    if (!firmId) return;
    let cancelled = false;
    setLatestPayoutsLoading(true);
    fetch(`/api/v2/propfirms/${firmId}/latest-payouts`)
      .then((r) => (r.ok ? r.json() : { payouts: [] }))
      .then((data) => {
        if (!cancelled) setLatestPayouts(data.payouts || []);
      })
      .finally(() => {
        if (!cancelled) setLatestPayoutsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [firmId]);

  if (chartLoading && !chartData) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
          <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[20px]">
            <div className="h-10 w-24 bg-slate-200 rounded-[16px] animate-pulse" />
            <div className="h-10 w-24 bg-slate-200 rounded-[16px] animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="bg-white p-6 rounded-xl border border-slate-200 animate-pulse"
            >
              <div className="h-3 w-24 bg-slate-200 rounded mb-4" />
              <div className="h-6 w-28 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 h-[350px] animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 h-80 animate-pulse" />
          <div className="bg-white rounded-xl border border-slate-200 h-80 animate-pulse" />
        </div>
      </div>
    );
  }

  if (chartError && !chartData) {
    return (
      <div className="py-12 text-center">
        <p className="text-red-600">Error loading payouts: {chartError}</p>
      </div>
    );
  }

  const summary = chartData?.summary;
  const chart = chartData?.chart;

  return (
    <div className="space-y-8">
      {/* Reporting period - 30d only; 12 Months disabled */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <span className="text-[11px] font-extrabold tracking-wider text-slate-400 uppercase">
          Viewing stats for
        </span>
        <div className="inline-flex bg-slate-100 p-1.5 rounded-[20px] gap-2 border border-slate-200">
          <button
            type="button"
            onClick={() => setChartPeriod(PERIOD_30D)}
            className={`px-6 py-2.5 text-xs font-bold rounded-[16px] transition-all ${
              chartPeriod === PERIOD_30D
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            30 Days
          </button>
          <button
            type="button"
            disabled
            className="px-6 py-2.5 text-xs font-bold rounded-[16px] text-slate-400 cursor-not-allowed"
            title="12 months not supported on this page"
          >
            12 Months
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
              Total Payouts
            </span>
            <div className="p-2 bg-slate-50 rounded-lg">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: "#635BFF" }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">
            ${summary?.totalPayouts?.toLocaleString() || 0}
          </h3>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
              No. of Payouts
            </span>
            <div className="p-2 bg-slate-50 rounded-lg">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: "#635BFF" }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                />
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">
            {summary?.payoutCount?.toLocaleString() || 0}
          </h3>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
              Avg. Per Payout
            </span>
            <div className="p-2 bg-slate-50 rounded-lg">
              <svg
                className="w-4 h-4 text-emerald-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 11l2-2 3 3 7-7"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 19h14a2 2 0 002-2V7"
                />
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">
            ${summary?.avgPayout?.toLocaleString() || 0}
          </h3>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
              Largest Single Payout
            </span>
            <div className="p-2 bg-slate-50 rounded-lg">
              <svg
                className="w-4 h-4 text-yellow-500"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">
            ${summary?.largestPayout?.toLocaleString() || 0}
          </h3>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
              Time Since Last Payout
            </span>
            <div className="p-2 bg-slate-50 rounded-lg">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: "#635BFF" }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">
            {timeSince(summary?.latestPayoutAt)}
          </h3>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
            <div className="flex flex-col">
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
                Total Payouts
              </h2>
              <span className="text-[11px] font-extrabold tracking-wider text-slate-400 uppercase">
                UTC Timezone
              </span>
            </div>
          </div>
          <div className="flex items-center gap-5 pt-1">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Crypto
            </span>
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              Rise
            </span>
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Wire
            </span>
          </div>
        </div>

        {chartLoading && (
          <div className="flex items-center justify-center h-[350px]">
            <span className="loading loading-spinner loading-md" />
          </div>
        )}

        {!chartLoading && chart?.data?.length > 0 && (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={chart.data}
              margin={{ top: 20, right: 20, left: 0, bottom: 5 }}
              barGap={0}
            >
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                stroke="#e2e8f0"
              />
              <XAxis
                dataKey={chart.bucketType === "daily" ? "date" : "month"}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
                dy={10}
                tickFormatter={(value) => {
                  if (chart.bucketType === "daily") {
                    const date = new Date(value);
                    return date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });
                  }
                  return value;
                }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickFormatter={(value) => {
                  if (value >= 1000000)
                    return `$${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
                  return `$${value}`;
                }}
              />
              <Tooltip
                formatter={(value) => `$${Number(value).toLocaleString()}`}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.75rem",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
                cursor={{ fill: "#f1f5f9" }}
              />
              <Bar
                dataKey="rise"
                stackId="a"
                fill="#3b82f6"
                radius={[6, 6, 0, 0]}
                name="Rise"
              />
              <Bar
                dataKey="crypto"
                stackId="a"
                fill="#f59e0b"
                radius={[6, 6, 0, 0]}
                name="Crypto"
              />
              <Bar
                dataKey="wire"
                stackId="a"
                fill="#10b981"
                radius={[6, 6, 0, 0]}
                name="Wire"
              />
            </BarChart>
          </ResponsiveContainer>
        )}

        {!chartLoading && (!chart?.data || chart.data.length === 0) && (
          <div className="h-[350px] flex items-center justify-center text-slate-500 text-sm">
            No payout data for this period
          </div>
        )}
      </div>

      {firmId !== "fundednext" && <FirmWeeklyReportCard firmId={firmId} />}

      {/* Top 10 & Latest Payouts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/30">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <svg
                className="w-5 h-5 text-yellow-500 fill-yellow-500"
                viewBox="0 0 24 24"
              >
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-900 text-base">
              Top 10 Largest Payouts
            </h3>
          </div>
          <div className="divide-y divide-slate-100 flex-grow">
            {topPayoutsLoading ? (
              <div className="px-6 py-8 text-center">
                <span className="loading loading-spinner loading-sm" />
              </div>
            ) : topPayouts.length > 0 ? (
              topPayouts.slice(0, 7).map((tx) => (
                <a
                  key={tx.txHash}
                  href={tx.arbiscanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-2 rounded-full ${
                        tx.paymentMethod === "crypto"
                          ? "bg-amber-50 text-amber-500"
                          : "bg-blue-50 text-blue-500"
                      }`}
                    >
                      {tx.paymentMethod === "crypto" ? (
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 14.708c-.223 1.487-1.716 2.291-3.63 2.058l-.742 2.977-1.812-.451.73-2.924c-.476-.119-.965-.231-1.45-.343l-.735 2.945-1.81-.451.742-2.975c-.393-.09-.778-.18-1.152-.276l.002-.008-2.498-.623.482-1.979s1.342.354 1.314.334c.733.183.865-.425.945-.67l1.348-5.405c.057-.142.014-.406-.36-.501.02-.028-1.315-.328-1.315-.328l.256-2.143 2.643.659-.001.007c.384.096.775.184 1.17.271l.735-2.948 1.812.451-.719 2.882c.495.113.977.225 1.448.344l.714-2.864 1.812.452-.735 2.947c2.392.726 4.055 1.933 3.825 4.093-.185 1.737-1.23 2.513-2.704 2.551.934.543 1.486 1.403 1.202 2.801z" />
                        </svg>
                      ) : (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-900">
                        {new Date(tx.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">
                        {tx.paymentMethod}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-900">
                      ${tx.amount.toLocaleString()}
                    </span>
                    <svg
                      className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </a>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-slate-500">
                No payouts found
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{ color: "#635BFF" }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="font-bold text-slate-900 text-base">
                Latest Payouts Feed
              </h3>
            </div>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-medium">
              Last 24 Hours
            </span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
            {latestPayoutsLoading ? (
              <div className="px-6 py-8 text-center">
                <span className="loading loading-spinner loading-sm" />
              </div>
            ) : latestPayouts.length > 0 ? (
              latestPayouts.map((tx) => (
                <a
                  key={tx.txHash}
                  href={tx.arbiscanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-2 rounded-full ${
                        tx.paymentMethod === "crypto"
                          ? "bg-amber-50 text-amber-500"
                          : "bg-blue-50 text-blue-500"
                      }`}
                    >
                      {tx.paymentMethod === "crypto" ? (
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 14.708c-.223 1.487-1.716 2.291-3.63 2.058l-.742 2.977-1.812-.451.73-2.924c-.476-.119-.965-.231-1.45-.343l-.735 2.945-1.81-.451.742-2.975c-.393-.09-.778-.18-1.152-.276l.002-.008-2.498-.623.482-1.979s1.342.354 1.314.334c.733.183.865-.425.945-.67l1.348-5.405c.057-.142.014-.406-.36-.501.02-.028-1.315-.328-1.315-.328l.256-2.143 2.643.659-.001.007c.384.096.775.184 1.17.271l.735-2.948 1.812.451-.719 2.882c.495.113.977.225 1.448.344l.714-2.864 1.812.452-.735 2.947c2.392.726 4.055 1.933 3.825 4.093-.185 1.737-1.23 2.513-2.704 2.551.934.543 1.486 1.403 1.202 2.801z" />
                        </svg>
                      ) : (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-900">
                        {timeSince(tx.timestamp)}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">
                        {tx.paymentMethod}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-900">
                      ${tx.amount.toLocaleString()}
                    </span>
                    <svg
                      className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </a>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-slate-500">
                No recent payouts in last 24 hours
              </div>
            )}
          </div>
          {latestPayouts.length > 0 && (
            <div className="px-6 py-4 bg-slate-50/30 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Showing {latestPayouts.length} of {latestPayouts.length}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
