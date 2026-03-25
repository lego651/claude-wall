"use client";

import { useState } from "react";
import { utcToLocalInputValue, localInputValueToUtc, getBrowserTimezone } from "@/lib/timezone";

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

export default function TradeCard({ trade, onSave, userTimezone }) {
  const tz = userTimezone || getBrowserTimezone();

  const [mode, setMode] = useState("view"); // "view" | "editing" | "saved"
  const [fields, setFields] = useState({ ...trade });
  // Separate local-timezone representation for the datetime-local input
  const [localTradeAt, setLocalTradeAt] = useState(() =>
    trade.trade_at ? utcToLocalInputValue(trade.trade_at, tz) : ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  function handleFieldChange(key, value) {
    if (key === "trade_at") {
      // value here is the local datetime-local input value ("YYYY-MM-DDTHH:mm")
      setLocalTradeAt(value);
      const utcIso = value ? localInputValueToUtc(value, tz) : null;
      setFields((prev) => ({ ...prev, trade_at: utcIso }));
    } else {
      setFields((prev) => ({ ...prev, [key]: value === "" ? null : value }));
    }
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/trade-log/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
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
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
