import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmployeePicker } from "@/components/shared/employee-picker";
import { TimeField } from "@/components/shared/datetime-field";
import {
  Car, Plus, Users, User, Check, X, MapPin, Clock, ShieldCheck, Info,
  AlertTriangle, CircleCheck, CircleDashed, Route, CalendarDays, Hash, Pencil,
} from "lucide-react";
import { format, isSameDay, startOfDay, endOfDay, addDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  WIN_START, WIN_END, BLOCK, overlaps, blockOf, computeBlock, toLocalInput,
  fmtRange, TIME_SLOTS, assignVehicles,
} from "../lib/booking-engine";
import { avatarTint, driverInitials, empName, floatOf } from "../lib/booking-visuals";
import { FormSection, RentalAssignmentCard } from "./vehicle-ui";
import { BookingDateField } from "./booking-date-field";
import { useCreateBooking, useUpdateBooking } from "../api/vehicles.api";

// ============================ Booking Form ============================
export function BookingForm({ open, onClose, prefillSlot, vehicleId: seedVehicleId, companyBookings, employees, me, myName, vehicles = [], editBooking }: any) {
  const { toast } = useToast();
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

  const book = useCreateBooking({
    onSuccess: (res: any) => {
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
  const save = useUpdateBooking(eb?.id, {
    onSuccess: () => { toast({ title: "Trip updated" }); onClose(); },
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
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0 border-b border-border">
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
