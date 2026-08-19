// The vehicle booking rules: the 7am-7pm window, the 3-hour intra-city block,
// overlap detection, fair vehicle assignment and per-vehicle availability.
// Extracted verbatim from the page — this is the logic the calendar, the booking
// form and the HR approval list all depend on.

import { format, isSameDay } from "date-fns";

export const WIN_START = 7;   // booking window 7:00 AM
export const WIN_END = 19;    // 7:00 PM
export const BLOCK = 3;       // intra-city bookings occupy 3-hour blocks

// ---- helpers ----
export const overlaps = (aS: Date, aE: Date, bS: Date, bE: Date) => aS < bE && bS < aE;
// Effective block window a company-car booking occupies (falls back to start/end for legacy rows / rentals).
export const blockOf = (b: any) => ({
  start: b.blockStart ? new Date(b.blockStart) : new Date(b.startTime),
  end: b.blockEnd ? new Date(b.blockEnd) : new Date(b.endTime),
});
// Mirror of the server's block computation, used for live form/right-panel previews.
export const computeBlock = (tripType: string, start: Date, end: Date) => {
  const dayStart = new Date(start); dayStart.setHours(WIN_START, 0, 0, 0);
  const dayEnd = new Date(start); dayEnd.setHours(WIN_END, 0, 0, 0);
  if (tripType === "inter_city") return { start: dayStart, end: dayEnd };
  const durH = Math.max(1, (+end - +start) / 3600000);
  const blocks = Math.max(1, Math.ceil(durH / BLOCK));
  let be = new Date(+start + blocks * BLOCK * 3600000);
  if (be > dayEnd) be = dayEnd;
  return { start: new Date(start), end: be };
};
export const dayCovers = (day: Date, b: any) => {
  const s = new Date(b.startTime), e = new Date(b.endTime);
  const d0 = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  return d0 >= new Date(s.getFullYear(), s.getMonth(), s.getDate()) && d0 <= new Date(e.getFullYear(), e.getMonth(), e.getDate());
};
export const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");
export const fmtRange = (s: string, e: string) => {
  const a = new Date(s), b = new Date(e);
  return isSameDay(a, b) ? `${format(a, "d MMM, h:mm a")} → ${format(b, "h:mm a")}` : `${format(a, "d MMM, h:mm a")} → ${format(b, "d MMM, h:mm a")}`;
};

// Booking-window time options (7:00 AM – 7:00 PM, 30-min steps) as { value: "HH:mm", label: "h:mm a" }.
export const TIME_SLOTS: { value: string; label: string }[] = (() => {
  const out: { value: string; label: string }[] = [];
  for (let h = WIN_START; h <= WIN_END; h++) {
    for (const m of [0, 30]) {
      if (h === WIN_END && m > 0) break; // stop at 7:00 PM
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      out.push({ value, label: format(new Date(2000, 0, 1, h, m), "h:mm a") });
    }
  }
  return out;
})();

// Calendar-style date field — reuses the app's RangeCalendar; past dates disabled. A single date by

// so one driver isn't overloaded while others are idle. `seedId` (a "Book Now"-targeted vehicle)
// is preferred when it can serve. Returns the ordered list of chosen vehicle ids.
export function assignVehicles(available: any[], pax: number, seedId: string | undefined, loadOf: (id: string) => number, capOf: (v: any) => number): string[] {
  if (!available.length) return [];
  const seed = seedId ? available.find((v) => v.id === seedId) : undefined;
  const fits = available.filter((v) => capOf(v) >= pax);
  if (seed && capOf(seed) >= pax) return [seed.id];
  if (fits.length) {
    // single vehicle: least-loaded first, then smallest capacity that still fits (least waste)
    const best = [...fits].sort((a, b) => loadOf(a.id) - loadOf(b.id) || capOf(a) - capOf(b) || (a.model || a.name || "").localeCompare(b.model || b.name || ""))[0];
    return [best.id];
  }
  // multiple vehicles needed: least-loaded first, larger capacity first (cover with fewer cars)
  const pool = [...available].sort((a, b) => loadOf(a.id) - loadOf(b.id) || capOf(b) - capOf(a) || (a.model || a.name || "").localeCompare(b.model || b.name || ""));
  const ordered = seed ? [seed, ...pool.filter((v) => v.id !== seed.id)] : pool;
  const chosen: string[] = []; let total = 0;
  for (const v of ordered) { chosen.push(v.id); total += capOf(v); if (total >= pax) break; }
  return chosen;
}

// Per-vehicle availability for the selected date: Maintenance/Unavailable (coral) · Limited Slots (amber) · Available (teal).
export function vehicleAvailability(v: any, companyBookings: any[], now: Date): { label: string; cls: string; solid: string; bookable: boolean } {
  if (v.status === "maintenance") return { label: "Maintenance", cls: "bg-[#64748B]/15 text-[#64748B]", solid: "bg-[#64748B]/70 text-white", bookable: false };
  let free = 0, total = 0;
  for (let h = WIN_START; h < WIN_END; h += BLOCK) {
    total++;
    const cs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 0);
    const ce = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.min(h + BLOCK, WIN_END), 0);
    const hit = companyBookings.some((b) => b.vehicleId === v.id && overlaps(cs, ce, blockOf(b).start, blockOf(b).end));
    if (!hit) free++;
  }
  if (free === 0) return { label: "Unavailable", cls: "bg-[#FF6F62]/20 text-[#FF6F62]", solid: "bg-[#FF6F62]/70 text-white", bookable: false };
  if (free < total) return { label: "Limited Slots", cls: "bg-[#F59E0B]/20 text-[#B45309] dark:text-[#F59E0B]", solid: "bg-[#F59E0B]/70 text-white", bookable: true };
  return { label: "Available", cls: "bg-[#4BDCD9]/25 text-[#0E7C7B]", solid: "bg-[#0E7C7B]/70 text-white", bookable: true };
}

// A trip starting within the next 24h is "due soon" and gets priority emphasis.
export const isDueSoon = (b: any) => { const ms = +new Date(b.startTime) - Date.now(); return ms >= 0 && ms <= 24 * 3600 * 1000; };
