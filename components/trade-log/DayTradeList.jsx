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
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const account = accounts.find((a) => a.id === trade.account_id);
  const pnlUnit = account?.pnl_unit || trade.pnl_unit || null;

  const time = trade.trade_at
    ? new Date(trade.trade_at).toISOString().substring(11, 16)
    : null;

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/trade-log/${trade.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDeleted(trade.id);
    } catch {
      // silently fail; could add a toast
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Collapsed row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900 text-sm">{trade.symbol}</span>
            {trade.direction && (
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${trade.direction === "buy" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {trade.direction.toUpperCase()}
              </span>
            )}
            {trade.entry_price && (
              <span className="text-xs text-gray-500">{trade.entry_price}</span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-xs text-gray-400">
          {time && <span>{time}</span>}
        </div>
        <div className="shrink-0 text-xs text-gray-400 text-right">
          {trade.account_name || account?.name || ""}
        </div>
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
            {trade.stop_loss != null && <div><span className="font-medium">SL:</span> {trade.stop_loss}</div>}
            {trade.take_profit != null && <div><span className="font-medium">TP:</span> {trade.take_profit}</div>}
            {trade.lots != null && <div><span className="font-medium">Lots:</span> {trade.lots}</div>}
            {trade.risk_reward != null && <div><span className="font-medium">R/R:</span> {trade.risk_reward}</div>}
            {trade.notes && <div className="col-span-2"><span className="font-medium">Notes:</span> {trade.notes}</div>}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">P&L:</span>
            <span className={`text-sm font-bold ${trade.pnl === null ? "text-gray-400" : trade.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatPnl(trade.pnl, pnlUnit)}
            </span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => setEditOpen(true)}
              className="btn btn-xs btn-outline"
            >
              Edit
            </button>

            {confirmDelete ? (
              <>
                <span className="text-xs text-gray-600">Delete this trade?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="btn btn-xs btn-error"
                >
                  {deleting ? <span className="loading loading-spinner loading-xs" /> : "Yes"}
                </button>
                <button onClick={() => setConfirmDelete(false)} className="btn btn-xs btn-ghost">
                  No
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="btn btn-xs btn-ghost text-red-400 hover:text-red-600"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}

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
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-gray-200 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!trades || trades.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No trades logged for this day.
      </div>
    );
  }

  return (
    <div className="space-y-2">
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
