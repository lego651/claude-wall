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

/** Year of the date in UTC (for use with getWeekBoundsUtc). */
export function getYearUtc(date: Date): number {
  return date.getUTCFullYear();
}

/** ISO week number (1–53) using UTC date components. Use with getWeekBoundsUtc. */
export function getWeekNumberUtc(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/** Start (Monday) and end (Sunday) of the ISO week that contains the given date (local time). */
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

/** Start (Monday 00:00:00 UTC) and end (Sunday 23:59:59.999 UTC) of the ISO week that contains the given date, in UTC. */
export function getWeekBoundsUtc(date: Date): { weekStart: Date; weekEnd: Date } {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const day = date.getUTCDate();
  const utcDay = date.getUTCDay(); // 0 = Sun, 1 = Mon, ...
  const diff = utcDay === 0 ? -6 : 1 - utcDay; // Monday = 0
  const weekStart = new Date(Date.UTC(y, m, day + diff, 0, 0, 0, 0));
  const weekEnd = new Date(Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + 6, 23, 59, 59, 999));
  return { weekStart, weekEnd };
}

/** Current week (Mon–Sun UTC) containing today. Used when running on Sunday: report/digest for this week. */
export function getCurrentWeekUtc(): { weekStart: Date; weekEnd: Date } {
  return getWeekBoundsUtc(new Date());
}
