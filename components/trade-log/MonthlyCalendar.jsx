"use client";

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

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
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=Sun
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prevMonthDays = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();

  const cells = [];
  // Previous month overflow
  for (let i = firstDow - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, overflow: true });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, overflow: false });
  }
  // Next month overflow to fill last row
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
  const weeks = monthlyData?.weeks || [];
  const days = monthlyData?.days || {};
  const pnlUnit = monthlyData?.pnl_unit || null;
  const monthlyPnl = monthlyData?.monthly_pnl ?? null;

  // Week index for a given day (0-based row)
  function weekRowIndex(day) {
    const firstDow = new Date(Date.UTC(year, monthNum - 1, 1)).getUTCDay();
    return Math.floor((firstDow + day - 1) / 7);
  }

  function dateStr(day) {
    return `${String(year).padStart(4, "0")}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const pnlHeader = formatPnl(monthlyPnl, pnlUnit);
  const headerColor = monthlyPnl === null ? "text-gray-400" : monthlyPnl >= 0 ? "text-green-600" : "text-red-600";

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      {/* Monthly P&L header */}
      <div className="text-center mb-3">
        <span className={`text-base font-bold ${headerColor}`}>
          Monthly P&L: {pnlHeader || "—"}
        </span>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => onMonthChange(-1)} aria-label="Previous month"
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-gray-700">{monthLabel}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMonthChange(1)}
            aria-label="Next month"
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => {
              const todayMonth = today.substring(0, 7);
              if (viewMonth !== todayMonth) onMonthChange(0); // signal reset — parent handles
            }}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-2"
            aria-label="Go to today's month"
          >
            Today
          </button>
        </div>
      </div>

      {/* DOW headers */}
      <div className="grid grid-cols-8 mb-1">
        {DOW.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
        ))}
        <div className="text-center text-xs font-semibold text-gray-400 py-1">Wk</div>
      </div>

      {/* Calendar rows */}
      {Array.from({ length: cells.length / 7 }).map((_, rowIdx) => {
        const rowCells = cells.slice(rowIdx * 7, rowIdx * 7 + 7);
        const weekData = weeks[rowIdx] || { trade_count: 0, pnl: null, label: `Week ${rowIdx + 1}` };

        return (
          <div key={rowIdx} className="grid grid-cols-8 mb-0.5">
            {rowCells.map((cell, colIdx) => {
              if (cell.overflow) {
                return <div key={colIdx} className="text-center p-1 text-xs text-gray-300">{cell.day}</div>;
              }

              const ds = dateStr(cell.day);
              const dayData = days[ds];
              const pnl = dayData?.pnl ?? null;
              const count = dayData?.trade_count ?? 0;
              const isToday = ds === today;
              const isSelected = ds === selectedDate;

              let bgClass = "";
              if (pnl !== null && pnl > 0) bgClass = "bg-green-900/20";
              else if (pnl !== null && pnl < 0) bgClass = "bg-red-900/20";

              return (
                <button
                  key={colIdx}
                  onClick={() => onDayClick(ds)}
                  className={`relative text-left p-1 rounded-lg text-xs min-h-[3rem] ${bgClass} ${isToday ? "ring-2 ring-indigo-500" : ""} ${isSelected ? "ring-2 ring-indigo-300" : ""} hover:bg-gray-100 transition-colors`}
                  aria-label={`${ds}${count > 0 ? `, ${count} trades` : ""}`}
                >
                  <div className="font-semibold text-gray-800">{cell.day}</div>
                  {pnl !== null && (
                    <div className={`text-[9px] leading-tight font-medium ${pnl >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {formatPnl(pnl, pnlUnit)}
                    </div>
                  )}
                  {count > 0 && (
                    <div className="text-[8px] text-gray-400">{count}t</div>
                  )}
                </button>
              );
            })}

            {/* Saturday week summary */}
            <div className="text-center p-1 text-[9px] text-gray-500 flex flex-col justify-center">
              <div className="font-semibold">{weekData.label}</div>
              {weekData.pnl !== null && (
                <div className={`font-medium ${weekData.pnl >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {formatPnl(weekData.pnl, pnlUnit)}
                </div>
              )}
              {weekData.trade_count > 0 && (
                <div className="text-gray-400">{weekData.trade_count}t</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
