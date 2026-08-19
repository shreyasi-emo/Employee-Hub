import { format, isSameDay, isSameMonth, subMonths, addMonths } from "date-fns";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  STATES, STATE_COLOR, LABEL_COLOR, statusLabelOf, textOn, blendWhite, TODAY_FILL_ALPHA,
} from "../lib/attendance-states";
import { StatusChip } from "./attendance-ui";

/** Month calendar / timeline of the signed-in employee's own attendance.
 *  Read-only: every status comes from the caller's `effectiveStatus`. */
export function MyAttendanceCalendar({
  view, onView, calFilter, onCalFilter, cursor, onCursor, selected, onSelect,
  monthDays, timeline, now, todayStr, effectiveStatus, wfhApproval, byDate, travelDays,
}: {
  view: "calendar" | "timeline";
  onView: (v: "calendar" | "timeline") => void;
  calFilter: string;
  onCalFilter: (v: string) => void;
  cursor: Date;
  onCursor: (d: Date) => void;
  selected: Date;
  onSelect: (d: Date) => void;
  monthDays: Date[];
  timeline: any[];
  now: Date;
  todayStr: string;
  effectiveStatus: (d: Date) => string | null;
  wfhApproval: (r: any) => "approved" | "pending" | "rejected" | null;
  byDate: Record<string, any>;
  travelDays: Record<string, string>;
}) {
  const dstr = (d: Date) => format(d, "yyyy-MM-dd");

  return (
    <div className="lg:col-span-2 card-surface rounded-2xl p-4">
      {/* Controls: view toggle · status filter (matches the booking calendar) */}
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="segmented-toggle inline-flex p-0.5 h-9">
          <button onClick={() => onView("calendar")} className={`px-3 h-full rounded-[10px] text-xs font-medium inline-flex items-center gap-1.5 ${view === "calendar" ? "btn-primary-gradient text-white" : "text-foreground/70"}`} data-testid="myatt-calendar"><CalendarDays className="h-3.5 w-3.5" /> Calendar</button>
          <button onClick={() => onView("timeline")} className={`px-3 h-full rounded-[10px] text-xs font-medium inline-flex items-center gap-1.5 ${view === "timeline" ? "btn-primary-gradient text-white" : "text-foreground/70"}`} data-testid="myatt-timeline"><CalendarRange className="h-3.5 w-3.5" /> Timeline</button>
        </div>
        <Select value={calFilter} onValueChange={onCalFilter}>
          <SelectTrigger className="h-9 w-[170px] text-xs" data-testid="myatt-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="present">Present</SelectItem>
            <SelectItem value="wfh">WFH</SelectItem>
            <SelectItem value="on_duty">On Duty</SelectItem>
            <SelectItem value="half_day">Half Day</SelectItem>
            <SelectItem value="absent">Absent</SelectItem>
            <SelectItem value="leave">Leave</SelectItem>
            <SelectItem value="holiday">Holiday</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {view === "calendar" ? (
        <>
          {/* Month nav — < label > (centered, matches booking calendar) */}
          <div className="flex items-center justify-center gap-4 mb-3">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onCursor(subMonths(cursor, 1))} data-testid="myatt-prev"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm font-semibold min-w-[12rem] text-center">{format(cursor, "MMMM yyyy")}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onCursor(addMonths(cursor, 1))} data-testid="myatt-next"><ChevronRight className="h-4 w-4" /></Button>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap mb-3 text-[11px] text-muted-foreground">
            {STATES.map((s) => <span key={s.key} className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ backgroundColor: s.color }} />{s.label}</span>)}
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ backgroundColor: "#94A3B8" }} />Holiday</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-border" style={{ backgroundColor: "#CBD5E1" }} />Weekend</span>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground text-center py-1.5">{d}</div>
            ))}
            {monthDays.map((day) => {
              const key = dstr(day);
              const st = effectiveStatus(day);
              const inM = isSameMonth(day, cursor);
              const isToday = isSameDay(day, now);
              const isSel = isSameDay(day, selected);
              const isFut = key > todayStr;
              const isWeekend = st === "weekend";
              const pendingWfh = st === "wfh" && wfhApproval(byDate[key]) === "pending";
              const color = st && !isWeekend ? (st === "holiday" ? "#94A3B8" : STATE_COLOR[st]) : null;
              const filterMatch = calFilter === "all" || st === calFilter;
              const showLabel = !!color && filterMatch && inM;   // a status label to show
              const showFill = showLabel && !isFut;              // future planned days = label only, no fill
              const todaySolid = isToday && !!color && !pendingWfh; // today is a solid filled box
              const solidText = todaySolid ? textOn(blendWhite(color!, TODAY_FILL_ALPHA)) : undefined;
              const label = pendingWfh ? "WFH · Pending" : statusLabelOf(st || undefined);
              const trip = inM ? travelDays[key] : undefined;
              return (
                <button key={day.toISOString()} onClick={() => onSelect(day)}
                  className={`min-h-[72px] rounded-lg border p-1.5 text-left flex flex-col transition-colors hover-elevate ${isSel ? "ring-2 ring-[#206295] ring-offset-2 ring-offset-background" : (isToday && !todaySolid) ? "ring-2 ring-[#206295]" : ""} ${inM ? (isWeekend ? "bg-muted/30 border-border/60" : "bg-background border-border/80") : "bg-muted/30 border-transparent text-muted-foreground/50"}`}
                  style={todaySolid ? { backgroundColor: `${color}80`, borderColor: color! } : (showFill ? { backgroundColor: `${color}33` } : undefined)}
                  data-testid={`myatt-day-${format(day, "yyyy-MM-dd")}`}>
                  <span className="self-start w-full flex items-center justify-between text-sm font-semibold" style={solidText ? { color: solidText } : undefined}>{format(day, "d")}{trip && <Plane className="h-3 w-3 text-[#206295]" aria-label="Travel booked" />}</span>
                  {showLabel && (showFill
                    ? <span className="mt-auto max-w-full truncate text-[11px] font-medium" style={{ color: solidText ?? (LABEL_COLOR[st || ""] || color!) }} title={label}>{label}</span>
                    : <span className="mt-auto self-start inline-flex max-w-full truncate rounded-md border px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: LABEL_COLOR[st || ""] || color!, borderColor: `${color}80` }} title={label}>{label}</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <ScrollArea className="h-[420px]">
          <div className="space-y-2 pr-2">
            {(() => { const rows = timeline.filter((r) => calFilter === "all" || r.status === calFilter); return rows.length === 0 ? (
              <div className="text-center py-16"><CalendarDays className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">{calFilter === "all" ? "No attendance recorded this month." : "No matching days this month."}</p></div>
            ) : rows.map((r) => (
              <button key={r.id} onClick={() => onSelect(new Date(r.date))} className="w-full text-left rounded-xl border border-border/60 p-3 flex items-center gap-3 hover-elevate" data-testid={`myatt-row-${r.date}`}>
                <div className="w-12 flex-shrink-0 text-center">
                  <p className="text-[10px] uppercase text-muted-foreground">{format(new Date(r.date), "MMM")}</p>
                  <p className="text-lg font-bold leading-none text-foreground tabular-nums">{format(new Date(r.date), "d")}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <StatusChip s={r.status} />
                  <p className="text-[11px] text-muted-foreground mt-1 truncate">{format(new Date(r.date), "EEEE")}</p>
                </div>
              </button>
            )); })()}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
