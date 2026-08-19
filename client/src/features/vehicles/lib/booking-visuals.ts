// Colour language and week-grid geometry for the vehicles screen.
// Blue = company car, coral = rental, teal = your own booking.

import { WIN_START, WIN_END } from "./booking-engine";

// Visual language: blue = company car, coral = rental. Pending rental = coral outline, no fill.
// (Literal class strings — Tailwind JIT only generates classes it sees verbatim in source.)
export function bookingVisual(b: any): { chip: string; label: string; badge: string; dot: string } {
  if (b.bookingType === "company_car") {
    return { chip: "bg-[#206295] text-white border border-[#206295]", label: "Company Car", badge: "bg-[#206295]/15 text-[#206295]", dot: "bg-[#206295]" };
  }
  if (b.status === "approved") {
    return { chip: "bg-[#FF6F62] text-white border border-[#FF6F62]", label: "Rental", badge: "bg-[#FF6F62]/20 text-[#FF6F62]", dot: "bg-[#FF6F62]" };
  }
  return { chip: "bg-transparent text-[#FF6F62] border border-dashed border-[#FF6F62]", label: "Rental (pending)", badge: "border border-[#FF6F62] text-[#FF6F62]", dot: "border border-[#FF6F62]" };
}
export function statusLabel(b: any): string {
  if (b.bookingType === "company_car") return b.status === "confirmed" ? "Confirmed" : "Cancelled";
  return { pending_hr_approval: "Awaiting HR Approval", approved: "Approved", rejected: "Rejected", cancelled: "Cancelled" }[b.status as string] || b.status;
}
// Standard status-badge colour language (matches the rest of the app):
// teal = approved / confirmed (success), blue = pending / awaiting, coral = rejected, grey = cancelled.
export function statusBadgeClass(b: any): string {
  const s = b.status;
  if (s === "approved" || s === "confirmed") return "bg-[#4BDCD9]/25 text-[#0E7C7B]";
  if (s === "pending_hr_approval") return "bg-[#206295]/15 text-[#206295]";
  if (s === "rejected") return "bg-[#FF6F62]/20 text-[#FF6F62]";
  return "bg-[#64748B]/15 text-[#64748B]"; // cancelled / other
}

// Avatar tints — a rotation of the 4 main brand colours so people chips aren't monotonous.
export const AVATAR_TINTS = [
  "bg-[#206295]/15 text-[#206295]", // blue
  "bg-[#0E7C7B]/15 text-[#0E7C7B]", // teal
  "bg-[#FF6F62]/20 text-[#FF6F62]", // coral
  "bg-[#425B8D]/15 text-[#425B8D]", // slate
];
export const avatarTint = (name?: string) => {
  const s = name || ""; let h = 0;
  for (let i = 0; i < s.length; i++) h += s.charCodeAt(i);
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
};

// Google-Calendar-style week grid config — fixed 7 AM – 7 PM booking window.
export const HOUR_START = WIN_START; // 7 AM
export const HOUR_END = WIN_END;     // 7 PM
export const ROW_H = 52;             // px per hour
export const WEEK_H = (HOUR_END - HOUR_START) * ROW_H;
export const hourAt = (day: Date, h: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 0, 0, 0);
export const floatOf = (d: Date) => d.getHours() + d.getMinutes() / 60;
export const clampF = (f: number) => Math.max(HOUR_START, Math.min(HOUR_END, f));
// Ghost look for the blocked 3-hour extension: ~50% grey fill + 70%-opacity diagonal hatching.
export const GHOST_STYLE = {
  backgroundColor: "rgba(148, 163, 184, 0.5)",
  backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.7) 0, rgba(255,255,255,0.7) 1px, transparent 1.5px, transparent 7px)",
} as const;

// Teal chip for the current user's own bookings, so they stand out from others' (blue company / coral rental).
export const MINE_CHIP = "bg-[#0E7C7B] text-white border border-[#0E7C7B]";

export const driverInitials = (n?: string) => (n || "").split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
export const empName = (e: any) => `${e?.firstName || ""} ${e?.lastName || ""}`.trim() || e?.username || "Employee";

export const manageStatusBadge = (s: string) => s === "maintenance" ? "bg-[#F59E0B]/20 text-[#B45309] dark:text-[#F59E0B]" : "bg-[#4BDCD9]/25 text-[#0E7C7B]";
