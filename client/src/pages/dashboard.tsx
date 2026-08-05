import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth, isHR, isFinance, isManager, getRoleLabel, getRoleBadgeColor } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/datetime-field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users, Clock, Plane, DollarSign, TrendingUp, Calendar,
  CheckCircle2, XCircle, AlertCircle, ArrowRight, Megaphone,
  Building2, UserCheck, ClipboardList, ShoppingCart, Car, Plus,
  ChevronLeft, ChevronRight, CalendarDays, Check, X, Pencil, Trash2, UserPlus,
  Route, Home, Hash, Briefcase, Mail, Search, Bell,
} from "lucide-react";
import { Calendar as CalendarWidget } from "@/components/ui/calendar";
import { useNavigation } from "react-day-picker";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format } from "date-fns";

interface Stats {
  totalEmployees: number;
  pendingLeaves: number;
  pendingRegularizations: number;
  presentToday: number;
}

// ===== Design system (dashboard) =====
// Note: the page background gradient is applied globally on the app shell (see App.tsx).

// Shared card styling: 20px radius + exact layered background + box-shadow from the reference.
const CARD_STYLE: React.CSSProperties = {
  borderRadius: 20,
  // Glassmorphism — same layered semi-transparent background as the header bar
  background:
    "linear-gradient(rgba(255,255,255,0.10), rgba(255,255,255,0.10)), rgba(255,255,255,0.50)",
  backgroundBlendMode: "overlay",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  // Unified glass shadow — matches the header bar
  boxShadow:
    "0 0 8px rgba(44,62,98,0.15), inset 2px 2px 2px -2px #fff, inset -2px -2px 2px -2px #fff, 0 8px 12px rgba(0,0,0,0.08)",
};

