import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { statusClass, statusLabel } from "@/lib/status";
import { useToast } from "@/hooks/use-toast";
import { PackageOpen, PackageCheck, MoreVertical, Eye, Copy } from "lucide-react";
import { format } from "date-fns";
import type { ReactNode } from "react";

const fmtDate = (d: any) => (d ? format(new Date(d), "d MMM yyyy") : "—");
const fmtKg = (w: any) => (w != null && w !== "" ? `${Number(w)} kg` : "—"); // strip the numeric column's trailing zeros

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground mt-0.5 truncate">{value}</p>
    </div>
  );
}

// Logistics request card — route as the hero, a muted reference kicker, status top-right,
// and a full-width stat strip (Cargo · Weight · Goods · Pickup · Delivery).
export function LogisticsRequestCard({ r, locName, onOpen }: {
  r: any; locName: (id: string) => string | undefined; onOpen: (r: any) => void;
}) {
  const { toast } = useToast();
  const isInboard = r.requestType === "inboard";
  const Icon = isInboard ? PackageCheck : PackageOpen;
  const from = r.fromLocationText || locName(r.fromLocationId) || "—";
  const to = r.toLocationText || locName(r.toLocationId) || "—";
  const tint = isInboard ? "#206295" : "#0E7C7B";

  return (
    <Card data-testid={`logistics-card-${r.id}`} className="border-0 hover-elevate active-elevate-2 cursor-pointer" onClick={() => onOpen(r)}>
      <CardContent className="p-4">
        <div className="flex gap-3.5">
          <span className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${tint}1a`, color: tint }}><Icon className="h-[18px] w-[18px]" /></span>
          <div className="flex-1 min-w-0">
            {/* Kicker + route hero · status + overflow */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-muted-foreground tracking-wide">{r.reference}</span>
                  <button onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(r.reference); toast({ title: "Reference copied" }); }} aria-label="Copy reference" className="h-5 w-5 rounded inline-flex items-center justify-center text-muted-foreground hover:text-[#206295] hover:bg-muted"><Copy className="h-3 w-3" /></button>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{isInboard ? "Inboard" : "Outboard"}</Badge>
                  {r.priority === "urgent" && <Badge className="text-[10px] px-1.5 py-0 bg-[#FF6F62]/15 text-[#C4402F]">Urgent</Badge>}
                </div>
                <h3 className="text-[17px] leading-snug font-bold text-foreground tracking-tight truncate mt-1">{from} → {to}</h3>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <Badge className={`text-xs ${statusClass(r.status)}`}>{statusLabel(r.status)}</Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" data-testid={`more-logistics-${r.id}`}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => onOpen(r)}><Eye className="h-4 w-4 mr-2" /> View details</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {/* Stat strip — fills the width, evenly distributed */}
            <div className="mt-3.5 pt-3.5 border-t border-border/60 grid grid-cols-2 sm:grid-cols-5 gap-x-6 gap-y-3">
              <Stat label="Cargo" value={`${r.quantity} unit${r.quantity !== 1 ? "s" : ""}`} />
              <Stat label="Weight" value={fmtKg(r.weightKg)} />
              <Stat label="Goods" value={<span className="capitalize">{r.goodsCategory || "—"}</span>} />
              <Stat label="Pickup" value={fmtDate(r.pickupDate)} />
              <Stat label="Delivery" value={fmtDate(r.deliveryDate)} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
