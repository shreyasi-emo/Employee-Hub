// Self-view attendance derivation. `effectiveStatus` is the single source of truth
// for a day's status — the calendar, the overview stats and the Activity Details
// panel all read from it, so they can never disagree.

import { format, eachDayOfInterval, startOfMonth, endOfMonth } from "date-fns";

export const parseMeta = (r: any) => { try { return JSON.parse(r?.notes || "null"); } catch { return null; } };

/**
 * Effective WFH approval for a record: "approved" | "pending" | "rejected" | null
 * (null = not a WFH request). Pending auto-resolves to approved once we're within
 * 24h of the WFH date.
 */
export function buildWfhApproval(now: Date) {
  return (r: any): "approved" | "pending" | "rejected" | null => {
    const meta = parseMeta(r);
    if (!meta || meta.kind !== "wfh") return null;
    if (meta.approval === "rejected") return "rejected";
    if (meta.approval === "approved") return "approved";
    if (meta.autoApproveAt && +now >= +new Date(meta.autoApproveAt)) return "approved";
    return "pending";
  };
}

/**
 * A working day with no explicit record (and not in the future) defaults to Present;
 * any exception (absent / leave / WFH / on-duty / half-day) comes from a stored record.
 * A REJECTED WFH request is ignored (the day reverts to its default), so it never
 * shows as WFH.
 */
export function buildEffectiveStatus(deps: {
  byDate: Record<string, any>;
  holidaySet: Set<string>;
  todayStr: string;
  joinStr: string | null;
  exitStr: string | null;
  wfhApproval: (r: any) => "approved" | "pending" | "rejected" | null;
}) {
  const { byDate, holidaySet, todayStr, joinStr, exitStr, wfhApproval } = deps;
  return (d: Date): string | null => {
    const key = format(d, "yyyy-MM-dd");
    // Outside the employment window → neutral (never assume Present before joining or after exit).
    if ((joinStr && key < joinStr) || (exitStr && key > exitStr)) return null;
    const isFuture = key > todayStr;
    const r = byDate[key];
    if (r && !(r.status === "wfh" && wfhApproval(r) === "rejected")) {
      // Future days only surface *planned* statuses (WFH / leave). A plain present/absent/half-day
      // record on a future date is ignored, so tomorrow never shows as "Present".
      if (!isFuture || r.status === "wfh" || r.status === "leave" || r.status === "on_duty") return r.status;
    }
    if (holidaySet.has(key)) return "holiday";
    const wd = d.getDay();
    if (wd === 0 || wd === 6) return "weekend";
    if (isFuture) return null;          // future working day — neutral until a status is applied
    return "present";                   // elapsed working day, no exception → present
  };
}

/** Month counts derived from effectiveStatus over the elapsed working days,
 *  so they match the calendar exactly. */
export function monthStats(deps: {
  cursor: Date;
  now: Date;
  effectiveStatus: (d: Date) => string | null;
}) {
  const { cursor, now, effectiveStatus } = deps;
  let present = 0, absent = 0, leave = 0, half = 0, office = 0, wfh = 0, onDuty = 0, working = 0;
  const mStart = startOfMonth(cursor), mEnd = endOfMonth(cursor);
  if (now >= mStart) {
    const upto = now > mEnd ? mEnd : now;
    for (const d of eachDayOfInterval({ start: mStart, end: upto })) {
      const s = effectiveStatus(d);
      if (!s || s === "weekend" || s === "holiday") continue;
      working++;
      if (s === "present") { office++; present++; }
      else if (s === "wfh") { wfh++; present++; }
      else if (s === "on_duty") { onDuty++; present++; }
      else if (s === "absent") absent++;
      else if (s === "leave") leave++;
      else if (s === "half_day") half++;
    }
  }
  const pct = working ? Math.min(100, Math.round((present / working) * 100)) : 0;
  return { present, absent, leave, half, office, wfh, onDuty, notPresent: absent + leave, pct, working };
}

/** Booked trips overlay the calendar (read-time, like leave): each covered day gets a marker. */
export function travelDaysFrom(myTrips: any[]) {
  const map: Record<string, string> = {};
  myTrips.filter((t) => t.status === "booked" && t.startDate).forEach((t) => {
    const end = new Date(`${t.endDate || t.startDate}T00:00:00`);
    for (let d = new Date(`${t.startDate}T00:00:00`); d <= end; d.setDate(d.getDate() + 1)) map[format(d, "yyyy-MM-dd")] = t.category;
  });
  return map;
}

/** Teammates first: you → peers/manager/reports → everyone else. */
export function teamRankAgainst(myEmp: any) {
  return (e: any) => {
    if (!myEmp) return 2;
    if (e.id === myEmp.id) return 0;
    const isPeer = myEmp.managerId && e.managerId === myEmp.managerId;
    const isMgr = myEmp.managerId && e.id === myEmp.managerId;
    const isReport = e.managerId === myEmp.id;
    return (isPeer || isMgr || isReport) ? 1 : 2;
  };
}
