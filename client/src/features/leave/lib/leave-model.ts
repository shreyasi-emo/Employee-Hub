import { parseISO } from "date-fns";
import { avatarColor } from "@/lib/avatar";
export { avatarColor };

// "yyyy-MM-dd" string → local Date (avoids the UTC shift of new Date("yyyy-MM-dd")).
export const parseYmd = (s?: string): Date | undefined => { if (!s) return undefined; const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

export const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: "Pending", bg: "bg-[#FFA962]/20", text: "text-[#FFA962]" },
  approved: { label: "Approved", bg: "bg-[#4BDCD9]/25", text: "text-[#206295]" },
  rejected: { label: "Rejected", bg: "bg-[#FF6F62]/20", text: "text-[#FF6F62]" },
  cancelled: { label: "Cancelled", bg: "bg-[#6A7366]/15", text: "text-[#6A7366]" },
};

export const statusOf = (status?: string) => statusConfig[status || ""] || statusConfig.pending;

/** Requested duration in days: half-day is 0.5, otherwise weekdays inclusive
 *  (weekends don't consume leave). */
export function requestedDays(startDate: string, endDate: string, isHalfDay: boolean) {
  if (!startDate || !endDate) return 0;
  if (isHalfDay) return 0.5;
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  let days = 0;
  const d = new Date(start);
  while (d <= end) { const dow = d.getDay(); if (dow !== 0 && dow !== 6) days++; d.setDate(d.getDate() + 1); }
  return days;
}

/** A request's effective year — explicit `year` if the server set one, else derived. */
export const reqYear = (r: any) => r.year ?? new Date(r.startDate).getFullYear();

/** Cancellable while pending, or approved but not yet started. */
export const canCancel = (r: any) => r.status === "pending" || (r.status === "approved" && new Date(r.startDate) > new Date());

/** The casual-leave type, matched by name or CL code — drives the balance stat card. */
export const findCasualLeaveType = (leaveTypes: any[]) =>
  leaveTypes.find((l: any) => /casual/i.test(l.name || "") || (l.code || "").toUpperCase() === "CL");

/** Year picker: next year through two years back. */
export const yearOptions = (currentYear: number) => [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];
