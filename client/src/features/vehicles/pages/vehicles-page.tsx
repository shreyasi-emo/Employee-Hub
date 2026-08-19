import { useState, useMemo, useEffect, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth, hasRole } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GlassBackButton } from "@/components/shared/glass-back-button";
import { useToast } from "@/hooks/use-toast";
import {
  Car, Plus, Users, User, Check, X, ChevronLeft, ChevronRight, ChevronDown, MapPin,
  Clock, ShieldCheck, Settings, Ban, CircleDashed, CircleCheck, AlertTriangle, Info,
  Hash, Phone, Pencil, Fuel, Cog, Trash2, Search, ArrowLeft, BarChart3, ArrowUpDown,
  CalendarDays, Route,
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, addMonths, subMonths, addDays, startOfDay, endOfDay,
} from "date-fns";
import {
  WIN_START, WIN_END, BLOCK, overlaps, blockOf, computeBlock, dayCovers,
  toLocalInput, fmtRange, vehicleAvailability, isDueSoon,
} from "../lib/booking-engine";
import {
  bookingVisual, statusLabel, statusBadgeClass, avatarTint, driverInitials, empName,
} from "../lib/booking-visuals";
import { HeroMetric, DetailField, SectionCard, PersonChip, PassengerChips, MiniBooking } from "../components/vehicle-ui";
import { BookingDetailsDialog } from "../components/booking-details-dialog";
import { BookingCalendar } from "../components/booking-calendar";
import { BookingForm } from "../components/booking-form";
import { VehicleCard } from "../components/vehicle-card";
import { ManageVehicleDialog } from "../components/manage-vehicle-dialog";
import { MyTimeline } from "../components/my-timeline";
import { RentalRequestCard } from "../components/rental-request-card";
import { TrackUsagePanel } from "../components/track-usage-panel";
import { VehiclesHeader } from "../components/vehicles-header";
import { VehiclesOverviewStats } from "../components/vehicles-overview-stats";
import { RentalRequestsList } from "../components/rental-requests-list";
import {
  useVehicles, useVehicleBookings, useCancelBooking, useRentalDecision, useOptOutOfBooking,
} from "../api/vehicles.api";

// ============================ Page ============================
export default function VehiclesPage() {
  const { data: auth } = useAuth();
  const { toast } = useToast();
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

  const { data: vehicles = [] } = useVehicles();
  const { data: bookings = [], isLoading } = useVehicleBookings();
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

  const onMutationError = (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" });
  const cancelBooking = useCancelBooking({ onSuccess: () => toast({ title: "Booking cancelled" }), onError: onMutationError });
  const decideRental = useRentalDecision({ onSuccess: () => toast({ title: "Updated" }), onError: onMutationError });
  const optOut = useOptOutOfBooking({ onSuccess: () => toast({ title: "You've opted out of this trip" }), onError: onMutationError });

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


  return (
    <div className="p-6 space-y-5 max-w-[92rem] mx-auto">
      <VehiclesHeader
        isHrAdmin={isHrAdmin}
        mode={mode} onMode={setMode}
        pendingRentalCount={pendingRentals.length}
        onTrackUsage={() => setUsageOpen(true)}
        onManageVehicles={() => setManageOpen(true)}
      />

      {/* ===== Calendar mode: 75:25 ===== */}
      {mode === "calendar" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 lg:items-stretch">
          {/* Left 75% — stats (same width as calendar) then the calendar */}
          <div className="lg:col-span-3 space-y-5">
            <VehiclesOverviewStats
              vehicleCount={activeVehicles.length}
              confirmedToday={confirmedToday}
              slotsThisWeek={slotsThisWeek}
              rentalAvailable={rentalAvailable}
            />
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
        <RentalRequestsList
          pendingRentals={pendingRentals}
          isLoading={isLoading}
          nameByUser={nameByUser}
          onOpen={setDetailBooking}
        />
      )}

      {formOpen && <BookingForm open={formOpen} onClose={() => { setFormOpen(false); setEditBooking(null); }} prefillSlot={prefillSlot} vehicleId={prefillVehicleId} editBooking={editBooking} companyBookings={companyBookings} employees={employees} me={me} myName={myName} vehicles={vehicles} />}
      {manageOpen && <ManageVehicleDialog open={manageOpen} onClose={() => setManageOpen(false)} vehicles={vehicles} employees={employees} />}
      {isHrAdmin && <TrackUsagePanel open={usageOpen} onOpenChange={setUsageOpen} employees={employees} bookings={bookings} vehicles={vehicles} departments={departments} />}
      {detailBooking && <BookingDetailsDialog booking={detailBooking} vehicles={vehicles} nameByUser={nameByUser} me={me} isHrAdmin={isHrAdmin} onClose={() => setDetailBooking(null)} onCancel={detailCancel} onEdit={detailEdit} onOptOut={detailOptOut} onViewInCalendar={detailViewInCalendar} onApprove={detailApprove} onReject={detailReject} />}
    </div>
  );
}
