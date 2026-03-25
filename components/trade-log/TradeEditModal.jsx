"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { utcToLocalInputValue, localInputValueToUtc, formatTimezoneLabel, getBrowserTimezone } from "@/lib/timezone";

const INPUT = "w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400";
const LABEL = "block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5";

export default function TradeEditModal({ trade, accounts, onSave, onClose }) {
  const [symbol, setSymbol] = useState(trade.symbol || "");
  const [direction, setDirection] = useState(trade.direction || "");
  const [entryPrice, setEntryPrice] = useState(trade.entry_price != null ? String(trade.entry_price) : "");
  const [stopLoss, setStopLoss] = useState(trade.stop_loss != null ? String(trade.stop_loss) : "");
  const [takeProfit, setTakeProfit] = useState(trade.take_profit != null ? String(trade.take_profit) : "");
  const [lots, setLots] = useState(trade.lots != null ? String(trade.lots) : "");
  const [rr, setRr] = useState(trade.risk_reward != null ? String(trade.risk_reward) : "");
  const [tradeAt, setTradeAt] = useState(""); // local timezone value for the input
  const [accountId, setAccountId] = useState(trade.account_id || "");
  const [pnlInput, setPnlInput] = useState(trade.pnl != null ? String(trade.pnl) : "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [userTimezone, setUserTimezone] = useState(null);

  useEffect(() => {
    fetch("/api/user-settings/trading")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        const tz = data.preferred_timezone || getBrowserTimezone();
        setUserTimezone(tz);
        if (trade.trade_at) {
          setTradeAt(utcToLocalInputValue(trade.trade_at, tz));
        }
      })
      .catch(() => {
        const tz = getBrowserTimezone();
        setUserTimezone(tz);
        if (trade.trade_at) {
          setTradeAt(utcToLocalInputValue(trade.trade_at, tz));
        }
      });
  }, [trade.trade_at]);

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const pnlUnit = selectedAccount?.pnl_unit || null;
  const tz = userTimezone || getBrowserTimezone();
  const tzLabel = formatTimezoneLabel(tz);

  async function handleSave() {
    if (!symbol.trim()) { setError("Symbol is required"); return; }
    setSaving(true);
    setError("");

    const utcTradeAt = tradeAt ? localInputValueToUtc(tradeAt, tz) : null;

    const body = {
      symbol: symbol.trim(),
      direction: direction || null,
      entry_price: entryPrice !== "" ? parseFloat(entryPrice) : null,
      stop_loss: stopLoss !== "" ? parseFloat(stopLoss) : null,
      take_profit: takeProfit !== "" ? parseFloat(takeProfit) : null,
      lots: lots !== "" ? parseFloat(lots) : null,
      risk_reward: rr !== "" ? parseFloat(rr) : null,
      trade_at: utcTradeAt,
      account_id: accountId || null,
      pnl: pnlInput !== "" ? parseFloat(pnlInput) : null,
    };

    try {
      const res = await fetch(`/api/trade-log/${trade.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      onSave(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[92vh] z-10">

        {/* Header */}
        <div className="flex items-start justify-between px-7 pt-7 pb-5">
          <div>
            <h2 className="text-2xl font-black text-slate-900 leading-tight">Edit Trade</h2>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Update your position details</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-7 pb-2 space-y-4">
          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

          {/* Symbol + Account */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Symbol</label>
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className={INPUT}
                maxLength={20}
              />
            </div>
            <div>
              <label className={LABEL}>Account</label>
              {accounts.length > 0 ? (
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className={INPUT}
                >
                  <option value="">—</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              ) : (
                <input value="—" disabled className={INPUT} />
              )}
            </div>
          </div>

          {/* Direction + Entry Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Direction</label>
              <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                {["buy", "sell"].map((d) => {
                  const isActive = direction === d;
                  const activeColor = d === "buy" ? "text-green-600" : "text-red-500";
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDirection(d)}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                        isActive
                          ? `bg-white shadow-sm ${activeColor}`
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      {d.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className={LABEL}>Entry Price</label>
              <input
                type="number"
                step="any"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className={INPUT}
              />
            </div>
          </div>

          {/* Trade Date & Time */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={LABEL + " mb-0"}>
                Trade Date &amp; Time ({tzLabel})
              </label>
              <Link
                href="/user/settings/trading"
                onClick={onClose}
                className="text-[10px] text-indigo-400 hover:text-indigo-600 transition-colors"
              >
                Change timezone →
              </Link>
            </div>
            <input
              type="datetime-local"
              value={tradeAt}
              onChange={(e) => setTradeAt(e.target.value)}
              className={INPUT}
            />
          </div>

          {/* Risk Management section */}
          <div className="bg-slate-50 rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-1 h-4 bg-indigo-500 rounded-full" />
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Risk Management</span>
            </div>

            {/* Stop Loss + Take Profit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Stop Loss</label>
                <input
                  type="number"
                  step="any"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  className={INPUT}
                />
              </div>
              <div>
                <label className={LABEL}>Take Profit</label>
                <input
                  type="number"
                  step="any"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  className={INPUT}
                />
              </div>
            </div>

            {/* Lots + Risk/Reward */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Lots</label>
                <input
                  type="number"
                  step="any"
                  value={lots}
                  onChange={(e) => setLots(e.target.value)}
                  className={INPUT}
                />
              </div>
              <div>
                <label className={LABEL}>Risk/Reward</label>
                <input
                  type="number"
                  step="any"
                  value={rr}
                  onChange={(e) => setRr(e.target.value)}
                  className={INPUT}
                />
              </div>
            </div>

            {/* P&L */}
            <div>
              <label className={LABEL}>
                P&amp;L {pnlUnit ? `(${pnlUnit === "R" ? "R" : "$"})` : "(R)"}
              </label>
              <input
                type="text"
                value={pnlInput}
                onChange={(e) => setPnlInput(e.target.value)}
                placeholder={pnlUnit === "R" ? "e.g. +2.5" : "e.g. 1000"}
                className={INPUT}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-7 py-6">
          <button
            onClick={onClose}
            className="text-sm font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm uppercase tracking-widest px-10 py-3.5 rounded-full shadow-md transition-all disabled:opacity-60"
          >
            {saving ? "Saving…" : "Update Trade"}
          </button>
        </div>
      </div>
    </div>
  );
}
