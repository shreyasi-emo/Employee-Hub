import { CARD_STYLE, calClassNames, HOLIDAY_COLOR, nameColor } from "../lib/dashboard-visuals";
import { EVENTS_KEY, loadEvents, type DashEvent } from "../lib/dashboard-events";
import { CalCaption } from "./dashboard-ui";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { DateInput, TimeField } from "@/components/shared/datetime-field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Users, Clock, Calendar, Car, Plus, CalendarDays, Check, X, Pencil, Trash2, UserPlus, Search } from "lucide-react";
import { Calendar as CalendarWidget } from "@/components/ui/calendar";
import { format } from "date-fns";

export function CalendarCard({ holidayDates, upcomingHolidays, employees, readOnly = false, bookingDates = [], upcomingBookings = [] }: {
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
                <TimeField value={form.time} onChange={(v) => setForm({ ...form, time: v })} testId="input-event-time" />
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
