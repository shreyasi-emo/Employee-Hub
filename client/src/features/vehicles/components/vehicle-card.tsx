import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Car, Users, Fuel, Cog, MapPin, Phone, Hash, Plus } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { driverInitials } from "../lib/booking-visuals";

// ============================ Company Vehicle card — compact, expands on hover ============================
// `expanded` (used when it's the only vehicle) locks the card open — driver + Book Now always visible.
export function VehicleCard({ v, av, onBook, expanded = false }: any) {
  const model = v.model || v.name || "Company Vehicle";
  const seat = v.seatingCapacity ? `${v.seatingCapacity} Seater` : "—";
  return (
    <div className="group card-surface rounded-2xl" data-testid={`vehicle-${v.id}`}>
      {/* Image window with the solid-colour status pill pinned bottom-left (absolute → never shifts other content) */}
      <div className="relative">
        <div className="h-28 w-full bg-muted/40 rounded-t-2xl overflow-hidden flex items-center justify-center border-b border-border/60">
          {v.imageUrl ? <img src={v.imageUrl} alt={model} className="max-h-full max-w-full object-contain" /> : <Car className="h-8 w-8 text-muted-foreground/40" />}
        </div>
        <span className={`absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm pointer-events-none ${av.solid}`}>{av.label}</span>
      </div>

      {/* Core details (always visible) */}
      <div className="p-3">
        <h3 className="text-sm font-bold text-foreground leading-tight truncate">{model}</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-1"><Hash className="h-3 w-3" />{v.registrationNo || "—"}</p>
        {/* Specs — always show icon + separators; '—' where a value isn't set */}
        <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Fuel className="h-3 w-3" />{v.fuelType || "—"}</span>
          <Separator orientation="vertical" className="h-3.5 bg-border" />
          <span className="inline-flex items-center gap-1"><Cog className="h-3 w-3" />{v.transmission || "—"}</span>
          <Separator orientation="vertical" className="h-3.5 bg-border" />
          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{seat}</span>
        </div>

        {/* Hover-reveal: driver + Book Now — animatable grid-rows for a smooth downward expand.
            When `expanded` (single vehicle) the reveal is locked open regardless of hover. */}
        <div className={`grid transition-all duration-300 ease-out ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 group-hover:grid-rows-[1fr] group-hover:opacity-100"}`}>
          {/* overflow-hidden powers the collapse animation; when locked open we drop it so the button shadow isn't clipped */}
          <div className={expanded ? "" : "overflow-hidden"}>
            <Separator className="mt-3 mb-2.5" />
            <div className="flex items-start gap-2.5">
              <span className="h-8 w-8 rounded-full bg-[#206295]/15 text-[#206295] flex items-center justify-center text-[11px] font-semibold flex-shrink-0 mt-0.5">{driverInitials(v.driverName)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Assigned Driver</p>
                <p className="text-xs font-medium text-foreground truncate">{v.driverName || "Unassigned"}</p>
                {v.driverPhone && <p className="text-[11px] text-muted-foreground truncate inline-flex items-center gap-1"><Phone className="h-3 w-3" />{v.driverPhone}</p>}
              </div>
            </div>
            {av.bookable && <Button className="w-full mt-2.5 h-9 btn-primary-gradient" onClick={onBook} data-testid={`book-vehicle-${v.id}`}><Plus className="h-4 w-4 mr-1.5" /> Book Now</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
