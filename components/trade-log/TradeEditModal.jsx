"use client";

import { useState } from "react";

export default function TradeEditModal({ trade, accounts, onSave, onClose }) {
  const [symbol, setSymbol] = useState(trade.symbol || "");
  const [direction, setDirection] = useState(trade.direction || "");
  const [entryPrice, setEntryPrice] = useState(trade.entry_price != null ? String(trade.entry_price) : "");
  const [stopLoss, setStopLoss] = useState(trade.stop_loss != null ? String(trade.stop_loss) : "");
  const [takeProfit, setTakeProfit] = useState(trade.take_profit != null ? String(trade.take_profit) : "");
  const [lots, setLots] = useState(trade.lots != null ? String(trade.lots) : "");
  const [rr, setRr] = useState(trade.risk_reward != null ? String(trade.risk_reward) : "");
  const [tradeAt, setTradeAt] = useState(
    trade.trade_at ? trade.trade_at.substring(0, 16) : ""
  );
  const [notes, setNotes] = useState(trade.notes || "");
  const [accountId, setAccountId] = useState(trade.account_id || "");
  const [pnlInput, setPnlInput] = useState(trade.pnl != null ? String(trade.pnl) : "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const pnlUnit = selectedAccount?.pnl_unit || null;

  async function handleSave() {
    if (!symbol.trim()) {
      setError("Symbol is required");
      return;
    }
    setSaving(true);
    setError("");

    const body = {
      symbol: symbol.trim(),
      direction: direction || null,
      entry_price: entryPrice !== "" ? parseFloat(entryPrice) : null,
      stop_loss: stopLoss !== "" ? parseFloat(stopLoss) : null,
      take_profit: takeProfit !== "" ? parseFloat(takeProfit) : null,
      lots: lots !== "" ? parseFloat(lots) : null,
      risk_reward: rr !== "" ? parseFloat(rr) : null,
      trade_at: tradeAt ? `${tradeAt}:00Z` : null,
      notes: notes.trim() || null,
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
      const updated = await res.json();
      onSave(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-black text-gray-900">Edit Trade</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold" aria-label="Close">×</button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div>
            <label className="text-xs font-semibold text-gray-600">Symbol *</label>
            <input value={symbol} onChange={(e) => setSymbol(e.target.value)} className="input input-bordered input-sm w-full mt-1" maxLength={20} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600">Direction</label>
              <select value={direction} onChange={(e) => setDirection(e.target.value)} className="select select-bordered select-sm w-full mt-1">
                <option value="">—</option>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Entry Price</label>
              <input type="number" step="any" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} className="input input-bordered input-sm w-full mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600">Stop Loss</label>
              <input type="number" step="any" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} className="input input-bordered input-sm w-full mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Take Profit</label>
              <input type="number" step="any" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} className="input input-bordered input-sm w-full mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600">Lots</label>
              <input type="number" step="any" value={lots} onChange={(e) => setLots(e.target.value)} className="input input-bordered input-sm w-full mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Risk/Reward</label>
              <input type="number" step="any" value={rr} onChange={(e) => setRr(e.target.value)} className="input input-bordered input-sm w-full mt-1" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Trade Date & Time (UTC)</label>
            <input type="datetime-local" value={tradeAt} onChange={(e) => setTradeAt(e.target.value)} className="input input-bordered input-sm w-full mt-1" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="textarea textarea-bordered textarea-sm w-full mt-1" rows={2} maxLength={1000} />
          </div>

          {accounts.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-gray-600">Account</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="select select-bordered select-sm w-full mt-1">
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.pnl_unit === "R" ? "R" : "$"})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-600">
              P&L {pnlUnit ? `(${pnlUnit === "R" ? "R" : "$"})` : ""}
            </label>
            <input
              type="number"
              step="any"
              value={pnlInput}
              onChange={(e) => setPnlInput(e.target.value)}
              placeholder={pnlUnit === "R" ? "e.g. 2" : "e.g. 1000"}
              className="input input-bordered input-sm w-full mt-1"
              aria-label={`P&L${pnlUnit ? ` (${pnlUnit})` : ""}`}
            />
            <p className="text-xs text-gray-400 mt-0.5">Leave blank to clear P&L</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn btn-outline btn-sm flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm flex-1">
            {saving ? <span className="loading loading-spinner loading-xs" /> : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
