import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { statusColors } from "../lib/movement-status";

export function MovementCard({ m, isHandler, onAction }: any) {
  const fromLabel = m.fromLocationText || m.fromLocationId || "—";
  const toLabel = m.toLocationText || m.toLocationId || "—";
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
