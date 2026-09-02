import { parseISO } from "date-fns";
import { avatarColor } from "@/lib/avatar";
export { avatarColor };

// "yyyy-MM-dd" string → local Date (avoids the UTC shift of new Date("yyyy-MM-dd")).
export const parseYmd = (s?: string): Date | undefined => { if (!s) return undefined; const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

export const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  // Brand palette only — pending is blue ("awaiting"), never orange.
  pending: { label: "Pending", bg: "bg-[#206295]/12", text: "text-[#206295]" },
  approved: { label: "Approved", bg: "bg-[#4BDCD9]/25", text: "text-[#0E7C7B]" },
  rejected: { label: "Rejected", bg: "bg-[#FF6F62]/20", text: "text-[#C4402F]" },
  cancelled: { label: "Cancelled", bg: "bg-[#64748B]/15", text: "text-[#64748B]" },
};

export const statusOf = (status?: string) => statusConfig[status || ""] || statusConfig.pending;

// ===== Brand-safe leave-type colour =====
// Leave-type `color` comes from the DB and has historically held banned hues (orange, pink,
// purple, green). This normalises every dot to the brand palette: a colour that's already
// brand-compliant is respected, anything else is mapped by keyword, with a deterministic
// brand fallback for unknown types. Use this everywhere instead of `lt.color`.
const BRAND_LEAVE_COLORS = ["#206295", "#2F80B8", "#425B8D", "#0E7C7B", "#4BDCD9", "#64748B", "#FF6F62", "#C4402F"];
const BRAND_SET = new Set(BRAND_LEAVE_COLORS.map((c) => c.toLowerCase()));
const LEAVE_COLOR_BY_KEYWORD: [RegExp, string][] = [
  [/casual/i, "#206295"],
  [/comp/i, "#2F80B8"],
  [/earned|annual|privilege|vacation/i, "#0E7C7B"],
  [/matern/i, "#FF6F62"],
  [/patern/i, "#425B8D"],
  [/sick|medical/i, "#C4402F"],
  [/loss of pay|unpaid|\blop\b/i, "#64748B"],
  [/marriage|wedding/i, "#4BDCD9"],
];

export function leaveTypeColor(lt?: { color?: string | null; name?: string | null; code?: string | null } | null): string {
  if (!lt) return "#206295";
  const raw = (lt.color || "").toLowerCase();
  if (raw && BRAND_SET.has(raw)) return lt.color!;         // already brand-compliant — keep it
  const hay = `${lt.name || ""} ${lt.code || ""}`;
  for (const [re, col] of LEAVE_COLOR_BY_KEYWORD) if (re.test(hay)) return col;
  let h = 0; for (let i = 0; i < hay.length; i++) h = (h * 31 + hay.charCodeAt(i)) >>> 0;
  return BRAND_LEAVE_COLORS[h % BRAND_LEAVE_COLORS.length];
}

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
