import { Cake, Gift, HeartHandshake } from "lucide-react";
import { initials } from "@/lib/format";
import { avatarColor } from "@/lib/avatar";
export { avatarColor };
export { initials };

/** Days until the next occurrence of a recurring (month/day) date — birthdays, anniversaries. */
export function daysUntilAnnual(dateStr?: string) {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr); if (isNaN(+d)) return Infinity;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.round((+next - +today) / 86400000);
}

/** Days until a one-off calendar date — last working day. */
export function daysUntilDate(dateStr?: string) {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr); if (isNaN(+d)) return Infinity;
  d.setHours(0, 0, 0, 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((+d - +t) / 86400000);
}

export type TodayEvent = { kind: "birthday" | "anniversary" | "farewell"; label: string; tint: string; icon: any };

/**
 * A celebration happening *today* for this employee (birthday > anniversary > farewell).
 *
 * NOTE: currently unwired — EmployeeCard accepts an `event` prop that renders a
 * coloured banner, but the directory page does not pass one, so no banner shows.
 * Kept because the card still supports it; pass `event={todayEvent(emp)}` to enable.
 */
export function todayEvent(e: any): TodayEvent | null {
  if (e.dateOfBirth && daysUntilAnnual(e.dateOfBirth) === 0) return { kind: "birthday", label: "Birthday", tint: "#FF6F62", icon: Cake };
  if (e.joinDate && daysUntilAnnual(e.joinDate) === 0) {
    const yrs = new Date().getFullYear() - new Date(e.joinDate).getFullYear();
    if (yrs >= 1) return { kind: "anniversary", label: `${yrs}-Year Anniversary`, tint: "#FFA962", icon: Gift };
  }
  if (e.lastWorkingDate && daysUntilDate(e.lastWorkingDate) === 0) return { kind: "farewell", label: "Farewell", tint: "#6A7366", icon: HeartHandshake };
  return null;
}