// Simple "< June 2026 >" month navigation for the dashboard calendar
function CalCaption({ displayMonth }: { displayMonth: Date }) {
  const { goToMonth, nextMonth, previousMonth } = useNavigation();
  return (
    <div className="flex items-center justify-center gap-3 pt-0.5 pb-1">
      <button
        type="button"
        disabled={!previousMonth}
        onClick={() => previousMonth && goToMonth(previousMonth)}
        className="p-1 rounded-md hover-elevate disabled:opacity-30"
        aria-label="Previous month"
        data-testid="button-cal-prev"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm font-semibold min-w-[8.5rem] text-center">
        {format(displayMonth, "MMMM yyyy")}
      </span>
      <button
        type="button"
        disabled={!nextMonth}
        onClick={() => nextMonth && goToMonth(nextMonth)}
        className="p-1 rounded-md hover-elevate disabled:opacity-30"
        aria-label="Next month"
        data-testid="button-cal-next"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// Fluid full-width calendar grid (merged over the Calendar component's defaults)
const calClassNames = {
  months: "w-full h-full",
  month: "w-full h-full flex flex-col",
  table: "w-full flex-1 flex flex-col",
  head_row: "flex w-full",
  head_cell: "text-muted-foreground flex-1 font-normal text-[0.75rem]",
  tbody: "flex-1 flex flex-col",
  row: "flex w-full flex-1",
  cell: "flex-1 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
  day: "inline-flex items-center justify-center h-full w-full p-0 font-normal rounded-[12px] hover-elevate aria-selected:opacity-100",
};

function StatCard({ title, value, icon: Icon, subtitle, color, href }: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  subtitle?: string;
  color: string;
  href?: string;
}) {
  return (
    <Card className="card-hover border-0" style={CARD_STYLE}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1">
            {/* Label = 14px (text-sm); number = 33px */}
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-[33px] leading-tight font-bold text-foreground">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`p-2.5 rounded-lg ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {href && (
          <a href={href} className="mt-3 flex items-center gap-1 text-xs text-primary font-medium">
            View details <ArrowRight className="h-3 w-3" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}

function AnnouncementCard({ announcement }: { announcement: any }) {
  return (
    <div className="flex gap-3 py-3">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Megaphone className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-foreground leading-snug">{announcement.title}</h3>
          {announcement.category && (
            <Badge variant="secondary" className="text-xs capitalize">{announcement.category}</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{announcement.content}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {format(new Date(announcement.createdAt), "MMM d, yyyy")}
        </p>
      </div>
    </div>
  );
}

function LeaveRequestCard({ request, employees, leaveTypes }: { request: any; employees: any[]; leaveTypes: any[] }) {
  const emp = employees.find(e => e.id === request.employeeId);
  const lt = leaveTypes.find(l => l.id === request.leaveTypeId);
  const initials = emp ? `${emp.firstName[0]}${emp.lastName[0]}` : "?";

  const statusIcon = request.status === "pending"
    ? <AlertCircle className="h-4 w-4 text-muted-foreground" />
    : request.status === "approved"
    ? <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
    : <XCircle className="h-4 w-4 text-[#FF6F62]" />;

  return (
    <div className="flex items-center gap-3 py-2.5">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {emp ? `${emp.firstName} ${emp.lastName}` : "Unknown"}
        </p>
        <p className="text-xs text-muted-foreground">
          {lt?.name} · {format(new Date(request.startDate), "MMM d")}
          {request.startDate !== request.endDate && ` - ${format(new Date(request.endDate), "MMM d")}`}
          · {request.totalDays}d
        </p>
      </div>
      <div className="flex items-center gap-1">
        {statusIcon}
        <span className="text-xs capitalize text-muted-foreground">{request.status}</span>
      </div>
    </div>
  );
}

function ServiceRequestRow({ icon: Icon, label, count, href, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  href: string;
  color: string;
}) {
  return (
    <a
      href={href}
      className="block flex-1"
      data-testid={`service-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <Card className="border-0 h-full card-hover" style={CARD_STYLE}>
        <CardContent className="h-full p-4 flex items-center gap-4">
          <div className={`p-3 rounded-xl flex-shrink-0 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <p className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">{label}</p>
          <span className="text-[33px] leading-tight font-bold text-foreground">{count}</span>
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        </CardContent>
      </Card>
    </a>
  );
}

// Client-side events (no backend events API yet) persisted to localStorage
const EVENTS_KEY = "emo_dashboard_events";
interface DashEvent {
  id: number;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  time?: string;
  attendees?: string[]; // employee names
}
function loadEvents(): DashEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    return raw ? (JSON.parse(raw) as DashEvent[]) : [];
  } catch {
    return [];
  }
}

const HOLIDAY_COLOR = "#FF6F62";
// My-Attendance donut colours (aligned with the Attendance page's state palette).
const ATT_COLORS: Record<string, string> = {
  present: "#206295", wfh: "#0E7C7B", on_duty: "#4A90C2", half_day: "#6A7366", leave: "#953229", absent: "#FF6F62",
};
// Per-name attendee palette so different people get teal / grey / coral DPs & chips
const NAME_PALETTE = [
  { avatar: "rgba(75, 220, 217, 0.35)", text: "#1F8F8C", chip: "rgba(75, 220, 217, 0.15)" },   // teal (#4BDCD9)
  { avatar: "rgba(125, 133, 142, 0.32)", text: "#566069", chip: "rgba(125, 133, 142, 0.14)" }, // grey
  { avatar: "rgba(255, 111, 98, 0.32)", text: "#C24A3E", chip: "rgba(255, 111, 98, 0.14)" },   // coral (#FF6F62)
];
function nameColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h += name.charCodeAt(i);
  return NAME_PALETTE[h % NAME_PALETTE.length];
}

function CalendarCard({ holidayDates, upcomingHolidays, employees, readOnly = false, bookingDates = [], upcomingBookings = [] }: {
  holidayDates: Date[];
  upcomingHolidays: any[];
  employees: any[];
  readOnly?: boolean;
  bookingDates?: Date[];
  upcomingBookings?: any[];
}) {
  const blankForm = { title: "", description: "", date: "", time: "", attendees: [] as string[] };
  const [events, setEvents] = useState<DashEvent[]>(() => loadEvents());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<"view" | "form">("view");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detail, setDetail] = useState<DashEvent | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [attendeeSearch, setAttendeeSearch] = useState("");

  const employeeNames: string[] = employees.map((e: any) => `${e.firstName} ${e.lastName}`);
  const empByName = new Map<string, any>(employees.map((e: any) => [`${e.firstName} ${e.lastName}`, e]));
  const initials = (name: string) => name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const visibleAttendees = employeeNames.filter((n) => n.toLowerCase().includes(attendeeSearch.trim().toLowerCase()));

  const eventDates = events.map((e) => new Date(e.date));
  const upcomingEvents = events
    .filter((e) => e.date && new Date(e.date) >= new Date(new Date().toDateString()))
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));

  function persist(next: DashEvent[]) {
    setEvents(next);
    try { localStorage.setItem(EVENTS_KEY, JSON.stringify(next)); } catch {}
  }
  function openAdd() {
    setEditingId(null);
    setForm(blankForm);
    setMode("form");
    setDialogOpen(true);
  }
  function openView(ev: DashEvent) {
    setDetail(ev);
    setConfirmDelete(false);
    setMode("view");
    setDialogOpen(true);
  }
  function startEdit(ev: DashEvent) {
    setEditingId(ev.id);
    setForm({ title: ev.title, description: ev.description || "", date: ev.date, time: ev.time || "", attendees: ev.attendees || [] });
    setConfirmDelete(false);
    setMode("form"); // swap content within the SAME open dialog — no close/reopen
  }
  function closeDialog() {
    setDialogOpen(false);
    setConfirmDelete(false);
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;
    const data = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      date: form.date,
      time: form.time || undefined,
      attendees: form.attendees.length ? form.attendees : undefined,
    };
    if (editingId != null) {
      persist(events.map((ev) => (ev.id === editingId ? { ...ev, ...data } : ev)));
    } else {
      persist([...events, { id: Date.now(), ...data }]);
    }
    setForm(blankForm);
    setEditingId(null);
    setDialogOpen(false);
  }
  function removeEvent(id: number) {
    persist(events.filter((ev) => ev.id !== id));
    setConfirmDelete(false);
    setDialogOpen(false);
  }
  function toggleAttendee(name: string) {
    setForm((f) => ({
      ...f,
      attendees: f.attendees.includes(name) ? f.attendees.filter((n) => n !== name) : [...f.attendees, name],
    }));
  }

  return (
    <Card className="border-0 lg:h-[25rem] lg:col-span-2 flex flex-col" style={CARD_STYLE}>
      <CardHeader className="pt-4 pb-2 flex flex-row items-center justify-between gap-1 space-y-0">
        <CardTitle className="text-base font-semibold">Calendar</CardTitle>
        {!readOnly && (
          <Button variant="secondary" size="sm" className="text-xs rounded-[12px]" onClick={openAdd} data-testid="button-add-event">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Event
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-5 pb-4 flex-1 min-h-0">
        <div className="flex flex-col lg:flex-row h-full">
          {/* Calendar grid — takes the larger share */}
          <div className="lg:flex-1 lg:pr-5 min-w-0 h-full">
            <CalendarWidget
              mode="single"
              showOutsideDays
              className="w-full h-full p-0"
              classNames={calClassNames}
              components={{ Caption: CalCaption }}
              modifiers={{ holiday: holidayDates, event: readOnly ? [] : eventDates, booking: bookingDates }}
              modifiersStyles={{
                holiday: { backgroundColor: "rgba(255,111,98,0.15)", color: HOLIDAY_COLOR, fontWeight: 600 },
                event: { backgroundColor: "rgba(32,98,149,0.15)", color: "#206295", fontWeight: 600 },
                booking: { backgroundColor: "rgba(14,124,123,0.15)", color: "#0E7C7B", fontWeight: 600 },
              }}
            />
          </div>

          {/* Vertical separator + events/holidays list */}
          <div className="lg:w-64 lg:flex-shrink-0 lg:border-l lg:border-border lg:pl-5 pr-2 mt-4 lg:mt-0 overflow-y-auto">
            {!readOnly && (<>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Upcoming Events</p>
            {upcomingEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground mb-4">No upcoming events yet. Use “Add Event” to create one.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {upcomingEvents.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => openView(ev)}
                    className="w-full text-left rounded-[12px] border border-primary/20 bg-primary/5 backdrop-blur-md p-3 hover-elevate"
                    style={{ boxShadow: "0 0 8px rgba(44,62,98,0.15), inset 2px 2px 2px -2px #fff, inset -2px -2px 2px -2px #fff, 0 8px 12px rgba(0,0,0,0.08)" }}
                    data-testid={`event-tile-${ev.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground leading-snug">{ev.title}</p>
                      {ev.attendees?.length ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-primary flex-shrink-0">
                          <Users className="h-3 w-3" /> {ev.attendees.length}
                        </span>
                      ) : null}
                    </div>
                    {ev.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ev.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs font-medium text-primary">
                      <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {format(new Date(ev.date), "MMM d, yyyy")}</span>
                      {ev.time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {ev.time}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            </>)}

            {upcomingBookings.length > 0 && (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#0E7C7B" }}>Upcoming Bookings</p>
                <div className="space-y-2 mb-4">
                  {upcomingBookings.map((b: any) => (
                    <div key={b.id} className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-[12px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(14,124,123,0.12)" }}>
                        <Car className="h-4 w-4" style={{ color: "#0E7C7B" }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{b.purpose || "Car booking"}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(b.startTime), "EEE, d MMM · h:mm a")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "rgb(89, 97, 105)" }}>Upcoming Holidays</p>
            {upcomingHolidays.length === 0 ? (
              <p className="text-xs text-muted-foreground">No upcoming holidays</p>
            ) : (
              <div className="space-y-2.5">
                {upcomingHolidays.map((h: any) => (
                  <div key={h.id} className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-[12px] flex flex-col items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(255,111,98,0.12)" }}>
                      <span className="text-[10px] leading-none font-medium uppercase" style={{ color: HOLIDAY_COLOR }}>{format(new Date(h.date), "MMM")}</span>
                      <span className="text-sm leading-none font-bold" style={{ color: HOLIDAY_COLOR }}>{format(new Date(h.date), "d")}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{h.name}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(h.date), "EEEE")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>

      {/* Event dialog — view details OR add/edit form in ONE dialog.
          (Two separate dialogs broke editing: closing one while opening the
          other left the page non-interactive.) */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent>
          {mode === "form" ? (
            <>
          <DialogHeader>
            <DialogTitle>{editingId != null ? "Edit Event" : "Add Event"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ev-title">Title</Label>
              <Input id="ev-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Team sync" data-testid="input-event-title" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-desc">Description</Label>
              <Textarea id="ev-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ev-date">Date</Label>
                <DateInput value={form.date} onChange={(v) => setForm({ ...form, date: v })} testId="input-event-date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-time">Time</Label>
                <Input
                  id="ev-time"
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  onClick={(e) => { try { (e.currentTarget as HTMLInputElement).showPicker?.(); } catch {} }}
                  className="cursor-pointer"
                />
              </div>
            </div>

            {/* Attendee selection */}
            <div className="flex flex-col items-start gap-2">
              <Label>Attendees</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs rounded-[16px] border no-default-hover-elevate no-default-active-elevate"
                    style={{ background: "transparent", borderColor: "rgba(29, 31, 32, 0.75)", boxShadow: "none" }}
                    data-testid="button-add-attendees"
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1" /> Add attendees
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-2">
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <span className="text-xs font-semibold text-muted-foreground">{form.attendees.length} selected</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, attendees: employeeNames }))}
                        className="text-xs font-medium text-primary hover:underline"
                        data-testid="button-add-all-attendees"
                      >
                        Add All
                      </button>
                      <span className="text-muted-foreground/40 text-xs">|</span>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, attendees: [] }))}
                        className="text-xs font-medium text-muted-foreground hover:underline"
                        data-testid="button-clear-all-attendees"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  <Input
                    value={attendeeSearch}
                    onChange={(e) => setAttendeeSearch(e.target.value)}
                    placeholder="Search people…"
                    className="h-8 text-xs mb-1.5"
                    data-testid="input-attendee-search"
                  />
                  <div className="max-h-56 overflow-y-auto space-y-0.5">
                    {employeeNames.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-1 py-2">No employees available</p>
                    ) : visibleAttendees.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-1 py-2">No matches for “{attendeeSearch}”</p>
                    ) : (
                      visibleAttendees.map((name) => {
                        const selected = form.attendees.includes(name);
                        const emp = empByName.get(name);
                        const c = nameColor(name);
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => toggleAttendee(name)}
                            className="w-full flex items-center gap-2 rounded-[12px] px-2 py-1.5 text-sm text-left hover-elevate"
                          >
                            <Avatar className="h-6 w-6 flex-shrink-0">
                              {emp?.avatarUrl && <AvatarImage src={emp.avatarUrl} />}
                              <AvatarFallback className="text-[9px]" style={{ backgroundColor: c.avatar, color: c.text }}>{initials(name)}</AvatarFallback>
                            </Avatar>
                            <span className="flex-1 truncate">{name}</span>
                            {selected && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {form.attendees.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1 w-full">
                  {form.attendees.map((name) => {
                    const emp = empByName.get(name);
                    const c = nameColor(name);
                    return (
                      <span key={name} className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2 py-1" style={{ backgroundColor: c.chip }}>
                        <Avatar className="h-[26px] w-[26px] flex-shrink-0">
                          {emp?.avatarUrl && <AvatarImage src={emp.avatarUrl} />}
                          <AvatarFallback className="text-[10px]" style={{ backgroundColor: c.avatar, color: c.text }}>{initials(name)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-foreground">{name}</span>
                        <button type="button" onClick={() => toggleAttendee(name)} aria-label={`Remove ${name}`}>
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="secondary" size="sm" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" size="sm" data-testid="button-save-event">
                {editingId != null ? "Save Changes" : "Add Event"}
              </Button>
            </DialogFooter>
          </form>
            </>
          ) : detail ? (
            <>
              <DialogHeader>
                <DialogTitle>{detail.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-foreground">
                  <CalendarDays className="h-4 w-4 text-primary" /> {format(new Date(detail.date), "EEEE, MMM d, yyyy")}
                </div>
                {detail.time && (
                  <div className="flex items-center gap-2 text-foreground">
                    <Clock className="h-4 w-4 text-primary" /> {detail.time}
                  </div>
                )}
                {detail.description && <p className="text-muted-foreground">{detail.description}</p>}
                {detail.attendees?.length ? (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                      Attendees ({detail.attendees.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.attendees.map((n) => {
                        const emp = empByName.get(n);
                        const c = nameColor(n);
                        return (
                          <span key={n} className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2 py-1 text-xs text-foreground" style={{ backgroundColor: c.chip }}>
                            <Avatar className="h-[26px] w-[26px] flex-shrink-0">
                              {emp?.avatarUrl && <AvatarImage src={emp.avatarUrl} />}
                              <AvatarFallback className="text-[10px]" style={{ backgroundColor: c.avatar, color: c.text }}>{initials(n)}</AvatarFallback>
                            </Avatar>
                            {n}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
              <DialogFooter>
                {confirmDelete ? (
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="text-sm text-destructive">Delete this event?</span>
                    <div className="flex gap-2">
                      <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                      <Button type="button" variant="destructive" size="sm" onClick={() => removeEvent(detail.id)} data-testid="button-confirm-delete">
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Button type="button" variant="secondary" size="sm" onClick={() => startEdit(detail)} data-testid="button-edit-event">
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                    <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmDelete(true)} data-testid="button-delete-event">
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ===== Quick Actions (last row, all dashboards) — important features NOT already on the dashboard =====
const QUICK_ACTIONS = [
  { label: "Book a Car", desc: "Company vehicles", href: "/vehicles", icon: Car, color: "bg-[#206295]/15 text-[#206295]" },
  { label: "Company Workspace", desc: "Services & requests", href: "/company-workspace", icon: Building2, color: "bg-[#4BDCD9]/25 text-[#0E7C7B]" },
  { label: "Request Logistics", desc: "Couriers & moves", href: "/logistics", icon: Route, color: "bg-[#206295]/15 text-[#206295]" },
  { label: "View Payslips", desc: "Salary & payroll", href: "/payroll", icon: DollarSign, color: "bg-[#4BDCD9]/25 text-[#0E7C7B]" },
];

function QuickActionsRow() {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Quick Actions</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_ACTIONS.map((a) => (
          <a key={a.href} href={a.href} className="block" data-testid={`quick-${a.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <Card className="border-0 card-hover h-full" style={CARD_STYLE}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2.5 rounded-lg flex-shrink-0 ${a.color}`}><a.icon className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{a.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{a.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}

// Brand palette for department chips in the directory (stable per department id).
const DEPT_CHIP_COLORS = ["#206295", "#0E7C7B", "#4A90C2", "#6A7366", "#953229", "#425B8D"];
const deptChipColor = (id?: string | null) => {
  if (!id) return "#94A3B8";
  let h = 0; for (const ch of id) h += ch.charCodeAt(0);
  return DEPT_CHIP_COLORS[h % DEPT_CHIP_COLORS.length];
};

// "Meet the Team" — safe, searchable coworker directory (sanitized fields only; no click-through to
// full profiles, which stay blocked server-side). Avatar-forward card grid.
function MeetTheTeamCard({ employees, departments, designations, meId }: { employees: any[]; departments: any[]; designations: any[]; meId?: string }) {
  const [q, setQ] = useState("");
  const deptName = (id?: string) => (departments as any[]).find((d) => d.id === id)?.name;
  const desigName = (id?: string) => (designations as any[]).find((d) => d.id === id)?.name;
  const initials = (e: any) => `${e.firstName?.[0] || ""}${e.lastName?.[0] || ""}`.toUpperCase();
  const term = q.trim().toLowerCase();
  const list = (employees as any[])
    .filter((e) => e.employmentStatus !== "exited")
    .filter((e) => !term || `${e.firstName} ${e.lastName} ${deptName(e.departmentId) || ""} ${desigName(e.designationId) || ""} ${e.employeeCode || ""}`.toLowerCase().includes(term))
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  return (
    <Card className="border-0 lg:col-span-3 lg:h-[26rem] flex flex-col" style={CARD_STYLE}>
      <CardHeader className="pt-4 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> Meet the Team <span className="text-xs font-normal text-muted-foreground">{list.length}</span></CardTitle>
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, team, role…" className="pl-9 h-9" data-testid="input-team-search" />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex-1 min-h-0">
        {list.length === 0 ? (
          <div className="h-full flex items-center justify-center"><p className="text-sm text-muted-foreground">No one matches your search.</p></div>
        ) : (
          <ScrollArea className="h-full -mr-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 pr-2">
              {list.map((e) => {
                const c = deptChipColor(e.departmentId);
                const isYou = meId && e.id === meId;
                return (
                  <div key={e.id} className="flex items-center gap-3 rounded-xl border border-border/60 p-2.5 hover-elevate" data-testid={`coworker-${e.id}`}>
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      {(e.profilePhoto || e.avatarUrl) && <AvatarImage src={e.profilePhoto || e.avatarUrl} />}
                      <AvatarFallback className="text-xs font-semibold" style={{ backgroundColor: `${c}1F`, color: c }}>{initials(e)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{e.firstName} {e.lastName}{isYou ? <span className="text-[10px] font-normal text-muted-foreground"> (You)</span> : null}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{desigName(e.designationId) || "—"}</p>
                      {e.departmentId && <span className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: `${c}1F`, color: c }}>{deptName(e.departmentId)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// "Recent Activity" — the current user's notification feed (approvals, decisions, reminders…).
function RecentActivityCard() {
  const { data: notifications = [] } = useQuery<any[]>({ queryKey: ["/api/notifications"] });
  const items = (notifications as any[]).slice(0, 15);
  return (
    <Card className="border-0 lg:h-[26rem] flex flex-col" style={CARD_STYLE}>
      <CardHeader className="pt-4 pb-2 flex flex-row items-center justify-between gap-1 space-y-0">
        <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex-1 min-h-0">
        {items.length === 0 ? (
          <div className="h-full flex items-center justify-center"><p className="text-sm text-muted-foreground">Nothing recent</p></div>
        ) : (
          <ScrollArea className="h-full -mr-2">
            <div className="list-divider pr-2">
              {items.map((n: any) => (
                <div key={n.id} className="flex gap-2.5 py-2.5">
                  <span className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5"><Bell className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground leading-snug">{n.title}</p>
                    {n.body && <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
                    {n.createdAt && <p className="text-[10px] text-muted-foreground/80 mt-0.5">{format(new Date(n.createdAt), "d MMM, h:mm a")}</p>}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const emp = auth?.employee;

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({ queryKey: ["/api/dashboard/stats"] });
  const { data: announcements = [], isLoading: annLoading } = useQuery<any[]>({ queryKey: ["/api/announcements"] });
  const { data: leaveRequests = [] } = useQuery<any[]>({ queryKey: ["/api/leave-requests"] });
  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees"],
    enabled: !!user, // used by the "Meet the Team" directory (sanitized list) + admin panels
  });
  const { data: leaveTypes = [] } = useQuery<any[]>({ queryKey: ["/api/leave-types"] });
  const { data: myAttendance = [] } = useQuery<any[]>({
    queryKey: emp ? [`/api/attendance?employeeId=${emp.id}&month=${currentMonth}&year=${currentYear}`] : [],
    enabled: !!emp,
  });
  const { data: myLeaveBalances = [] } = useQuery<any[]>({
    queryKey: emp ? [`/api/leave-balances?employeeId=${emp.id}&year=${currentYear}`] : [],
    enabled: !!emp,
  });
  const { data: myPayslips = [] } = useQuery<any[]>({
    queryKey: ["/api/payslips/me"],
  });
  const { data: myEmp } = useQuery<any>({ queryKey: ["/api/employees/me"], enabled: !!emp });
  const { data: departments = [] } = useQuery<any[]>({ queryKey: ["/api/departments"], enabled: !!user });
  const { data: designations = [] } = useQuery<any[]>({ queryKey: ["/api/designations"], enabled: !!user });
  const { data: allBookings = [] } = useQuery<any[]>({ queryKey: ["/api/vehicles/bookings"], enabled: !!user, retry: false });

  // Service-request counts + calendar data for the admin dashboard layout
  const showAdminLayout = isHR(user!) || isManager(user!);
  const { data: requestSummary } = useQuery<any>({
    queryKey: ["/api/my-requests/summary"],
    enabled: !!user,
  });
  // /api/team-requests returns an object: { purchases, travels, tickets, teamMembers }
  const { data: teamRequests } = useQuery<any>({
    queryKey: ["/api/team-requests"],
    enabled: showAdminLayout,
    retry: false,
  });
  const { data: holidays = [] } = useQuery<any[]>({
    queryKey: [`/api/holidays?year=${currentYear}`],
    enabled: !!user,
  });

  const purchasePending = requestSummary?.purchases?.pending ?? 0;
  const travelPending = requestSummary?.travels?.pending ?? 0;
  const teamPending = [
    ...(teamRequests?.purchases ?? []),
    ...(teamRequests?.travels ?? []),
    ...(teamRequests?.tickets ?? []),
  ].filter(
    (r: any) => !["fulfilled", "rejected", "closed", "completed", "cancelled", "done", "resolved"].includes(r.status)
  ).length;

  const holidayDates = holidays
    .map((h: any) => (h.date ? new Date(h.date) : null))
    .filter(Boolean) as Date[];
  const upcomingHolidays = holidays
    .filter((h: any) => h.date && new Date(h.date) >= new Date(new Date().toDateString()))
    .sort((a: any, b: any) => +new Date(a.date) - +new Date(b.date))
    .slice(0, 4);

  const greeting = () => {
    const h = today.getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  };

  const displayName = emp ? emp.firstName : user?.username || "User";

  // Elapsed working days this month (Mon–Fri minus holidays, up to today).
  const monthStart = new Date(currentYear, currentMonth - 1, 1);
  const holidayStrSet = new Set((holidays as any[]).map((h) => h.date));
  let workingDays = 0;
  for (let d = new Date(monthStart); d <= today; d.setDate(d.getDate() + 1)) {
    const wd = d.getDay();
    if (wd === 0 || wd === 6) continue;
    if (holidayStrSet.has(format(d, "yyyy-MM-dd"))) continue;
    workingDays++;
  }
  // Only count records for ELAPSED working days so the numbers stay consistent with `workingDays`
  // (future planned leave/WFH must not inflate this-month-so-far totals).
  const todayStr = format(today, "yyyy-MM-dd");
  const elapsedAtt = (myAttendance as any[]).filter((a) => {
    if (!a.date || a.date > todayStr) return false;
    const d = new Date(`${a.date}T00:00:00`);
    const wd = d.getDay();
    return wd !== 0 && wd !== 6 && !holidayStrSet.has(a.date);
  });
  const countStatus = (s: string) => elapsedAtt.filter((a) => a.status === s).length;
  const wfhDays = countStatus("wfh");
  const onDutyDays = countStatus("on_duty");
  const absentDays = countStatus("absent");
  const leaveDays = countStatus("leave");
  const halfDays = countStatus("half_day");
  // Present-by-default: every elapsed working day with no exception record counts as office-present.
  const officePresent = Math.max(0, workingDays - wfhDays - onDutyDays - leaveDays - absentDays - halfDays);
  const presentDays = officePresent + wfhDays + onDutyDays; // "present" incl. WFH / On-Duty

  // Full month breakdown (all six states, for the legend) + non-zero subset (for the donut).
  const attLegend = [
    { key: "present", name: "Present (Office)", value: officePresent },
    { key: "wfh", name: "WFH", value: wfhDays },
    { key: "on_duty", name: "On Duty", value: onDutyDays },
    { key: "half_day", name: "Half Day", value: halfDays },
    { key: "leave", name: "Leave", value: leaveDays },
    { key: "absent", name: "Absent", value: absentDays },
  ].map((s) => ({ ...s, color: ATT_COLORS[s.key] })).sort((a, b) => b.value - a.value);
  const attSegments = attLegend.filter((s) => s.value > 0);
  const attendancePct = workingDays ? Math.round(((officePresent + wfhDays + onDutyDays + 0.5 * halfDays) / workingDays) * 100) : 0;

  const pendingLeaveRequests = leaveRequests.filter((r: any) => r.status === "pending");
  const myPendingCount = pendingLeaveRequests.length + (requestSummary?.purchases?.pending ?? 0) + (requestSummary?.travels?.pending ?? 0);
  const totalLeaveBalance = myLeaveBalances.reduce((a: number, b: any) => a + parseFloat(b.closingBalance || "0"), 0);

  // Profile snapshot lookups + my upcoming car bookings (for the calendar).
  const deptName = (departments as any[]).find((d) => d.id === emp?.departmentId)?.name;
  const designationName = (designations as any[]).find((d) => d.id === emp?.designationId)?.name;
  const empInitials = emp ? `${emp.firstName?.[0] || ""}${emp.lastName?.[0] || ""}`.toUpperCase() : "";
  const empJoinDate = (emp as any)?.joinDate as string | undefined;
  const empEmploymentType = (emp as any)?.employmentType as string | undefined;
  const tenure = (() => {
    if (!empJoinDate) return "";
    const j = new Date(empJoinDate);
    let m = (today.getFullYear() - j.getFullYear()) * 12 + (today.getMonth() - j.getMonth());
    if (m < 0) m = 0;
    const y = Math.floor(m / 12), mm = m % 12;
    return y ? `${y}y ${mm}m` : `${mm} mo`;
  })();
  const managerName = myEmp?.managerName as string | undefined;
  const empEmail = (myEmp?.email || (emp as any)?.email) as string | undefined;
  // Today's status chip.
  const todayRec = (myAttendance as any[]).find((a) => a.date === todayStr);
  const todayStatusKey = todayRec?.status || ([0, 6].includes(today.getDay()) ? "weekend" : holidayStrSet.has(todayStr) ? "holiday" : "present");
  const STATUS_META: Record<string, { label: string; color: string }> = {
    present: { label: "In Office", color: "#206295" }, wfh: { label: "WFH", color: "#0E7C7B" }, on_duty: { label: "On Duty", color: "#4A90C2" },
    half_day: { label: "Half Day", color: "#6A7366" }, leave: { label: "On Leave", color: "#953229" }, absent: { label: "Absent", color: "#FF6F62" },
    weekend: { label: "Weekend", color: "#94A3B8" }, holiday: { label: "Holiday", color: "#94A3B8" },
  };
  const todayMeta = STATUS_META[todayStatusKey] || STATUS_META.present;

  const todayMidnight = new Date(new Date().toDateString());
  const myBookings = (allBookings as any[])
    .filter((b) => (b.requesterId === user?.id || (b.attendees || []).some((a: any) => a?.userId === user?.id)) && b.startTime && new Date(b.startTime) >= todayMidnight && b.status !== "cancelled")
    .sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime));
  const bookingDates = myBookings.map((b) => new Date(b.startTime));
  const upcomingBookings = myBookings.slice(0, 4);

  return (
    <div className="min-h-full">
      <div className="p-6 space-y-4 max-w-[92rem] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {greeting()}, {displayName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(today, "EEEE, MMMM d, yyyy")} · {getRoleLabel(user?.role as any)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isHR(user!) && (
            <Button asChild size="sm" data-testid="button-add-employee">
              <a href="/employees?action=new">
                <Users className="h-4 w-4 mr-1.5" />
                Add Employee
              </a>
            </Button>
          )}
          {emp && !showAdminLayout && (
            <>
              <Button variant="outline" size="sm" asChild data-testid="button-mark-on-duty">
                <a href="/attendance?action=on-duty"><Route className="h-4 w-4 mr-1.5" /> Mark On Duty</a>
              </Button>
              <Button variant="outline" size="sm" asChild data-testid="button-apply-wfh">
                <a href="/attendance?action=wfh"><Home className="h-4 w-4 mr-1.5" /> Apply WFH</a>
              </Button>
              <div className="w-px h-6 bg-border self-center mx-0.5" aria-hidden="true" />
            </>
          )}
          <Button variant="outline" size="sm" asChild data-testid="button-apply-leave">
            <a href="/leave?action=apply">
              <Plane className="h-4 w-4 mr-1.5" />
              Apply Leave
            </a>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      {(isHR(user!) || isManager(user!)) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-0" style={CARD_STYLE}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))
          ) : (
            <>
              <StatCard
                title="Active Employees"
                value={stats?.totalEmployees || 0}
                icon={Users}
                subtitle="Total headcount"
                color="bg-[#206295]/15 text-[#206295]"
                href="/employees"
              />
              <StatCard
                title="Present Today"
                value={stats?.presentToday || 0}
                icon={UserCheck}
                subtitle={`of ${stats?.totalEmployees || 0} employees`}
                color="bg-[#4BDCD9]/25 text-[#206295]"
                href="/attendance"
              />
              <StatCard
                title="Pending Leaves"
                value={stats?.pendingLeaves || 0}
                icon={Plane}
                subtitle="Awaiting approval"
                color="bg-[#206295]/15 text-[#206295]"
                href="/leave"
              />
              <StatCard
                title="Regularizations"
                value={stats?.pendingRegularizations || 0}
                icon={ClipboardList}
                subtitle="Pending approval"
                color="bg-[#4BDCD9]/25 text-[#206295]"
                href="/attendance"
              />
            </>
          )}
        </div>
      )}

      {/* Personal row — profile snapshot (merged) + the two non-attendance stats.
          Attendance now lives in the donut below, so no repetitive present/absence cards. */}
      {emp && !showAdminLayout && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Profile snapshot — spans the first two card slots */}
          <Card className="border-0 col-span-2" style={CARD_STYLE}>
            <CardContent className="p-5 flex items-center gap-5">
              {/* Left — identity + inline meta (single strip to keep the card short) */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="relative flex-shrink-0">
                  <Avatar className="h-14 w-14 ring-2 ring-[#206295]/20 ring-offset-2 ring-offset-transparent">
                    {emp.avatarUrl && <AvatarImage src={emp.avatarUrl} />}
                    <AvatarFallback className="text-lg font-bold bg-[#206295]/10 text-[#206295]">{empInitials}</AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white" style={{ backgroundColor: todayMeta.color }} title={`Today · ${todayMeta.label}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-lg font-bold text-foreground truncate">{emp.firstName} {emp.lastName}</p>
                    {user?.role && <Badge className={`text-[10px] ${getRoleBadgeColor(user.role as any)}`}>{getRoleLabel(user.role as any)}</Badge>}
                    {(designationName || deptName) && <span className="text-xs text-muted-foreground truncate">{designationName || ""}{designationName && deptName ? " · " : ""}{deptName || ""}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><Hash className="h-3.5 w-3.5 text-[#206295]" /> {emp.employeeCode || "—"}</span>
                    {empEmploymentType && <span className="inline-flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 text-[#206295]" /> {empEmploymentType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>}
                    {empJoinDate && <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-[#206295]" /> Joined {format(new Date(empJoinDate), "MMM yyyy")}{tenure ? ` · ${tenure}` : ""}</span>}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="hidden sm:block w-px self-stretch bg-border/70" />

              {/* Right — today's status + contact */}
              <div className="sm:w-64 flex-shrink-0 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: `${todayMeta.color}1F`, color: todayMeta.color }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: todayMeta.color }} /> Today · {todayMeta.label}
                  </span>
                  <a href={`/employees/${emp.id}`} className="text-xs text-primary font-medium inline-flex items-center gap-1" data-testid="link-profile-snapshot">View <ArrowRight className="h-3 w-3" /></a>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {empEmail && <p className="inline-flex items-center gap-2 w-full min-w-0"><Mail className="h-3.5 w-3.5 text-[#206295] flex-shrink-0" /><span className="truncate">{empEmail}</span></p>}
                  <p className="inline-flex items-center gap-2"><UserCheck className="h-3.5 w-3.5 text-[#206295] flex-shrink-0" /> {managerName ? <>Reports to <span className="font-medium text-foreground">{managerName}</span></> : "No manager assigned"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <StatCard
            title="Leave Balance"
            value={totalLeaveBalance}
            icon={Plane}
            subtitle="Total available days"
            color="bg-[#4BDCD9]/25 text-[#206295]"
            href="/leave"
          />
          <StatCard
            title="My Pending Requests"
            value={myPendingCount}
            icon={ClipboardList}
            subtitle="Awaiting approval"
            color="bg-[#206295]/15 text-[#206295]"
            href="/my-requests"
          />
        </div>
      )}

      {/* Announcements panel (reused in both layouts) */}
      {(() => {
        const announcementsPanel = (
          <Card className="border-0 h-full flex flex-col" style={CARD_STYLE}>
            <CardHeader className="pt-4 pb-2 flex flex-row items-center justify-between gap-1 space-y-0">
              <CardTitle className="text-base font-semibold">Announcements</CardTitle>
              <Button variant="ghost" size="sm" asChild className="text-xs h-auto min-h-0 py-1">
                <a href="/announcements">View all <ArrowRight className="h-3 w-3 ml-1" /></a>
              </Button>
            </CardHeader>
            <CardContent className="px-5 pb-4 flex-1 min-h-0">
              <ScrollArea className="h-full">
                {annLoading ? (
                  <div className="space-y-4">
                    {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : announcements.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No announcements yet
                  </div>
                ) : (
                  <div className="list-divider pr-2">
                    {announcements.map((ann: any) => (
                      <AnnouncementCard key={ann.id} announcement={ann} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        );

        if (showAdminLayout) {
          return (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* LEFT — Pending Service Requests (bento card, below 1st overview card) */}
              <Card className="border-0 lg:h-[25rem] flex flex-col" style={CARD_STYLE}>
                <CardHeader className="pt-4 pb-2">
                  <CardTitle className="text-base font-semibold">Pending Service Requests</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 flex-1 flex flex-col gap-4">
                  <ServiceRequestRow
                    icon={ShoppingCart} label="Purchase Requests" count={purchasePending}
                    href="/my-requests?tab=purchases"
                    color="bg-[#206295]/15 text-[#206295]"
                  />
                  <ServiceRequestRow
                    icon={Car} label="Travel Requests" count={travelPending}
                    href="/my-requests?tab=travels"
                    color="bg-[#4BDCD9]/25 text-[#206295]"
                  />
                  <ServiceRequestRow
                    icon={Users} label="Team Requests" count={teamPending}
                    href="/team-requests"
                    color="bg-[#206295]/15 text-[#206295]"
                  />
                </CardContent>
              </Card>

              {/* CENTER — Calendar (below 2nd & 3rd overview cards) */}
              <CalendarCard holidayDates={holidayDates} upcomingHolidays={upcomingHolidays} employees={employees} bookingDates={bookingDates} upcomingBookings={upcomingBookings} />

              {/* RIGHT — Announcements (below 4th overview card) */}
              <div className="lg:h-[25rem]">{announcementsPanel}</div>
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* LEFT — My Attendance donut + quick access to the attendance page */}
            <Card className="border-0 lg:h-[25rem] flex flex-col" style={CARD_STYLE}>
              <CardHeader className="pt-4 pb-2 flex flex-row items-center justify-between gap-1 space-y-0">
                <CardTitle className="text-base font-semibold">My Attendance</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 flex-1 min-h-0 flex flex-col">
                {workingDays === 0 ? (
                  <div className="flex-1 flex items-center justify-center"><p className="text-sm text-muted-foreground">No working days yet this month</p></div>
                ) : (
                  <>
                    <div className="relative h-32 w-32 mx-auto flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={attSegments} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={58} innerRadius={34} paddingAngle={3} cornerRadius={5} stroke="none">
                            {attSegments.map((s) => <Cell key={s.key} fill={s.color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-bold text-foreground leading-none tabular-nums">{attendancePct}%</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">attendance</span>
                      </div>
                    </div>
                    <p className="text-center text-xs text-muted-foreground mt-2">
                      <span className="font-semibold text-foreground">{presentDays}</span> of {workingDays} working days present
                    </p>
                    <Separator className="my-3" />
                    <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1">
                      {attLegend.map((s) => (
                        <div key={s.key} className={`flex items-center gap-2 text-xs ${s.value === 0 ? "opacity-45" : ""}`}>
                          <span className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style={{ background: s.color }} />
                          <span className="text-foreground/80 truncate flex-1">{s.name}</span>
                          <span className="font-semibold text-foreground tabular-nums">{s.value}<span className="text-muted-foreground font-normal"> {s.value === 1 ? "day" : "days"}</span></span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <Button variant="secondary" size="sm" asChild className="w-full mt-3 rounded-[12px] flex-shrink-0">
                  <a href="/attendance" data-testid="link-view-attendance"><CalendarDays className="h-3.5 w-3.5 mr-1.5" /> View full attendance</a>
                </Button>
              </CardContent>
            </Card>

            {/* CENTER — read-only Calendar: holidays + my upcoming bookings; no Add Event / attendee tooling. */}
            <CalendarCard holidayDates={holidayDates} upcomingHolidays={upcomingHolidays} employees={[]} readOnly bookingDates={bookingDates} upcomingBookings={upcomingBookings} />

            {/* RIGHT — Announcements */}
            <div className="lg:h-[25rem]">{announcementsPanel}</div>
          </div>
        );
      })()}

      {/* Pending approvals for managers/HR */}
      {(isHR(user!) || isManager(user!)) && pendingLeaveRequests.length > 0 && (
        <Card className="border-0" style={CARD_STYLE}>
          <CardHeader className="pt-4 pb-2 flex flex-row items-center justify-between gap-1 space-y-0">
            <CardTitle className="text-base font-semibold">Pending Leave Requests</CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-xs h-auto min-h-0 py-1">
              <a href="/leave">View all <ArrowRight className="h-3 w-3 ml-1" /></a>
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-2">
            <div className="list-divider">
              {pendingLeaveRequests.slice(0, 5).map((req: any) => (
                <LeaveRequestCard
                  key={req.id}
                  request={req}
                  employees={employees}
                  leaveTypes={leaveTypes}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meet the Team (3/4) + Recent Activity (1/4) — equal height */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <MeetTheTeamCard employees={employees} departments={departments} designations={designations} meId={emp?.id} />
        <RecentActivityCard />
      </div>

      {/* Quick Actions — always last */}
      <QuickActionsRow />
      </div>
    </div>
  );
}
