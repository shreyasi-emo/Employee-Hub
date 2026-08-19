import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { statusClass, statusLabel } from "@/lib/status";
import { format } from "date-fns";
import { Package, ExternalLink, IndianRupee, CircleCheck, X, User, CalendarClock, Copy, MessageSquare } from "lucide-react";
import { CommentThread } from "@/components/shared/comment-thread";

export const canProcureApprove = (role?: string) => !!role && (role === "super_admin" || role === "ceo_approver");
const money = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const normalizeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
function linkLabel(u: string) {
  try { const url = new URL(normalizeUrl(u)); const seg = url.pathname.split("/").filter(Boolean)[0]; const host = url.hostname.replace(/^www\./, ""); return seg ? `${host}/${seg.slice(0, 16)}` : host; } catch { return u; }
}
export const invalidateProcurement = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/procurement") });

function LinkChip({ url }: { url: string }) {
  const { toast } = useToast();
  const href = normalizeUrl(url);
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 pl-2 pr-1 py-0.5 max-w-full">
      <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-[#206295] hover:underline min-w-0"><ExternalLink className="h-3 w-3 flex-shrink-0" /><span className="truncate max-w-[190px]">{linkLabel(url)}</span></a>
      <button type="button" onClick={() => { navigator.clipboard?.writeText(href); toast({ title: "Link copied" }); }} aria-label="Copy link" className="h-5 w-5 rounded inline-flex items-center justify-center text-muted-foreground hover:text-[#206295] hover:bg-background flex-shrink-0"><Copy className="h-3 w-3" /></button>
    </span>
  );
}

