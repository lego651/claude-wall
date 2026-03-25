"use client";

const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT", "WK"];

function formatPnl(value, unit) {
  if (value === null || value === undefined) return null;
  const sign = value >= 0 ? "+" : "-";
  const abs = Math.abs(value);
  if (unit === "R") return `${sign}${abs}R`;
  if (unit === "USD") {
    const formatted = abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return `${sign}$${formatted}`;
  }
  return `${sign}${abs}`;
}

function buildCalendarGrid(year, month) {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prevMonthDays = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();

  const cells = [];
  for (let i = firstDow - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, overflow: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, overflow: false });
  }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, overflow: true });
    }
  }
  return cells;
}

export default function MonthlyCalendar({ monthlyData, selectedDate, onDayClick, viewMonth, onMonthChange, isLoading }) {
  const today = new Date().toISOString().substring(0, 10);

  const [year, monthNum] = (viewMonth || today.substring(0, 7)).split("-").map(Number);
  const monthLabel = new Date(Date.UTC(year, monthNum - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const cells = buildCalendarGrid(year, monthNum);
  const days = monthlyData?.days || {};
  const pnlUnit = monthlyData?.pnl_unit || null;
  const monthlyPnl = monthlyData?.monthly_pnl ?? null;

  function dateStr(day) {
    return `${String(year).padStart(4, "0")}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const pnlHeader = formatPnl(monthlyPnl, pnlUnit);
  const headerColor = monthlyPnl === null ? "text-slate-400" : monthlyPnl >= 0 ? "text-green-500" : "text-red-500";

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 sm:px-6 sm:py-5">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base sm:text-xl font-bold text-slate-900 leading-tight">{monthLabel}</h2>
            <p className={`text-xs sm:text-sm font-semibold leading-tight ${headerColor}`}>
              Monthly P&L: {pnlHeader || "—"}
            </p>
          </div>
        </div>
        {/* Nav: < Today > */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => onMonthChange(-1)}
            aria-label="Previous month"
            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors"
          >
            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => onMonthChange(0)}
            className="text-xs sm:text-sm font-semibold text-indigo-600 hover:text-indigo-800 px-1 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => onMonthChange(1)}
            aria-label="Next month"
            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors"
          >
            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* DOW headers */}
      <div className="grid grid-cols-[repeat(7,1fr)_44px] sm:grid-cols-[repeat(7,1fr)_80px] border-t border-slate-100">
        {DOW.map((d) => (
          <div key={d} className="text-center text-[9px] sm:text-[11px] font-bold text-slate-400 py-2 sm:py-2.5 tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar rows */}
      {Array.from({ length: cells.length / 7 }).map((_, rowIdx) => {
        const rowCells = cells.slice(rowIdx * 7, rowIdx * 7 + 7);

        // Compute weekly summary from non-overflow cells
        let weekPnl = null;
        let weekTrades = 0;
        rowCells.forEach((cell) => {
          if (cell.overflow) return;
          const ds = dateStr(cell.day);
          const dayData = days[ds];
          if (dayData?.pnl != null) weekPnl = (weekPnl ?? 0) + dayData.pnl;
          weekTrades += dayData?.trade_count ?? 0;
        });

        return (
          <div key={rowIdx} className="grid grid-cols-[repeat(7,1fr)_44px] sm:grid-cols-[repeat(7,1fr)_80px] border-t border-slate-100">
            {rowCells.map((cell, colIdx) => {
              if (cell.overflow) {
                return (
                  <div
                    key={colIdx}
                    className="px-1 pt-2 pb-2 sm:px-2 sm:pt-3 sm:pb-4 min-h-[3.75rem] sm:min-h-[5.5rem] border-r border-slate-100"
                  >
                    <span className="text-xs font-medium text-slate-300">{cell.day}</span>
                  </div>
                );
              }

              const ds = dateStr(cell.day);
              const dayData = days[ds];
              const pnl = dayData?.pnl ?? null;
              const count = dayData?.trade_count ?? 0;
              const isToday = ds === today;
              const isSelected = ds === selectedDate && !isToday;

              return (
                <button
                  key={colIdx}
                  onClick={() => onDayClick(ds)}
                  className={`text-left px-1 pt-2 pb-2 sm:px-2 sm:pt-3 sm:pb-4 min-h-[3.75rem] sm:min-h-[5.5rem] border-r border-slate-100 hover:bg-slate-50 transition-colors ${isSelected ? "bg-indigo-50" : ""}`}
                  aria-label={`${ds}${count > 0 ? `, ${count} trades` : ""}`}
                >
                  {/* Day number */}
                  {isToday ? (
                    <span className="inline-flex w-6 h-6 sm:w-7 sm:h-7 items-center justify-center rounded-full bg-indigo-600 text-white text-xs sm:text-sm font-bold mb-0.5 sm:mb-1">
                      {cell.day}
                    </span>
                  ) : (
                    <span className={`text-xs sm:text-sm font-semibold mb-0.5 sm:mb-1 block ${isSelected ? "text-indigo-600" : "text-slate-600"}`}>
                      {cell.day}
                    </span>
                  )}

                  {/* P&L */}
                  {pnl !== null && (
                    <div className={`text-[10px] sm:text-xs font-bold leading-tight ${pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {formatPnl(pnl, pnlUnit)}
                    </div>
                  )}

                  {/* Trade count */}
                  {count > 0 && (
                    <div className="text-[9px] sm:text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">
                      {count} T
                    </div>
                  )}
                </button>
              );
            })}

            {/* Weekly summary cell */}
            <div className="px-1 sm:px-2 pt-2 sm:pt-3 pb-2 sm:pb-4 min-h-[3.75rem] sm:min-h-[5.5rem] flex flex-col justify-end">
              {weekTrades > 0 && (
                <>
                  <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5 sm:mb-1">
                    Wk {rowIdx + 1}
                  </p>
                  {weekPnl !== null && (
                    <p className={`text-xs sm:text-sm font-bold leading-tight ${weekPnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {formatPnl(weekPnl, pnlUnit)}
                    </p>
                  )}
                  <p className="text-[8px] sm:text-[9px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">
                    {weekTrades}T
                  </p>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
