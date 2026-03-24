"use client";

import { useState } from "react";
import TradeEditModal from "./TradeEditModal";

function formatPnl(value, unit) {
  if (value === null || value === undefined) return "—";
  const sign = value >= 0 ? "+" : "-";
  const abs = Math.abs(value);
  if (unit === "R") return `${sign}${abs}R`;
  if (unit === "USD") {
    const fmt = abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return `${sign}$${fmt}`;
  }
  return `${sign}${abs}`;
}

function TradeRow({ trade, accounts, onUpdated, onDeleted }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const account = accounts.find((a) => a.id === trade.account_id);
  const pnlUnit = account?.pnl_unit || trade.pnl_unit || null;
  const isBuy = trade.direction === "buy";

  const time = trade.trade_at
    ? new Date(trade.trade_at).toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC",
      })
    : null;

  // SELL: SL → Entry → TP (red → gray → green)
  // BUY:  TP → Entry → SL (green → gray → red)
  const rows = isBuy
    ? [
        { label: "TAKE PROFIT", value: trade.take_profit, dot: "green" },
        { label: "ENTRY",       value: trade.entry_price, dot: "gray"  },
        { label: "STOP LOSS",   value: trade.stop_loss,   dot: "red"   },
      ]
    : [
        { label: "STOP LOSS",   value: trade.stop_loss,   dot: "red"   },
        { label: "ENTRY",       value: trade.entry_price, dot: "gray"  },
        { label: "TAKE PROFIT", value: trade.take_profit, dot: "green" },
      ];

  const DOT = {
    green: "bg-green-500",
    gray:  "bg-slate-300",
    red:   "bg-red-500",
  };

  const pnlFormatted = formatPnl(trade.pnl, pnlUnit);
  const pnlColor = trade.pnl === null
    ? "text-slate-300"
    : trade.pnl >= 0 ? "text-green-500" : "text-red-500";

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/trade-log/${trade.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDeleted(trade.id);
    } catch {
      // silently fail
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <span className="text-lg font-black text-slate-900 tracking-tight">{trade.symbol}</span>
        {trade.direction && (
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded ${
            isBuy
              ? "bg-green-100 text-green-600"
              : "bg-red-100 text-red-500"
          }`}>
            {trade.direction.toUpperCase()}
          </span>
        )}
        <div className="flex-1" />
        {time && (
          <span className="text-xs font-medium text-slate-400">{time}</span>
        )}
        {(trade.account_name || account?.name) && (
          <span className="text-xs font-semibold text-slate-500">
            {trade.account_name || account?.name}
          </span>
        )}
      </div>

      {/* Body rows with connecting line */}
      <div className="px-4 pb-2">
        <div className="relative">
          {/* Vertical connecting line between first and last dot */}
          <div className="absolute left-[5px] top-[18px] bottom-[18px] w-px bg-slate-200" />

          {rows.map((row, idx) => (
            <div key={row.label} className="flex items-center gap-3 py-2">
              {/* Dot */}
              <span className={`w-3 h-3 rounded-full flex-shrink-0 relative z-10 ${DOT[row.dot]}`} />

              {/* Label */}
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-24 flex-shrink-0">
                {row.label}
              </span>

              {/* Value */}
              <span className="text-sm font-semibold text-slate-700 flex-1">
                {row.value != null ? row.value : "—"}
              </span>

              {/* Right column: R/R on first row, P/L on last row */}
              <div className="text-right w-16 flex-shrink-0">
                {idx === 0 && trade.risk_reward != null && (
                  <>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">R/R</p>
                    <p className="text-sm font-bold text-slate-700">{trade.risk_reward}</p>
                  </>
                )}
                {idx === rows.length - 1 && (
                  <>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">P/L</p>
                    <p className={`text-sm font-bold ${pnlColor}`}>{pnlFormatted}</p>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-5 px-4 py-3 border-t border-slate-100">
        <button
          onClick={() => setEditOpen(true)}
          className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          EDIT
        </button>

        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Delete?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs font-bold text-red-600 hover:text-red-800"
            >
              {deleting ? "…" : "YES"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              NO
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 text-xs font-bold text-red-500 hover:text-red-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            DELETE
          </button>
        )}

        <div className="flex-1" />

        {/* Share / expand icon */}
        <button className="text-slate-300 hover:text-slate-500 transition-colors" aria-label="Share trade">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
      </div>

      {editOpen && (
        <TradeEditModal
          trade={trade}
          accounts={accounts}
          onSave={(updated) => { onUpdated(updated); setEditOpen(false); }}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}

export default function DayTradeList({ trades, accounts, onUpdated, onDeleted, isLoading }) {
  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-40 bg-slate-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!trades || trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="mb-5">
          <svg className="w-14 h-14 text-slate-300" viewBox="0 0 56 56" fill="none">
            <rect x="6"  y="6"  width="19" height="19" rx="3" stroke="currentColor" strokeWidth="2.5" />
            <rect x="31" y="6"  width="19" height="19" rx="3" stroke="currentColor" strokeWidth="2.5" />
            <rect x="6"  y="31" width="19" height="19" rx="3" stroke="currentColor" strokeWidth="2.5" />
            <rect x="31" y="31" width="19" height="19" rx="3" stroke="currentColor" strokeWidth="2.5" />
          </svg>
        </div>
        <p className="text-base font-bold text-slate-700 mb-1">No trades logged</p>
        <p className="text-sm text-slate-400 mb-5">Log your first trade for this day.</p>
        <button
          onClick={() => document.querySelector('[data-fab]')?.click()}
          className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          Log Trade
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {trades.map((trade) => (
        <TradeRow
          key={trade.id}
          trade={trade}
          accounts={accounts}
          onUpdated={onUpdated}
          onDeleted={onDeleted}
        />
      ))}
    </div>
  );
}
