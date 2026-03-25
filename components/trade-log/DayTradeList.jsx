"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import TradeEditModal from "./TradeEditModal";
import { createClient } from "@/lib/supabase/client";
import { getBrowserTimezone, formatTimezoneLabel } from "@/lib/timezone";

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

function ChartImageLightbox({ signedUrl, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
        <img
          src={signedUrl}
          alt="Chart screenshot"
          className="w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
        />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center text-lg cursor-pointer transition-colors"
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function ChartImageTop({ chartImagePath }) {
  const [signedUrl, setSignedUrl] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!chartImagePath) return;
    const supabase = createClient();
    supabase.storage
      .from("trade-charts")
      .createSignedUrl(chartImagePath, 3600)
      .then(({ data }) => setSignedUrl(data?.signedUrl || null))
      .catch(() => {});
  }, [chartImagePath]);

  if (!chartImagePath) return null;

  return (
    <>
      <div
        className="w-full h-36 bg-slate-100 overflow-hidden cursor-pointer"
        onClick={() => signedUrl && setLightboxOpen(true)}
      >
        {signedUrl ? (
          <img src={signedUrl} alt="Chart" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full animate-pulse bg-slate-200" />
        )}
      </div>
      {lightboxOpen && signedUrl && (
        <ChartImageLightbox signedUrl={signedUrl} onClose={() => setLightboxOpen(false)} />
      )}
    </>
  );
}

const RESULT_STATUSES = [
  {
    key: "TP",
    label: "TP",
    active:   "text-white bg-green-500 border border-green-500",
    inactive: "text-indigo-400 bg-transparent border border-indigo-300 hover:bg-indigo-50",
  },
  {
    key: "BE",
    label: "BE",
    active:   "text-white bg-slate-500 border border-slate-500",
    inactive: "text-indigo-400 bg-transparent border border-indigo-300 hover:bg-indigo-50",
  },
  {
    key: "SL",
    label: "SL",
    active:   "text-white bg-red-500 border border-red-500",
    inactive: "text-indigo-400 bg-transparent border border-indigo-300 hover:bg-indigo-50",
  },
];

function getResultStatus(pnl, rr) {
  if (pnl === null || pnl === undefined) return null;
  if (pnl === 0) return "BE";
  if (pnl === -1) return "SL";
  if (rr != null && pnl === rr) return "TP";
  return null;
}

function TradeRow({ trade, accounts, onUpdated, onDeleted, userTimezone }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const account = accounts.find((a) => a.id === trade.account_id);
  const pnlUnit = account?.pnl_unit || trade.pnl_unit || null;
  const isBuy = trade.direction === "buy";

  const tz = userTimezone || getBrowserTimezone();
  const time = trade.trade_at
    ? new Date(trade.trade_at).toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz,
      })
    : null;
  // Extract just the UTC offset, e.g. "UTC-4" from "New York (UTC-4)"
  const tzLabel = formatTimezoneLabel(tz).match(/\(([^)]+)\)/)?.[1] ?? "UTC";

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

  async function handleSetStatus(statusKey) {
    const currentStatus = getResultStatus(trade.pnl, trade.risk_reward);
    // Toggle off if already active
    const pnl = currentStatus === statusKey ? null
      : statusKey === "TP" ? (trade.risk_reward ?? 0)
      : statusKey === "BE" ? 0
      : -1; // SL

    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/trade-log/${trade.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pnl }),
      });
      if (!res.ok) throw new Error();
      onUpdated(await res.json());
    } catch {
      // silently fail
    } finally {
      setUpdatingStatus(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

      {/* Chart thumbnail — only when screenshot exists */}
      <ChartImageTop chartImagePath={trade.chart_image_path} />

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
        {(trade.account_name || account?.name) && (
          <span className="text-xs font-semibold text-slate-600 bg-slate-100 rounded px-2 py-0.5">
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
            <div key={row.label} className="grid grid-cols-2 items-start py-2">
              {/* Left: Dot + Label + Price */}
              <div className="flex items-start gap-3">
                <span className={`w-3 h-3 rounded-full flex-shrink-0 relative z-10 mt-0.5 ${DOT[row.dot]}`} />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                    {row.label}
                  </p>
                  <p className="text-xs font-semibold text-slate-600 mt-0.5">
                    {row.value != null ? row.value : "—"}
                  </p>
                </div>
              </div>

              {/* Right: R/R on first row, P/L on last row */}
              <div className="text-right">
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
      <div className="flex items-center px-4 py-3 border-t border-slate-100 gap-2">

        {/* Left: result status — pen icon + TP / BE / SL pills */}
        <div className="flex items-center gap-1.5">
          <svg className="w-3 h-3 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          {RESULT_STATUSES.map(({ key, label, active, inactive }) => {
            const isActive = getResultStatus(trade.pnl, trade.risk_reward) === key;
            return (
              <button
                key={key}
                onClick={() => handleSetStatus(key)}
                disabled={updatingStatus}
                className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all cursor-pointer disabled:opacity-40 ${isActive ? active : inactive}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Middle: time + timezone */}
        <div className="flex-1 flex items-center justify-center gap-1">
          {time && (
            <>
              <div className="w-px h-3 bg-slate-200 shrink-0" />
              <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-slate-400">
                {time}
                <Link
                  href="/user/settings/trading"
                  className="inline-flex items-center gap-0.5 hover:text-indigo-500 transition-colors cursor-pointer"
                  title="Update preferred timezone in Trading Settings"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {tzLabel}
                </Link>
              </span>
              <div className="w-px h-3 bg-slate-200 shrink-0" />
            </>
          )}
        </div>

        {/* Right: edit + delete */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditOpen(true)}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
          >
            EDIT
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Delete?</span>
              <button onClick={handleDelete} disabled={deleting} className="text-xs font-bold text-red-600 hover:text-red-800 cursor-pointer">
                {deleting ? "…" : "YES"}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer">
                NO
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-red-400 hover:text-red-600 transition-colors cursor-pointer"
              aria-label="Delete trade"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>

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

export default function DayTradeList({ trades, accounts, onUpdated, onDeleted, isLoading, userTimezone }) {
  if (isLoading) {
    return (
      <div className="space-y-3">
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
          className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
        >
          Log Trade
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {trades.map((trade) => (
        <TradeRow
          key={trade.id}
          trade={trade}
          accounts={accounts}
          onUpdated={onUpdated}
          onDeleted={onDeleted}
          userTimezone={userTimezone}
        />
      ))}
    </div>
  );
}
