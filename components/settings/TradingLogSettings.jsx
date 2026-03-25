"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { formatTimezoneLabel, getBrowserTimezone } from "@/lib/timezone";

const COMMON_TIMEZONES = [
  // UTC
  'UTC',
  // UTC-12
  'Etc/GMT+12',           // UTC-12 (no DST)
  // UTC-11
  'Pacific/Midway',       // Midway
  'Pacific/Pago_Pago',    // Pago Pago
  // UTC-10
  'Pacific/Honolulu',     // Honolulu (no DST)
  'Pacific/Tahiti',       // Tahiti (no DST)
  // UTC-9  (Gambier is permanent UTC-9; Anchorage is UTC-9 in winter / UTC-8 in summer)
  'Pacific/Gambier',      // Gambier Islands (always UTC-9)
  'America/Anchorage',    // Anchorage
  // UTC-8
  'America/Los_Angeles',  // Los Angeles
  'America/Vancouver',    // Vancouver
  // UTC-7
  'America/Phoenix',      // Phoenix (no DST, always UTC-7)
  'America/Denver',       // Denver
  // UTC-6
  'America/Mexico_City',  // Mexico City (no DST since 2022, always UTC-6)
  'America/Chicago',      // Chicago
  // UTC-5
  'America/New_York',     // New York
  'America/Toronto',      // Toronto
  // UTC-4  (Caracas & La Paz have no DST — permanently UTC-4)
  'America/Caracas',      // Caracas (no DST)
  'America/La_Paz',       // La Paz (no DST)
  // UTC-3
  'America/Sao_Paulo',    // Sao Paulo
  'America/Argentina/Buenos_Aires', // Buenos Aires (no DST)
  // UTC-2
  'America/Noronha',      // Noronha (no DST)
  // UTC-1
  'Atlantic/Cape_Verde',  // Cape Verde (no DST, always UTC-1)
  'Atlantic/Azores',      // Azores (UTC-1 / UTC+0 in summer)
  // UTC
  'Atlantic/Reykjavik',   // Reykjavik (no DST, always UTC)
  'Europe/London',        // London (UTC / UTC+1 in summer)
  // UTC+1
  'Europe/Paris',         // Paris
  'Europe/Berlin',        // Berlin
  // UTC+2
  'Africa/Cairo',         // Cairo (no DST, always UTC+2)
  'Europe/Athens',        // Athens (UTC+2 / UTC+3 in summer)
  // UTC+3
  'Europe/Moscow',        // Moscow (no DST)
  'Asia/Riyadh',          // Riyadh (no DST)
  // UTC+4
  'Asia/Dubai',           // Dubai (no DST)
  'Asia/Baku',            // Baku
  // UTC+5
  'Asia/Karachi',         // Karachi (no DST)
  'Asia/Tashkent',        // Tashkent (no DST)
  'Asia/Almaty',          // Almaty (no DST, moved to UTC+5 in 2024)
  // UTC+6
  'Asia/Dhaka',           // Dhaka (no DST)
  'Asia/Bishkek',         // Bishkek (no DST)
  // UTC+7
  'Asia/Bangkok',         // Bangkok (no DST)
  'Asia/Ho_Chi_Minh',     // Ho Chi Minh (no DST)
  // UTC+8
  'Asia/Singapore',       // Singapore (no DST)
  'Asia/Shanghai',        // Shanghai (no DST)
  // UTC+9
  'Asia/Tokyo',           // Tokyo (no DST)
  'Asia/Seoul',           // Seoul (no DST)
  // UTC+10
  'Australia/Brisbane',   // Brisbane (no DST, always UTC+10)
  'Australia/Sydney',     // Sydney (UTC+10 / UTC+11 in summer)
  // UTC+11
  'Pacific/Noumea',       // Noumea (no DST)
  'Pacific/Guadalcanal',  // Guadalcanal (no DST)
  // UTC+12
  'Pacific/Fiji',         // Fiji (no DST since 2022, always UTC+12)
  'Pacific/Auckland',     // Auckland (UTC+12 / UTC+13 in summer)
  // UTC+13
  'Pacific/Apia',         // Apia
  'Pacific/Tongatapu',    // Tongatapu (no DST)
];

function PnlUnitBadge({ unit }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${unit === 'R' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
      {unit === 'R' ? 'R' : '$'}
    </span>
  );
}

