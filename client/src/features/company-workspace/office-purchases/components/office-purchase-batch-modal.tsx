import { money } from "../../shared/approval-format";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable } from "@/components/shared/data-table";
import { useToast } from "@/hooks/use-toast";
import { Check, X, IndianRupee, Layers } from "lucide-react";

// One CEO card for a whole HR-sent batch — opens a table with approve/reject-all.
export function OfficePurchaseBatchModal({ items, open, onClose }: { items: any[]; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const ids = items.map((i) => i.id);
  const total = items.reduce((s, i) => s + Number(i.totalAmount || 0), 0);
  const requesters = Array.from(new Set(items.map((i) => i.employeeName).filter(Boolean)));
  const invalidateOp = () => qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/office-purchases") });
  const approve = useMutation({ mutationFn: () => apiRequest("POST", "/api/office-purchases/bulk-approve", { ids, note }), onSuccess: () => { invalidateOp(); toast({ title: "Group approved" }); onClose(); }, onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }) });
  const reject = useMutation({ mutationFn: () => apiRequest("POST", "/api/office-purchases/bulk-reject", { ids, note }), onSuccess: () => { invalidateOp(); toast({ title: "Group rejected" }); onClose(); }, onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }) });
  const busy = approve.isPending || reject.isPending;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0 border-b border-border">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0"><Layers className="h-5 w-5" /></span>
            Purchase group | {items.length} request{items.length !== 1 ? "s" : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-5 space-y-3">
        <div className="flex items-end gap-1"><IndianRupee className="h-7 w-7 text-[#206295] mb-1" /><span className="text-[2rem] leading-none font-bold text-[#206295] tabular-nums">{total.toLocaleString("en-IN")}</span></div>
        <p className="text-xs text-muted-foreground">{requesters.length} requester{requesters.length !== 1 ? "s" : ""}: {requesters.join(", ") || "—"}</p>
        <div className="card-surface rounded-2xl">
          <DataTable
            columns={[
              { key: "reference", header: "Reference", cellClassName: "font-medium text-foreground" },
              { key: "requester", header: "Requester", render: (o: any) => <span className="text-foreground">{o.employeeName || "—"}<span className="text-muted-foreground"> ({o.employeeCode || "—"})</span></span> },
              { key: "items", header: "Items", cellClassName: "text-muted-foreground max-w-[16rem] truncate", render: (o: any) => (o.items || []).map((i: any) => `${i.description}${i.quantity ? ` ×${i.quantity}` : ""}`).filter(Boolean).join(", ") || "—" },
              { key: "amount", header: "Amount", align: "right", cellClassName: "font-semibold text-foreground", render: (o: any) => money(o.totalAmount) },
            ]}
            rows={items}
            getRowKey={(o: any) => o.id}
            testIdPrefix="batch-row"
          />
        </div>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Decision note (optional)" className="h-9" />
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-border flex-shrink-0">
          <Button variant="outline" className="flex-1 text-[#FF6F62] border-[#FF6F62]/40" disabled={busy} onClick={() => reject.mutate()}><X className="h-4 w-4 mr-1.5" /> Reject all</Button>
          <Button className="btn-primary-gradient flex-1" disabled={busy} onClick={() => approve.mutate()}><Check className="h-4 w-4 mr-1.5" /> Approve all</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
