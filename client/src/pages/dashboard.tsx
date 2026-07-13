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
} from "lucide-react";
import { Calendar as CalendarWidget } from "@/components/ui/calendar";
import { useNavigation } from "react-day-picker";
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

function CalendarCard({ holidayDates, upcomingHolidays, employees }: {
  holidayDates: Date[];
  upcomingHolidays: any[];
  employees: any[];
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
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-1">
        <CardTitle className="text-base font-semibold">Calendar</CardTitle>
        <Button variant="secondary" size="sm" className="text-xs rounded-[12px]" onClick={openAdd} data-testid="button-add-event">
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Event
        </Button>
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
              modifiers={{ holiday: holidayDates, event: eventDates }}
              modifiersStyles={{
                holiday: { backgroundColor: "rgba(255,111,98,0.15)", color: HOLIDAY_COLOR, fontWeight: 600 },
                event: { backgroundColor: "rgba(32,98,149,0.15)", color: "#206295", fontWeight: 600 },
              }}
            />
          </div>

          {/* Vertical separator + events/holidays list */}
          <div className="lg:w-64 lg:flex-shrink-0 lg:border-l lg:border-border lg:pl-5 pr-2 mt-4 lg:mt-0 overflow-y-auto">
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
                <Input
                  id="ev-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  onClick={(e) => { try { (e.currentTarget as HTMLInputElement).showPicker?.(); } catch {} }}
                  className="cursor-pointer"
                  data-testid="input-event-date"
                />
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
    enabled: isHR(user!) || isManager(user!),
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

  // Service-request counts + calendar data for the admin dashboard layout
  const showAdminLayout = isHR(user!) || isManager(user!);
  const { data: requestSummary } = useQuery<any>({
    queryKey: ["/api/my-requests/summary"],
    enabled: showAdminLayout,
  });
  // /api/team-requests returns an object: { purchases, travels, tickets, teamMembers }
  const { data: teamRequests } = useQuery<any>({
    queryKey: ["/api/team-requests"],
    enabled: showAdminLayout,
    retry: false,
  });
  const { data: holidays = [] } = useQuery<any[]>({
    queryKey: [`/api/holidays?year=${currentYear}`],
    enabled: showAdminLayout,
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

  const presentDays = myAttendance.filter((a: any) => ["present", "wfh", "on_duty"].includes(a.status)).length;
  const absentDays = myAttendance.filter((a: any) => a.status === "absent").length;
  const lopDays = myAttendance.filter((a: any) => a.status === "lop").length;

  const pendingLeaveRequests = leaveRequests.filter((r: any) => r.status === "pending");
  const latestPayslip = myPayslips[0];

  return (
    <div className="min-h-full">
      <div className="p-6 space-y-6 max-w-[92rem] mx-auto">
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

      {/* Personal Stats — only for individual contributors, not company-level viewers
          (HR/managers/super-admin see the company stats grid above instead). */}
      {emp && !showAdminLayout && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Present This Month"
            value={presentDays}
            icon={UserCheck}
            subtitle="Days present"
            color="bg-[#4BDCD9]/25 text-[#206295]"
            href="/attendance"
          />
          <StatCard
            title="Leave Balance"
            value={myLeaveBalances.reduce((a: number, b: any) => a + parseFloat(b.closingBalance || "0"), 0)}
            icon={Plane}
            subtitle="Total available days"
            color="bg-[#206295]/15 text-[#206295]"
            href="/leave"
          />
          <StatCard
            title="Absences"
            value={absentDays}
            icon={XCircle}
            subtitle="Days absent"
            color="bg-[#FF6F62]/20 text-[#FF6F62]"
          />
          {latestPayslip && (
            <StatCard
              title="Last Net Pay"
              value={`₹${Math.round(parseFloat(latestPayslip.netPay || "0")).toLocaleString("en-IN")}`}
              icon={DollarSign}
              subtitle={`${latestPayslip.year}-${String(latestPayslip.month).padStart(2, "0")}`}
              color="bg-[#4BDCD9]/25 text-[#206295]"
              href="/payroll"
            />
          )}
        </div>
      )}

      {/* Announcements panel (reused in both layouts) */}
      {(() => {
        const announcementsPanel = (
          <Card className="border-0 h-full flex flex-col" style={CARD_STYLE}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between gap-1">
              <CardTitle className="text-base font-semibold">Announcements</CardTitle>
              <Button variant="ghost" size="sm" asChild className="text-xs">
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
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* LEFT — Pending Service Requests (bento card, below 1st overview card) */}
              <Card className="border-0 lg:h-[25rem] flex flex-col" style={CARD_STYLE}>
                <CardHeader className="pb-2">
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
              <CalendarCard holidayDates={holidayDates} upcomingHolidays={upcomingHolidays} employees={employees} />

              {/* RIGHT — Announcements (below 4th overview card) */}
              <div className="lg:h-[25rem]">{announcementsPanel}</div>
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">{announcementsPanel}</div>

            {/* Leave Summary */}
            {emp && (
          <Card className="border-0" style={CARD_STYLE}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between gap-1">
              <CardTitle className="text-base font-semibold">Leave Balances</CardTitle>
              <Button variant="ghost" size="sm" asChild className="text-xs">
                <a href="/leave">Apply <ArrowRight className="h-3 w-3 ml-1" /></a>
              </Button>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {myLeaveBalances.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">No leave balances</div>
              ) : (
                <div className="space-y-2.5">
                  {myLeaveBalances.map((bal: any) => {
                    const lt = leaveTypes.find((l: any) => l.id === bal.leaveTypeId);
                    const total = parseFloat(bal.closingBalance || "0");
                    const taken = parseFloat(bal.taken || "0");
                    const accrued = parseFloat(bal.accrued || "0");
                    const pct = accrued > 0 ? Math.min(100, (total / accrued) * 100) : 0;
                    return (
                      <div key={bal.id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: lt?.color || "#3B82F6" }}
                            />
                            <span className="text-foreground font-medium">{lt?.name || "Unknown"}</span>
                          </div>
                          <span className="font-semibold text-foreground">{total}d</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: lt?.color || "#3B82F6" }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{taken}d taken of {accrued}d</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
          </div>
        );
      })()}

      {/* Pending approvals for managers/HR */}
      {(isHR(user!) || isManager(user!)) && pendingLeaveRequests.length > 0 && (
        <Card className="border-0" style={CARD_STYLE}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-1">
            <CardTitle className="text-base font-semibold">Pending Leave Requests</CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-xs">
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
      </div>
    </div>
  );
}
