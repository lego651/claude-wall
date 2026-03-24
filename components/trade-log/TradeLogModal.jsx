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
  const [pendingPnlUpdate, setPendingPnlUpdate] = useState(null);
  const [selectedTradeForPnl, setSelectedTradeForPnl] = useState(null);

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);   // ATTACH FILE — no capture, opens file picker
  const cameraInputRef = useRef(null); // Camera button — capture="environment" for mobile
  const modalRef = useRef(null);
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
    applyFile(e.target.files?.[0]);
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  function applyFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  // Drag-and-drop on chat area
  function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }
  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }
  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!modalRef.current?.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  }
  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    applyFile(file);
  }

  function pushMessage(msg) {
    setMessages((prev) => [...prev, msg]);
  }

  async function handlePnlUpdateResponse(data) {
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

  const accountName = selectedAccount?.name || (accounts[0]?.name ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal — full drop zone */}
      <div
        ref={modalRef}
        className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] z-10"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay — covers entire modal */}
        {isDragging && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-t-3xl sm:rounded-3xl border-2 border-dashed border-indigo-400 bg-indigo-50/90 pointer-events-none">
            <div className="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-indigo-400 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <p className="text-sm font-semibold text-indigo-600">Drop image here</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            {/* Purple icon circle */}
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 3v18h18M7 16l4-4 4 4 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </div>
            <div>
              <h2 className="font-black text-gray-900 text-lg leading-tight">Log a Trade</h2>
              <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase leading-tight">Smart Journaling Assistant</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl font-bold leading-none w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Account + P&L row */}
        {accounts.length > 0 && (
          <div className="px-5 pr-5 pb-3 flex items-center gap-3">
            {/* Account */}
            <div className="flex items-center gap-2 flex-1">
              <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase shrink-0">Account</span>
              <select
                value={selectedAccountId || ""}
                onChange={(e) => setSelectedAccountId(e.target.value || null)}
                className="flex-1 text-sm font-medium text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 min-w-0"
                aria-label="Trade account"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            {/* P&L */}
            <div className="flex items-center gap-2 flex-1">
              <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase shrink-0">
                P&amp;L {pnlUnit ? `(${pnlUnit === "R" ? "R" : "$"})` : ""}
              </span>
              <input
                type="number"
                step="any"
                value={pnlInput}
                onChange={(e) => setPnlInput(e.target.value)}
                placeholder={pnlUnit === "R" ? "e.g. 2.5" : "e.g. 1000"}
                className="flex-1 text-sm text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 min-w-0"
                aria-label={`P&L ${pnlUnit ? `(${pnlUnit})` : ""}`}
              />
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="h-px bg-gray-100 mx-0" />

        {/* Chat history */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3 min-h-0 relative">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center">
              {/* Image placeholder icon */}
              <div className="w-16 h-16 rounded-2xl border-2 border-gray-200 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>
              <p className="font-semibold text-gray-400 text-sm">Describe your trade or upload a screenshot.</p>
              <p className="text-xs text-gray-400 mt-1">e.g. &quot;Bought EURUSD at 1.0850, SL 1.0820, TP 1.0920&quot;</p>
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
          <div className="px-5 pb-2 flex items-center gap-2">
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

        {/* Divider */}
        <div className="h-px bg-gray-100" />

        {/* Input row */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2.5 border border-gray-200 shadow-sm">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your trade or upload trading pic to get log"
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none min-w-0"
              disabled={isLoading}
            />
            {/* Camera button — opens camera on mobile, file picker on desktop */}
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
              aria-label="Take photo"
              disabled={isLoading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
            {/* Camera input: capture="environment" opens the camera on mobile */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleImageChange}
            />
            {/* File picker input: no capture, opens file browser on all devices */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
            {/* Round send button */}
            <button
              onClick={handleSend}
              disabled={isLoading || (!input.trim() && !imageFile)}
              className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-40 shrink-0"
              aria-label="Send"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="px-5 pb-4 pt-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 tracking-wide hover:text-indigo-500 transition-colors disabled:opacity-40"
            aria-label="Attach file"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
            </svg>
            <span className="uppercase tracking-widest">Attach File</span>
            <span className="text-gray-300 mx-0.5">•</span>
            <span className="uppercase tracking-widest">Drag &amp; Drop to Upload</span>
          </button>
        </div>

      </div>
    </div>
  );
}
