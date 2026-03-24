"use client";

import { useRef, useState, useEffect } from "react";
import TradeCard from "./TradeCard";

const NON_TRADE_REPLY =
  "This assistant is only for logging trades and recording P&L results.";

function formatPnl(value, unit) {
  if (value === null || value === undefined) return "—";
  const sign = value >= 0 ? "+" : "";
  if (unit === "R") return `${sign}${value}R`;
  if (unit === "USD") {
    return `${sign}$${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}${value < 0 ? "" : ""}`.replace("+$-", "-$");
  }
  return `${sign}${value}`;
}

export default function TradeLogModal({ onClose, onSaved }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pnlInput, setPnlInput] = useState("");

  // Account picker
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || null;
  const pnlUnit = selectedAccount?.pnl_unit || null;

  // pnl_update flow state
  const [pendingPnlUpdate, setPendingPnlUpdate] = useState(null); // { symbol, pnl, matchingTrades }
  const [selectedTradeForPnl, setSelectedTradeForPnl] = useState(null);

  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

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

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function pushMessage(msg) {
    setMessages((prev) => [...prev, msg]);
  }

  async function handlePnlUpdateResponse(data) {
    // Fetch today's trades for the active account
    const today = new Date().toISOString().substring(0, 10);
    let dailyTrades = [];
    try {
      const params = new URLSearchParams({ date: today });
      if (selectedAccountId) params.set("account_id", selectedAccountId);
      const res = await fetch(`/api/trade-log/daily?${params}`);
      if (res.ok) {
        const body = await res.json();
        dailyTrades = body.trades || [];
      }
    } catch {
      // ignore
    }

    const symbol = data.symbol?.toUpperCase();
    const matching = dailyTrades.filter(
      (t) => t.symbol?.toUpperCase() === symbol
    );

    if (matching.length === 0) {
      pushMessage({
        type: "system",
        text: `No ${symbol} trade found today. Log the trade first.`,
      });
      return;
    }

    const pnlState = { symbol, pnl: data.pnl, matchingTrades: matching };
    setPendingPnlUpdate(pnlState);

    if (matching.length === 1) {
      const t = matching[0];
      const time = t.trade_at ? new Date(t.trade_at).toISOString().substring(11, 16) : "?";
      pushMessage({
        type: "pnl_confirm",
        trade: t,
        pnl: data.pnl,
        text: `Update ${symbol} trade P&L to ${formatPnl(data.pnl, pnlUnit)}?\nEntry: ${t.entry_price} at ${time} UTC`,
      });
    } else {
      pushMessage({
        type: "pnl_select",
        trades: matching,
        pnl: data.pnl,
        symbol,
      });
    }
  }

  async function handleConfirmPnlUpdate(trade) {
    if (!pendingPnlUpdate) return;
    try {
      const res = await fetch(`/api/trade-log/${trade.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pnl: pendingPnlUpdate.pnl }),
      });
      if (!res.ok) throw new Error();
      pushMessage({
        type: "system",
        text: `P&L updated: ${formatPnl(pendingPnlUpdate.pnl, pnlUnit)} on ${pendingPnlUpdate.symbol} ✓`,
      });
    } catch {
      pushMessage({ type: "system", text: "Failed to update P&L." });
    } finally {
      setPendingPnlUpdate(null);
      setSelectedTradeForPnl(null);
    }
  }

  function handleCancelPnlUpdate() {
    setPendingPnlUpdate(null);
    setSelectedTradeForPnl(null);
    pushMessage({ type: "system", text: "Cancelled." });
  }

  async function handleSend() {
    if (!input.trim() && !imageFile) return;
    if (isLoading) return;

    const userText = input.trim();
    const userImage = imagePreview;

    pushMessage({ type: "user", text: userText, image: userImage });
    setInput("");
    clearImage();
    setIsLoading(true);

    try {
      const formData = new FormData();
      if (userText) formData.append("message", userText);
      if (imageFile) formData.append("image", imageFile);

      const res = await fetch("/api/trade-log/parse", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.error === "non_trade") {
        pushMessage({ type: "system", text: NON_TRADE_REPLY });
      } else if (data.error) {
        pushMessage({ type: "system", text: `Error: ${data.error}` });
      } else if (data.type === "pnl_update") {
        await handlePnlUpdateResponse(data);
      } else {
        // new_trade (or legacy without type)
        // Ensure trade_at is always an ISO string with offset so it passes schema validation
        const tradeAt = data.trade_at
          ? (data.trade_at.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(data.trade_at)
              ? data.trade_at
              : data.trade_at + "Z")
          : new Date().toISOString();
        pushMessage({ type: "trade_card", trade: { ...data, trade_at: tradeAt, pnl: parsePnlInput(), account_id: selectedAccountId } });
      }
    } catch {
      pushMessage({ type: "system", text: "Something went wrong. Please try again." });
    } finally {
      setIsLoading(false);
    }
  }

  function parsePnlInput() {
    const v = parseFloat(pnlInput);
    return isNaN(v) ? null : v;
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <h2 className="font-black text-gray-900">Log a Trade</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl font-bold leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Account picker + P&L field */}
        {accounts.length > 0 && (
          <div className="px-4 pt-3 pb-2 border-b border-gray-100 space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-500 shrink-0">Account</label>
              <select
                value={selectedAccountId || ""}
                onChange={(e) => setSelectedAccountId(e.target.value || null)}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                aria-label="Trade account"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.pnl_unit === "R" ? "R" : "$"})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-500 shrink-0">
                P&L {pnlUnit ? `(${pnlUnit === "R" ? "R" : "$"})` : ""}
              </label>
              <input
                type="number"
                step="any"
                value={pnlInput}
                onChange={(e) => setPnlInput(e.target.value)}
                placeholder={pnlUnit === "R" ? "e.g. 2" : "e.g. 1000"}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                aria-label={`P&L ${pnlUnit ? `(${pnlUnit})` : ""}`}
              />
            </div>
          </div>
        )}

        {/* Chat history */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-8">
              <p className="font-medium">Describe your trade or upload a screenshot.</p>
              <p className="text-xs mt-1">e.g. "Bought EURUSD at 1.0850, SL 1.0820, TP 1.0920"</p>
            </div>
          )}

          {messages.map((msg, i) => {
            if (msg.type === "user") {
              return (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] space-y-2">
                    {msg.image && (
                      <img src={msg.image} alt="Uploaded" className="rounded-xl max-h-40 object-contain ml-auto" />
                    )}
                    {msg.text && (
                      <div className="bg-indigo-600 text-white text-sm rounded-2xl rounded-tr-sm px-4 py-2.5">
                        {msg.text}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            if (msg.type === "system") {
              return (
                <div key={i} className="flex justify-start">
                  <div className="bg-gray-100 text-gray-600 text-sm rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[80%] whitespace-pre-line">
                    {msg.text}
                  </div>
                </div>
              );
            }

            if (msg.type === "trade_card") {
              return (
                <div key={i} className="flex justify-start">
                  <TradeCard trade={msg.trade} accountId={selectedAccountId} pnlUnit={pnlUnit} onSave={onSaved} />
                </div>
              );
            }

            if (msg.type === "pnl_confirm") {
              return (
                <div key={i} className="flex justify-start">
                  <div className="bg-amber-50 border border-amber-200 text-gray-800 text-sm rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] space-y-2">
                    <p className="whitespace-pre-line">{msg.text}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleConfirmPnlUpdate(msg.trade)}
                        className="btn btn-xs btn-primary"
                      >
                        Confirm
                      </button>
                      <button onClick={handleCancelPnlUpdate} className="btn btn-xs btn-ghost">
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            if (msg.type === "pnl_select") {
              return (
                <div key={i} className="flex justify-start">
                  <div className="bg-amber-50 border border-amber-200 text-gray-800 text-sm rounded-2xl rounded-tl-sm px-4 py-3 max-w-[90%] space-y-2">
                    <p>Multiple {msg.symbol} trades today. Which one to update to {formatPnl(msg.pnl, pnlUnit)}?</p>
                    <div className="space-y-1">
                      {msg.trades.map((t) => {
                        const time = t.trade_at ? new Date(t.trade_at).toISOString().substring(11, 16) : "?";
                        return (
                          <button
                            key={t.id}
                            onClick={() => {
                              setPendingPnlUpdate({ symbol: msg.symbol, pnl: msg.pnl, matchingTrades: msg.trades });
                              const confirmText = `Update ${msg.symbol} trade P&L to ${formatPnl(msg.pnl, pnlUnit)}?\nEntry: ${t.entry_price} at ${time} UTC`;
                              pushMessage({ type: "pnl_confirm", trade: t, pnl: msg.pnl, text: confirmText });
                            }}
                            className="block w-full text-left text-xs bg-white border border-amber-200 rounded-lg px-3 py-1.5 hover:bg-amber-50"
                          >
                            {t.symbol} {t.direction?.toUpperCase()} @ {t.entry_price} — {time} UTC
                          </button>
                        );
                      })}
                    </div>
                    <button onClick={handleCancelPnlUpdate} className="btn btn-xs btn-ghost">
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }

            return null;
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-400 text-sm rounded-2xl rounded-tl-sm px-4 py-2.5">
                <span className="animate-pulse">Analyzing…</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Image preview strip */}
        {imagePreview && (
          <div className="px-4 pb-2 flex items-center gap-2">
            <div className="relative">
              <img src={imagePreview} alt="Preview" className="h-14 w-14 object-cover rounded-lg border border-gray-200" />
              <button
                onClick={clearImage}
                className="absolute -top-1.5 -right-1.5 bg-gray-800 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center leading-none"
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Input row */}
        <div className="px-4 pb-4 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2 bg-gray-50 rounded-2xl px-3 py-2 border border-gray-200">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your trade…"
              className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
              disabled={isLoading}
            />

            {/* Camera / file button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              aria-label="Attach image"
              disabled={isLoading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleImageChange}
            />

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={isLoading || (!input.trim() && !imageFile)}
              className="bg-indigo-600 text-white rounded-xl px-3 py-1.5 text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-40"
              aria-label="Send"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
