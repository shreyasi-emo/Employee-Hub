import { Badge } from "@/components/ui/badge";
import { statusClass, statusLabel } from "@/lib/status";
import { PackageOpen, PackageCheck, MapPin, ArrowRight, CalendarClock } from "lucide-react";
import { format } from "date-fns";

export function LogisticsRequestCard({ r, locName, onOpen }: {
  r: any; locName: (id: string) => string | undefined; onOpen: (r: any) => void;
}) {
  const isInboard = r.requestType === "inboard";
  const Icon = isInboard ? PackageCheck : PackageOpen;
  const from = r.fromLocationText || locName(r.fromLocationId) || "—";
  const to = r.toLocationText || locName(r.toLocationId) || "—";
  return (
    <button onClick={() => onOpen(r)} className="w-full text-left card-surface rounded-[16px] p-4 hover-elevate flex items-center gap-4" data-testid={`logistics-card-${r.id}`}>
      <span className="h-10 w-10 rounded-xl bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0"><Icon className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-foreground">{r.reference}</span>
          <Badge variant="secondary" className="text-[10px]">{isInboard ? "Inboard" : "Outboard"}</Badge>
          {r.priority === "urgent" && <Badge className="text-[10px] bg-[#FF6F62]/15 text-[#C4402F]">Urgent</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1.5 truncate max-w-full"><MapPin className="h-3.5 w-3.5 flex-shrink-0" /> {from} <ArrowRight className="h-3 w-3 flex-shrink-0" /> {to}</p>
        <p className="text-[11px] text-muted-foreground mt-1 truncate">{r.quantity} unit{r.quantity !== 1 ? "s" : ""}{r.weightKg ? ` · ${r.weightKg} kg` : ""}{r.goodsCategory ? ` · ${r.goodsCategory}` : ""}</p>
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <Badge className={`text-xs ${statusClass(r.status)}`}>{statusLabel(r.status)}</Badge>
        {r.pickupDate && <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" /> {format(new Date(r.pickupDate), "d MMM")}</span>}
      </div>
    </button>
  );
}
