import { useState, useMemo, useEffect, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth, hasRole } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar as RangeCalendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmployeePicker } from "@/components/employee-picker";
import { GlassBackButton } from "@/components/glass-back-button";
import { DateRangePicker, CalCaption } from "@/components/date-range-picker";
import { TimeField } from "@/components/datetime-field";
import { useToast } from "@/hooks/use-toast";
import {
  Car, Plus, Users, User, Check, X, ChevronLeft, ChevronRight, ChevronDown, MapPin,
  Clock, ShieldCheck, Settings, Ban, CircleDashed, CircleCheck, AlertTriangle, Info,
  Hash, Phone, Upload, Pencil, Fuel, Cog, Trash2, Search, ArrowLeft, BarChart3, ArrowUpDown, CalendarDays, Route,
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, addMonths, subMonths, addDays, startOfDay, endOfDay,
} from "date-fns";

const WIN_START = 7;   // booking window 7:00 AM
const WIN_END = 19;    // 7:00 PM
const BLOCK = 3;       // intra-city bookings occupy 3-hour blocks

// ---- helpers ----
const overlaps = (aS: Date, aE: Date, bS: Date, bE: Date) => aS < bE && bS < aE;
// Effective block window a company-car booking occupies (falls back to start/end for legacy rows / rentals).
const blockOf = (b: any) => ({
  start: b.blockStart ? new Date(b.blockStart) : new Date(b.startTime),
  end: b.blockEnd ? new Date(b.blockEnd) : new Date(b.endTime),
});
// Mirror of the server's block computation, used for live form/right-panel previews.
const computeBlock = (tripType: string, start: Date, end: Date) => {
  const dayStart = new Date(start); dayStart.setHours(WIN_START, 0, 0, 0);
  const dayEnd = new Date(start); dayEnd.setHours(WIN_END, 0, 0, 0);
  if (tripType === "inter_city") return { start: dayStart, end: dayEnd };
  const durH = Math.max(1, (+end - +start) / 3600000);
  const blocks = Math.max(1, Math.ceil(durH / BLOCK));
  let be = new Date(+start + blocks * BLOCK * 3600000);
  if (be > dayEnd) be = dayEnd;
  return { start: new Date(start), end: be };
};
const dayCovers = (day: Date, b: any) => {
  const s = new Date(b.startTime), e = new Date(b.endTime);
  const d0 = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  return d0 >= new Date(s.getFullYear(), s.getMonth(), s.getDate()) && d0 <= new Date(e.getFullYear(), e.getMonth(), e.getDate());
};
const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");
const fmtRange = (s: string, e: string) => {
  const a = new Date(s), b = new Date(e);
  return isSameDay(a, b) ? `${format(a, "d MMM, h:mm a")} → ${format(b, "h:mm a")}` : `${format(a, "d MMM, h:mm a")} → ${format(b, "d MMM, h:mm a")}`;
};

// Visual language: blue = company car, coral = rental. Pending rental = coral outline, no fill.
// (Literal class strings — Tailwind JIT only generates classes it sees verbatim in source.)
function bookingVisual(b: any): { chip: string; label: string; badge: string; dot: string } {
  if (b.bookingType === "company_car") {
    return { chip: "bg-[#206295] text-white border border-[#206295]", label: "Company Car", badge: "bg-[#206295]/15 text-[#206295]", dot: "bg-[#206295]" };
  }
  if (b.status === "approved") {
    return { chip: "bg-[#FF6F62] text-white border border-[#FF6F62]", label: "Rental", badge: "bg-[#FF6F62]/20 text-[#FF6F62]", dot: "bg-[#FF6F62]" };
  }
  return { chip: "bg-transparent text-[#FF6F62] border border-dashed border-[#FF6F62]", label: "Rental (pending)", badge: "border border-[#FF6F62] text-[#FF6F62]", dot: "border border-[#FF6F62]" };
}
function statusLabel(b: any): string {
  if (b.bookingType === "company_car") return b.status === "confirmed" ? "Confirmed" : "Cancelled";
  return { pending_hr_approval: "Awaiting HR Approval", approved: "Approved", rejected: "Rejected", cancelled: "Cancelled" }[b.status as string] || b.status;
}
// Standard status-badge colour language (matches the rest of the app):
// teal = approved / confirmed (success), blue = pending / awaiting, coral = rejected, grey = cancelled.
function statusBadgeClass(b: any): string {
  const s = b.status;
  if (s === "approved" || s === "confirmed") return "bg-[#4BDCD9]/25 text-[#0E7C7B]";
  if (s === "pending_hr_approval") return "bg-[#206295]/15 text-[#206295]";
  if (s === "rejected") return "bg-[#FF6F62]/20 text-[#FF6F62]";
  return "bg-[#64748B]/15 text-[#64748B]"; // cancelled / other
}

// Avatar tints — a rotation of the 4 main brand colours so people chips aren't monotonous.
const AVATAR_TINTS = [
  "bg-[#206295]/15 text-[#206295]", // blue
  "bg-[#0E7C7B]/15 text-[#0E7C7B]", // teal
  "bg-[#FF6F62]/20 text-[#FF6F62]", // coral
  "bg-[#425B8D]/15 text-[#425B8D]", // slate
];
const avatarTint = (name?: string) => {
  const s = name || ""; let h = 0;
  for (let i = 0; i < s.length; i++) h += s.charCodeAt(i);
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
};

// Compact hero metric block (Date / Time / Passengers) — brand-blue shades.
function HeroMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-0 px-2 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-foreground mt-1 whitespace-nowrap truncate">{value}</p>
    </div>
  );
}

// Labelled field used inside the section cards — filled icon box on the left, label + value beside it.
function DetailField({ icon: Icon, label, value }: { icon?: any; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      {Icon && <span className="h-9 w-9 rounded-lg bg-[#206295]/[0.08] text-[#206295] flex items-center justify-center flex-shrink-0"><Icon className="h-[18px] w-[18px]" /></span>}
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="text-sm font-medium text-foreground mt-0.5 break-words">{value}</div>
      </div>
    </div>
  );
}

// Titled section card — numbered blue badge + title (same style as the booking form's section headers),
// with an optional right-aligned action.
function SectionCard({ n, title, action, children }: { n: number; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-6 rounded-full bg-[#206295] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">{n}</span>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {action}
      </div>
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4">{children}</div>
    </div>
  );
}

// A single person chip: brand-tinted avatar + name (marks the viewer as "you").
function PersonChip({ name, userId, me }: { name: string; userId?: string; me?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-background border border-border/60 pl-1 pr-2.5 py-0.5">
      <span className={`h-5 w-5 rounded-full ${avatarTint(name)} text-[9px] font-semibold flex items-center justify-center flex-shrink-0`}>{driverInitials(name)}</span>
      <span className="text-xs text-foreground">{name}{userId && userId === me ? " (you)" : ""}</span>
    </span>
  );
}

// Passenger avatar chips (~2 lines) with View all / Show less toggle.
function PassengerChips({ attendees, me, max = 4 }: { attendees: any[]; me?: string; max?: number }) {
  const [expanded, setExpanded] = useState(false);
  const list = (attendees || []).filter((a) => a?.name);
  if (!list.length) return <span className="text-sm text-muted-foreground">—</span>;
  const shown = expanded ? list : list.slice(0, max);
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((a, i) => <PersonChip key={i} name={a.name} userId={a.userId} me={me} />)}
      {list.length > max && (
        <button type="button" onClick={() => setExpanded((x) => !x)} className="text-xs font-medium text-[#206295] hover:underline px-1.5 py-1" data-testid="passengers-more">{expanded ? "Show less" : `View all passengers (${list.length})`}</button>
      )}
    </div>
  );
}