// Detail + CEO decision. Employee-priced Amazon procurement that goes straight to the CEO.
export function ProcurementDetailDialog({ id, open, onClose, context = "owner" }: { id: string | null; open: boolean; onClose: () => void; context?: "owner" | "approver" }) {
  const { data: auth } = useAuth();
  const role = auth?.user?.role;
  const meId = auth?.user?.id;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [resItems, setResItems] = useState<any[] | null>(null);  // requester's edits when answering a CEO query
  const [resJust, setResJust] = useState<string | null>(null);
  const { data: order } = useQuery<any>({ queryKey: [`/api/procurement/${id}`], enabled: !!id && open });

  const act = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: any }) => apiRequest("POST", `/api/procurement/${id}/${path}`, body || {}),
    onSuccess: (_d, vars) => {
      invalidateProcurement(qc); qc.invalidateQueries({ queryKey: [`/api/procurement/${id}`] });
      const MSG: Record<string, string> = { approve: "Approved", reject: "Rejected", cancel: "Request cancelled" };
      toast({ title: MSG[vars.path] || "Done" }); setNote("");
    },
    onError: (e: any) => toast({ title: "Action failed", description: e.message, variant: "destructive" }),
  });

  // Requester answering a query: save the edited items + note, then flip back to the CEO with a resubmitted marker.
  const resubmit = useMutation({
    mutationFn: () => apiRequest("POST", `/api/procurement/${id}/resubmit`, {
      items: (resItems ?? (order?.items || [])).map((it: any) => ({ description: it.description, quantity: Number(it.quantity) || 1, link: it.link || "", unitPrice: Number(it.unitPrice) || 0 })),
      justification: resJust ?? order?.justification ?? null,
    }),
    onSuccess: () => { invalidateProcurement(qc); qc.invalidateQueries({ queryKey: [`/api/procurement/${id}`] }); toast({ title: "Resubmitted for approval" }); onClose(); },
    onError: (e: any) => toast({ title: "Action failed", description: e.message, variant: "destructive" }),
  });

  if (!order) return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Loading…</DialogTitle></DialogHeader>
        <div className="py-12 flex justify-center"><div className="h-6 w-6 rounded-full border-2 border-[#206295]/30 border-t-[#206295] animate-spin" /></div>
      </DialogContent>
    </Dialog>
  );

  const items: any[] = Array.isArray(order.items) ? order.items : [];
  const isOwner = order.requesterId === meId;
  const total = Number(order.totalAmount) || 0;
  const canEditResubmit = isOwner && order.status === "under_review";  // owner answers the CEO's query here
  const rItems = resItems ?? items.map((it) => ({ ...it }));
  const setEdit = (i: number, patch: any) => setResItems((prev) => (prev ?? items.map((it) => ({ ...it }))).map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 min-w-0 pr-6">
            <span className="h-9 w-9 rounded-xl bg-[#0E7C7B]/10 text-[#0E7C7B] flex items-center justify-center flex-shrink-0"><Package className="h-5 w-5" /></span>
            <span className="truncate">{order.reference}</span>
            <Badge className={`text-xs flex-shrink-0 ${statusClass(order.status)}`}>{statusLabel(order.status)}</Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Meta strip */}
        <div className="flex items-stretch rounded-xl border border-border/60 overflow-hidden">
          <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5">
            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0"><p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-tight">Requester</p><p className="text-sm font-semibold text-foreground truncate leading-tight mt-0.5">{order.employeeName || "Employee"}{order.employeeCode ? ` | ${order.employeeCode}` : ""}</p></div>
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 border-l border-border/60">
            <CalendarClock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0"><p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-tight">Submitted</p><p className="text-sm font-semibold text-foreground truncate leading-tight mt-0.5">{order.createdAt ? format(new Date(order.createdAt), "MMM d, yyyy") : "—"}</p></div>
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 border-l border-border/60">
            <IndianRupee className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0"><p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-tight">Total</p><p className="text-sm font-bold text-[#206295] truncate leading-tight mt-0.5">{money(total)}</p></div>
          </div>
        </div>

        {!canEditResubmit && order.justification && (
          <p className="text-sm text-foreground/80"><span className="text-xs uppercase tracking-wide text-muted-foreground mr-2">Note</span>{order.justification}</p>
        )}

        <Separator />

        {/* Items */}
        <div className="space-y-2">
          {canEditResubmit
            ? rItems.map((it: any, i: number) => (
              <div key={i} className="rounded-xl border border-border/60 p-3 grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-12 sm:col-span-5 h-8 text-xs" value={it.description || ""} onChange={(e) => setEdit(i, { description: e.target.value })} placeholder="Item description" />
                <Input className="col-span-3 sm:col-span-2 h-8 text-xs" type="number" min="1" value={it.quantity ?? 1} onChange={(e) => setEdit(i, { quantity: Number(e.target.value) || 1 })} placeholder="Qty" />
                <Input className="col-span-4 sm:col-span-2 h-8 text-xs" type="number" min="0" value={it.unitPrice ?? 0} onChange={(e) => setEdit(i, { unitPrice: Number(e.target.value) || 0 })} placeholder="₹ each" />
                <Input className="col-span-5 sm:col-span-3 h-8 text-xs" value={it.link || ""} onChange={(e) => setEdit(i, { link: e.target.value })} placeholder="Link (optional)" />
              </div>
            ))
            : items.map((it, i) => {
              const line = (Number(it.unitPrice) || 0) * (Number(it.quantity) || 0);
              return (
                <div key={i} className="rounded-xl border border-border/60 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground min-w-0 truncate">{it.description || `Item ${i + 1}`} <span className="text-muted-foreground font-normal">× {it.quantity}</span></p>
                    <span className="text-sm font-semibold text-foreground flex-shrink-0">{money(line)}</span>
                  </div>
                  {it.link && <div className="flex flex-wrap items-center gap-1.5"><span className="text-[11px] font-medium text-muted-foreground flex-shrink-0">Link:</span><LinkChip url={it.link} /></div>}
                </div>
              );
            })}
        </div>

        {/* Discussion thread — CEO queries + requester replies. */}
        {(context === "approver" || isOwner || (order.comments || []).length > 0) && (
          <div className="rounded-xl border border-border p-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Discussion</p>
            <CommentThread basePath="/api/procurement" id={order.id} comments={order.comments || []} invalidateKey="/api/procurement" meId={meId} />
          </div>
        )}

        {/* CEO decision */}
        {context === "approver" && canProcureApprove(role) && order.status === "pending_approval" && (
          <div className="rounded-xl border border-border p-3 space-y-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Decision note (optional)" className="h-9" />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 text-[#FF6F62] border-[#FF6F62]/40" disabled={act.isPending} onClick={() => act.mutate({ path: "reject", body: { note } })}>Reject</Button>
              <Button className="btn-primary-gradient flex-1" disabled={act.isPending} onClick={() => act.mutate({ path: "approve", body: { note } })}><CircleCheck className="h-4 w-4 mr-1.5" /> Approve</Button>
            </div>
          </div>
        )}

        {/* Requester: answer the CEO's query → edit items above, then resubmit */}
        {canEditResubmit && (
          <div className="rounded-xl border border-[#206295]/30 bg-[#206295]/[0.05] p-3 space-y-2">
            <p className="text-xs text-muted-foreground">The CEO raised a query. Update the items above (and the note), then resend for approval.</p>
            <Input value={resJust ?? order.justification ?? ""} onChange={(e) => setResJust(e.target.value)} placeholder="Note (optional)" className="h-9" />
            <Button className="btn-primary-gradient w-full" disabled={resubmit.isPending || !rItems.some((it: any) => String(it.description || "").trim())} onClick={() => resubmit.mutate()}><CircleCheck className="h-4 w-4 mr-1.5" /> Resubmit for approval</Button>
          </div>
        )}

        {/* Owner cancel */}
        {isOwner && order.status === "pending_approval" && (
          <Button variant="outline" className="w-full text-[#FF6F62] border-[#FF6F62]/40" disabled={act.isPending} onClick={() => { if (window.confirm("Cancel this request?")) act.mutate({ path: "cancel" }); }}><X className="h-4 w-4 mr-1.5" /> Cancel request</Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
