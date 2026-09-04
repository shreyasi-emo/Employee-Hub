import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { statusColors } from "../lib/movement-status";

export function MovementCard({ m, isHandler, onAction }: any) {
  const isMobile = useIsMobile();
  const fromLabel = m.fromLocationText || m.fromLocationId || "—";
  const toLabel = m.toLocationText || m.toLocationId || "—";

  // Handler action buttons — shared by both layouts (stacked below the row on mobile).
  const handlerActions = isHandler && (
    <div className="flex flex-wrap gap-2 pt-2 border-t">
      {m.status === "submitted" && <>
        <Button size="sm" onClick={() => onAction(m.id, "accept")}>Accept</Button>
        <Button size="sm" variant="outline" onClick={() => onAction(m.id, "escalate")}>Escalate to CEO</Button>
        <Button size="sm" variant="ghost" onClick={() => onAction(m.id, "reject")}>Reject</Button>
      </>}
      {m.status === "accepted" && <Button size="sm" onClick={() => onAction(m.id, "dispatch")}>Mark dispatched</Button>}
      {m.status === "dispatched" && <Button size="sm" onClick={() => onAction(m.id, "in-transit")}>Mark in transit</Button>}
      {(m.status === "dispatched" || m.status === "in_transit") && <Button size="sm" onClick={() => onAction(m.id, "deliver")}>Mark delivered</Button>}
    </div>
  );

  // Mobile: a compact single-row card (ref + status · route · item summary · dates), with the
  // handler action buttons stacked below the row unchanged.
  if (isMobile) {
    return (
      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start gap-3">
            <span className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5"><MapPin className="h-4 w-4 text-muted-foreground" /></span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-foreground truncate">{m.reference}</span>
                <Badge className={`text-[10px] flex-shrink-0 ${statusColors[m.status] || ""}`}>{m.status.replace(/_/g, " ")}</Badge>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5 min-w-0">
                <MapPin className="h-3 w-3 flex-shrink-0" /><span className="truncate">{fromLabel}</span>
                <ArrowRight className="h-3 w-3 flex-shrink-0" /><span className="truncate">{toLabel}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 truncate">
                <span className="whitespace-nowrap">{(m.items || []).length} item(s)</span>
                <span className="text-border">|</span>
                <span className="whitespace-nowrap">{m.totalQuantity ?? 0} units</span>
                <span className="text-border">|</span>
                <span className="whitespace-nowrap">{m.totalWeightKg ?? 0} kg</span>
                {m.priority !== "normal" && <><span className="text-border">|</span><span className="capitalize whitespace-nowrap">{m.priority}</span></>}
              </div>
            </div>
            <div className="text-right text-[11px] text-muted-foreground flex-shrink-0">
              {m.requestedDate && <div className="whitespace-nowrap">Needed {format(new Date(m.requestedDate), "d MMM")}</div>}
              <div className="whitespace-nowrap">{format(new Date(m.createdAt), "d MMM yyyy")}</div>
            </div>
          </div>
          {m.notes && <p className="text-xs text-muted-foreground">{m.notes}</p>}
          {handlerActions}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{m.reference}</span>
              <Badge className={statusColors[m.status] || ""}>{m.status.replace(/_/g, " ")}</Badge>
              {m.priority !== "normal" && <Badge variant="outline">{m.priority}</Badge>}
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm">
              <MapPin className="h-3 w-3" /> {fromLabel}
              <ArrowRight className="h-3 w-3" /> {toLabel}
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {m.requestedDate && <div>Needed {format(new Date(m.requestedDate), "d MMM")}</div>}
            <div>{format(new Date(m.createdAt), "d MMM yyyy")}</div>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {(m.items || []).length} item(s) · {m.totalQuantity ?? 0} units · {m.totalWeightKg ?? 0} kg
        </div>
        {m.notes && <p className="text-sm">{m.notes}</p>}
        {isHandler && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {m.status === "submitted" && <>
              <Button size="sm" onClick={() => onAction(m.id, "accept")}>Accept</Button>
              <Button size="sm" variant="outline" onClick={() => onAction(m.id, "escalate")}>Escalate to CEO</Button>
              <Button size="sm" variant="ghost" onClick={() => onAction(m.id, "reject")}>Reject</Button>
            </>}
            {m.status === "accepted" && <Button size="sm" onClick={() => onAction(m.id, "dispatch")}>Mark dispatched</Button>}
            {m.status === "dispatched" && <Button size="sm" onClick={() => onAction(m.id, "in-transit")}>Mark in transit</Button>}
            {(m.status === "dispatched" || m.status === "in_transit") && <Button size="sm" onClick={() => onAction(m.id, "deliver")}>Mark delivered</Button>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
