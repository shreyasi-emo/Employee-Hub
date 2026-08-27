import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Car, Users, User, Check, X, MapPin, Clock, ShieldCheck, Info, Hash, Phone,
  Fuel, Cog, CalendarDays, Route, AlertTriangle, Ban, CircleCheck, Pencil,
} from "lucide-react";
import { format, isSameDay } from "date-fns";
import { blockOf, computeBlock, fmtRange } from "../lib/booking-engine";
import { bookingVisual, statusLabel, statusBadgeClass, avatarTint, driverInitials } from "../lib/booking-visuals";
import { HeroMetric, DetailField, SectionCard, PersonChip, PassengerChips, RentalAssignmentCard } from "./vehicle-ui";

// ============================ Booking details popup ============================
// Premium detail rows for any booking (opened by clicking a booking anywhere). Upcoming bookings
// get a sticky footer to edit / cancel (booker) or opt out (other passengers).
export function BookingDetailsDialog({ booking, vehicles, nameByUser, me, isHrAdmin, onClose, onCancel, onEdit, onOptOut, onViewInCalendar, onApprove, onReject }: any) {
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
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0 border-b border-border">
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
