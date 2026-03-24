"use client";

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function buildCells(year, month) {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prevDays = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();

  const cells = [];
  for (let i = firstDow - 1; i >= 0; i--) {
    cells.push({ day: prevDays - i, overflow: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, overflow: false });
  }
  const rem = 7 - (cells.length % 7);
  if (rem < 7) {
    for (let d = 1; d <= rem; d++) cells.push({ day: d, overflow: true });
  }
  return cells;
}

export default function CalendarPicker({ selectedDate, monthlyData, viewMonth, onSelectDate, onMonthChange, onClose }) {
  const today = new Date().toISOString().substring(0, 10);
  const [year, monthNum] = (viewMonth || today.substring(0, 7)).split("-").map(Number);

  const monthLabel = new Date(Date.UTC(year, monthNum - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const cells = buildCells(year, monthNum);
  const days = monthlyData?.days || {};

  function dateStr(day) {
    return `${String(year).padStart(4, "0")}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function getDot(ds) {
    const d = days[ds];
    if (!d || d.trade_count === 0) return null;
    if (d.pnl === null || d.pnl === 0) return "gray";
    return d.pnl > 0 ? "green" : "red";
  }

  const DOT_COLORS = { green: "bg-green-500", red: "bg-red-500", gray: "bg-gray-400" };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" data-testid="calendar-picker">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close calendar" />

      {/* Bottom sheet */}
      <div className="relative bg-white w-full max-w-lg rounded-t-3xl shadow-2xl z-10 p-4 pb-8">
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
            <button onClick={() => onMonthChange(1)} aria-label="Next month"
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={() => { onMonthChange(0); }}
              className="text-xs text-indigo-600 font-semibold px-2"
              aria-label="Today"
            >
              Today
            </button>
          </div>
        </div>

        {/* DOW headers */}
        <div className="grid grid-cols-7 mb-1">
          {DOW.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((cell, i) => {
            if (cell.overflow) {
              return <div key={i} className="h-10 flex items-center justify-center text-xs text-gray-300">{cell.day}</div>;
            }

            const ds = dateStr(cell.day);
            const isToday = ds === today;
            const isSelected = ds === selectedDate;
            const dot = getDot(ds);

            return (
              <button
                key={i}
                onClick={() => { onSelectDate(ds); onClose(); }}
                className={`h-10 flex flex-col items-center justify-center rounded-full text-xs font-medium transition-colors
                  ${isToday ? "bg-indigo-600 text-white" : ""}
                  ${isSelected && !isToday ? "ring-2 ring-indigo-500 text-indigo-600" : ""}
                  ${!isToday && !isSelected ? "hover:bg-gray-100 text-gray-800" : ""}
                `}
                aria-label={ds}
              >
                <span>{cell.day}</span>
                {dot && <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${DOT_COLORS[dot]}`} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
