import { useMemo, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, addMonths, subMonths, addDays,
} from "date-fns";
import { blockOf, dayCovers } from "../lib/booking-engine";
import {
  bookingVisual, MINE_CHIP, GHOST_STYLE,
  HOUR_START, HOUR_END, ROW_H, WEEK_H, hourAt, floatOf, clampF,
} from "../lib/booking-visuals";

// ============================ Calendar (month + week) ============================
export function BookingCalendar({ view, setView, cursor, setCursor, bookings, selectedSlot, onMonthDay, onWeekSlot, filter, setFilter, isMine, onOpenBooking }: any) {
  const isWeek = view === "week";
  // Teal only for the user's OWN company-car bookings; rentals stay coral, others' company cars stay blue.
  const chipOf = (b: any) => (b.bookingType === "company_car" && isMine && isMine(b) ? MINE_CHIP : bookingVisual(b).chip);
  const monthDays = useMemo(() => eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor)), end: endOfWeek(endOfMonth(cursor)) }), [cursor]);
  const weekDays = useMemo(() => eachDayOfInterval({ start: startOfWeek(cursor), end: endOfWeek(cursor) }), [cursor]);
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()); // midnight today — anything before is "past"
  const go = (dir: number) => setCursor(isWeek ? addDays(cursor, dir * 7) : (dir < 0 ? subMonths(cursor, 1) : addMonths(cursor, 1)));
  const label = isWeek ? `${format(startOfWeek(cursor), "d MMM")} – ${format(endOfWeek(cursor), "d MMM yyyy")}` : format(cursor, "MMMM yyyy");

  const geom = (day: Date, s: Date, e: Date) => {
    const sf = clampF(s.getDate() === day.getDate() && s.getMonth() === day.getMonth() ? floatOf(s) : HOUR_START);
    const ef = clampF(e.getDate() === day.getDate() && e.getMonth() === day.getMonth() ? floatOf(e) : HOUR_END);
    return { top: (sf - HOUR_START) * ROW_H, height: Math.max(14, (ef - sf) * ROW_H), valid: ef > sf };
  };
  // Assign side-by-side columns so overlapping bookings never cover each other.
  // Company cars occupy their whole BLOCK window; rentals occupy their actual time. Overlapping items split the width.
  const layoutCols = (day: Date): Map<string, { col: number; cols: number }> => {
    const items = (bookings as any[]).filter((b) => dayCovers(day, b)).map((b) => {
      const win = b.bookingType === "company_car" ? blockOf(b) : { start: new Date(b.startTime), end: new Date(b.endTime) };
      return { id: b.id, s: +win.start, e: +win.end, col: 0 };
    }).sort((a, b) => a.s - b.s || a.e - b.e);
    const map = new Map<string, { col: number; cols: number }>();
    let i = 0;
    while (i < items.length) {
      const cluster = [items[i]]; let end = items[i].e; let j = i + 1;
      while (j < items.length && items[j].s < end) { cluster.push(items[j]); end = Math.max(end, items[j].e); j++; }
      const colEnds: number[] = [];
      cluster.forEach((it) => { let c = 0; for (; c < colEnds.length; c++) { if (colEnds[c] <= it.s) break; } colEnds[c] = it.e; it.col = c; });
      cluster.forEach((it) => map.set(it.id, { col: it.col, cols: colEnds.length }));
      i = j;
    }
    return map;
  };
  const hPos = (p?: { col: number; cols: number }) => {
    const col = p?.col ?? 0, cols = p?.cols ?? 1;
    return { left: `calc(${(col * 100) / cols}% + 2px)`, width: `calc(${100 / cols}% - 4px)` };
  };

  return (
    <div className="card-surface rounded-2xl p-4">
      {/* Controls: view toggle · filter */}
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="segmented-toggle inline-flex p-0.5 h-9">
          {(["month", "week"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`px-3 h-full rounded-[10px] text-xs font-medium capitalize ${view === v ? "btn-primary-gradient text-white" : "text-muted-foreground"}`} data-testid={`view-${v}`}>{v}</button>
          ))}
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v)}>
          <SelectTrigger className="h-9 w-[180px] text-xs" data-testid="calendar-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Bookings</SelectItem>
            <SelectItem value="company">Company Car only</SelectItem>
            <SelectItem value="mine">My Bookings only</SelectItem>
            <SelectItem value="rental">Rental Bookings only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Month/Week nav — < label > */}
      <div className="flex items-center justify-center gap-4 mb-3">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => go(-1)} data-testid="cal-prev"><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm font-semibold min-w-[12rem] text-center">{label}</span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => go(1)} data-testid="cal-next"><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap mb-3">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#0E7C7B]" /> My Company Car</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#206295]" /> Company Car</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-foreground/15" /> Blocked (3-hr window)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#FF6F62]" /> Rental (approved)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-dashed border-[#FF6F62]" /> Rental (awaiting approval)</span>
      </div>

      {/* ===== MONTH VIEW ===== */}
      {!isWeek && (
        <div className="grid grid-cols-7 gap-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground text-center py-1.5">{d}</div>
          ))}
          {monthDays.map((day) => {
            const inMonth = isSameMonth(day, cursor);
            const isToday = isSameDay(day, today);
            const isPast = day < startToday; // past days can't be booked
            const isSel = selectedSlot && isSameDay(day, selectedSlot.start);
            const evs = (bookings as any[]).filter((b) => dayCovers(day, b));
            return (
              <button key={day.toISOString()} onClick={() => onMonthDay(day)} disabled={isPast}
                className={`min-h-[104px] rounded-lg border p-1.5 text-left align-top transition-colors ${isPast ? "cursor-default" : "hover-elevate"} ${isSel ? "ring-2 ring-[#206295] border-transparent" : inMonth ? "bg-background border-border/80" : "bg-muted/30 border-transparent text-muted-foreground/50"}`}
                data-testid={`cal-day-${format(day, "yyyy-MM-dd")}`}>
                <div className={`text-xs font-medium mb-1 inline-flex items-center justify-center ${isToday ? "bg-[#206295] text-white rounded-full h-5 w-5" : ""}`}>{format(day, "d")}</div>
                <div className="space-y-1">
                  {evs.slice(0, 3).map((b: any) => {
                    const v = bookingVisual(b);
                    return <div key={b.id} role="button" onClick={(e) => { e.stopPropagation(); onOpenBooking && onOpenBooking(b); }} className={`text-[10px] leading-tight rounded px-1 py-0.5 truncate cursor-pointer ${chipOf(b)}`} title={`${v.label} · ${format(new Date(b.startTime), "h:mm a")}–${format(new Date(b.endTime), "h:mm a")} · ${b.purpose}`}>{format(new Date(b.startTime), "h:mm a")} {b.purpose || v.label}</div>;
                  })}
                  {evs.length > 3 && <div className="text-[10px] text-muted-foreground pl-1">+{evs.length - 3} more</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ===== WEEK VIEW — hourly time grid (fixed 7 AM–7 PM, fits without inner scroll) ===== */}
      {isWeek && (
        <div className="rounded-xl border border-border/60 overflow-hidden bg-white/10">
          {/* header row: blank gutter + 7 day headers */}
          <div className="flex bg-background border-b border-border/60">
            <div className="w-14 flex-shrink-0" />
            {weekDays.map((d) => {
              const isToday = isSameDay(d, today);
              return (
                <div key={d.toISOString()} className="flex-1 text-center py-2 border-l border-border/40">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{format(d, "EEE")}</div>
                  <div className={`text-sm font-semibold inline-flex items-center justify-center mt-0.5 ${isToday ? "bg-[#206295] text-white rounded-full h-6 w-6" : "text-foreground"}`}>{format(d, "d")}</div>
                </div>
              );
            })}
          </div>
          {/* body: time gutter + day columns */}
          <div className="flex">
            <div className="w-14 flex-shrink-0" style={{ height: WEEK_H }}>
              {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i).map((h) => (
                <div key={h} style={{ height: ROW_H }} className="relative">
                  <span className="absolute top-1 right-1.5 text-[10px] text-muted-foreground">{format(hourAt(today, h), "h a")}</span>
                </div>
              ))}
            </div>
            {weekDays.map((day) => {
              const dayItems = (bookings as any[]).filter((b) => dayCovers(day, b));
              const cols = layoutCols(day);
              return (
                <div key={day.toISOString()} className="flex-1 relative border-l border-border/50" style={{ height: WEEK_H }}>
                  {/* Every hour cell (except past) is clickable — even when a booking overlaps it. The booking
                      overlays below are pointer-events-none, so the click falls through and the form decides
                      company-car vs. rental based on that slot's availability. */}
                  {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i).map((h) => {
                    const isPastCell = hourAt(day, h + 1) <= today; // slot fully in the past
                    if (isPastCell) {
                      // Looks like a normal empty cell, but inert: no hover, no pointer, not clickable.
                      return <div key={h} style={{ height: ROW_H }} className="border-t border-border/40" aria-hidden data-testid={`week-past-${format(day, "yyyy-MM-dd")}-${h}`} />;
                    }
                    return (
                      <button key={h} onClick={() => onWeekSlot(hourAt(day, h), hourAt(day, h + 1))}
                        style={{ height: ROW_H }}
                        className="block w-full border-t border-border/40 hover:bg-[#206295]/[0.10]"
                        data-testid={`week-cell-${format(day, "yyyy-MM-dd")}-${h}`} aria-label={`${format(hourAt(day, h), "h a")} ${format(day, "EEE d")}`} />
                    );
                  })}
                  {/* overlays: blue actual booking + ghost-grey blocked extension (company) / coral (rental) */}
                  {dayItems.map((b: any) => {
                    const v = bookingVisual(b);
                    const s = new Date(b.startTime), e = new Date(b.endTime);
                    const actual = geom(day, s, e);
                    const times = `${format(s, "h:mm a")}–${format(e, "h:mm a")}`;
                    const pos = hPos(cols.get(b.id)); // side-by-side column so bookings never overlap
                    if (b.bookingType !== "company_car") {
                      if (!actual.valid) return null;
                      return (
                        <div key={b.id} onClick={(e) => { e.stopPropagation(); onOpenBooking && onOpenBooking(b); }} style={{ top: actual.top, height: actual.height, ...pos }} className={`absolute z-[2] rounded-md px-1 py-0.5 overflow-hidden text-[10px] leading-tight cursor-pointer ${chipOf(b)}`} title={`${v.label} · ${times} · ${b.purpose}`}>
                          <div className="font-medium truncate">{b.purpose || v.label}</div>
                          <div className="truncate opacity-90">{times}</div>
                        </div>
                      );
                    }
                    const win = blockOf(b);
                    const before = win.start < s ? geom(day, win.start, s) : { valid: false, top: 0, height: 0 };
                    const after = e < win.end ? geom(day, e, win.end) : { valid: false, top: 0, height: 0 };
                    const blueCls = `${before.valid ? "" : "rounded-t-md"} ${after.valid ? "" : "rounded-b-md"}`;
                    return (
                      <Fragment key={b.id}>
                        {before.valid && <div style={{ top: before.top, height: before.height, ...pos, ...GHOST_STYLE }} className="absolute z-[1] rounded-t-md border border-dotted border-[#206295]/50 pointer-events-none" aria-hidden />}
                        {actual.valid && (
                          <div onClick={(e) => { e.stopPropagation(); onOpenBooking && onOpenBooking(b); }} style={{ top: actual.top, height: actual.height, ...pos }} className={`absolute z-[2] ${blueCls} px-1 py-0.5 overflow-hidden text-[10px] leading-tight cursor-pointer ${chipOf(b)}`} title={`${v.label} · ${times} · ${b.purpose}`}>
                            <div className="font-medium truncate">{b.purpose || v.label}</div>
                            <div className="truncate opacity-90">{times}</div>
                          </div>
                        )}
                        {after.valid && <div style={{ top: after.top, height: after.height, ...pos, ...GHOST_STYLE }} className="absolute z-[1] rounded-b-md border border-dotted border-[#206295]/50 pointer-events-none" title="Blocked (3-hour window)" />}
                      </Fragment>
                    );
                  })}
                  {/* Google-Calendar-style current-time marker: horizontal line across today's column + dot on the right */}
                  {isSameDay(day, today) && floatOf(today) >= HOUR_START && floatOf(today) <= HOUR_END && (
                    <div className="absolute left-0 right-0 z-[3] pointer-events-none" style={{ top: (floatOf(today) - HOUR_START) * ROW_H }}>
                      <div className="relative h-px bg-[#FF6F62]">
                        <span className="absolute right-0 -top-[3px] h-[7px] w-[7px] rounded-full bg-[#FF6F62]" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