// ============================ Booking details popup ============================
// Premium detail rows for any booking (opened by clicking a booking anywhere). Upcoming bookings
// get a sticky footer to edit / cancel (booker) or opt out (other passengers).
function BookingDetailsDialog({ booking, vehicles, nameByUser, me, isHrAdmin, onClose, onCancel, onEdit, onOptOut, onViewInCalendar, onApprove, onReject }: any) {
  const b = booking;
  const [note, setNote] = useState("");
  const company = b.bookingType === "company_car";
  const v = company ? (vehicles as any[]).find((x) => x.id === b.vehicleId) : null;
  const done = new Date(b.endTime) < new Date();
  const attendees = Array.isArray(b.attendees) ? b.attendees : [];
  const isBooker = b.requesterId === me;
  const isAttendee = !isBooker && attendees.some((a: any) => a?.userId === me);
  const active = b.status !== "cancelled" && b.status !== "rejected";
  // HR approving a pending rental gets the approve/reject footer instead of edit/cancel.
  const canApprove = isHrAdmin && b.bookingType === "rental" && b.status === "pending_hr_approval";
  const showFooter = !canApprove && !done && active && (isBooker || isAttendee || isHrAdmin);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden gap-0 flex flex-col max-h-[90vh]">
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2.5">
            <span className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${company ? "bg-[#206295]/10 text-[#206295]" : "bg-[#FF6F62]/10 text-[#FF6F62]"}`}><Car className="h-5 w-5" /></span>
            <span className="truncate">{b.purpose || "Booking"}</span>
          </DialogTitle>
          <div className="flex items-center gap-2 flex-wrap pt-2">
            <Badge className={`text-[10px] ${company ? "bg-[#206295]/15 text-[#206295]" : "bg-[#FF6F62]/20 text-[#FF6F62]"}`}>{company ? "Company Car" : "Rental"}</Badge>
            <Badge className={`text-[10px] ${statusBadgeClass(b)}`}>{statusLabel(b)}</Badge>
            <span className={`text-[11px] font-medium uppercase tracking-wide inline-flex items-center gap-1 ${done ? "text-[#0E7C7B]" : "text-muted-foreground"}`}>{done ? <><CircleCheck className="h-3.5 w-3.5" /> Completed</> : <><Clock className="h-3.5 w-3.5" /> Upcoming</>}</span>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-6 pb-5 space-y-5">
            {/* Hero summary — three equal metric blocks, brand-blue shades */}
            <div className="rounded-2xl border border-[#206295]/20 bg-[#206295]/[0.06] py-3 flex items-stretch">
              <HeroMetric label="Date" value={format(new Date(b.startTime), "d MMM")} />
              <Separator orientation="vertical" className="h-9 self-center bg-[#206295]/20" />
              <HeroMetric label="Time" value={`${format(new Date(b.startTime), "h:mm")}–${format(new Date(b.endTime), "h:mm a")}`} />
              <Separator orientation="vertical" className="h-9 self-center bg-[#206295]/20" />
              <HeroMetric label="Passengers" value={String(attendees.length || b.passengers || 1)} />
            </div>

            {/* Trip Information — pickup / destination */}
            <SectionCard n={1} title="Trip Information"
              action={<Button variant="ghost" size="sm" className="h-7 text-xs text-[#206295] hover:text-[#206295] -mr-1" onClick={() => onViewInCalendar && onViewInCalendar(b)} data-testid="detail-view-calendar"><CalendarDays className="h-3.5 w-3.5 mr-1" /> View in Calendar</Button>}>
              <div className="grid grid-cols-2 divide-x divide-border/60">
                <div className="pr-4"><DetailField icon={MapPin} label="Pickup" value={b.pickupLocation || "Not set"} /></div>
                <div className="pl-4"><DetailField icon={MapPin} label="Destination" value={b.dropLocation || "Not set"} /></div>
              </div>
            </SectionCard>

            <Separator />

            {/* Vehicle & Driver — side by side */}
            <SectionCard n={2} title="Vehicle & Driver">
              <div className="grid grid-cols-2 divide-x divide-border/60">
                <div className="pr-4"><DetailField icon={Car} label="Vehicle" value={company ? (v ? <span>{v.model || v.name}<span className="block text-xs text-muted-foreground mt-0.5">{v.registrationNo || "—"}</span></span> : "Company car") : "Agency rental (external)"} /></div>
                <div className="pl-4"><DetailField icon={User} label="Driver" value={company && v?.driverName ? <span>{v.driverName}<span className="block text-xs text-muted-foreground mt-0.5">{v.driverPhone || "—"}</span></span> : <span className="text-muted-foreground">—</span>} /></div>
              </div>
            </SectionCard>

            <Separator />

            {/* People — passengers, then booked-by, each as icon + heading with content below */}
            <SectionCard n={3} title="People">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <span className="h-9 w-9 rounded-lg bg-[#206295]/[0.08] text-[#206295] flex items-center justify-center flex-shrink-0"><Users className="h-[18px] w-[18px]" /></span>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Passengers (<span className="font-bold text-foreground">{attendees.length || b.passengers || 1}</span>)</p>
                  </div>
                  <PassengerChips attendees={attendees} me={me} />
                </div>
                <Separator />
                <div>
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <span className="h-9 w-9 rounded-lg bg-[#206295]/[0.08] text-[#206295] flex items-center justify-center flex-shrink-0"><User className="h-[18px] w-[18px]" /></span>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Booked by</p>
                  </div>
                  {b.requesterId ? <PersonChip name={(nameByUser && nameByUser[b.requesterId]) || "—"} /> : <span className="text-sm text-muted-foreground">—</span>}
                </div>
              </div>
            </SectionCard>

            <Separator />

            {/* Notes card */}
            {b.notes && (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1"><Info className="h-3 w-3" />Notes</p>
                <p className="text-sm text-foreground mt-1 break-words">{b.notes}</p>
              </div>
            )}
            {b.decisionNote && (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" />HR note</p>
                <p className="text-sm text-foreground mt-1 break-words">{b.decisionNote}</p>
              </div>
            )}

          </div>
        </div>

        {canApprove && (
          <div className="flex-shrink-0 border-t border-border bg-background px-6 py-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for the requester…" data-testid="approve-note" />
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" className="text-[#FF6F62] border-[#FF6F62]/40 hover:bg-[#FF6F62]/10" onClick={() => onReject && onReject(b, note.trim())} data-testid="detail-reject"><X className="h-4 w-4 mr-1.5" /> Reject</Button>
              <Button className="bg-[#0E7C7B] hover:bg-[#0E7C7B]/90 text-white" onClick={() => onApprove && onApprove(b, note.trim())} data-testid="detail-approve"><Check className="h-4 w-4 mr-1.5" /> Approve</Button>
            </div>
          </div>
        )}

        {showFooter && (
          <div className="flex-shrink-0 border-t border-border bg-background px-6 py-4 space-y-3">
            <div className="flex items-center gap-2 rounded-lg bg-[#206295]/[0.06] border border-[#206295]/20 px-3 py-2">
              <Info className="h-4 w-4 text-[#206295] flex-shrink-0" />
              <p className="text-xs text-foreground">You can edit or cancel this trip before it starts.</p>
            </div>
            <div className="flex items-center justify-end gap-3">
              {isBooker && <Button variant="outline" onClick={() => onEdit && onEdit(b)} data-testid="detail-edit"><Pencil className="h-4 w-4 mr-1.5" /> Edit Trip</Button>}
              {(isBooker || isHrAdmin) ? (
                <Button variant="outline" className="text-[#FF6F62] border-[#FF6F62]/40 hover:bg-[#FF6F62]/10" onClick={() => onCancel && onCancel(b)} data-testid="detail-cancel"><Ban className="h-4 w-4 mr-1.5" /> Cancel Trip</Button>
              ) : isAttendee ? (
                <Button variant="outline" className="text-[#FF6F62] border-[#FF6F62]/40 hover:bg-[#FF6F62]/10" onClick={() => onOptOut && onOptOut(b)} data-testid="detail-optout"><X className="h-4 w-4 mr-1.5" /> Opt Out</Button>
              ) : null}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Google-Calendar-style week grid config — fixed 7 AM – 7 PM booking window.
const HOUR_START = WIN_START; // 7 AM
const HOUR_END = WIN_END;     // 7 PM
const ROW_H = 52;             // px per hour
const WEEK_H = (HOUR_END - HOUR_START) * ROW_H;
const hourAt = (day: Date, h: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 0, 0, 0);
const floatOf = (d: Date) => d.getHours() + d.getMinutes() / 60;
const clampF = (f: number) => Math.max(HOUR_START, Math.min(HOUR_END, f));
// Ghost look for the blocked 3-hour extension: ~50% grey fill + 70%-opacity diagonal hatching.
const GHOST_STYLE = {
  backgroundColor: "rgba(148, 163, 184, 0.5)",
  backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.7) 0, rgba(255,255,255,0.7) 1px, transparent 1.5px, transparent 7px)",
} as const;

// Teal chip for the current user's own bookings, so they stand out from others' (blue company / coral rental).
const MINE_CHIP = "bg-[#0E7C7B] text-white border border-[#0E7C7B]";

// ============================ Calendar (month + week) ============================
function BookingCalendar({ view, setView, cursor, setCursor, bookings, selectedSlot, onMonthDay, onWeekSlot, filter, setFilter, isMine, onOpenBooking }: any) {
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

// Numbered section header used to structure the booking form. Module-level so inputs never lose focus.
function FormSection({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="h-6 w-6 rounded-full bg-[#206295] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">{n}</span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// Booking-window time options (7:00 AM – 7:00 PM, 30-min steps) as { value: "HH:mm", label: "h:mm a" }.
const TIME_SLOTS: { value: string; label: string }[] = (() => {
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
// default, with an "End date" toggle (OFF by default) that turns it into a multi-day range — same
// pattern as the Attendance custom-range picker.
function BookingDateField({ value, onChange }: { value: { from?: Date; to?: Date }; onChange: (v: { from?: Date; to?: Date }) => void }) {
  const [open, setOpen] = useState(false);
  const [endOn, setEndOn] = useState(!!(value.from && value.to && +value.from !== +value.to));
  const hasRange = endOn && value.to && value.from && +value.to !== +value.from;
  const label = value.from
    ? hasRange ? `${format(value.from!, "EEE, d MMM")} – ${format(value.to!, "EEE, d MMM yyyy")}` : format(value.from, "EEE, d MMM yyyy")
    : "Select date";
  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={`w-full justify-start font-normal ${!value.from ? "text-muted-foreground" : ""}`} data-testid="veh-date">
          <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        {endOn && (
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 text-sm font-medium px-3 py-1.5 rounded-[12px] border border-border text-center">{value.from ? format(value.from, "MMM d, yyyy") : "Start date"}</div>
            <span className="text-muted-foreground text-xs">→</span>
            <div className="flex-1 text-sm font-medium px-3 py-1.5 rounded-[12px] border border-border text-center">{hasRange ? format(value.to!, "MMM d, yyyy") : "End date"}</div>
          </div>
        )}
        {endOn ? (
          <RangeCalendar mode="range" selected={value as any} onSelect={(r: any) => onChange(r ?? {})} defaultMonth={value.from} disabled={{ before: startOfDay(new Date()) }} components={{ Caption: CalCaption }} />
        ) : (
          <RangeCalendar mode="single" selected={value.from} onSelect={(d: any) => { if (d) { onChange({ from: d, to: d }); setOpen(false); } }} defaultMonth={value.from} disabled={{ before: startOfDay(new Date()) }} components={{ Caption: CalCaption }} />
        )}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
          <span className="text-sm font-medium">End date</span>
          <Switch checked={endOn} onCheckedChange={(c) => { setEndOn(c); if (!c && value.from) onChange({ from: value.from, to: value.from }); else if (c && value.from) onChange({ from: value.from, to: undefined }); }} data-testid="veh-end-date-toggle" />
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Date + time form fields (TimeField) now live in the shared @/components/datetime-field.

// Fair company-car assignment: cover `pax` seats using the available vehicles, favouring
// (1) capacity match — least wasted seats, (2) load balance — least-booked driver/vehicle first,
// so one driver isn't overloaded while others are idle. `seedId` (a "Book Now"-targeted vehicle)
// is preferred when it can serve. Returns the ordered list of chosen vehicle ids.
function assignVehicles(available: any[], pax: number, seedId: string | undefined, loadOf: (id: string) => number, capOf: (v: any) => number): string[] {
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

// ============================ My Travel Timeline ============================
// The current user's own bookings as a chronological timeline (past · upcoming · completed),
// with a date filter (All / This Week / This Month) and a mode filter.
function MyTimeline({ bookings, isMine, search, vehicles, onOpenBooking }: any) {
  const [dateFilter, setDateFilter] = useState<"all" | "week" | "month">("all");
  const [modeFilter, setModeFilter] = useState<"all" | "company_car" | "rental_approved" | "rental_pending">("all");
  const now = new Date();
  const vehName = (id: string) => { const v = (vehicles as any[]).find((x) => x.id === id); return v?.model || v?.name || "Company Vehicle"; };

  const rows = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    const inDate = (b: any) => {
      if (dateFilter === "all") return true;
      const s = new Date(b.startTime);
      if (dateFilter === "week") return s >= startOfWeek(now, { weekStartsOn: 1 }) && s <= endOfWeek(now, { weekStartsOn: 1 });
      return s >= startOfMonth(now) && s <= endOfMonth(now);
    };
    const inMode = (b: any) => {
      if (modeFilter === "all") return true;
      if (modeFilter === "company_car") return b.bookingType === "company_car";
      if (modeFilter === "rental_approved") return b.bookingType === "rental" && b.status === "approved";
      return b.bookingType === "rental" && b.status === "pending_hr_approval";
    };
    return (bookings as any[])
      .filter((b) => isMine(b) && b.status !== "cancelled" && b.status !== "rejected")
      .filter(inDate).filter(inMode)
      .filter((b) => !q || (b.purpose || "").toLowerCase().includes(q) || (b.pickupLocation || "").toLowerCase().includes(q) || (b.dropLocation || "").toLowerCase().includes(q))
      .sort((a, b) => +new Date(b.startTime) - +new Date(a.startTime)); // newest first
  }, [bookings, isMine, search, dateFilter, modeFilter]);
  const upcoming = rows.filter((b) => new Date(b.endTime) >= now);
  const completed = rows.filter((b) => new Date(b.endTime) < now);
  // Primary-card timeline entry with a coloured dot that sits on the vertical connecting line.
  const renderCard = (b: any) => {
    const company = b.bookingType === "company_car";
    const pending = b.bookingType === "rental" && b.status === "pending_hr_approval";
    const dotCls = company ? "bg-[#0E7C7B]" : pending ? "border-2 border-[#FF6F62] bg-background" : "bg-[#FF6F62]";
    return (
      <div key={b.id} className="relative">
        {/* Dot sits on the vertical line and is vertically centred to the card */}
        <span className={`absolute -left-[22px] top-1/2 -translate-y-1/2 h-3 w-3 rounded-full ring-4 ring-background ${dotCls}`} />
        <button type="button" onClick={() => onOpenBooking && onOpenBooking(b)} data-testid={`timeline-${b.id}`}
          className="w-full text-left card-surface card-hover rounded-2xl px-3.5 py-3 flex items-center gap-3">
          {/* Identity: type icon + purpose + muted type/status (fixed width on md+ so columns line up) */}
          <span className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${company ? "bg-[#0E7C7B]/15 text-[#0E7C7B]" : "bg-[#FF6F62]/15 text-[#FF6F62]"}`}><Car className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1 pr-2">
            <p className="text-sm font-bold text-foreground truncate">{b.purpose}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{company ? "Company Car" : "Rental"}{pending ? " · Awaiting HR" : ""}</p>
          </div>
          {/* Primary divider — thicker & darker than the inner separators */}
          <div className="self-center w-[1.4px] h-11 rounded-full bg-foreground/25 flex-shrink-0 hidden md:block" />
          {/* Labelled stat columns — fixed widths, grouped & right-aligned (identity grows to push them right) */}
          <div className="hidden md:flex items-stretch gap-5 flex-shrink-0">
            <div className="w-[200px]">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[10px] leading-none uppercase tracking-wide text-muted-foreground mt-0.5">When</p>
              <p className="text-xs text-foreground mt-1 whitespace-nowrap"><span className="font-bold">{format(new Date(b.startTime), "d MMM yyyy")}</span> <span className="text-muted-foreground/50">|</span> {format(new Date(b.startTime), "h:mm a")} - {format(new Date(b.endTime), "h:mm a")}</p>
            </div>
            <Separator orientation="vertical" className="h-11 flex-shrink-0" />
            <div className="w-[140px]">
              <Car className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[10px] leading-none uppercase tracking-wide text-muted-foreground mt-0.5">Vehicle</p>
              <p className="text-xs text-foreground mt-1 truncate">{company ? vehName(b.vehicleId) : "Agency rental"}</p>
            </div>
            <Separator orientation="vertical" className="h-11 flex-shrink-0" />
            <div className="w-[140px]">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[10px] leading-none uppercase tracking-wide text-muted-foreground mt-0.5">Route</p>
              <p className="text-xs text-foreground mt-1 truncate">{b.pickupLocation || "—"} → {b.dropLocation || "—"}</p>
            </div>
          </div>
          {/* Compact meta for narrow widths (columns hidden) */}
          <div className="md:hidden flex-shrink-0 text-right ml-auto">
            <p className="text-xs font-semibold text-foreground">{format(new Date(b.startTime), "d MMM")}</p>
            <p className="text-[11px] text-muted-foreground">{format(new Date(b.startTime), "h:mm a")}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </button>
      </div>
    );
  };

  return (
    <div className="card-surface rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <p className="text-base font-semibold text-foreground inline-flex items-center gap-1.5"><Route className="h-4 w-4 text-[#0E7C7B]" /> Your Travel Timeline</p>
        <div className="flex gap-2">
          <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as any)}>
            <SelectTrigger className="w-auto h-9 text-xs gap-1.5" data-testid="timeline-date"><CalendarDays className="h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All dates</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          <Select value={modeFilter} onValueChange={(v) => setModeFilter(v as any)}>
            <SelectTrigger className="w-auto h-9 text-xs gap-1.5" data-testid="timeline-mode"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modes</SelectItem>
              <SelectItem value="company_car">Company Car</SelectItem>
              <SelectItem value="rental_approved">Rentals - Approved</SelectItem>
              <SelectItem value="rental_pending">Rentals - Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Separator className="mb-3 bg-foreground/20" />
      {/* Legend — dot colours mirror the timeline markers */}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap mb-3">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-[#0E7C7B]" /> Company Car</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-[#FF6F62]" /> Rental</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-[#FF6F62]" /> Awaiting HR Approval</span>
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20"><Car className="h-9 w-9 text-muted-foreground/40 mb-2" /><p className="text-sm text-muted-foreground">No bookings match these filters.</p></div>
      ) : (
        <ScrollArea className="h-[500px]">
          {/* Continuous vertical connecting line — each card's coloured dot sits on it */}
          <div className="relative pl-6 pr-2 py-1">
            <span className="absolute left-[7px] top-3 bottom-3 w-px bg-border" aria-hidden />
            <div className="space-y-3">
              {upcoming.length > 0 && <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pt-1 pb-0.5">Upcoming</p>}
              {upcoming.map(renderCard)}
              {completed.length > 0 && <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pt-3 pb-0.5">Completed</p>}
              {completed.map(renderCard)}
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// Rental entry shown inside the Assigned Vehicle section (agency car, coral/dashed, HR-approval).
function RentalAssignmentCard({ seatLabel, note }: { seatLabel: string; note: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[#FF6F62]/50 bg-[#FF6F62]/[0.05] p-3" data-testid="assigned-rental">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Rental Vehicle</span>
        <Badge className="text-[10px] bg-[#206295]/15 text-[#206295] flex-shrink-0">Awaiting HR approval</Badge>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-12 w-16 rounded-lg bg-[#FF6F62]/10 flex items-center justify-center border border-[#FF6F62]/30 flex-shrink-0"><Car className="h-4 w-4 text-[#FF6F62]" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Agency Rental</p>
          <p className="text-[11px] text-muted-foreground">{note}</p>
        </div>
        <Badge className="text-[10px] bg-[#FF6F62]/20 text-[#FF6F62] flex-shrink-0">{seatLabel}</Badge>
      </div>
    </div>
  );
}

// ============================ Booking Form ============================
function BookingForm({ open, onClose, prefillSlot, vehicleId: seedVehicleId, companyBookings, employees, me, myName, vehicles = [], editBooking }: any) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const eb = editBooking || null;      // when set, the form edits this booking in place
  const editing = !!eb;
  const seedStart = eb ? new Date(eb.startTime) : prefillSlot?.start;
  const seedEnd = eb ? new Date(eb.endTime) : prefillSlot?.end;
  const init = () => eb
    ? { purpose: eb.purpose || "", pickupLocation: eb.pickupLocation || "", dropLocation: eb.dropLocation || "", notes: eb.notes || "" }
    : { purpose: "", pickupLocation: "Office", dropLocation: "", notes: "" };
  const [form, setForm] = useState<any>(init);
  // Date range (End-date toggle defaults OFF → to === from) + separate start/end times (HH:mm).
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>(seedStart ? { from: startOfDay(seedStart), to: startOfDay(seedStart) } : {});
  const [startHM, setStartHM] = useState<string>(seedStart ? format(seedStart, "HH:mm") : "");
  const [endHM, setEndHM] = useState<string>(seedEnd ? format(seedEnd, "HH:mm") : "");
  const [tripType, setTripType] = useState<"intra_city" | "inter_city">(eb?.tripType === "inter_city" ? "inter_city" : "intra_city");
  const meEmpId = (employees as any[]).find((e: any) => e.userId === me)?.id;
  const [passengerIds, setPassengerIds] = useState<string[]>(() => {
    if (eb && Array.isArray(eb.attendees)) {
      const ids = eb.attendees.map((a: any) => (employees as any[]).find((e) => e.userId === a?.userId)?.id).filter(Boolean) as string[];
      if (ids.length) return ids;
    }
    return meEmpId ? [meEmpId] : [];
  });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  // When editing, the booking must not conflict with itself; seed the assignment with its own vehicle.
  const relevantCompany = eb ? (companyBookings as any[]).filter((x) => x.id !== eb.id) : (companyBookings as any[]);
  const seedVeh = eb?.vehicleId || seedVehicleId;

  const combine = (d: Date, hm: string) => { const [h, m] = hm.split(":").map(Number); const x = new Date(d); x.setHours(h, m, 0, 0); return x; };
  const endDay = dateRange.to ?? dateRange.from;
  const sameDay = !!dateRange.from && !!endDay && +startOfDay(dateRange.from) === +startOfDay(endDay);
  const start = dateRange.from && startHM ? combine(dateRange.from, startHM) : null;
  const end = endDay && endHM ? combine(endDay, endHM) : null;
  // Each day's time must sit inside the 7 AM–7 PM window.
  const inWindow = !!(start && end && floatOf(start) >= WIN_START && floatOf(end) <= WIN_END);
  const validRange = !!(start && end && start < end && inWindow);
  // Candidate block window (inter-city = whole day; intra-city = 3-hour blocks from start).
  const candBlock = useMemo(() => (validRange ? computeBlock(tripType, start!, end!) : null), [validRange, tripType, start, end]);

  // Build the attendee list from the selected employees; the requester is always included.
  const attendees = useMemo(() => {
    const emps = passengerIds.map((id) => (employees as any[]).find((e) => e.id === id)).filter(Boolean) as any[];
    const list = emps.map((e) => ({ userId: e.userId || null, name: `${e.firstName || ""} ${e.lastName || ""}`.trim() }));
    if (!list.some((a) => a.userId === me)) list.unshift({ userId: me, name: myName });
    return list;
  }, [passengerIds, employees, me, myName]);
  const pax = attendees.length;

  // ---- Company-car assignment (auto, fair; user can override per slot) ----
  const capOf = (v: any) => (v?.seatingCapacity ? Number(v.seatingCapacity) : 5);       // total seats (incl. driver)
  const paxCapOf = (v: any) => Math.max(1, capOf(v) - 1);                                // bookable passenger seats (driver excluded)
  const loadOf = (vId: string) => relevantCompany.filter((b) => b.vehicleId === vId).length;
  const vehicleFree = (vId: string) => !candBlock || !relevantCompany.some((b) => b.vehicleId === vId && overlaps(candBlock.start, candBlock.end, blockOf(b).start, blockOf(b).end));
  const availableVehicles = useMemo(() => (vehicles as any[]).filter((v) => v.status === "active" && vehicleFree(v.id)), [vehicles, candBlock, companyBookings]);
  const autoAssigned = useMemo(() => assignVehicles(availableVehicles, pax, seedVeh, loadOf, paxCapOf), [availableVehicles, pax, seedVeh]);
  const [assigned, setAssigned] = useState<string[]>([]);
  useEffect(() => { setAssigned(autoAssigned); }, [autoAssigned.join("|")]); // re-auto whenever the slot/pax/availability changes
  const assignedVehicles = assigned.map((id) => (vehicles as any[]).find((v) => v.id === id)).filter(Boolean) as any[];
  const assignedCap = assignedVehicles.reduce((s, v) => s + paxCapOf(v), 0);
  const carFree = assignedVehicles.length > 0;          // we only ever assign vehicles that are free
  const over = carFree && pax > assignedCap;            // seats still short after all company cars → rental

  const book = useMutation({
    mutationFn: (payload: any) => apiRequest("POST", "/api/vehicles/book", payload),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["/api/vehicles/bookings"] });
      const n = res.companies?.length ?? (res.company ? 1 : 0);
      const cars = `${n} company car${n > 1 ? "s" : ""}`;
      const msg = n && res.rental ? `Booked ${cars} + a rental request was sent to HR for the extra passengers.`
        : n ? `Booked ${cars} — see it on the shared calendar.`
        : "Rental car requested — awaiting HR approval.";
      toast({ title: "Done", description: msg });
      onClose();
    },
    onError: (e: any) => toast({ title: "Could not complete booking", description: e.message, variant: "destructive" }),
  });
  // Edit an existing booking in place (keeps its type/status; recomputes the block window server-side).
  const save = useMutation({
    mutationFn: (payload: any) => apiRequest("PATCH", `/api/vehicles/bookings/${eb.id}`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/vehicles/bookings"] }); toast({ title: "Trip updated" }); onClose(); },
    onError: (e: any) => toast({ title: "Couldn't update trip", description: e.message, variant: "destructive" }),
  });

  const submit = () => {
    if (!form.purpose.trim()) return toast({ title: "Add a purpose", variant: "destructive" });
    if (start && start < new Date()) return toast({ title: "That time has passed", description: "Bookings can't start in the past — pick a future date and time.", variant: "destructive" });
    if (start && end && start < end && !inWindow) return toast({ title: "Outside booking window", description: "Bookings must be within 7:00 AM – 7:00 PM on a single day.", variant: "destructive" });
    if (!validRange) return toast({ title: "Pick a valid start and end time", variant: "destructive" });
    if (editing) {
      save.mutate({
        purpose: form.purpose.trim(), startTime: toLocalInput(start!), endTime: toLocalInput(end!), tripType,
        vehicleId: eb.bookingType === "company_car" ? (assigned[0] || eb.vehicleId) : eb.vehicleId,
        pickupLocation: form.pickupLocation || null, dropLocation: form.dropLocation || null, notes: form.notes || null,
        attendees,
      });
      return;
    }
    book.mutate({
      purpose: form.purpose.trim(), startTime: toLocalInput(start!), endTime: toLocalInput(end!), tripType,
      vehicleIds: assigned, vehicleId: assigned[0] || undefined,
      pickupLocation: form.pickupLocation || null, dropLocation: form.dropLocation || null, notes: form.notes || null,
      attendees, intent: carFree ? "company_car" : "rental",
    });
  };

  const multi = assignedVehicles.length > 1;
  const primary = editing ? { label: "Save Changes", cls: "btn-primary-gradient" }
    : !validRange ? { label: "Book", cls: "btn-primary-gradient" }
    : !carFree ? { label: over ? `Request Rental for all ${pax}` : "Request Rental Car", cls: "bg-[#FF6F62] hover:bg-[#FF6F62]/90 text-white" }
    : over ? { label: multi ? "Book Cars + Request Rental" : "Book Car + Request Rental", cls: "btn-primary-gradient" }
    : { label: multi ? "Book Company Cars" : "Book Company Car", cls: "btn-primary-gradient" };

  const bannerTone = carFree && !over ? "border-[#206295]/40 bg-[#206295]/[0.06]" : "border-[#FF6F62]/40 bg-[#FF6F62]/[0.06]";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg h-[88vh] p-0 overflow-hidden gap-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-[#206295]/10 text-[#206295] flex items-center justify-center"><Car className="h-5 w-5" /></span>
            {editing ? "Edit Trip" : "Book a Car"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 pb-6 space-y-6">
            {/* ===== 1 · Trip Details ===== */}
            <FormSection n={1} title="Trip Details">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Trip Type</Label>
                  <Select value={tripType} onValueChange={(v) => setTripType(v as any)}>
                    <SelectTrigger data-testid="veh-trip-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intra_city">Intra-city (3-hour blocks)</SelectItem>
                      <SelectItem value="inter_city">Inter-city (full day)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Purpose</Label><Input value={form.purpose} onChange={(e) => set("purpose", e.target.value)} placeholder="e.g. Client meeting" data-testid="veh-purpose" /></div>
              </div>
              <div className="space-y-1.5"><Label>Date</Label><BookingDateField value={dateRange} onChange={setDateRange} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Start Time <span className="text-muted-foreground font-normal">(7 AM–7 PM)</span></Label><TimeField value={startHM} onChange={(v) => { setStartHM(v); if (sameDay && endHM && endHM <= v) setEndHM(""); }} max="18:30" placeholder="Start" slots={TIME_SLOTS} testId="veh-time" /></div>
                <div className="space-y-1.5"><Label>End Time</Label><TimeField value={endHM} onChange={setEndHM} min={sameDay ? startHM : undefined} placeholder="End" slots={TIME_SLOTS} testId="veh-time" /></div>
              </div>
              {start && end && start < end && !inWindow && (
                <p className="text-[11px] text-[#FF6F62]">Bookings must be within 7:00 AM – 7:00 PM.</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Pickup</Label><Input value={form.pickupLocation} onChange={(e) => set("pickupLocation", e.target.value)} placeholder="Office" /></div>
                <div className="space-y-1.5"><Label>Drop</Label><Input value={form.dropLocation} onChange={(e) => set("dropLocation", e.target.value)} placeholder="Destination" /></div>
              </div>
              {validRange && candBlock && (
                <div className={`rounded-xl border p-3 text-sm ${bannerTone}`}>
                  {/* Highlighted selected booking time */}
                  <div className="flex items-center gap-2 pb-2 mb-2 border-b border-border/60">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm"><CalendarDays className="h-3.5 w-3.5 text-[#206295]" /> {format(start!, "EEE, d MMM")}{!sameDay ? ` → ${format(end!, "EEE, d MMM")}` : ""}</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm"><Clock className="h-3.5 w-3.5 text-[#206295]" /> {format(start!, "h:mm a")} – {format(end!, "h:mm a")}</span>
                  </div>
                  {!carFree ? (
                    <p className="flex items-start gap-2 text-foreground leading-relaxed">
                      <AlertTriangle className="h-4 w-4 text-[#FF6F62] mt-1 flex-shrink-0" />
                      <span>
                        No company car is free {tripType === "inter_city" ? "for the full day" : "for this time"}. We'll request a{" "}
                        <span className="inline-block rounded-md bg-[#FF6F62]/20 px-1.5 py-0 leading-5 font-semibold text-[#FF6F62] whitespace-nowrap">rental{over ? ` for all ${pax}` : ""}</span> from the agency — <span className="font-semibold">needs HR approval</span>.
                      </span>
                    </p>
                  ) : over ? (
                    <p className="flex items-start gap-2 text-foreground leading-relaxed">
                      <Users className="h-4 w-4 text-[#FF6F62] mt-1 flex-shrink-0" />
                      <span>
                        <span className="font-semibold">{pax} passengers</span> exceed{" "}
                        <span className="inline-block rounded-md bg-[#206295]/10 px-1.5 py-0 leading-5 font-semibold text-[#206295] whitespace-nowrap">{assignedCap} seats · {assignedVehicles.length} company {assignedVehicles.length === 1 ? "car" : "cars"}</span>. We'll book {assignedVehicles.length === 1 ? "it" : "them"} and request a{" "}
                        <span className="inline-block rounded-md bg-[#FF6F62]/20 px-1.5 py-0 leading-5 font-semibold text-[#FF6F62] whitespace-nowrap">rental for {pax - assignedCap}</span>.
                      </span>
                    </p>
                  ) : (
                    <p className="flex items-start gap-2 text-foreground leading-relaxed">
                      <CircleCheck className="h-4 w-4 text-[#0E7C7B] mt-1 flex-shrink-0" />
                      <span>
                        <span className="font-semibold text-[#0E7C7B]">Available</span> — books {multi ? `${assignedVehicles.length} company cars` : "the company car"}{" "}
                        {tripType === "inter_city" ? (
                          <>for the <span className="inline-block rounded-md bg-[#206295]/10 px-1.5 py-0 leading-5 font-semibold text-[#206295] whitespace-nowrap">whole day · 7 AM – 7 PM</span>.</>
                        ) : (
                          <>
                            <span className="inline-block rounded-md bg-[#206295]/10 px-1.5 py-0 leading-5 font-semibold text-[#206295] whitespace-nowrap">{format(candBlock.start, "h:mm a")} – {format(candBlock.end, "h:mm a")}</span>{" "}
                            <span className="inline-block rounded-md bg-[#0E7C7B]/10 px-1.5 py-0 leading-5 font-semibold text-[#0E7C7B] whitespace-nowrap">3-hour block{(+candBlock.end - +candBlock.start) > 3 * 3600000 ? "s" : ""}</span>.
                          </>
                        )}
                      </span>
                    </p>
                  )}
                </div>
              )}
            </FormSection>

            <Separator />

            {/* ===== 2 · Passengers ===== */}
            <FormSection n={2} title="Passengers">
              <Label className="flex items-center gap-1.5 text-muted-foreground font-normal"><Users className="h-3.5 w-3.5" /> {pax} selected · you're always included</Label>
              <EmployeePicker employees={employees} selectedIds={passengerIds}
                onChange={(ids) => setPassengerIds(meEmpId ? Array.from(new Set([meEmpId, ...ids])) : ids)}
                multiple buttonLabel="Add passengers" lockedIds={meEmpId ? [meEmpId] : []} modal />
            </FormSection>

            <Separator />

            {/* ===== 3 · Assigned Vehicle ===== */}
            <FormSection n={3} title="Assigned Vehicle">
              {!validRange ? (
                <p className="text-xs text-muted-foreground">Pick a date and time to see the assigned company car.</p>
              ) : availableVehicles.length === 0 ? (
                <RentalAssignmentCard
                  seatLabel={`${pax} ${pax === 1 ? "seat" : "seats"}`}
                  note={<>No company car is free {tripType === "inter_city" ? "for the full day" : "for this slot"}, so HR will arrange a rental from the agency for your trip.</>} />
              ) : (
                <div className="space-y-3">
                  {assignedVehicles.map((v, i) => {
                    const otherPicked = assigned.filter((_, idx) => idx !== i);
                    const options = availableVehicles.filter((o) => o.id === v.id || !otherPicked.includes(o.id));
                    return (
                      <div key={i} className="rounded-xl border border-border/60 p-3" data-testid={`assigned-vehicle-${i}`}>
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{multi ? `Assigned Vehicle ${i + 1}` : "Assigned Vehicle"}</span>
                          {availableVehicles.length > 1 && (
                            <Select value={v.id} onValueChange={(nv) => setAssigned((prev) => prev.map((id, idx) => (idx === i ? nv : id)))}>
                              <SelectTrigger className="w-auto h-8 text-xs gap-1.5" data-testid={`assigned-change-${i}`}><Pencil className="h-3 w-3" /><SelectValue /></SelectTrigger>
                              <SelectContent>{options.map((o) => <SelectItem key={o.id} value={o.id}>{o.model || o.name}</SelectItem>)}</SelectContent>
                            </Select>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-16 rounded-lg bg-muted/40 overflow-hidden flex items-center justify-center border border-border/60 flex-shrink-0">
                            {v.imageUrl ? <img src={v.imageUrl} alt={v.model || v.name} className="max-h-full max-w-full object-contain" /> : <Car className="h-4 w-4 text-muted-foreground/40" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground truncate">{v.model || v.name}</p>
                            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Hash className="h-3 w-3" />{v.registrationNo || "—"}</p>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{paxCapOf(v)} seats</span>
                              <Separator orientation="vertical" className="h-3 bg-border" />
                              <span className="inline-flex items-center gap-1 truncate"><span className="h-4 w-4 rounded-full bg-[#206295]/15 text-[#206295] flex items-center justify-center text-[8px] font-semibold flex-shrink-0">{driverInitials(v.driverName)}</span>{v.driverName || "No driver"}</span>
                            </div>
                          </div>
                          <Badge className="text-[10px] bg-[#4BDCD9]/25 text-[#0E7C7B] flex-shrink-0">Available</Badge>
                        </div>
                      </div>
                    );
                  })}
                  {over && (
                    <RentalAssignmentCard
                      seatLabel={`+${pax - assignedCap} seats`}
                      note={<>Carries the {pax - assignedCap} passenger{pax - assignedCap === 1 ? "" : "s"} who won't fit in the company {assignedVehicles.length === 1 ? "car" : "cars"}. HR arranges it with the agency.</>} />
                  )}
                </div>
              )}
            </FormSection>

            <Separator />

            {/* ===== 4 · Additional Notes ===== */}
            <FormSection n={4} title="Additional Notes">
              <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything the driver / agency should know…" data-testid="veh-notes" />
            </FormSection>
          </div>
        </ScrollArea>

        {/* Sticky action footer — stays visible while the form scrolls */}
        <div className="flex-shrink-0 border-t border-border bg-background px-6 py-4 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className={primary.cls} disabled={book.isPending || save.isPending || !validRange || !form.purpose.trim()} onClick={submit} data-testid="veh-submit">{book.isPending || save.isPending ? "Working…" : primary.label}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Per-vehicle availability for the selected date: Maintenance/Unavailable (coral) · Limited Slots (amber) · Available (teal).
function vehicleAvailability(v: any, companyBookings: any[], now: Date): { label: string; cls: string; solid: string; bookable: boolean } {
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
const driverInitials = (n?: string) => (n || "").split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
const empName = (e: any) => `${e?.firstName || ""} ${e?.lastName || ""}`.trim() || e?.username || "Employee";

// ============================ Company Vehicle card — compact, expands on hover ============================
// `expanded` (used when it's the only vehicle) locks the card open — driver + Book Now always visible.
function VehicleCard({ v, av, onBook, expanded = false }: any) {
  const model = v.model || v.name || "Company Vehicle";
  const seat = v.seatingCapacity ? `${v.seatingCapacity} Seater` : "—";
  return (
    <div className="group card-surface rounded-2xl" data-testid={`vehicle-${v.id}`}>
      {/* Image window with the solid-colour status pill pinned bottom-left (absolute → never shifts other content) */}
      <div className="relative">
        <div className="h-28 w-full bg-muted/40 rounded-t-2xl overflow-hidden flex items-center justify-center border-b border-border/60">
          {v.imageUrl ? <img src={v.imageUrl} alt={model} className="max-h-full max-w-full object-contain" /> : <Car className="h-8 w-8 text-muted-foreground/40" />}
        </div>
        <span className={`absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm pointer-events-none ${av.solid}`}>{av.label}</span>
      </div>

      {/* Core details (always visible) */}
      <div className="p-3">
        <h3 className="text-sm font-bold text-foreground leading-tight truncate">{model}</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-1"><Hash className="h-3 w-3" />{v.registrationNo || "—"}</p>
        {/* Specs — always show icon + separators; '—' where a value isn't set */}
        <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Fuel className="h-3 w-3" />{v.fuelType || "—"}</span>
          <Separator orientation="vertical" className="h-3.5 bg-border" />
          <span className="inline-flex items-center gap-1"><Cog className="h-3 w-3" />{v.transmission || "—"}</span>
          <Separator orientation="vertical" className="h-3.5 bg-border" />
          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{seat}</span>
        </div>

        {/* Hover-reveal: driver + Book Now — animatable grid-rows for a smooth downward expand.
            When `expanded` (single vehicle) the reveal is locked open regardless of hover. */}
        <div className={`grid transition-all duration-300 ease-out ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 group-hover:grid-rows-[1fr] group-hover:opacity-100"}`}>
          {/* overflow-hidden powers the collapse animation; when locked open we drop it so the button shadow isn't clipped */}
          <div className={expanded ? "" : "overflow-hidden"}>
            <Separator className="mt-3 mb-2.5" />
            <div className="flex items-start gap-2.5">
              <span className="h-8 w-8 rounded-full bg-[#206295]/15 text-[#206295] flex items-center justify-center text-[11px] font-semibold flex-shrink-0 mt-0.5">{driverInitials(v.driverName)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Assigned Driver</p>
                <p className="text-xs font-medium text-foreground truncate">{v.driverName || "Unassigned"}</p>
                {v.driverPhone && <p className="text-[11px] text-muted-foreground truncate inline-flex items-center gap-1"><Phone className="h-3 w-3" />{v.driverPhone}</p>}
              </div>
            </div>
            {av.bookable && <Button className="w-full mt-2.5 h-9 btn-primary-gradient" onClick={onBook} data-testid={`book-vehicle-${v.id}`}><Plus className="h-4 w-4 mr-1.5" /> Book Now</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================ Manage Vehicles (HR) ============================
const BLANK_VEHICLE = { id: null, name: "", model: "", registrationNo: "", baseLocation: "", driverName: "", driverPhone: "", driverUserId: "", fuelType: "Electric", transmission: "", seatingCapacity: "5", status: "active", imageUrl: "" };
const manageStatusBadge = (s: string) => s === "maintenance" ? "bg-[#F59E0B]/20 text-[#B45309] dark:text-[#F59E0B]" : "bg-[#4BDCD9]/25 text-[#0E7C7B]";

// Driver picker — a blue "Secondary Button B" dropdown. Once a driver is chosen the trigger is
// replaced by their avatar + name + caret (no separate name label shown below the control).
function DriverSelect({ employees, driverUserId, driverName, onSelect }: any) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const list = (employees as any[]).filter((e) => e.firstName || e.lastName || e.username);
  const current = list.find((e) => (driverUserId && e.userId === driverUserId) || empName(e) === driverName);
  const visible = list.filter((e) => empName(e).toLowerCase().includes(search.trim().toLowerCase()));
  const pick = (e: any) => { onSelect(e); setOpen(false); setSearch(""); };
  return (
    // `modal` gives the popover its own scroll context so the mouse wheel works even though it's
    // nested inside the Manage Vehicles Dialog (whose scroll-lock would otherwise block wheel events).
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        {current ? (
          <button type="button" className="w-full flex items-center gap-2 rounded-[16px] border-[1.5px] border-[#1A4B94] bg-[#1A4B94]/[0.06] px-2.5 py-1.5 text-left" data-testid="driver-select">
            <Avatar className="h-7 w-7 flex-shrink-0"><AvatarImage src={current.avatarUrl} /><AvatarFallback className="text-[10px] bg-[#206295]/15 text-[#206295]">{driverInitials(empName(current))}</AvatarFallback></Avatar>
            <span className="text-sm font-medium text-foreground truncate flex-1">{empName(current)}</span>
            <ChevronDown className="h-4 w-4 text-[#1A4B94] flex-shrink-0" />
          </button>
        ) : (
          <button type="button" className="w-full flex items-center justify-between rounded-[16px] border-[1.5px] border-[#1A4B94] bg-[#1A4B94]/[0.06] px-3 py-2 text-sm font-medium text-[#1A4B94]" data-testid="driver-select">
            <span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Assign Driver</span>
            <ChevronDown className="h-4 w-4" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[14rem] p-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people…" className="h-8 text-xs mb-1.5" data-testid="driver-search" />
        <div className="max-h-56 overflow-y-auto space-y-0.5">
          {current && <button type="button" onClick={() => pick(null)} className="w-full text-left rounded-[12px] px-2 py-1.5 text-xs text-muted-foreground hover-elevate">Clear assignment</button>}
          {visible.length === 0 ? <p className="text-xs text-muted-foreground px-1 py-2">No matches</p> : visible.map((e) => {
            const name = empName(e); const sel = current?.id === e.id;
            return (
              <button key={e.id} type="button" onClick={() => pick(e)} className="w-full flex items-center gap-2 rounded-[12px] px-2 py-1.5 text-sm text-left hover-elevate" data-testid={`driver-opt-${e.id}`}>
                <Avatar className="h-6 w-6 flex-shrink-0"><AvatarImage src={e.avatarUrl} /><AvatarFallback className="text-[9px] bg-[#206295]/15 text-[#206295]">{driverInitials(name)}</AvatarFallback></Avatar>
                <span className="flex-1 truncate">{name}</span>
                {sel && <Check className="h-4 w-4 text-[#1A4B94] flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ManageVehicleDialog({ open, onClose, vehicles, employees }: any) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [screen, setScreen] = useState<"list" | "form">(vehicles.length ? "list" : "form");
  const [form, setForm] = useState<any>({ ...BLANK_VEHICLE });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const editing = !!form.id;

  const startAdd = () => { setForm({ ...BLANK_VEHICLE }); setScreen("form"); };
  const startEdit = (v: any) => { setForm({ id: v.id, name: v.name || "", model: v.model || "", registrationNo: v.registrationNo || "", baseLocation: v.baseLocation || "", driverName: v.driverName || "", driverPhone: v.driverPhone || "", driverUserId: v.driverUserId || "", fuelType: v.fuelType || "", transmission: v.transmission || "", seatingCapacity: v.seatingCapacity != null ? String(v.seatingCapacity) : "", status: v.status || "active", imageUrl: v.imageUrl || "" }); setScreen("form"); };
  const backToList = () => { setForm({ ...BLANK_VEHICLE }); setScreen("list"); };

  const save = useMutation({
    mutationFn: ({ id, ...rest }: any) => {
      // The Name field was removed — the model identifies the vehicle, so mirror model → name (DB name is NOT NULL).
      const body = { ...rest, name: (rest.model || rest.name || "").trim() || "Vehicle", seatingCapacity: rest.seatingCapacity ? Number(rest.seatingCapacity) : null, fuelType: rest.fuelType || null, transmission: rest.transmission || null, driverUserId: rest.driverUserId || null };
      return id ? apiRequest("PATCH", `/api/vehicles/${id}`, body) : apiRequest("POST", "/api/vehicles", body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/vehicles"] }); toast({ title: editing ? "Vehicle updated" : "Vehicle added" }); backToList(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const del = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/vehicles/${id}`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/vehicles"] }); toast({ title: "Vehicle deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const onFile = async (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast({ title: "Unsupported image", description: "Use JPG, PNG or WebP.", variant: "destructive" });
    if (file.size > 3 * 1024 * 1024) return toast({ title: "Image too large", description: "Maximum size is 3 MB.", variant: "destructive" });
    const dataUrl: string = await new Promise((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result as string); fr.onerror = reject; fr.readAsDataURL(file); });
    set("imageUrl", dataUrl);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg h-[85vh] p-0 overflow-hidden gap-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {screen === "form" && vehicles.length > 0 && (
              <button onClick={backToList} className="inline-flex items-center text-muted-foreground hover:text-foreground" data-testid="manage-back"><ArrowLeft className="h-4 w-4" /></button>
            )}
            {screen === "form" ? (editing ? "Edit Vehicle" : "Add Vehicle") : "Manage Company Vehicles"}
          </DialogTitle>
        </DialogHeader>

        {screen === "list" ? (
          <>
            {/* Vehicle cards — Edit/Delete surface on hover in the top-right corner */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-6 pb-4 space-y-3">
                {vehicles.length === 0 ? (
                  <div className="text-center py-12"><Car className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No vehicles yet.</p></div>
                ) : vehicles.map((v: any) => (
                  <div key={v.id} className="group relative card-surface rounded-xl p-3 flex items-center gap-3" data-testid={`manage-vehicle-${v.id}`}>
                    <div className="h-14 w-20 rounded-lg bg-muted/40 overflow-hidden flex items-center justify-center border border-border/60 flex-shrink-0">
                      {v.imageUrl ? <img src={v.imageUrl} alt={v.name} className="max-h-full max-w-full object-contain" /> : <Car className="h-5 w-5 text-muted-foreground/40" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{v.model || v.name}</p>
                      <p className="text-xs text-muted-foreground truncate inline-flex items-center gap-1"><Hash className="h-3 w-3" />{v.registrationNo || "—"}</p>
                      <Badge className={`text-[10px] mt-1 capitalize ${manageStatusBadge(v.status)}`}>{v.status}</Badge>
                    </div>
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(v)} className="h-7 w-7 rounded-lg bg-background border border-border flex items-center justify-center text-[#206295] hover:bg-[#206295]/10" title="Edit" data-testid={`edit-vehicle-${v.id}`}><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => { if (window.confirm(`Delete “${v.name}”? This cannot be undone.`)) del.mutate(v.id); }} disabled={del.isPending} className="h-7 w-7 rounded-lg bg-background border border-border flex items-center justify-center text-[#FF6F62] hover:bg-[#FF6F62]/10" title="Delete" data-testid={`delete-vehicle-${v.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            {/* Fixed action footer — same pattern as the reimbursement approval popup */}
            <div className="flex-shrink-0 border-t border-border bg-background px-6 py-4">
              <Button variant="secondaryB" className="w-full" style={{ borderRadius: "16px" }} onClick={startAdd} data-testid="add-vehicle"><Plus className="h-4 w-4 mr-1.5" /> Add Vehicle</Button>
            </div>
          </>
        ) : (
          <>
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-6 pb-4 space-y-3">
                {/* Image upload + preview */}
                <div className="flex items-center gap-3">
                  {form.imageUrl
                    ? <img src={form.imageUrl} alt="preview" className="h-16 w-24 rounded-lg object-cover border border-border/60" />
                    : <div className="h-16 w-24 rounded-lg bg-muted flex items-center justify-center border border-border/60"><Car className="h-5 w-5 text-muted-foreground/50" /></div>}
                  <div className="flex flex-col gap-1.5">
                    <label className="inline-flex items-center gap-1.5 text-xs text-[#206295] cursor-pointer hover:underline">
                      <Upload className="h-3.5 w-3.5" /> {form.imageUrl ? "Change photo" : "Upload photo"}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} data-testid="vehicle-image" />
                    </label>
                    {form.imageUrl && <button className="text-[11px] text-muted-foreground hover:text-[#FF6F62] text-left" onClick={() => set("imageUrl", "")}>Remove photo</button>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1 col-span-2"><Label className="text-xs">Model *</Label><Input value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="Toyota Innova Crysta" data-testid="vehicle-model" /></div>
                  <div className="space-y-1"><Label className="text-xs">Reg. No.</Label><Input value={form.registrationNo} onChange={(e) => set("registrationNo", e.target.value)} placeholder="MH-01-AB-1234" /></div>
                  <div className="space-y-1"><Label className="text-xs">Base Location</Label><Input value={form.baseLocation} onChange={(e) => set("baseLocation", e.target.value)} placeholder="HQ" /></div>
                  <div className="space-y-1"><Label className="text-xs">Seating Capacity</Label><Input type="number" min="1" value={form.seatingCapacity} onChange={(e) => set("seatingCapacity", e.target.value)} placeholder="5" data-testid="vehicle-seating" /></div>
                  <div className="space-y-1"><Label className="text-xs">Fuel Type</Label>
                    <Select value={form.fuelType} onValueChange={(v) => set("fuelType", v)}>
                      <SelectTrigger data-testid="vehicle-fuel"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{["Petrol", "Diesel", "Electric", "CNG", "Hybrid"].map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Transmission</Label>
                    <Select value={form.transmission} onValueChange={(v) => set("transmission", v)}>
                      <SelectTrigger data-testid="vehicle-transmission"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{["Manual", "Automatic"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 col-span-2"><Label className="text-xs">Assign Driver</Label>
                    <DriverSelect employees={employees} driverUserId={form.driverUserId} driverName={form.driverName}
                      onSelect={(e: any) => {
                        if (!e) { set("driverName", ""); set("driverUserId", ""); set("driverPhone", ""); return; }
                        set("driverName", empName(e));
                        set("driverUserId", e.userId || "");
                        // Auto-fetch the driver's phone from their employee record.
                        set("driverPhone", e.phone || e.personalPhone || e.contactNumber || e.mobile || "");
                      }} />
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Driver Phone</Label><Input value={form.driverPhone} onChange={(e) => set("driverPhone", e.target.value)} placeholder="+91…" /></div>
                  <div className="space-y-1"><Label className="text-xs">Status</Label>
                    <Select value={form.status} onValueChange={(v) => set("status", v)}>
                      <SelectTrigger data-testid="vehicle-status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </ScrollArea>
            <div className="flex-shrink-0 border-t border-border bg-background px-6 py-4 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={vehicles.length ? backToList : onClose}>Cancel</Button>
              <Button disabled={save.isPending || !form.model.trim()} onClick={() => save.mutate(form)} data-testid="save-vehicle">{save.isPending ? "Saving…" : editing ? "Update Vehicle" : "Add Vehicle"}</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Big booking row for the HR approval list.
// A trip starting within the next 24h is "due soon" and gets priority emphasis.
const isDueSoon = (b: any) => { const ms = +new Date(b.startTime) - Date.now(); return ms >= 0 && ms <= 24 * 3600 * 1000; };

// Rental approval request card — same primary-card style as the Travel Timeline cards, clickable → details popup.
function RentalRequestCard({ b, nameByUser, onOpen }: any) {
  const dueSoon = isDueSoon(b);
  return (
    <button type="button" onClick={() => onOpen(b)} data-testid={`rental-req-${b.id}`}
      className={`w-full text-left card-surface card-hover rounded-2xl px-4 py-3.5 flex items-center gap-4 ${dueSoon ? "ring-1 ring-[#FF6F62]/50" : ""}`}>
      <span className="h-11 w-11 rounded-xl bg-[#FF6F62]/15 text-[#FF6F62] flex items-center justify-center flex-shrink-0"><Car className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1 pr-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[15px] font-bold text-foreground truncate">{b.purpose}</span>
          <Badge className="text-[10px] bg-[#206295]/15 text-[#206295]">Awaiting HR Approval</Badge>
          {dueSoon && <Badge className="text-[10px] bg-[#FF6F62]/20 text-[#FF6F62] font-semibold inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Due Soon</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Rental</p>
      </div>
      <div className="self-center w-[1.4px] h-11 rounded-full bg-foreground/25 flex-shrink-0 hidden md:block" />
      <div className="hidden md:flex items-stretch gap-5 flex-shrink-0">
        <div className="w-[190px]">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-[10px] leading-none uppercase tracking-wide text-muted-foreground mt-0.5">When</p>
          <p className="text-xs text-foreground mt-1 whitespace-nowrap"><span className="font-bold">{format(new Date(b.startTime), "d MMM yyyy")}</span> <span className="text-muted-foreground/50">|</span> {format(new Date(b.startTime), "h:mm a")} - {format(new Date(b.endTime), "h:mm a")}</p>
        </div>
        <Separator orientation="vertical" className="h-11 flex-shrink-0" />
        <div className="w-[64px]">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-[10px] leading-none uppercase tracking-wide text-muted-foreground mt-0.5">Pax</p>
          <p className="text-xs text-foreground mt-1">{b.passengers || 1}</p>
        </div>
        <Separator orientation="vertical" className="h-11 flex-shrink-0" />
        <div className="w-[140px]">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-[10px] leading-none uppercase tracking-wide text-muted-foreground mt-0.5">Requester</p>
          <p className="text-xs text-foreground mt-1 truncate">{(b.requesterId && nameByUser[b.requesterId]) || "—"}</p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </button>
  );
}

// Compact booking item for the right-hand Upcoming list.
function MiniBooking({ b, canCancel, onCancel, onOpen }: any) {
  const v = bookingVisual(b);
  return (
    <div onClick={() => onOpen && onOpen(b)} className="rounded-xl border border-border/60 p-2.5 cursor-pointer hover-elevate" data-testid={`mini-${b.id}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${v.dot}`} />
        <span className="text-xs font-medium text-foreground truncate flex-1">{b.purpose}</span>
        {canCancel && <button onClick={(e) => { e.stopPropagation(); onCancel(); }} aria-label="Cancel"><Ban className="h-3.5 w-3.5 text-muted-foreground hover:text-[#FF6F62]" /></button>}
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">{fmtRange(b.startTime, b.endTime)}</p>
      <Badge className={`text-[10px] mt-1.5 ${statusBadgeClass(b)}`}>{statusLabel(b)}</Badge>
    </div>
  );
}

// Date-range picker + CalCaption now come from the shared @/components/date-range-picker.

// ============================ Track Usage side panel (HR) ============================
// Slide-in Sheet (same primitive as Workforce Insights). Two views inside one panel:
// the employee usage list, and — on selecting a person — their vehicle-usage timeline (with a Back button).
function TrackUsagePanel({ open, onOpenChange, employees, bookings, vehicles, departments }: any) {
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("all");
  const [sort, setSort] = useState<"most" | "least" | "name">("most");
  const [period, setPeriod] = useState<"weekly" | "monthly" | "custom">("monthly");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>(() => { const t = new Date(); return { from: t, to: t }; });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Active date window the usage counts are computed over.
  const { rangeStart, rangeEnd } = useMemo(() => {
    const t = new Date();
    if (period === "weekly") return { rangeStart: startOfWeek(t, { weekStartsOn: 1 }), rangeEnd: endOfWeek(t, { weekStartsOn: 1 }) };
    if (period === "custom") {
      const f = customRange.from ?? t, to = customRange.to ?? f;
      const lo = f <= to ? f : to, hi = f <= to ? to : f;
      return { rangeStart: startOfDay(lo), rangeEnd: endOfDay(hi) };
    }
    return { rangeStart: startOfMonth(t), rangeEnd: endOfMonth(t) };
  }, [period, customRange]);

  const vehName = (id: string) => (vehicles as any[]).find((v) => v.id === id)?.name || "Vehicle";
  const deptName = (id: string) => (departments as any[]).find((d) => d.id === id)?.name || "—";

  // Per-employee usage: every non-cancelled/rejected booking (within the selected date window)
  // where they were the requester OR a passenger.
  const usage = useMemo(() => {
    const valid = (bookings as any[]).filter((b) => {
      if (b.status === "cancelled" || b.status === "rejected") return false;
      const s = new Date(b.startTime);
      return s >= rangeStart && s <= rangeEnd;
    });
    return (employees as any[]).filter((e) => e.userId).map((e) => {
      const list = valid
        .filter((b) => b.requesterId === e.userId || (Array.isArray(b.attendees) && b.attendees.some((a: any) => a?.userId === e.userId)))
        .sort((a, b) => +new Date(b.startTime) - +new Date(a.startTime));
      return { emp: e, count: list.length, bookings: list };
    }).filter((u) => u.count > 0);
  }, [bookings, employees, rangeStart, rangeEnd]);

  // Department dropdown filters by id; the search box matches employee name OR department name.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return usage
      .filter((u) => dept === "all" || u.emp.departmentId === dept)
      .filter((u) => !q || empName(u.emp).toLowerCase().includes(q) || deptName(u.emp.departmentId).toLowerCase().includes(q))
      .sort((a, b) => sort === "name" ? empName(a.emp).localeCompare(empName(b.emp)) : sort === "least" ? a.count - b.count : b.count - a.count);
  }, [usage, dept, search, sort]);

  const selected = usage.find((u) => u.emp.id === selectedId) || null;
  const usedDeptIds = new Set(usage.map((u) => u.emp.departmentId).filter(Boolean));
  const deptOptions = (departments as any[]).filter((d) => usedDeptIds.has(d.id));
  const SORT_OPTS: { value: "most" | "least" | "name"; label: string }[] = [{ value: "most", label: "Most trips" }, { value: "least", label: "Least trips" }, { value: "name", label: "Name (A–Z)" }];
  const close = (o: boolean) => { if (!o) setSelectedId(null); onOpenChange(o); };

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col gap-0">
        {!selected ? (
          <>
            <SheetHeader className="px-6 pt-6 pb-3 flex-shrink-0">
              <SheetTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-[#206295]" /> Vehicle Usage</SheetTitle>
            </SheetHeader>
            <div className="px-6 pb-3 space-y-2 flex-shrink-0">
              {/* Line 1: search (matches name or department) fills the row */}
              <div className="relative">
                <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or department…" className="h-9 pl-8 text-sm" data-testid="usage-search" />
              </div>
              {/* Line 2: date window (left) · department + icon-only sort (right) */}
              <div className="flex items-center gap-2">
                <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
                  <SelectTrigger className="w-auto h-9 text-xs gap-1.5" data-testid="usage-period"><CalendarDays className="h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="custom">Custom Date Range</SelectItem>
                  </SelectContent>
                </Select>
                {period === "custom" && <DateRangePicker value={customRange} onChange={setCustomRange} triggerClassName="h-9" testId="usage-custom-range" />}
                <Select value={dept} onValueChange={setDept}>
                  <SelectTrigger className="w-auto h-9 text-xs gap-1.5 ml-auto" data-testid="usage-dept"><SelectValue placeholder="Department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {deptOptions.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" aria-label="Sort" data-testid="usage-sort"><ArrowUpDown className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {SORT_OPTS.map((o) => (
                      <DropdownMenuItem key={o.value} onClick={() => setSort(o.value)} className="text-sm gap-2" data-testid={`sort-${o.value}`}>
                        <Check className={`h-4 w-4 text-[#206295] ${sort === o.value ? "opacity-100" : "opacity-0"}`} /> {o.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-6 pt-1 pb-8 space-y-2">
                {filtered.length === 0 ? (
                  <div className="text-center py-16"><Car className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No usage recorded yet.</p></div>
                ) : filtered.map((u) => {
                  const name = empName(u.emp);
                  return (
                    <button key={u.emp.id} onClick={() => setSelectedId(u.emp.id)} className="w-full flex items-center gap-3 rounded-xl border border-border/60 p-3 text-left hover-elevate" data-testid={`usage-emp-${u.emp.id}`}>
                      <Avatar className="h-9 w-9 flex-shrink-0"><AvatarImage src={u.emp.avatarUrl} /><AvatarFallback className="text-xs bg-[#206295]/15 text-[#206295]">{driverInitials(name)}</AvatarFallback></Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{name}</p>
                        <p className="text-xs text-muted-foreground truncate">{deptName(u.emp.departmentId)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Badge className="bg-[#206295]/15 text-[#206295] text-xs tabular-nums">{u.count} {u.count === 1 ? "trip" : "trips"}</Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        ) : (
          <>
            <SheetHeader className="px-6 pt-6 pb-3 flex-shrink-0">
              <div className="flex items-center gap-3">
                <GlassBackButton onClick={() => setSelectedId(null)} ariaLabel="Back to list" data-testid="usage-back" />
                <Avatar className="h-10 w-10 flex-shrink-0"><AvatarImage src={selected.emp.avatarUrl} /><AvatarFallback className="text-sm bg-[#206295]/15 text-[#206295]">{driverInitials(empName(selected.emp))}</AvatarFallback></Avatar>
                <div className="min-w-0">
                  <SheetTitle className="truncate">{empName(selected.emp)}</SheetTitle>
                  <p className="text-xs text-muted-foreground">{deptName(selected.emp.departmentId)} · {selected.count} {selected.count === 1 ? "trip" : "trips"}</p>
                </div>
              </div>
            </SheetHeader>
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-6 pt-2 pb-8">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-3">Vehicle Usage Timeline</p>
                <div className="relative pl-5 space-y-4 before:absolute before:left-[4px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-border">
                  {selected.bookings.map((b: any) => (
                    <div key={b.id} className="relative" data-testid={`usage-trip-${b.id}`}>
                      <span className={`absolute -left-5 top-1 h-2.5 w-2.5 rounded-full ring-2 ring-background ${b.bookingType === "company_car" ? "bg-[#206295]" : "bg-[#FF6F62]"}`} />
                      <p className="text-sm font-medium text-foreground">{b.purpose}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-1.5"><Clock className="h-3 w-3" /> {fmtRange(b.startTime, b.endTime)}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <Badge className="text-[10px] bg-muted text-muted-foreground"><Car className="h-3 w-3 mr-1" />{vehName(b.vehicleId)}</Badge>
                        <Badge className={`text-[10px] ${statusBadgeClass(b)}`}>{statusLabel(b)}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ============================ Page ============================
export default function VehiclesPage() {
  const { data: auth } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const user = auth?.user || null;
  const me = user?.id;
  const isHrAdmin = hasRole(user, "super_admin", "hr_admin");

  const [mode, setMode] = useState<"calendar" | "requests">("calendar");
  const [view, setView] = useState<"month" | "week">("month");
  const [myTab, setMyTab] = useState<"upcoming" | "completed">("upcoming");
  const [leftView, setLeftView] = useState<"calendar" | "timeline">("calendar"); // calendar area: shared calendar vs. my travel timeline
  const [leftSearch, setLeftSearch] = useState("");
  const [detailBooking, setDetailBooking] = useState<any>(null); // booking whose details popup is open
  const [editBooking, setEditBooking] = useState<any>(null); // booking being edited in the form (null = new booking)
  const [filter, setFilter] = useState<"all" | "company" | "mine" | "rental">("all");
  const [cursor, setCursor] = useState(new Date());
  // A concrete time slot (not a whole day) — availability is always checked against this range.
  const defaultSlot = () => { const d = new Date(); return { start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0), end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 10, 0) }; };
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date }>(defaultSlot);
  const [formOpen, setFormOpen] = useState(false);
  const [prefillSlot, setPrefillSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [prefillVehicleId, setPrefillVehicleId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);

  const { data: vehicles = [] } = useQuery<any[]>({ queryKey: ["/api/vehicles"] });
  const { data: bookings = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/vehicles/bookings"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: departments = [] } = useQuery<any[]>({ queryKey: ["/api/departments"] });

  const nameByUser = useMemo(() => {
    const m: Record<string, string> = {};
    (employees as any[]).forEach((e) => { if (e.userId) m[e.userId] = `${e.firstName} ${e.lastName}`; });
    return m;
  }, [employees]);
  const myName = (me && nameByUser[me]) || (auth?.employee ? `${auth.employee.firstName} ${auth.employee.lastName}` : "You");
  const isMine = (b: any) => b.requesterId === me || (Array.isArray(b.attendees) && b.attendees.some((a: any) => a?.userId === me));

  const companyBookings = useMemo(() => (bookings as any[]).filter((b) => b.bookingType === "company_car" && b.status === "confirmed"), [bookings]);
  const activeVehicles = useMemo(() => (vehicles as any[]).filter((v) => v.status !== "retired"), [vehicles]);

  const calendarBookings = useMemo(() => (bookings as any[]).filter((b) => {
    const isCompany = b.bookingType === "company_car" && b.status === "confirmed";
    const isRentalApproved = b.bookingType === "rental" && b.status === "approved";
    const isRentalPending = b.bookingType === "rental" && b.status === "pending_hr_approval";
    if (!(isCompany || isRentalApproved || isRentalPending)) return false;
    // Rental bookings are private: only HR/Super Admin or the people on that booking see them on the shared calendar.
    if (b.bookingType === "rental" && !(isHrAdmin || isMine(b))) return false;
    if (filter === "company") return isCompany;
    if (filter === "rental") return isRentalApproved || isRentalPending;
    if (filter === "mine") return isMine(b);
    return true;
  }), [bookings, filter, me, isHrAdmin]);
  // The left-column search box also narrows what shows on the shared calendar (by purpose).
  const searchedCalendarBookings = useMemo(() => {
    const q = leftSearch.trim().toLowerCase();
    return q ? calendarBookings.filter((b) => (b.purpose || "").toLowerCase().includes(q)) : calendarBookings;
  }, [calendarBookings, leftSearch]);

  const now = new Date();
  const upcomingMine = useMemo(() => (bookings as any[])
    .filter((b) => b.status !== "cancelled" && b.status !== "rejected" && isMine(b) && new Date(b.endTime) >= now)
    .sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime)), [bookings, me]);
  const completedMine = useMemo(() => (bookings as any[])
    .filter((b) => b.status !== "cancelled" && b.status !== "rejected" && isMine(b) && new Date(b.endTime) < now)
    .sort((a, b) => +new Date(b.startTime) - +new Date(a.startTime)), [bookings, me]);
  const pendingRentals = useMemo(() => (bookings as any[]).filter((b) => b.bookingType === "rental" && b.status === "pending_hr_approval"), [bookings]);

  // ---- Availability summary metrics ----
  const isToday = (d: any) => isSameDay(new Date(d), now);
  const confirmedToday = companyBookings.filter((b) => isToday(b.startTime)).length;
  // Free 3-hour blocks across the current week (7AM–7PM = four blocks/day), minus blocks hit by company bookings.
  const slotsThisWeek = useMemo(() => {
    const days = eachDayOfInterval({ start: startOfWeek(cursor), end: endOfWeek(cursor) });
    let free = 0;
    for (const d of days) {
      for (let h = WIN_START; h < WIN_END; h += BLOCK) {
        const cs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0);
        const ce = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.min(h + BLOCK, WIN_END), 0);
        const hit = companyBookings.some((b) => { const w = blockOf(b); return w.start < ce && cs < w.end; });
        if (!hit) free++;
      }
    }
    return free;
  }, [cursor, companyBookings]);
  const rentalAvailable = true; // agency tie-up is always "available on request"

  // ---- Selected-slot summary (block-window overlap, NOT "any booking on the day") ----
  const selDayBlocks = companyBookings
    .filter((b) => dayCovers(selectedSlot.start, b))
    .sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime));
  const selSlotFree = !companyBookings.some((b) => { const w = blockOf(b); return overlaps(selectedSlot.start, selectedSlot.end, w.start, w.end); });

  const cancelBooking = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/vehicles/bookings/${id}/cancel`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/vehicles/bookings"] }); toast({ title: "Booking cancelled" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const decideRental = useMutation({
    mutationFn: ({ id, action, note }: any) => apiRequest("POST", `/api/vehicles/rentals/${id}/${action}`, note ? { note } : {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/vehicles/bookings"] }); toast({ title: "Updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const optOut = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/vehicles/bookings/${id}/opt-out`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/vehicles/bookings"] }); toast({ title: "You've opted out of this trip" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ---- Booking-details popup actions ----
  const detailCancel = (b: any) => { if (window.confirm("Cancel this trip?")) { cancelBooking.mutate(b.id); setDetailBooking(null); } };
  const detailOptOut = (b: any) => { if (window.confirm("Opt out of this trip? You'll be removed from the passenger list.")) { optOut.mutate(b.id); setDetailBooking(null); } };
  const detailEdit = (b: any) => { setDetailBooking(null); setPrefillSlot(null); setPrefillVehicleId(null); setEditBooking(b); setFormOpen(true); };
  const detailApprove = (b: any, note: string) => { decideRental.mutate({ id: b.id, action: "approve", note }); setDetailBooking(null); };
  const detailReject = (b: any, note: string) => { decideRental.mutate({ id: b.id, action: "reject", note }); setDetailBooking(null); };
  const detailViewInCalendar = (b: any) => {
    const s = new Date(b.startTime);
    setLeftView("calendar"); setView("month"); setCursor(s);
    setSelectedSlot({ start: s, end: new Date(b.endTime) });
    setDetailBooking(null);
  };

  const openForm = (slot: { start: Date; end: Date } | null, vehicleId: string | null = null) => { setPrefillSlot(slot); setPrefillVehicleId(vehicleId); setFormOpen(true); };
  // "Book Now" on a card → open the form targeting that specific vehicle, pre-filled with the selected slot.
  const onBookVehicle = (v: any) => openForm(selectedSlot, v.id);
  // Month day click → select that day's default 9–10 slot AND open the booking form pre-filled.
  const onMonthDay = (day: Date) => { const slot = { start: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0), end: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 10, 0) }; setSelectedSlot(slot); openForm(slot); };
  // Week hour cell click → select that exact hour AND open the booking form pre-filled.
  const onWeekSlot = (start: Date, end: Date) => { setSelectedSlot({ start, end }); openForm({ start, end }); };
  const canCancel = (b: any) => (b.requesterId === me || isHrAdmin) && b.status !== "cancelled" && b.status !== "rejected" && new Date(b.endTime) >= now;

  // Overview stat: line 1 = icon + heading, line 2 = big number + small text (or a status badge).
  const OverviewStat = ({ icon: Icon, heading, value, sub, badge, valueClass = "text-foreground" }: any) => (
    <div className="flex-1 min-w-[130px]">
      <div className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-4 w-4" /><span className="text-[11px] uppercase tracking-wide font-medium">{heading}</span></div>
      {badge ? (
        <div className="mt-1.5">{badge}</div>
      ) : (
        <p className="mt-1 flex items-baseline gap-1.5"><span className={`text-2xl font-bold tracking-tight tabular-nums ${valueClass}`}>{value}</span><span className="text-xs text-muted-foreground">{sub}</span></p>
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-5 max-w-[92rem] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-xl bg-[#206295]/10 text-[#206295] flex items-center justify-center"><Car className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Vehicles</h1>
            <p className="text-sm text-muted-foreground">Book the company car directly, or request a rental</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isHrAdmin && (
            <>
              <div className="segmented-toggle inline-flex p-0.5 h-10">
                <button onClick={() => setMode("calendar")} className={`px-3 h-full rounded-[10px] text-xs font-medium ${mode === "calendar" ? "btn-primary-gradient text-white" : "text-foreground/70"}`} data-testid="mode-calendar">Manage Bookings</button>
                <button onClick={() => setMode("requests")} className={`px-3 h-full rounded-[10px] text-xs font-medium ${mode === "requests" ? "btn-primary-gradient text-white" : "text-foreground/70"}`} data-testid="mode-requests">Rental Requests{pendingRentals.length ? ` (${pendingRentals.length})` : ""}</button>
              </div>
              {/* Divider between the primary mode toggle and the secondary action buttons */}
              <Separator orientation="vertical" className="h-8 self-center bg-border mx-1" />
              <Button variant="outline" size="sm" className="h-10" onClick={() => setUsageOpen(true)} data-testid="track-usage"><BarChart3 className="h-4 w-4 mr-1.5" /> Track Usage</Button>
              <Button variant="outline" size="sm" className="h-10" onClick={() => setManageOpen(true)} data-testid="manage-vehicle"><Settings className="h-4 w-4 mr-1.5" /> Manage Vehicles</Button>
            </>
          )}
        </div>
      </div>

      {/* ===== Calendar mode: 75:25 ===== */}
      {mode === "calendar" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 lg:items-stretch">
          {/* Left 75% — stats (same width as calendar) then the calendar */}
          <div className="lg:col-span-3 space-y-5">
            <Card className="border-0">
              <CardContent className="p-4 flex items-stretch gap-4">
                <OverviewStat icon={Car} heading="Company Vehicles" value={activeVehicles.length} sub="total" valueClass="text-[#206295]" />
                <Separator orientation="vertical" className="h-12 self-center bg-foreground/25" />
                <OverviewStat icon={CircleCheck} heading="Confirmed" value={confirmedToday} sub="today" />
                <Separator orientation="vertical" className="h-12 self-center bg-foreground/25" />
                <OverviewStat icon={Clock} heading="Slots Available" value={slotsThisWeek} sub="this week" valueClass="text-[#0E7C7B]" />
                <Separator orientation="vertical" className="h-12 self-center bg-foreground/25" />
                <OverviewStat icon={ShieldCheck} heading="Rental Backup"
                  badge={<Badge className={rentalAvailable ? "bg-[#4BDCD9]/25 text-[#0E7C7B]" : "bg-[#64748B]/15 text-[#64748B]"}>{rentalAvailable ? "Available on request" : "Unavailable"}</Badge>} />
              </CardContent>
            </Card>
            {/* Calendar-area controls: switch between the shared Calendar and the user's travel timeline, plus search */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="segmented-toggle inline-flex p-0.5 h-10">
                <button onClick={() => setLeftView("calendar")} className={`px-3 h-full rounded-[10px] text-xs font-medium inline-flex items-center gap-1.5 ${leftView === "calendar" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`} data-testid="left-calendar"><CalendarDays className="h-3.5 w-3.5" /> Calendar</button>
                <button onClick={() => setLeftView("timeline")} className={`px-3 h-full rounded-[10px] text-xs font-medium inline-flex items-center gap-1.5 ${leftView === "timeline" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`} data-testid="left-timeline"><Route className="h-3.5 w-3.5" /> My Bookings</button>
              </div>
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input value={leftSearch} onChange={(e) => setLeftSearch(e.target.value)} placeholder={leftView === "timeline" ? "Search your bookings…" : "Search bookings on the calendar…"} className="h-10 pl-8 text-sm" data-testid="left-search" />
              </div>
            </div>
            {isLoading ? <Skeleton className="h-[560px] w-full rounded-2xl" /> :
              leftView === "calendar" ? (
                <BookingCalendar view={view} setView={setView} cursor={cursor} setCursor={setCursor}
                  bookings={searchedCalendarBookings} selectedSlot={selectedSlot} onMonthDay={onMonthDay} onWeekSlot={onWeekSlot}
                  filter={filter} setFilter={setFilter} isMine={isMine} onOpenBooking={setDetailBooking} />
              ) : (
                <MyTimeline bookings={bookings} isMine={isMine} search={leftSearch} vehicles={vehicles} onOpenBooking={setDetailBooking} />
              )}

            {/* How booking works — 4 colourful steps, divided by thin vertical lines */}
            <div className="card-surface rounded-2xl p-4">
              <p className="text-base font-semibold text-foreground mb-3 inline-flex items-center gap-1.5"><Info className="h-4 w-4 text-[#206295]" /> How Booking Works</p>
              <div className="flex items-stretch gap-5 flex-wrap sm:flex-nowrap">
                {[
                  { icon: Clock, ic: "bg-[#206295]/10 text-[#206295]", title: "Select a Time Slot",
                    body: <span>Choose any available slot from the calendar.</span> },
                  { icon: MapPin, ic: "bg-[#4BDCD9]/25 text-[#0E7C7B]", title: "Select Trip Type",
                    body: <><span className="block">Intra-city → 3-hour slot</span><span className="block">Inter-city → Full-day booking</span></> },
                  { icon: Car, ic: "bg-[#FF6F62]/10 text-[#FF6F62]", title: "Instant Booking or Rental",
                    body: <><span className="flex items-center gap-1"><CircleCheck className="h-3 w-3 text-[#0E7C7B] flex-shrink-0" /> Car available → Book instantly</span><span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-[#FF6F62] flex-shrink-0" /> Car busy → Request rental</span></> },
                  { icon: CircleCheck, ic: "bg-[#425B8D]/10 text-[#425B8D]", title: "Travel & Cancel",
                    body: <span>View your bookings anytime and cancel before the trip starts.</span> },
                ].map((s, i) => (
                  <Fragment key={i}>
                    {i > 0 && <Separator orientation="vertical" className="h-auto self-stretch bg-border hidden sm:block" />}
                    {/* Icon sits ABOVE the heading for more breathing room; box fill = a light tint of its icon colour */}
                    <div className="flex-1 min-w-[150px]">
                      <span className={`h-10 w-10 rounded-xl flex items-center justify-center ${s.ic}`}><s.icon className="h-5 w-5" /></span>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground mt-3">{s.title}</p>
                      <div className="text-xs text-foreground mt-1 leading-relaxed space-y-0.5">{s.body}</div>
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Right 25% — selected slot · my bookings (fills) · company vehicles.
              At lg the inner stack is absolutely positioned so its content NEVER drives the grid row
              height — the row is sized purely by the LEFT column, and this wrapper is stretched to match
              it (items-stretch). Result: the right column is EXACTLY the left column's height; My Bookings
              (flex-1) fills and Company Vehicles scrolls to fit, instead of the right elongating the row. */}
          <div className="lg:col-span-1 lg:relative lg:min-h-0">
            <div className="flex flex-col gap-4 lg:absolute lg:inset-0">
            {/* Booking Summary bento for the selected time slot */}
            <div className="card-surface rounded-2xl p-4 flex-shrink-0">
              <p className="text-base font-semibold text-foreground">Selected Slot</p>
              <p className="text-sm font-medium text-foreground mt-1.5">{format(selectedSlot.start, "EEE, d MMM yyyy")}</p>
              <p className="text-sm text-muted-foreground">{format(selectedSlot.start, "h:mm a")} – {format(selectedSlot.end, "h:mm a")}</p>
              <div className={`mt-3 rounded-xl border p-3 ${selSlotFree ? "border-[#0E7C7B]/40 bg-[#0E7C7B]/[0.06]" : "border-[#FF6F62]/40 bg-[#FF6F62]/[0.06]"}`}>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  {selSlotFree ? <><CircleCheck className="h-4 w-4 text-[#0E7C7B]" /> Company car available</> : <><AlertTriangle className="h-4 w-4 text-[#FF6F62]" /> Booked for this time</>}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{selSlotFree ? "This time slot is free — book the company car directly." : "This exact time overlaps a booking. Pick another time or request a rental."}</p>
              </div>
              {/* Day context — bookings block only their window, so show exactly when it's busy/blocked. */}
              {selDayBlocks.length > 0 && (
                <div className="mt-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Busy / blocked on this day</p>
                  <div className="space-y-1">
                    {selDayBlocks.map((b: any) => {
                      const w = blockOf(b);
                      return (
                        <div key={b.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#206295] flex-shrink-0" />
                          {format(new Date(b.startTime), "h:mm a")}–{format(new Date(b.endTime), "h:mm a")}
                          {(+w.end !== +new Date(b.endTime)) && <span className="text-muted-foreground/70">(blocked to {format(w.end, "h:mm a")})</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <Button className={`w-full mt-3 ${selSlotFree ? "btn-primary-gradient" : "bg-[#FF6F62] hover:bg-[#FF6F62]/90 text-white"}`} onClick={() => openForm(selectedSlot)} data-testid="book-selected">
                <Plus className="h-4 w-4 mr-1.5" /> {selSlotFree ? "Book Company Car" : "Request Rental"}
              </Button>
            </div>

            {/* My Bookings — grows to fill the column so its bottom aligns with the left column; Upcoming / Completed toggle */}
            {(() => {
              const rows = myTab === "upcoming" ? upcomingMine : completedMine;
              return (
                <div className="card-surface rounded-2xl p-4 flex flex-col min-h-0 h-[18rem] lg:h-auto lg:flex-1">
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <p className="text-base font-semibold text-foreground">My Bookings</p>
                    <div className="segmented-toggle inline-flex p-0.5 h-8">
                      <button onClick={() => setMyTab("upcoming")} className={`px-2.5 h-full rounded-[9px] text-[11px] font-medium ${myTab === "upcoming" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`} data-testid="my-upcoming">Upcoming</button>
                      <button onClick={() => setMyTab("completed")} className={`px-2.5 h-full rounded-[9px] text-[11px] font-medium ${myTab === "completed" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`} data-testid="my-completed">Completed</button>
                    </div>
                  </div>
                  {isLoading ? <Skeleton className="h-20 w-full" /> :
                    rows.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center py-6"><Car className="h-8 w-8 text-muted-foreground/40 mb-2" /><p className="text-xs text-muted-foreground">No {myTab} bookings.</p></div>
                    ) : (
                      <ScrollArea className="flex-1 min-h-0">
                        <div className="space-y-2 pr-2">
                          {rows.map((b) => (
                            <MiniBooking key={b.id} b={b} canCancel={canCancel(b)} onOpen={setDetailBooking}
                              onCancel={() => { if (window.confirm("Cancel this booking?")) cancelBooking.mutate(b.id); }} />
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                </div>
              );
            })()}

            {/* Company Vehicles. Single vehicle → natural height, no scroll. 2+ → capped ~1.85 cards, scrolls. */}
            {(() => {
              const list = vehicles as any[];
              const single = list.length === 1;
              return (
                <div className={`card-surface rounded-2xl p-4 flex flex-col ${single ? "flex-shrink-0" : "min-h-0"}`} style={single ? undefined : { flex: "0 1 25rem" }}>
                  <p className="text-base font-semibold text-foreground mb-2.5 flex-shrink-0">Company Vehicles</p>
                  {list.length === 0 ? (
                    <div className="text-center py-8"><Car className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-xs text-muted-foreground">No vehicles yet{isHrAdmin ? " — add one via “Manage Vehicles”." : "."}</p></div>
                  ) : single ? (
                    // One vehicle: no height restriction / scroll — let the full card expand naturally.
                    <VehicleCard v={list[0]} av={vehicleAvailability(list[0], companyBookings, selectedSlot.start)} onBook={() => onBookVehicle(list[0])} expanded />
                  ) : (
                    // Fixed-height scroll window. -mx-4 puts the scrollbar at the card edge; the inner px-4/py-3
                    // insets the cards from the clip boundary so their shadows have room and aren't cropped.
                    <ScrollArea className="flex-1 min-h-0 -mx-4">
                      <div className="space-y-3 px-4 py-3">
                        {list.map((v) => <VehicleCard key={v.id} v={v} av={vehicleAvailability(v, companyBookings, selectedSlot.start)} onBook={() => onBookVehicle(v)} expanded={false} />)}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              );
            })()}
            </div>
          </div>
        </div>
      )}

      {/* ===== Rental Requests mode (HR) ===== */}
      {mode === "requests" && isHrAdmin && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-[#206295]" /> Rental Requests — Awaiting Approval</h2>
          {isLoading ? <Skeleton className="h-24 w-full" /> :
            pendingRentals.length === 0 ? (
              <div className="card-surface rounded-2xl py-16 text-center"><CircleDashed className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No rental requests awaiting your approval.</p></div>
            ) : [...pendingRentals].sort((a, b) => Number(isDueSoon(b)) - Number(isDueSoon(a)) || +new Date(a.startTime) - +new Date(b.startTime)).map((b) => (
              <RentalRequestCard key={b.id} b={b} nameByUser={nameByUser} onOpen={setDetailBooking} />
            ))}
        </div>
      )}

      {formOpen && <BookingForm open={formOpen} onClose={() => { setFormOpen(false); setEditBooking(null); }} prefillSlot={prefillSlot} vehicleId={prefillVehicleId} editBooking={editBooking} companyBookings={companyBookings} employees={employees} me={me} myName={myName} vehicles={vehicles} />}
      {manageOpen && <ManageVehicleDialog open={manageOpen} onClose={() => setManageOpen(false)} vehicles={vehicles} employees={employees} />}
      {isHrAdmin && <TrackUsagePanel open={usageOpen} onOpenChange={setUsageOpen} employees={employees} bookings={bookings} vehicles={vehicles} departments={departments} />}
      {detailBooking && <BookingDetailsDialog booking={detailBooking} vehicles={vehicles} nameByUser={nameByUser} me={me} isHrAdmin={isHrAdmin} onClose={() => setDetailBooking(null)} onCancel={detailCancel} onEdit={detailEdit} onOptOut={detailOptOut} onViewInCalendar={detailViewInCalendar} onApprove={detailApprove} onReject={detailReject} />}
    </div>
  );
}
