/**
 * Week number and year helpers (ISO 8601), aligned with DB get_week_number / get_year.
 */

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function getYear(date: Date): number {
  return date.getFullYear();
}

/** Start (Monday) and end (Sunday) of the ISO week that contains the given date. */
export function getWeekBounds(date: Date): { weekStart: Date; weekEnd: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 0
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
}
