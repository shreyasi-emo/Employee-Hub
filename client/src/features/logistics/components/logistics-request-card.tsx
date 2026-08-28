import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { statusClass, statusLabel } from "@/lib/status";
import { Truck, MapPin, Package, Scale, Copy, ChevronRight } from "lucide-react";
import { format } from "date-fns";

const fmtDate = (d: any) => (d ? format(new Date(d), "d MMM yyyy") : "—");
const fmtKg = (w: any) => (w != null && w !== "" ? `${Number(w)} kg` : null); // strip the numeric column's trailing zeros
// Location text is stored as "Type — City" (e.g. "Customer — Kochi"); flatten to "Customer, Kochi".
const flatLoc = (s: any) => String(s || "—").split(/\s*—\s*/).filter(Boolean).join(", ") || "—";

const Sep = () => <span className="w-px h-3 bg-border flex-shrink-0" />;

function Endpoint({ label, loc, date }: { label: string; loc: string; date: any }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 flex-shrink-0" /> {label}</p>
      <p className="text-[15px] font-bold text-foreground truncate mt-1">{flatLoc(loc)}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(date)}</p>
    </div>
  );
}

// Logistics request card — single row: requester + cargo · route (pickup → drop) · status · action.
export function LogisticsRequestCard({ r, locName, onOpen }: {
  r: any; locName: (id: string) => string | undefined; onOpen: (r: any) => void;
}) {
  const isInboard = r.requestType === "inboard";
  const from = r.fromLocationText || locName(r.fromLocationId) || "—";
  const to = r.toLocationText || locName(r.toLocationId) || "—";
  const weight = fmtKg(r.weightKg);
  const divider = <div className="hidden lg:block w-px self-stretch bg-border flex-shrink-0" />;
  const copyRef = (e: React.MouseEvent) => { e.stopPropagation(); navigator.clipboard?.writeText(r.reference); };

  return (
    <Card data-testid={`logistics-card-${r.id}`} className="border hover-elevate active-elevate-2 cursor-pointer" onClick={() => onOpen(r)}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-0">
          {/* PART 1 — requester · reference · cargo meta */}
          <div className="flex gap-3 lg:flex-1 lg:min-w-0 lg:pr-5">
            <span className="h-11 w-11 rounded-xl bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0"><Truck className="h-5 w-5" /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[15px] font-bold text-foreground truncate">{r.requesterName || "Unassigned"}</span>
                {r.requesterDept && <><Sep /><span className="text-sm text-muted-foreground truncate">{r.requesterDept}</span></>}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-semibold text-muted-foreground tracking-wide">{r.reference}</span>
                <button onClick={copyRef} aria-label="Copy reference" className="h-4 w-4 rounded inline-flex items-center justify-center text-muted-foreground hover:text-[#206295]"><Copy className="h-3 w-3" /></button>
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                {r.goodsCategory && <><span className="font-semibold text-foreground capitalize whitespace-nowrap">{r.goodsCategory}</span><Sep /></>}
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Truck className="h-3.5 w-3.5" /> {isInboard ? "Inboard" : "Outboard"}</span>
                <Sep />
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Package className="h-3.5 w-3.5" /> {r.quantity} unit{r.quantity !== 1 ? "s" : ""}</span>
                {weight && <><Sep /><span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Scale className="h-3.5 w-3.5" /> {weight}</span></>}
              </div>
            </div>
          </div>

          {divider}

          {/* MIDDLE — from (pickup) ···🚚···> to (drop) */}
          <div className="flex items-start gap-3 min-w-0 lg:flex-1 lg:px-5">
            <Endpoint label="From (Pickup)" loc={from} date={r.pickupDate} />
            <div className="flex items-center flex-1 min-w-[2rem] pt-5">
              <span className="flex-1 border-t border-dashed border-border" />
              <Truck className="h-4 w-4 text-muted-foreground mx-1.5 flex-shrink-0" />
              <span className="flex-1 border-t border-dashed border-border" />
            </div>
            <Endpoint label="To (Drop)" loc={to} date={r.deliveryDate} />
          </div>

          {divider}

          {/* PART 3 — status + action grouped in one section (light internal divider) */}
          <div className="flex items-center lg:flex-1 lg:pl-5">
            <div className="min-w-0 flex-1 lg:pr-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Status</p>
              <Badge className={`gap-1.5 text-xs w-fit mt-1.5 ${statusClass(r.status)}`}><span className="h-1.5 w-1.5 rounded-full bg-current" /> {statusLabel(r.status)}</Badge>
              <p className="text-[11px] text-muted-foreground mt-1.5">Requested {fmtDate(r.createdAt)}</p>
            </div>
            <div className="hidden lg:block w-px self-stretch bg-border/50 flex-shrink-0" />
            <div className="flex items-center lg:pl-4" onClick={(e) => e.stopPropagation()}>
              <Button variant="outline" size="sm" className="border-[#206295]/40 text-[#206295] hover:bg-[#206295]/10 hover:text-[#206295]" onClick={() => onOpen(r)} data-testid={`view-logistics-${r.id}`}>View Details <ChevronRight className="h-4 w-4 ml-0.5" /></Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
