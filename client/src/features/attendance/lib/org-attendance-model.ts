// Org-wide attendance derivation — the rules the HR/manager dashboard runs on.
// Extracted verbatim from the page so the stat cards, chart, donut, lists and
// exports all read from one model and cannot drift apart.

import { format, startOfDay, startOfMonth, endOfMonth } from "date-fns";
import { STATE_KEYS } from "./attendance-states";

/** Flatten attendance rows into a `${employeeId}|${date}` -> status lookup. */
export const toAttMap = (rows: any[]) => {
  const m = new Map<string, string>();
  for (const r of rows) m.set(`${r.employeeId}|${r.date}`, r.status);
  return m;
};

/** Tally a per-employee status map into per-state counts. */
export const countsFromStatus = (m: Map<string, string>) => {
  const c: Record<string, number> = { present: 0, wfh: 0, on_duty: 0, half_day: 0, absent: 0, leave: 0, holiday: 0 };
  m.forEach((st) => { c[st]++; });
  return c;
};

/** An employee only counts on days inside their employment window
 *  (no Present before joining / after exit). */
export const inEmployment = (e: any, ds: string) => {
  const j = e.joinDate ? String(e.joinDate).slice(0, 10) : null;
  const x = e.lastWorkingDate ? String(e.lastWorkingDate).slice(0, 10) : null;
  return !((j && ds < j) || (x && ds > x));
};

/**
 * Builds the per-day status resolver.
 *
 * Status priority: on leave → holiday → recorded status → default Present. Mirrors
 * My-Attendance's effectiveStatus so the two views agree. Callers must not pass a
 * future day.
 */
export function buildStatusForDay(deps: {
  activeEmployees: any[];
  holidaySet: Set<string>;
  approvedLeaves: any[];
}) {
  const { activeEmployees, holidaySet, approvedLeaves } = deps;
  return (d: Date, attMap: Map<string, string>) => {
    const ds = format(d, "yyyy-MM-dd");
    const sod = startOfDay(d);
    const isHol = holidaySet.has(ds);
    const onLeave = new Set(approvedLeaves.filter((lr: any) => new Date(lr.startDate) <= sod && new Date(lr.endDate) >= sod).map((lr: any) => lr.employeeId));
    const m = new Map<string, string>();
    for (const e of activeEmployees) {
      if (!inEmployment(e, ds)) continue;
      let st: string;
      if (onLeave.has(e.id)) st = "leave";
      else if (isHol) st = "holiday";
      else { const rec = attMap.get(`${e.id}|${ds}`); st = rec && (STATE_KEYS as readonly string[]).includes(rec) ? rec : "present"; }
      m.set(e.id, st);
    }
    return m;
  };
}

/** Working days in the month containing `anchor` = days minus weekends minus holidays. */
export function workingDaysInMonth(anchor: Date, holidaySet: Set<string>) {
  const monthStart = startOfMonth(anchor), monthEndDate = endOfMonth(anchor);
  let workingDays = 0;
  for (let cur = new Date(monthStart); cur <= monthEndDate; cur.setDate(cur.getDate() + 1)) {
    const dow = cur.getDay();
    if (dow === 0 || dow === 6) continue;
    if (holidaySet.has(format(cur, "yyyy-MM-dd"))) continue;
    workingDays++;
  }
  return workingDays;
}

/** Per-employee month totals on the same present-by-default model as the cards and chart
 *  (not a raw record tally), over the month's *elapsed* working days. */
export function monthlyPerEmployee(deps: {
  monthAttendance: any[];
  anchor: Date;
  today: Date;
  holidaySet: Set<string>;
  statusForDay: (d: Date, attMap: Map<string, string>) => Map<string, string>;
}) {
  const { monthAttendance, anchor, today, holidaySet, statusForDay } = deps;
  const map: Record<string, { present: number; half: number; absent: number; leave: number }> = {};
  const monthMap = new Map<string, string>();
  for (const r of monthAttendance) monthMap.set(`${r.employeeId}|${r.date}`, r.status);
  const mStart = startOfMonth(anchor), mEnd = endOfMonth(anchor);
  for (let cur = new Date(mStart); cur <= mEnd; cur.setDate(cur.getDate() + 1)) {
    if (cur > today) break;
    const dow = cur.getDay(); if (dow === 0 || dow === 6) continue;
    if (holidaySet.has(format(cur, "yyyy-MM-dd"))) continue;
    statusForDay(cur, monthMap).forEach((st, empId) => {
      const s = (map[empId] ||= { present: 0, half: 0, absent: 0, leave: 0 });
      if (["present", "wfh", "on_duty"].includes(st)) s.present++;
      else if (st === "half_day") s.half++;
      else if (st === "absent") s.absent++;
      else if (st === "leave") s.leave++;
    });
  }
  return map;
}

/** Monthly chart series: all 12 months, future left empty, state totals + average attendance %. */
export function monthlySeries(deps: {
  months: string[];
  chartYear: number;
  today: Date;
  holidaySet: Set<string>;
  activeEmployeeCount: number;
  countsForDay: (d: Date) => Record<string, number>;
}) {
  const { months, chartYear, today, holidaySet, activeEmployeeCount, countsForDay } = deps;
  const nowM = today.getMonth(), nowY = today.getFullYear();
  return months.map((label, m) => {
    const isFuture = chartYear > nowY || (chartYear === nowY && m > nowM);
    if (isFuture) return { label, attendancePct: null, ...Object.fromEntries(STATE_KEYS.map((k) => [k, null])) };
    const totals: Record<string, number> = { present: 0, wfh: 0, on_duty: 0, half_day: 0, absent: 0, leave: 0, holiday: 0 };
    let pctSum = 0, wd = 0;
    const dim = new Date(chartYear, m + 1, 0).getDate();
    for (let day = 1; day <= dim; day++) {
      const dDate = new Date(chartYear, m, day);
      if (dDate > today) break; // don't count future days of the current month as Present
      const c = countsForDay(dDate);
      for (const k of STATE_KEYS) totals[k] += c[k];
      const dow = dDate.getDay();
      if (dow !== 0 && dow !== 6 && !holidaySet.has(format(dDate, "yyyy-MM-dd"))) {
        const denom = activeEmployeeCount || 1;
        pctSum += ((c.present + c.wfh + c.on_duty + 0.5 * c.half_day) / denom) * 100;
        wd++;
      }
    }
    return { label, ...totals, attendancePct: wd > 0 ? Math.round(pctSum / wd) : 0 };
  });
}
