import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Car, Users, User, ChevronLeft, ChevronRight, MapPin, Clock, CalendarDays,
  Route, ArrowUpDown, CircleCheck, CircleDashed, Ban,
} from "lucide-react";
import { format, isSameDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { blockOf, fmtRange } from "../lib/booking-engine";
import { bookingVisual, statusLabel, statusBadgeClass, avatarTint, driverInitials } from "../lib/booking-visuals";

// ============================ My Travel Timeline ============================
// The current user's own bookings as a chronological timeline (past · upcoming · completed),
// with a date filter (All / This Week / This Month) and a mode filter.
export function MyTimeline({ bookings, isMine, search, vehicles, onOpenBooking }: any) {
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
