// How a notification is presented: which icon + brand tint it gets, and whose
// avatar (if anyone's) to show beside it. Keyword-based so any new server-side
// notification type still resolves to something sensible without a code change.

import {
  IndianRupee, Plane, ShoppingCart, LifeBuoy, ClipboardCheck, CheckCircle2,
  XCircle, Cake, Gift, UserPlus, CalendarClock, Info,
} from "lucide-react";

// Default-avatar shades (brand colors) for employee DPs in notifications
const NOTIF_AVATAR_PALETTE = ["#206295", "#4BDCD9", "#FF6F62"];

export function notifAvatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return NOTIF_AVATAR_PALETTE[h % NOTIF_AVATAR_PALETTE.length];
}

// Map a notification type to a clean icon + brand-tinted circular badge.
// Keyword-based so any type variant resolves to a sensible icon.
export function notifVisual(type: string): { icon: any; cls: string } {
  const t = (type || "").toLowerCase();
  const TEAL = "bg-[#4BDCD9]/25 text-[#206295]";
  const BLUE = "bg-[#206295]/15 text-[#206295]";
  const CORAL = "bg-[#FF6F62]/15 text-[#FF6F62]";
  const GREY = "bg-[#6A7366]/15 text-[#6A7366]";
  if (t.includes("reject")) return { icon: XCircle, cls: CORAL };
  if (t.includes("reimburse")) return { icon: IndianRupee, cls: TEAL };
  if (t.includes("birthday")) return { icon: Cake, cls: TEAL };
  if (t.includes("anniversary")) return { icon: Gift, cls: BLUE };
  if (t.includes("leave") || t.includes("travel")) return { icon: Plane, cls: BLUE };
  if (t.includes("purchase")) return { icon: ShoppingCart, cls: TEAL };
  if (t.includes("ticket") || t.includes("support")) return { icon: LifeBuoy, cls: BLUE };
  if (t.includes("approved") || t.includes("fulfilled") || t.includes("done")) return { icon: CheckCircle2, cls: TEAL };
  if (t.includes("approval") || t.includes("pending") || t.includes("submitted")) return { icon: ClipboardCheck, cls: BLUE };
  if (t.includes("regulariz") || t.includes("attendance")) return { icon: CalendarClock, cls: BLUE };
  if (t.includes("employee") || t.includes("onboard") || t.includes("hr") || t.includes("invite")) return { icon: UserPlus, cls: BLUE };
  return { icon: Info, cls: GREY };
}

const NOTIF_EMPLOYEE_TYPES = ["leave", "reimburse", "travel", "purchase", "birthday", "anniversary", "employee", "onboard", "ticket"];

// Best-effort: pull a person's name from the notification text so we can show their DP.
export function notifEmployeeName(n: any): string | null {
  const isEmpRelated = NOTIF_EMPLOYEE_TYPES.some((k) => (n.type || "").toLowerCase().includes(k));
  if (!isEmpRelated) return null;
  const text = `${n.body || ""} ${n.title || ""}`;
  let m = text.match(/\(([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2})\)/);
  if (m) return m[1];
  m = text.match(/\b(?:by|from|for)\s+([A-Z][a-z]+\s[A-Z][a-z]+)/);
  if (m) return m[1];
  return null;
}
