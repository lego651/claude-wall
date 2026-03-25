"use client";

import { useState, useRef, useEffect } from "react";
import { utcToLocalInputValue, localInputValueToUtc, getBrowserTimezone, formatTimezoneLabel } from "@/lib/timezone";

function calcRR(entry, sl, tp) {
  const e = parseFloat(entry);
  const s = parseFloat(sl);
  const t = parseFloat(tp);
  if (isNaN(e) || isNaN(s) || isNaN(t)) return null;
  const risk = Math.abs(e - s);
  const reward = Math.abs(t - e);
  if (risk === 0) return null;
  return Math.round((reward / risk) * 100) / 100;
}

const FIELD_LABELS = {
  symbol: "Symbol",
  direction: "Direction",
  entry_price: "Entry Price",
  stop_loss: "Stop Loss",
  take_profit: "Take Profit",
  lots: "Lots / Size",
  risk_reward: "Risk/Reward",
  trade_at: "Date & Time",
  notes: "Notes",
};

function formatValue(key, value, userTimezone) {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "trade_at") {
    try {
      const tz = userTimezone || getBrowserTimezone();
      return new Date(value).toLocaleString("en-US", {
        timeZone: tz,
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return value;
    }
  }
  if (key === "direction") return value.charAt(0).toUpperCase() + value.slice(1);
  if (key === "risk_reward") return `${value}R`;
  return String(value);
}

export default function TradeCard({ trade, onSave, userTimezone, initialChartImageFile }) {
  const tz = userTimezone || getBrowserTimezone();

  const [mode, setMode] = useState("view"); // "view" | "editing" | "saved"
  const [fields, setFields] = useState(() => {
    const f = { ...trade };
    if (f.risk_reward == null) {
      const rr = calcRR(f.entry_price, f.stop_loss, f.take_profit);
      if (rr !== null) f.risk_reward = rr;
    }
    return f;
  });
  const [localTradeAt, setLocalTradeAt] = useState(() =>
    trade.trade_at ? utcToLocalInputValue(trade.trade_at, tz) : ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Chart state
  const [chartUrl, setChartUrl] = useState(trade.chart_url || "");
  const [chartImageFile, setChartImageFile] = useState(initialChartImageFile || null);
  const [chartPreviewUrl, setChartPreviewUrl] = useState(null);
  const [chartExpanded, setChartExpanded] = useState(!!initialChartImageFile);
  const [chartUploading, setChartUploading] = useState(false);
  const chartFileInputRef = useRef(null);

  // Create preview URL for initial chart image or when file changes
  useEffect(() => {
    if (chartImageFile) {
      const url = URL.createObjectURL(chartImageFile);
      setChartPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setChartPreviewUrl(null);
    }
  }, [chartImageFile]);

  function handleChartImageChange(e) {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setChartImageFile(file);
    }
  }

  function clearChartImage() {
    setChartImageFile(null);
    if (chartFileInputRef.current) chartFileInputRef.current.value = "";
  }

  function handleFieldChange(key, value) {
    if (key === "trade_at") {
      setLocalTradeAt(value);
      const utcIso = value ? localInputValueToUtc(value, tz) : null;
      setFields((prev) => ({ ...prev, trade_at: utcIso }));
    } else {
      setFields((prev) => {
        const next = { ...prev, [key]: value === "" ? null : value };
        if (key === "entry_price") {
          const rr = calcRR(next.entry_price, next.stop_loss, next.take_profit);
          if (rr !== null) next.risk_reward = rr;
        }
        return next;
      });
    }
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);

    let uploadedChartImagePath = null;

    // Upload chart image first if provided
    if (chartImageFile) {
      setChartUploading(true);
      try {
        const formData = new FormData();
        formData.append("image", chartImageFile);
        const res = await fetch("/api/trade-log/chart-upload", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          uploadedChartImagePath = data.chart_image_path;
        } else {
          const err = await res.json();
          if (err.error === "not_trading_chart") {
            setSaveError("The uploaded image doesn't look like a trading chart. Please use a chart screenshot.");
            setIsSaving(false);
            setChartUploading(false);
            return;
          }
          // Other upload errors: non-fatal, save without chart image
        }
      } catch {
        // Non-fatal: save without chart image
      } finally {
        setChartUploading(false);
      }
    }

    try {
      const res = await fetch("/api/trade-log/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          chart_url: chartUrl.trim() || null,
          chart_image_path: uploadedChartImagePath,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        const fieldErrors = body.details?.fieldErrors
          ? Object.entries(body.details.fieldErrors)
              .map(([f, msgs]) => `${f}: ${msgs[0]}`)
              .join("; ")
          : null;
        throw new Error(fieldErrors || body.error || "Save failed");
      }
      const saved = await res.json();
      setMode("saved");
      if (onSave) onSave(saved);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  const directionColor =
    fields.direction === "buy"
      ? "text-emerald-600"
      : fields.direction === "sell"
      ? "text-red-500"
      : "text-gray-500";

  const hasChart = chartUrl.trim() || chartImageFile;

  return (
    <div className="border border-gray-200 rounded-2xl p-4 bg-white shadow-sm w-full max-w-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-black text-gray-900 text-lg">{fields.symbol || "—"}</span>
          {fields.direction && (
            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full border ${
              fields.direction === "buy"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-red-50 border-red-200 text-red-600"
            }`}>
              {fields.direction}
            </span>
          )}
        </div>
        {mode === "saved" && (
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
            Saved ✓
          </span>
        )}
      </div>

      {/* Fields: View mode */}
      {mode === "view" && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
          {Object.entries(FIELD_LABELS)
            .filter(([k]) => k !== "symbol" && k !== "direction")
            .map(([key, label]) => (
              <div key={key}>
                <div className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">{label}</div>
                <div className="text-gray-800 font-medium">{formatValue(key, fields[key], tz)}</div>
                {key === "trade_at" && fields[key] && (
                  <div className="text-gray-400 text-[10px] mt-0.5">{formatTimezoneLabel(tz)}</div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Fields: Edit mode */}
      {mode === "editing" && (
        <div className="space-y-2 mb-4">
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(FIELD_LABELS)
                .filter(([k]) => k !== "symbol")
                .map(([key, label]) => (
                  <tr key={key} className="border-b border-gray-100 last:border-0">
                    <td className="py-1.5 pr-3 text-gray-500 text-xs font-semibold w-28">{label}</td>
                    <td className="py-1.5">
                      {key === "direction" ? (
                        <select
                          value={fields[key] || ""}
                          onChange={(e) => handleFieldChange(key, e.target.value || null)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-indigo-400"
                        >
                          <option value="">—</option>
                          <option value="buy">Buy</option>
                          <option value="sell">Sell</option>
                        </select>
                      ) : key === "notes" ? (
                        <textarea
                          value={fields[key] || ""}
                          onChange={(e) => handleFieldChange(key, e.target.value)}
                          rows={2}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-indigo-400 resize-none"
                        />
                      ) : key === "trade_at" ? (
                        <input
                          type="datetime-local"
                          value={localTradeAt}
                          onChange={(e) => handleFieldChange("trade_at", e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-indigo-400"
                        />
                      ) : (
                        <input
                          type="text"
                          value={fields[key] ?? ""}
                          onChange={(e) => handleFieldChange(key, e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-indigo-400"
                        />
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <button
            onClick={() => setMode("view")}
            className="w-full mt-1 bg-indigo-600 text-white text-sm font-bold py-2 rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Confirm
          </button>
        </div>
      )}

      {/* Chart section — always visible before save */}
      {mode !== "saved" && (
        <div className="border-t border-gray-100 pt-3 mb-3">
          <button
            onClick={() => setChartExpanded(!chartExpanded)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 cursor-pointer w-full text-left transition-colors"
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Add Chart</span>
            <span className="text-[10px] text-gray-300 ml-0.5">optional</span>
            {hasChart && (
              <span className="ml-1 text-indigo-400 text-[10px] font-bold">✓</span>
            )}
            <svg
              className={`w-3 h-3 ml-auto text-gray-300 transition-transform ${chartExpanded ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {chartExpanded && (
            <div className="mt-2 space-y-2">
              {/* TradingView URL */}
              <input
                type="url"
                value={chartUrl}
                onChange={(e) => setChartUrl(e.target.value)}
                placeholder="TradingView link (e.g. https://www.tradingview.com/x/…)"
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-400 placeholder:text-gray-300"
              />

              <div className="flex items-center gap-2 text-[10px] text-gray-300">
                <div className="flex-1 h-px bg-gray-100" />
                <span>or upload screenshot</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {chartImageFile && chartPreviewUrl ? (
                <div className="relative rounded-lg overflow-hidden border border-gray-100">
                  <img
                    src={chartPreviewUrl}
                    alt="Chart preview"
                    className="w-full max-h-32 object-cover"
                  />
                  <button
                    onClick={clearChartImage}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center text-xs cursor-pointer transition-colors"
                    aria-label="Remove chart image"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 border border-dashed border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-400 hover:border-indigo-300 hover:text-indigo-400 cursor-pointer transition-colors">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Upload chart screenshot
                  <input
                    ref={chartFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleChartImageChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {saveError && (
        <p className="text-red-500 text-xs mb-2">{saveError}</p>
      )}

      {/* CTAs */}
      {mode !== "saved" && (
        <div className="flex gap-2">
          {mode === "view" && (
            <button
              onClick={() => setMode("editing")}
              className="flex-1 border border-gray-200 text-gray-600 text-sm font-bold py-2 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Edit
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 bg-gray-900 text-white text-sm font-bold py-2 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {chartUploading ? "Uploading…" : isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
