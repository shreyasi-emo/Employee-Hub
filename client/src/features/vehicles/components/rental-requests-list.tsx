import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, CircleDashed } from "lucide-react";
import { isDueSoon } from "../lib/booking-engine";
import { RentalRequestCard } from "./rental-request-card";

/** HR's approval queue. Due-soon trips float to the top, then earliest start first. */
export function RentalRequestsList({ pendingRentals, isLoading, nameByUser, onOpen }: {
  pendingRentals: any[]; isLoading: boolean; nameByUser: Record<string, string>; onOpen: (b: any) => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-foreground inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-[#206295]" /> Rental Requests — Awaiting Approval</h2>
      {isLoading ? <Skeleton className="h-24 w-full" /> :
        pendingRentals.length === 0 ? (
          <div className="card-surface rounded-2xl py-16 text-center"><CircleDashed className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No rental requests awaiting your approval.</p></div>
        ) : [...pendingRentals].sort((a, b) => Number(isDueSoon(b)) - Number(isDueSoon(a)) || +new Date(a.startTime) - +new Date(b.startTime)).map((b) => (
          <RentalRequestCard key={b.id} b={b} nameByUser={nameByUser} onOpen={onOpen} />
        ))}
    </div>
  );
}
