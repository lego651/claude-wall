"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import PropProofLayout from "@/components/common/PropProofLayout";
import DayNavigator from "./DayNavigator";
import DailySummaryCard from "./DailySummaryCard";
import MonthlyCalendar from "./MonthlyCalendar";
import CalendarPicker from "./CalendarPicker";
import DayTradeList from "./DayTradeList";
import TradeLogFAB from "./TradeLogFAB";

function todayUTC() {
  return new Date().toISOString().substring(0, 10);
}

function monthOf(dateStr) {
  return dateStr.substring(0, 7);
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().substring(0, 10);
}

function formatPnlHeader(value, unit) {
  if (value === null || value === undefined) return null;
  const sign = value >= 0 ? "+" : "-";
  const abs = Math.abs(value);
  if (unit === "R") return `${sign}${abs}R`;
  if (unit === "USD") {
    const fmt = abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return `${sign}$${fmt}`;
  }
  return `${sign}${abs}`;
}

function formatSelectedDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).toUpperCase();
}

const ACCOUNT_COLORS = [
  "#635BFF", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316",
];

// AccountFilterBar — inline component
function AccountFilterBar({ accounts, selectedIds, onToggle, onSelectAll }) {
  const allSelected = selectedIds.size === 0;
  const selectedCount = allSelected ? accounts.length : selectedIds.size;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
      {/* Top row: filter label + selected badge */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
          Filter by Accounts
        </span>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-600 text-white">
          {selectedCount} Selected
        </span>
      </div>

      {/* Pills row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* All Accounts pill — solid indigo when all selected */}
        <button
          onClick={onSelectAll}
          className={`px-5 py-2 rounded-full text-sm font-bold border transition-all ${
            allSelected
              ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
              : "bg-white border-slate-300 text-slate-600 hover:border-slate-400"
          }`}
        >
          All Accounts
        </button>

        {/* Individual account pills */}
        {accounts.map((acct, idx) => {
          const isActive = !allSelected && selectedIds.has(acct.id);
          const color = ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length];
          return (
            <button
              key={acct.id}
              onClick={() => onToggle(acct.id)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all flex items-center gap-2 ${
                isActive
                  ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {acct.name}
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: isActive ? color : "#94A3B8" }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function LogsPageClient() {
  const today = todayUTC();
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMonth, setViewMonth] = useState(monthOf(today));
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);

  const [dailyData, setDailyData] = useState(null);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState(null);
  const [monthlyLoading, setMonthlyLoading] = useState(true);

  const [accounts, setAccounts] = useState([]);
  // selectedIds: empty Set = show all accounts (no filter)
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Load accounts once
  useEffect(() => {
    fetch("/api/trade-accounts")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const fetchDaily = useCallback(async (date, ids) => {
    setDailyLoading(true);
    try {
      const params = new URLSearchParams({ date });
      if (ids && ids.size > 0) {
        for (const id of ids) params.append("account_id", id);
      }
      const res = await fetch(`/api/trade-log/daily?${params}`);
      if (res.ok) setDailyData(await res.json());
    } finally {
      setDailyLoading(false);
    }
  }, []);

  const fetchMonthly = useCallback(async (month, ids) => {
    setMonthlyLoading(true);
    try {
      const params = new URLSearchParams({ month });
      if (ids && ids.size > 0) {
        for (const id of ids) params.append("account_id", id);
      }
      const res = await fetch(`/api/trade-log/monthly?${params}`);
      if (res.ok) setMonthlyData(await res.json());
    } finally {
      setMonthlyLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDaily(selectedDate, selectedIds);
  }, [selectedDate, selectedIds, fetchDaily]);

  useEffect(() => {
    fetchMonthly(viewMonth, selectedIds);
  }, [viewMonth, selectedIds, fetchMonthly]);

  function handlePrev() {
    const prev = addDays(selectedDate, -1);
    setSelectedDate(prev);
    const prevMonth = monthOf(prev);
    if (prevMonth !== viewMonth) setViewMonth(prevMonth);
  }

  function handleNext() {
    if (selectedDate >= today) return;
    const next = addDays(selectedDate, 1);
    setSelectedDate(next);
    const nextMonth = monthOf(next);
    if (nextMonth !== viewMonth) setViewMonth(nextMonth);
  }

  function handleDayClick(dateStr) {
    setSelectedDate(dateStr);
    const m = monthOf(dateStr);
    if (m !== viewMonth) setViewMonth(m);
    setShowCalendarPicker(false);
  }

  function handleMonthChange(delta) {
    if (delta === 0) {
      setViewMonth(monthOf(today));
      return;
    }
    const [y, m] = viewMonth.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
    setViewMonth(dt.toISOString().substring(0, 7));
  }

  function handleTradeUpdated(updatedTrade) {
    if (!dailyData) return;
    setDailyData((prev) => ({
      ...prev,
      trades: prev.trades.map((t) => (t.id === updatedTrade.id ? updatedTrade : t)),
    }));
  }

  function handleTradeDeleted(id) {
    if (!dailyData) return;
    setDailyData((prev) => ({
      ...prev,
      trades: prev.trades.filter((t) => t.id !== id),
      trades_logged: Math.max(0, prev.trades_logged - 1),
      trades_remaining: prev.trades_remaining !== null ? prev.trades_remaining + 1 : null,
    }));
  }

  // Account filter handlers
  function handleToggleAccount(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      // If currently showing all (empty set), start filtering: select only this account
      if (prev.size === 0) {
        return new Set([id]);
      }
      if (next.has(id)) {
        next.delete(id);
        // If empty after delete, revert to all
        if (next.size === 0) return new Set();
      } else {
        next.add(id);
        // If all accounts are now selected, revert to "all" mode
        if (accounts.length > 0 && next.size === accounts.length) return new Set();
      }
      return next;
    });
  }

  function handleSelectAll() {
    setSelectedIds(new Set());
  }

  // Compute total P&L for header (from monthlyData)
  const totalPnl = monthlyData?.monthly_pnl ?? null;
  const pnlUnit = monthlyData?.pnl_unit ?? null;
  const totalPnlFormatted = formatPnlHeader(totalPnl, pnlUnit);
  const totalPnlColor = totalPnl === null ? "text-slate-500" : totalPnl >= 0 ? "text-green-600" : "text-red-600";

  return (
    <PropProofLayout>
      {/* Page Header */}
      <div className="w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Trading Journal</h1>
              <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                <span>Track your trades and review your performance</span>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Total P&L card */}
              {totalPnlFormatted && (
                <div className="border border-slate-200 rounded-xl px-4 py-2 min-w-[120px] text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total P&L</p>
                  <p className={`text-lg font-bold ${totalPnlColor}`}>{totalPnlFormatted}</p>
                </div>
              )}
              <Link
                href="/user/settings"
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Edit Settings
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Account Filter Bar */}
      {accounts.length > 0 && (
        <AccountFilterBar
          accounts={accounts}
          selectedIds={selectedIds}
          onToggle={handleToggleAccount}
          onSelectAll={handleSelectAll}
        />
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-[72%_28%] gap-6">

          {/* Left column: Monthly Calendar */}
          <div>
            <MonthlyCalendar
              monthlyData={monthlyData}
              selectedDate={selectedDate}
              onDayClick={handleDayClick}
              viewMonth={viewMonth}
              onMonthChange={handleMonthChange}
              isLoading={monthlyLoading}
            />
          </div>

          {/* Right column: Day view */}
          <div className="flex flex-col gap-4">
            {/* Navigator + Summary combined card */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <DayNavigator
                selectedDate={selectedDate}
                onPrev={handlePrev}
                onNext={handleNext}
                onLabelClick={() => setShowCalendarPicker(true)}
              />
              <DailySummaryCard
                tradesLogged={dailyData?.trades_logged ?? 0}
                tradesRemaining={dailyData?.trades_remaining ?? null}
                dailyLimit={dailyData?.daily_limit ?? null}
                pnlTotal={dailyData?.pnl_total ?? null}
                pnlUnit={dailyData?.pnl_unit ?? null}
                isLoading={dailyLoading}
              />
            </div>

            {/* Trades section */}
            <div>
              {/* Section header */}
              <div className="flex items-center justify-between px-1 py-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  Trades for {formatSelectedDate(selectedDate)}
                </span>
                <span className="text-[11px] font-bold text-slate-500">
                  {dailyLoading ? "…" : `${dailyData?.trades_logged ?? 0} Total`}
                </span>
              </div>
              {/* Trade List */}
              <DayTradeList
                trades={dailyData?.trades ?? []}
                accounts={accounts}
                onUpdated={handleTradeUpdated}
                onDeleted={handleTradeDeleted}
                isLoading={dailyLoading}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Day Picker */}
      {showCalendarPicker && (
        <CalendarPicker
          selectedDate={selectedDate}
          monthlyData={monthlyData}
          viewMonth={viewMonth}
          onSelectDate={handleDayClick}
          onMonthChange={handleMonthChange}
          onClose={() => setShowCalendarPicker(false)}
        />
      )}

      {/* FAB */}
      <TradeLogFAB onTradeLogged={() => {
        fetchDaily(selectedDate, selectedIds);
        fetchMonthly(viewMonth, selectedIds);
      }} />
    </PropProofLayout>
  );
}
