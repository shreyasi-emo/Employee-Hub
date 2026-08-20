// One place for the start/end date rule, so every range in the app behaves the same:
//
//   1. the end field can never select a date before the start
//   2. moving the start past the end never leaves an invalid range —
//      the end is pulled forward to match
//
// Use `minDate` on <DateField>/<DateInput> for (1) and `clampEnd` in the start
// field's onChange for (2). For a native <input type="date">, pass `ymd(start)`
// as its `min`.

/** "yyyy-MM-dd" -> local Date (avoids the UTC shift of new Date("yyyy-MM-dd")). */
export function parseYmd(s?: string | null): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

/** Date -> "yyyy-MM-dd" in local time. */
export function ymd(d?: Date | null): string {
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * The end value a range should hold once `start` changes.
 * Returns `end` untouched when it is still on or after `start`, otherwise `start`
 * — so the range collapses to a single day rather than going backwards.
 *
 * Works with "yyyy-MM-dd" strings, which is how most forms here store dates.
 */
export function clampEnd(start: string, end?: string | null): string {
  if (!end) return "";
  return end < start ? start : end;
}

/** Date-object form of clampEnd, for forms that keep Dates in state. */
export function clampEndDate(start?: Date, end?: Date): Date | undefined {
  if (!start || !end) return end;
  return end < start ? start : end;
}

/** True when the range is usable: no end, or end on/after start. */
export function isRangeValid(start?: string | null, end?: string | null): boolean {
  if (!start || !end) return true;
  return end >= start;
}
