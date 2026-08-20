import { cap, money, fmtDate } from "../shared/approval-format";
import { Field } from "./approval-ui";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink } from "lucide-react";
import { statusClass, statusLabel } from "@/lib/status";

export function ActivityDetailModal({ row, onClose }: { row: any; onClose: () => void }) {
  const r = row.raw || {};
  const itemsText = (arr: any) => Array.isArray(arr) && arr.length
    ? arr.map((i: any) => (i && typeof i === "object" ? `${i.description || i.name || "Item"}${i.qty ? ` ×${i.qty}` : ""}` : String(i))).join(", ")
    : null;
  const fields: [string, any][] = [];
  const add = (label: string, val: any) => fields.push([label, val]);

  switch (row.kind) {
    case "purchase":
      add("Category", cap(r.category)); add("Items", itemsText(r.items)); add("Estimated Cost", r.estimatedCost != null ? money(r.estimatedCost) : null);
      add("Department", r.department); add("Needed By", r.neededByDate ? fmtDate(r.neededByDate) : null); add("PO Number", r.poNumber); add("Notes", r.notes);
      break;
    case "travel":
      add("Purpose", r.purpose); add("Route", r.category === "flight" ? `${r.details?.fromCity || "?"} → ${r.details?.toCity || "?"}` : r.category === "stay" ? (r.details?.city || null) : `${r.details?.from || "?"} → ${r.details?.to || "?"}`);
      add("Travel Date", r.startDate ? fmtDate(r.startDate) : null); add("Return Date", r.endDate && r.endDate !== r.startDate ? fmtDate(r.endDate) : null); add("Amount", r.amount != null && Number(r.amount) > 0 ? money(r.amount) : null);
      add("Preferences", r.preferences); add("Assigned To", r.assignedToName); add("Notes", r.notes);
      break;
    case "ticket":
      add("Category", cap(r.category)); add("Subject", r.subject); add("Description", r.description); add("Priority", cap(r.priority));
      add("Resolved At", r.resolvedAt ? fmtDate(r.resolvedAt) : null);
      break;
    case "reimbursement":
      add("Reference", r.reference); add("Category", r.category); add("Amount", money(r.totalAmount)); add("Description", r.description);
      add("Invoice No.", r.invoiceNumber); add("Invoice Date", r.invoiceDate ? fmtDate(r.invoiceDate) : null); add("Decision Note", r.decisionNote);
      break;
    case "office_purchase":
      add("Reference", r.reference);
      add("Items", Array.isArray(r.items) ? r.items.map((i: any) => `${i.description || "Item"}${i.quantity ? ` ×${i.quantity}` : ""}`).filter(Boolean).join(", ") : null);
      add("Priority", cap(r.priority)); add("Total", Number(r.totalAmount) > 0 ? money(r.totalAmount) : null); add("Justification", r.justification);
      break;
    case "procurement":
      add("Reference", r.reference);
      add("Items", Array.isArray(r.items) ? r.items.map((i: any) => `${i.description || "Item"}${i.quantity ? ` ×${i.quantity}` : ""}`).filter(Boolean).join(", ") : null);
      add("Total", Number(r.totalAmount) > 0 ? money(r.totalAmount) : null); add("Purpose", r.justification);
      break;
    case "request":
      add("Reference", r.reference); add("Type", cap(r.type)); add("Title", r.title); add("Description", r.description); add("Routed To", r.routeToTeam);
      add("Quantity", r.quantity); add("Estimated Cost", r.estimatedCost != null ? money(r.estimatedCost) : null); add("Priority", cap(r.priority));
      add("Needed By", r.neededByDate ? fmtDate(r.neededByDate) : null); add("Resolution", r.resolutionNote);
      break;
    case "logistics":
      add("Reference", r.reference); add("Movement Type", cap(r.movementType)); add("Route", `${r.fromLocationText || "?"} → ${r.toLocationText || "?"}`);
      add("Items", itemsText(r.items)); add("Priority", cap(r.priority)); add("Requested Date", r.requestedDate ? fmtDate(r.requestedDate) : null);
      add("Carrier", r.carrier); add("Tracking", r.trackingNumber); add("Estimated Cost", r.estimatedCost != null ? money(r.estimatedCost) : null); add("Notes", r.notes);
      break;
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{row.type} Details</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`text-xs ${statusClass(row.status)}`}>{statusLabel(row.status)}</Badge>
            <span className="text-xs text-muted-foreground">{fmtDate(row.date)}</span>
          </div>
          <div className="list-divider">
            <Field label="Requester" value={row.requester} />
            {fields.map(([l, v]) => <Field key={l} label={l} value={v} />)}
            <Field label="Approved By" value={row.approvedBy && row.approvedBy !== "—" ? row.approvedBy : null} />
          </div>
          {r.invoiceUrl && (
            <a href={r.invoiceUrl} target="_blank" rel="noreferrer" className="text-xs text-[#206295] inline-flex items-center gap-1 hover:underline">
              <ExternalLink className="h-3 w-3" /> View invoice
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
