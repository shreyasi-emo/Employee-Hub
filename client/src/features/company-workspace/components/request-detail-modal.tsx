import { formatDate, formatStatus, money, money2, REVOCABLE_BLOCK } from "../shared/request-format";
import { buildTimeline } from "../shared/request-timeline";
import { Row, Timeline } from "./request-ui";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { FileText, Ban } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "../reimbursements/components/status-badge";
import { statusClass, statusLabel } from "@/lib/status";

// Read-only detail popup for any request type. No navigation — opens in place.
export function RequestDetailModal({ detail, onClose }: { detail: { type: string; item: any } | null; onClose: () => void }) {
  const { toast } = useToast();
  const revoke = useMutation({
    mutationFn: () => {
      const d = detail!;
      const url = d.type === "reimbursement"
        ? `/api/reimbursements/${d.item.id}/revoke`
        : `/api/my-requests/${d.type === "purchase" ? "purchases" : d.type === "travel" ? "travels" : "tickets"}/${d.item.id}/revoke`;
      return apiRequest("POST", url, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/") });
      toast({ title: "Request revoked" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Could not revoke", description: e.message, variant: "destructive" }),
  });
  if (!detail) return null;
  const { type, item } = detail;
  const titleMap: Record<string, string> = { purchase: "Purchase Request", travel: "Travel Request", ticket: "Support Ticket", reimbursement: "Reimbursement Claim" };
  const isReimb = type === "reimbursement";
  const canRevoke = !REVOCABLE_BLOCK.includes(item.status);
  const lines: any[] = Array.isArray(item.lines) ? item.lines : [];
  const subTotal = lines.length ? lines.reduce((s, l) => s + (Number(l.amount) || 0), 0) : Number(item.totalAmount || 0);
  const advance = Number(item.cashAdvance) || 0;
  const steps = buildTimeline(type, item);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto overflow-x-hidden rounded-[16px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {titleMap[type] || "Request"}
            {isReimb ? <StatusBadge status={item.status} /> : <Badge className={`text-xs ${statusClass(item.status)}`}>{statusLabel(item.status)}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {/* ---- Details table ---- */}
        <table className="w-full table-fixed">
          <tbody>
            {type === "purchase" && <>
              <Row label="Category" value={formatStatus(item.category)} />
              <Row label="Estimated Cost" value={item.estimatedCost ? money(item.estimatedCost) : null} />
              <Row label="Needed By" value={item.neededByDate ? formatDate(item.neededByDate) : null} />
              <Row label="Department" value={item.department} />
              <Row label="Notes" value={item.notes} />
            </>}
            {type === "travel" && <>
              <Row label="Route" value={`${item.fromCity || "?"} → ${item.toCity || "?"}`} />
              <Row label="Purpose" value={item.purpose} />
              <Row label="Travel Date" value={item.travelDate ? formatDate(item.travelDate) : null} />
              <Row label="Return Date" value={item.returnDate ? formatDate(item.returnDate) : null} />
              <Row label="Preferences" value={item.preferences} />
              <Row label="Estimated Budget" value={item.estimatedBudget ? money(item.estimatedBudget) : null} />
            </>}
            {type === "ticket" && <>
              <Row label="Subject" value={item.subject} />
              <Row label="Category" value={formatStatus(item.category)} />
              <Row label="Priority" value={formatStatus(item.priority)} />
              <Row label="Description" value={item.description} />
            </>}
            {isReimb && <>
              <Row label="Reference" value={item.reference} />
              <Row label="Category" value={item.category} />
              <Row label="Business Purpose" value={item.businessPurpose} />
              <Row label="Period" value={item.periodFrom ? `${formatDate(item.periodFrom)} – ${formatDate(item.periodTo || item.periodFrom)}` : null} />
              <Row label="Invoice No." value={item.invoiceNumber} />
              <Row label="Invoice Date" value={item.invoiceDate ? formatDate(item.invoiceDate) : null} />
              <Row label="Finance Remark" value={item.financeNote} />
              <Row label="Decision Note" value={item.decisionNote} />
            </>}
            <Row label="Created" value={item.createdAt ? formatDate(item.createdAt) : null} />
          </tbody>
        </table>

        {/* ---- Purchase line items ---- */}
        {type === "purchase" && Array.isArray(item.items) && item.items.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Items</p>
            <div className="space-y-1.5">
              {item.items.map((it: any, i: number) => (
                <div key={i} className="bg-muted/40 rounded-[16px] p-2.5 text-xs break-words">
                  <span className="font-medium text-foreground">{it.description}</span> · Qty {it.qty || 1}{it.estimatedCost ? ` · ${money(it.estimatedCost)}` : ""}
                  {it.link && <a href={it.link} target="_blank" rel="noreferrer" className="block text-[#206295] hover:underline mt-0.5 break-all">{it.link}</a>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---- Reimbursement line items + bill (with cash advance) ---- */}
        {isReimb && lines.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Expense Items</p>
            <div className="rounded-[16px] border border-border overflow-hidden">
              <table className="w-full table-fixed text-xs">
                <thead>
                  <tr className="bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground text-left">
                    <th className="py-2 px-3 font-medium">Item</th>
                    <th className="py-2 px-2 font-medium w-16 text-center">Invoice</th>
                    <th className="py-2 px-3 font-medium w-24 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {lines.map((l: any, i: number) => (
                    <tr key={i} className="align-top">
                      <td className="py-2.5 px-3">
                        <p className="font-medium text-foreground break-words">{l.description || `Item ${i + 1}`}</p>
                        <p className="text-[11px] text-muted-foreground break-words mt-0.5">
                          {[l.nature || l.category, l.invoiceNo ? `Inv ${l.invoiceNo}` : null, l.invoiceDate ? formatDate(l.invoiceDate) : null].filter(Boolean).join("  |  ")}
                        </p>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        {l.fileData ? <a href={l.fileData} target="_blank" rel="noreferrer" className="text-[#206295] inline-flex items-center gap-1 hover:underline"><FileText className="h-3 w-3" /> View</a> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-foreground whitespace-nowrap">{money2(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 rounded-[16px] border border-border p-3 bg-muted/30 space-y-1.5 ml-auto sm:w-64">
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Sub Total</span><span className="font-semibold text-foreground">{money2(subTotal)}</span></div>
              {advance > 0 && <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Less: Cash Advance</span><span className="font-semibold text-[#FF6F62]">− {money2(advance)}</span></div>}
              <div className="flex items-center justify-between pt-1.5 border-t border-border"><span className="text-sm font-semibold text-foreground">Total to be Paid</span><span className="text-base font-bold text-[#206295]">{money2(subTotal - advance)}</span></div>
            </div>
          </div>
        )}

        {/* ---- Approval timeline ---- */}
        <Separator className="my-1" />
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Approval Timeline</p>
          <Timeline steps={steps} cancelled={item.status === "cancelled"} />
        </div>

        {/* ---- Revoke ---- */}
        {canRevoke && (
          <DialogFooter>
            <Button variant="ghost" className="btn-glass border-[1.5px] border-[#FF6F62] text-[#FF6F62] hover:text-[#FF6F62]" disabled={revoke.isPending}
              onClick={() => { if (window.confirm("Revoke this request? This cannot be undone.")) revoke.mutate(); }} data-testid="button-revoke-request">
              <Ban className="h-4 w-4 mr-1.5" /> {revoke.isPending ? "Revoking…" : "Revoke Request"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
