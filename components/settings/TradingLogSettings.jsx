"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";

function PnlUnitBadge({ unit }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${unit === 'R' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
      {unit === 'R' ? 'R' : '$'}
    </span>
  );
}

export default function TradingLogSettings() {
  const [dailyLimit, setDailyLimit] = useState(3);
  const [limitInput, setLimitInput] = useState("3");
  const [savingLimit, setSavingLimit] = useState(false);

  const [accounts, setAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // New account form
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("USD");
  const [addingAccount, setAddingAccount] = useState(false);

  // Rename state: accountId → temp name
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  // Default P&L edit state: accountId → temp value string
  const [editingPnlId, setEditingPnlId] = useState(null);
  const [pnlEditValue, setPnlEditValue] = useState("");

  // Delete confirm
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    fetchSettings();
    fetchAccounts();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch("/api/user-settings/trading");
      if (res.ok) {
        const data = await res.json();
        setDailyLimit(data.daily_trade_limit);
        setLimitInput(String(data.daily_trade_limit));
      }
    } catch {
      // Silently fail; defaults remain
    }
  }

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

  async function handleSaveLimit() {
    const val = parseInt(limitInput, 10);
    if (!Number.isInteger(val) || val < 1) {
      toast.error("Daily trade limit must be at least 1");
      return;
    }
    setSavingLimit(true);
    try {
      const res = await fetch("/api/user-settings/trading", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_trade_limit: val }),
      });
      if (!res.ok) throw new Error();
      setDailyLimit(val);
      toast.success("Daily limit saved");
    } catch {
      toast.error("Failed to save daily limit");
    } finally {
      setSavingLimit(false);
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

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h2 className="text-xl font-bold">Trading Log</h2>
      </div>

      {/* Part A: Daily Trade Limit */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Daily Trade Limit</h3>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            value={limitInput}
            onChange={(e) => setLimitInput(e.target.value)}
            className="input input-bordered w-24"
            aria-label="Daily trade limit"
          />
          <button
            onClick={handleSaveLimit}
            disabled={savingLimit}
            className="btn btn-primary btn-sm"
          >
            {savingLimit ? <span className="loading loading-spinner loading-xs" /> : "Save"}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Maximum trades you intend to log per day. Currently: {dailyLimit}
        </p>
      </div>

      {/* Part B: Trade Accounts */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Trade Accounts</h3>

        {loadingAccounts ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2 mb-6">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl"
              >
                {/* Name (inline edit or display) */}
                <div className="flex-1 min-w-0">
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
                      className="text-sm font-medium text-gray-900 hover:text-indigo-600 text-left truncate block"
                      onClick={() => {
                        setRenamingId(account.id);
                        setRenameValue(account.name);
                      }}
                      title="Click to rename"
                    >
                      {account.name}
                    </button>
                  )}
                </div>

                {/* Badges */}
                <PnlUnitBadge unit={account.pnl_unit} />
                {account.is_default && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700">
                    Default
                  </span>
                )}

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
                    placeholder={`Default P&L (${account.pnl_unit === "R" ? "R" : "$"})`}
                    className="input input-bordered input-xs w-28"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => {
                      setEditingPnlId(account.id);
                      setPnlEditValue(account.default_pnl != null ? String(account.default_pnl) : "");
                    }}
                    className="text-xs text-gray-400 hover:text-indigo-600 border border-dashed border-gray-200 hover:border-indigo-300 rounded px-2 py-0.5 transition-colors shrink-0"
                    title="Set default P&L"
                  >
                    {account.default_pnl != null
                      ? `${account.default_pnl}${account.pnl_unit === "R" ? "R" : "$"}`
                      : "Set P&L"}
                  </button>
                )}

                {/* Actions */}
                {!account.is_default && (
                  <div className="flex items-center gap-1 ml-auto shrink-0">
                    <button
                      onClick={() => handleSetDefault(account.id)}
                      className="btn btn-xs btn-ghost text-gray-500 hover:text-gray-700"
                      title="Set as default"
                    >
                      Set default
                    </button>

                    {confirmDeleteId === account.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(account.id)}
                          disabled={deletingId === account.id}
                          className="btn btn-xs btn-error"
                        >
                          {deletingId === account.id ? <span className="loading loading-spinner loading-xs" /> : "Delete"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="btn btn-xs btn-ghost"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(account.id)}
                        className="btn btn-xs btn-ghost text-red-400 hover:text-red-600"
                        aria-label={`Delete ${account.name}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {accounts.length === 0 && (
              <p className="text-sm text-gray-500">No accounts yet. Add one below.</p>
            )}
          </div>
        )}

        {/* Add account form */}
        <form onSubmit={handleAddAccount} className="border border-gray-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">Add Account</h4>
          <input
            type="text"
            placeholder="Account name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={50}
            required
            className="input input-bordered input-sm w-full"
          />
          <div>
            <p className="text-xs font-medium text-gray-700 mb-1">P&L Unit</p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="pnl_unit"
                  value="USD"
                  checked={newUnit === "USD"}
                  onChange={() => setNewUnit("USD")}
                  className="radio radio-sm"
                />
                $ (US dollars)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="pnl_unit"
                  value="R"
                  checked={newUnit === "R"}
                  onChange={() => setNewUnit("R")}
                  className="radio radio-sm"
                />
                R (risk multiples)
              </label>
            </div>
            <p className="text-xs text-amber-600 mt-1">
              Cannot be changed after creation.
            </p>
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
    </div>
  );
}
