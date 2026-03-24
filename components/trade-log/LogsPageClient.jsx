"use client";

import { useState, useEffect, useCallback } from "react";
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

export default function LogsPageClient() {
  const [selectedDate, setSelectedDate] = useState(todayUTC());
  const [viewMonth, setViewMonth] = useState(monthOf(todayUTC()));
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);

  const [dailyData, setDailyData] = useState(null);
  const [dailyLoading, setDailyLoading] = useState(true);

  const [monthlyData, setMonthlyData] = useState(null);
  const [monthlyLoading, setMonthlyLoading] = useState(true);

  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(null);

  // Load accounts once
  useEffect(() => {
    fetch("/api/trade-accounts")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        setAccounts(data);
        const def = data.find((a) => a.is_default);
        if (def) setSelectedAccountId(def.id);
      })
      .catch(() => {});
  }, []);

  const fetchDaily = useCallback(async (date, accountId) => {
    setDailyLoading(true);
    try {
      const params = new URLSearchParams({ date });
      if (accountId) params.set("account_id", accountId);
      const res = await fetch(`/api/trade-log/daily?${params}`);
      if (res.ok) setDailyData(await res.json());
    } finally {
      setDailyLoading(false);
    }
  }, []);

  const fetchMonthly = useCallback(async (month, accountId) => {
    setMonthlyLoading(true);
    try {
      const params = new URLSearchParams({ month });
      if (accountId) params.set("account_id", accountId);
      const res = await fetch(`/api/trade-log/monthly?${params}`);
      if (res.ok) setMonthlyData(await res.json());
    } finally {
      setMonthlyLoading(false);
    }
  }, []);

  // Fetch daily on date/account change
  useEffect(() => {
    fetchDaily(selectedDate, selectedAccountId);
  }, [selectedDate, selectedAccountId, fetchDaily]);

  // Fetch monthly on viewMonth/account change
  useEffect(() => {
    fetchMonthly(viewMonth, selectedAccountId);
  }, [viewMonth, selectedAccountId, fetchMonthly]);

  function handlePrev() {
    const prev = addDays(selectedDate, -1);
    setSelectedDate(prev);
    const prevMonth = monthOf(prev);
    if (prevMonth !== viewMonth) setViewMonth(prevMonth);
  }

  function handleNext() {
    const today = todayUTC();
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
    const [y, m] = viewMonth.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
    const newMonth = dt.toISOString().substring(0, 7);
    setViewMonth(newMonth);
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
      trades_remaining: prev.trades_remaining + 1,
    }));
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Monthly Calendar */}
        <MonthlyCalendar
          monthlyData={monthlyData}
          selectedDate={selectedDate}
          onDayClick={handleDayClick}
          viewMonth={viewMonth}
          onMonthChange={handleMonthChange}
          isLoading={monthlyLoading}
        />

        {/* Day Navigator */}
        <DayNavigator
          selectedDate={selectedDate}
          onPrev={handlePrev}
          onNext={handleNext}
          onLabelClick={() => setShowCalendarPicker(true)}
        />

        {/* Daily Summary Card */}
        <DailySummaryCard
          tradesLogged={dailyData?.trades_logged ?? 0}
          tradesRemaining={dailyData?.trades_remaining ?? 0}
          dailyLimit={dailyData?.daily_limit ?? 3}
          pnlTotal={dailyData?.pnl_total ?? null}
          pnlUnit={dailyData?.pnl_unit ?? null}
          isLoading={dailyLoading}
        />

        {/* Trade List */}
        <DayTradeList
          trades={dailyData?.trades ?? []}
          accounts={accounts}
          onUpdated={handleTradeUpdated}
          onDeleted={handleTradeDeleted}
          isLoading={dailyLoading}
        />
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
        fetchDaily(selectedDate, selectedAccountId);
        fetchMonthly(viewMonth, selectedAccountId);
      }} />
    </div>
  );
}
