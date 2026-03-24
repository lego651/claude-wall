"use client";

export default function DayNavigator({ selectedDate, onPrev, onNext, onLabelClick }) {
  const today = new Date().toISOString().substring(0, 10);
  const isToday = selectedDate === today;

  function formatLabel(dateStr) {
    if (dateStr === today) return "Today";
    const [year, month, day] = dateStr.split("-").map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  }

  return (
    <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100">
      <button
        onClick={onPrev}
        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-400"
        aria-label="Previous day"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        onClick={onLabelClick}
        className="flex-1 text-center text-xl font-bold text-slate-900 hover:text-indigo-600 transition-colors"
        aria-label="Select date"
      >
        {formatLabel(selectedDate)}
      </button>

      <button
        onClick={onNext}
        disabled={isToday}
        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Next day"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
