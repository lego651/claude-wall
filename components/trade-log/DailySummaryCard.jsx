"use client";

function formatPnl(value, unit) {
  if (value === null || value === undefined) return "—";
  const sign = value >= 0 ? "+" : "-";
  const abs = Math.abs(value);
  if (unit === "R") return `${sign}${abs}R`;
  if (unit === "USD") {
    const formatted = abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return `${sign}$${formatted}`;
  }
  return `${sign}${abs}`;
}

function ArcProgress({ value, max }) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  // SVG arc — 100 unit viewBox, center (50,50), radius 40
  const cx = 50, cy = 50, r = 40;
  const startAngle = -210; // degrees, start at bottom-left
  const totalDegrees = 240;
  const angle = startAngle + ratio * totalDegrees;

  function polarToCartesian(angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(angle);
  const largeArcFlag = ratio * totalDegrees > 180 ? 1 : 0;

  const trackEnd = polarToCartesian(startAngle + totalDegrees);
  const trackLargeArc = 1;

  // Color: green < limit, amber = limit, red > limit
  let color = "#22c55e"; // green
  if (value >= max) color = value > max ? "#ef4444" : "#f59e0b";

  return (
    <svg viewBox="0 0 100 100" className="w-24 h-24">
      {/* Track */}
      <path
        d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${trackLargeArc} 1 ${trackEnd.x} ${trackEnd.y}`}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={8}
        strokeLinecap="round"
      />
      {/* Fill */}
      {ratio > 0 && (
        <path
          d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
        />
      )}
      {/* Center label */}
      <text x="50" y="48" textAnchor="middle" dominantBaseline="middle" fontSize="18" fontWeight="bold" fill="#111827">
        {value}
      </text>
      <text x="50" y="64" textAnchor="middle" fontSize="9" fill="#6b7280">
        / {max}
      </text>
    </svg>
  );
}

export default function DailySummaryCard({ tradesLogged = 0, tradesRemaining = null, dailyLimit = null, pnlTotal = null, pnlUnit = null, isLoading = false }) {
  if (isLoading) {
    return (
      <div className="px-6 py-5 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-10 w-16 bg-gray-100 rounded" />
          <div className="h-24 w-24 bg-gray-100 rounded-full" />
          <div className="h-10 w-16 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  const pnlFormatted = formatPnl(pnlTotal, pnlUnit);
  const pnlColor = pnlTotal === null ? "text-slate-300" : pnlTotal >= 0 ? "text-green-500" : "text-red-500";
  const showArc = dailyLimit !== null;

  return (
    <div className="px-6 py-5">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Logged */}
        <div className="text-center min-w-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Logged</p>
          <p className="text-3xl font-black text-slate-900">{tradesLogged}</p>
        </div>

        {/* Center: Arc — only when single account with limit set */}
        {showArc && <ArcProgress value={tradesLogged} max={dailyLimit} />}

        {/* Right: P&L */}
        <div className="text-center min-w-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">P&L</p>
          <p className={`text-3xl font-black ${pnlColor}`}>{pnlFormatted}</p>
        </div>
      </div>

      {showArc && tradesRemaining === 0 && (
        <p className="text-center text-[11px] font-bold text-red-400 uppercase tracking-wide mt-3">Limit reached</p>
      )}
    </div>
  );
}
