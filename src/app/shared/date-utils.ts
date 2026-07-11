/**
 * Formats a Date as a local YYYY-MM-DD string (for <input type="date">,
 * API date-range params, etc.) WITHOUT going through UTC.
 *
 * `date.toISOString().split('T')[0]` looks equivalent but is NOT — it
 * converts to UTC first, so for any timezone ahead of UTC (e.g. UTC+6),
 * calling it during local early-morning hours yields YESTERDAY's date.
 * That is why "today" filters across the app were quietly showing one
 * day behind. Always use this helper instead.
 */
export function toLocalDateString(d: Date = new Date()): string {
  const year  = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day   = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
