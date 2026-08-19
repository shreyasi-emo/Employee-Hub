// Small presentational pieces shared across the vehicles screen: hero metrics,
// labelled detail fields, numbered section headers, people chips and the compact
// booking row.

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Ban, Car, Check, Info, X } from "lucide-react";
import { format } from "date-fns";
import { avatarTint, driverInitials, bookingVisual, statusLabel, statusBadgeClass } from "../lib/booking-visuals";
import { fmtRange } from "../lib/booking-engine";

// Compact hero metric block (Date / Time / Passengers) — brand-blue shades.
export function HeroMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-0 px-2 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-foreground mt-1 whitespace-nowrap truncate">{value}</p>
    </div>
  );
}

// Labelled field used inside the section cards — filled icon box on the left, label + value beside it.
export function DetailField({ icon: Icon, label, value }: { icon?: any; label: string; value: React.ReactNode }) {
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
export function SectionCard({ n, title, action, children }: { n: number; title: string; action?: React.ReactNode; children: React.ReactNode }) {
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
export function PersonChip({ name, userId, me }: { name: string; userId?: string; me?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-background border border-border/60 pl-1 pr-2.5 py-0.5">
      <span className={`h-5 w-5 rounded-full ${avatarTint(name)} text-[9px] font-semibold flex items-center justify-center flex-shrink-0`}>{driverInitials(name)}</span>
      <span className="text-xs text-foreground">{name}{userId && userId === me ? " (you)" : ""}</span>
    </span>
  );
}

// Passenger avatar chips (~2 lines) with View all / Show less toggle.
export function PassengerChips({ attendees, me, max = 4 }: { attendees: any[]; me?: string; max?: number }) {
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

// Numbered section header used to structure the booking form. Module-level so inputs never lose focus.
export function FormSection({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
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


// Rental entry shown inside the Assigned Vehicle section (agency car, coral/dashed, HR-approval).
export function RentalAssignmentCard({ seatLabel, note }: { seatLabel: string; note: React.ReactNode }) {
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

// Compact booking item for the right-hand Upcoming list.
export function MiniBooking({ b, canCancel, onCancel, onOpen }: any) {
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

