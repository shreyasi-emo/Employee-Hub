import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Car, Users, Clock, ChevronRight, MapPin, Route, AlertTriangle, CalendarDays, User } from "lucide-react";
import { format, isSameDay } from "date-fns";
import { isDueSoon } from "../lib/booking-engine";
import { statusBadgeClass, statusLabel } from "../lib/booking-visuals";

// Rental approval request card — same primary-card style as the Travel Timeline cards, clickable → details popup.
export function RentalRequestCard({ b, nameByUser, onOpen }: any) {
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