export default function TradingLogSettings() {
  const [accounts, setAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Timezone preference
  const [preferredTimezone, setPreferredTimezone] = useState(null);
  const [loadingTz, setLoadingTz] = useState(true);
  const [savingTz, setSavingTz] = useState(false);

  // New account form
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("USD");
  const [addingAccount, setAddingAccount] = useState(false);

  // Rename state: accountId → temp name
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  // Default P&L edit state
  const [editingPnlId, setEditingPnlId] = useState(null);
  const [pnlEditValue, setPnlEditValue] = useState("");

  // Daily limit edit state
  const [editingLimitId, setEditingLimitId] = useState(null);
  const [limitEditValue, setLimitEditValue] = useState("");

  // Delete confirm
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    fetchAccounts();
    fetch('/api/user-settings/trading')
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => setPreferredTimezone(data.preferred_timezone || null))
      .catch(() => {})
      .finally(() => setLoadingTz(false));
  }, []);

  async function fetchAccounts() {
    setLoadingAccounts(true);
    try {
      const res = await fetch("/api/trade-accounts");
      if (res.ok) {
        setAccounts(await res.json());
      }
    } catch {
      toast.error("Failed to load accounts");
    } finally {
      setLoadingAccounts(false);
    }
  }

  async function handleAddAccount(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAddingAccount(true);
    try {
      const res = await fetch("/api/trade-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), pnl_unit: newUnit }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add account");
      }
      const created = await res.json();
      setAccounts((prev) => [...prev, created]);
      setNewName("");
      setNewUnit("USD");
      toast.success("Account created");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAddingAccount(false);
    }
  }

  async function handleRename(id) {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingId(null);
      return;
    }
    try {
      const res = await fetch(`/api/trade-accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setAccounts((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch {
      toast.error("Failed to rename account");
    } finally {
      setRenamingId(null);
    }
  }

  async function handleSaveDefaultPnl(id) {
    const trimmed = pnlEditValue.trim();
    const val = trimmed === "" ? null : parseFloat(trimmed);
    if (trimmed !== "" && isNaN(val)) {
      toast.error("Default P&L must be a number");
      return;
    }
    try {
      const res = await fetch(`/api/trade-accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_pnl: val }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setAccounts((prev) => prev.map((a) => (a.id === id ? updated : a)));
      toast.success(val === null ? "Default P&L cleared" : "Default P&L saved");
    } catch {
      toast.error("Failed to save default P&L");
    } finally {
      setEditingPnlId(null);
    }
  }

  async function handleSaveAccountLimit(id) {
    const trimmed = limitEditValue.trim();
    const val = trimmed === "" ? null : parseInt(trimmed, 10);
    if (trimmed !== "" && (isNaN(val) || val < 1)) {
      toast.error("Daily limit must be a positive number");
      return;
    }
    try {
      const res = await fetch(`/api/trade-accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_trade_limit: val }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setAccounts((prev) => prev.map((a) => (a.id === id ? updated : a)));
      toast.success(val === null ? "Daily limit cleared" : "Daily limit saved");
    } catch {
      toast.error("Failed to save daily limit");
    } finally {
      setEditingLimitId(null);
    }
  }

  async function handleSetDefault(id) {
    try {
      const res = await fetch(`/api/trade-accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: true }),
      });
      if (!res.ok) throw new Error();
      setAccounts((prev) =>
        prev.map((a) => ({ ...a, is_default: a.id === id }))
      );
    } catch {
      toast.error("Failed to set default account");
    }
  }

  async function handleDelete(id) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/trade-accounts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete");
      }
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      setConfirmDeleteId(null);
      toast.success("Account deleted");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSaveTimezone(tz) {
    setSavingTz(true);
    try {
      const res = await fetch('/api/user-settings/trading', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferred_timezone: tz }),
      });
      if (!res.ok) throw new Error();
      setPreferredTimezone(tz);
      toast.success('Timezone saved');
    } catch {
      toast.error('Failed to save timezone');
    } finally {
      setSavingTz(false);
    }
  }

  // Determine the timezone options, ensuring the user's browser tz is always present
  const browserTz = getBrowserTimezone();
  const effectiveTz = preferredTimezone || browserTz;
  const tzOptions = COMMON_TIMEZONES.includes(effectiveTz)
    ? COMMON_TIMEZONES
    : [effectiveTz, ...COMMON_TIMEZONES];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h2 className="text-xl font-bold text-slate-900">Trading Log</h2>
      </div>

      {/* Timezone Preference */}
      <div className="px-6 py-5 border-b border-slate-100">
        <p className="text-[11px] font-bold tracking-widest uppercase text-slate-400 mb-1">Trade Timezone</p>
        <p className="text-xs text-slate-400 mb-3">
          All trade date &amp; time fields are displayed in this timezone. Trade history on the calendar uses UTC dates.
        </p>
        {loadingTz ? (
          <div className="h-11 bg-slate-100 rounded-xl animate-pulse" />
        ) : (
          <div className="relative flex items-center">
            <select
              value={effectiveTz}
              onChange={(e) => handleSaveTimezone(e.target.value)}
              disabled={savingTz}
              className="w-full appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition-colors cursor-pointer"
            >
              {tzOptions.map((tz) => (
                <option key={tz} value={tz}>
                  {formatTimezoneLabel(tz)}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              {savingTz
                ? <span className="loading loading-spinner loading-xs" />
                : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              }
            </div>
          </div>
        )}
        {!preferredTimezone && !loadingTz && (
          <p className="text-[11px] text-slate-400 mt-1.5">Auto-detected from browser</p>
        )}
      </div>

      {/* Trade Accounts */}
      <div className="px-6 py-5 border-b border-slate-100">
        <p className="text-[11px] font-bold tracking-widest uppercase text-slate-400 mb-3">Trade Accounts</p>

        {loadingAccounts ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className={`flex items-center gap-2 px-4 py-3 border rounded-xl ${account.is_default ? "border-slate-300" : "border-slate-200"}`}
              >
                {/* Name (inline edit or display) */}
                <div className="flex-1 min-w-0 mr-2">
                  {renamingId === account.id ? (
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRename(account.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(account.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="input input-bordered input-sm w-full"
                      maxLength={50}
                      autoFocus
                    />
                  ) : (
                    <button
                      className="group flex items-center gap-1.5 text-sm font-bold text-slate-900 hover:text-indigo-600 text-left cursor-pointer transition-colors"
                      onClick={() => {
                        setRenamingId(account.id);
                        setRenameValue(account.name);
                      }}
                      title="Click to rename"
                    >
                      <span className="truncate border-b border-dashed border-transparent group-hover:border-indigo-300 transition-colors">
                        {account.name}
                      </span>
                      <svg className="w-3 h-3 shrink-0 text-indigo-400 group-hover:text-indigo-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* P&L UNIT label + badge */}
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[9px] font-bold tracking-wider uppercase text-slate-400">P&L UNIT</span>
                  <PnlUnitBadge unit={account.pnl_unit} />
                </div>

                {/* Divider */}
                <div className="w-px h-5 bg-slate-200 shrink-0" />

                {/* Daily limit inline editor */}
                {editingLimitId === account.id ? (
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={limitEditValue}
                    onChange={(e) => setLimitEditValue(e.target.value)}
                    onBlur={() => handleSaveAccountLimit(account.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveAccountLimit(account.id);
                      if (e.key === "Escape") setEditingLimitId(null);
                    }}
                    placeholder="e.g. 3"
                    className="input input-bordered input-xs w-16"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => {
                      setEditingLimitId(account.id);
                      setLimitEditValue(account.daily_trade_limit != null ? String(account.daily_trade_limit) : "");
                    }}
                    className={`text-[11px] font-semibold rounded-lg px-2 py-1 transition-colors shrink-0 cursor-pointer ${account.daily_trade_limit != null ? "text-slate-500 border border-slate-200 hover:text-indigo-600 hover:border-indigo-300" : "text-indigo-500 border border-dashed border-indigo-300 hover:bg-indigo-50"}`}
                    title="Set daily trade limit"
                  >
                    {account.daily_trade_limit != null ? `${account.daily_trade_limit}/DAY` : "SET LIMIT"}
                  </button>
                )}

                {/* Divider */}
                <div className="w-px h-5 bg-slate-200 shrink-0" />

                {/* Default P&L inline editor */}
                {editingPnlId === account.id ? (
                  <input
                    type="number"
                    step="any"
                    value={pnlEditValue}
                    onChange={(e) => setPnlEditValue(e.target.value)}
                    onBlur={() => handleSaveDefaultPnl(account.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveDefaultPnl(account.id);
                      if (e.key === "Escape") setEditingPnlId(null);
                    }}
                    placeholder={`e.g. 1.3`}
                    className="input input-bordered input-xs w-20"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => {
                      setEditingPnlId(account.id);
                      setPnlEditValue(account.default_pnl != null ? String(account.default_pnl) : "");
                    }}
                    className={`text-[11px] font-semibold rounded-lg px-2 py-1 transition-colors shrink-0 cursor-pointer ${account.default_pnl != null ? "text-slate-500 border border-slate-200 hover:text-indigo-600 hover:border-indigo-300" : "text-indigo-500 border border-dashed border-indigo-300 hover:bg-indigo-50"}`}
                    title="Set default P&L"
                  >
                    {account.default_pnl != null
                      ? `${account.default_pnl}${account.pnl_unit === "R" ? "R" : "$"}`
                      : "SET P&L"}
                  </button>
                )}

                {/* Divider */}
                <div className="w-px h-5 bg-slate-200 shrink-0" />

                {/* Default badge / Set default button */}
                {account.is_default ? (
                  <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500 border border-slate-300 rounded-lg px-2 py-1 shrink-0">
                    Default
                  </span>
                ) : (
                  <button
                    onClick={() => handleSetDefault(account.id)}
                    className="text-[9px] font-bold tracking-wider uppercase text-indigo-400 hover:text-indigo-600 border border-dashed border-indigo-200 hover:border-indigo-400 rounded-lg px-2 py-1 text-center leading-tight shrink-0 transition-colors hover:bg-indigo-50 cursor-pointer"
                    title="Set as default"
                  >
                    SET<br/>DEFAULT
                  </button>
                )}

                {/* Delete */}
                {!account.is_default && (
                  confirmDeleteId === account.id ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleDelete(account.id)}
                        disabled={deletingId === account.id}
                        className="btn btn-xs btn-error"
                      >
                        {deletingId === account.id ? <span className="loading loading-spinner loading-xs" /> : "Delete"}
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="btn btn-xs btn-ghost">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(account.id)}
                      className="text-red-300 hover:text-red-500 transition-colors shrink-0 cursor-pointer"
                      aria-label={`Delete ${account.name}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )
                )}
              </div>
            ))}

            {accounts.length === 0 && (
              <p className="text-sm text-slate-400">No accounts yet. Add one below.</p>
            )}
          </div>
        )}
      </div>

      {/* Add account form */}
      <form onSubmit={handleAddAccount} className="px-6 py-6 space-y-5">
        <h3 className="text-lg font-bold text-slate-900">Add Account</h3>

        <div>
          <p className="text-[11px] font-bold tracking-widest uppercase text-slate-400 mb-2">Account Name</p>
          <input
            type="text"
            placeholder="Enter account name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={50}
            required
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition-colors"
          />
        </div>

        <div>
          <p className="text-[11px] font-bold tracking-widest uppercase text-slate-400 mb-3">P&L Unit</p>
          <div className="flex gap-6">
            <label className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input
                type="radio"
                name="pnl_unit"
                value="USD"
                checked={newUnit === "USD"}
                onChange={() => setNewUnit("USD")}
                className="radio radio-sm radio-primary border-indigo-400"
              />
              <span className="text-slate-700">$ (US dollars)</span>
            </label>
            <label className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input
                type="radio"
                name="pnl_unit"
                value="R"
                checked={newUnit === "R"}
                onChange={() => setNewUnit("R")}
                className="radio radio-sm radio-primary border-indigo-400"
              />
              <span className="text-slate-700">R (risk multiples)</span>
            </label>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <svg className="w-3.5 h-3.5 text-orange-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
            </svg>
            <p className="text-[11px] font-bold tracking-wider uppercase text-orange-500">
              Cannot be changed after creation.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={addingAccount || !newName.trim()}
          className="btn btn-primary btn-sm"
        >
          {addingAccount ? <span className="loading loading-spinner loading-xs" /> : "Add Account"}
        </button>
      </form>
    </div>
  );
}
