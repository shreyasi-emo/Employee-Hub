import { money, isResubmittedThread } from "../shared/approval-format";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { CommentThread } from "@/components/shared/comment-thread";
import { Check, X, ChevronDown, MessageSquare, ExternalLink, Layers } from "lucide-react";

// Inbox bulk-approval modal — every pending item in one category, X to drop, Approve/Reject all on the rest.
// CEO review — expand-a-row: compact list, open a row for its receipt + discussion thread + per-item
// Approve / Reject / Raise Query. Footer keeps Approve-all / Reject-all; tick rows to query several.
// Live-fetches its category so the list updates as items are decided or moved to Under Review.
export function CeoReviewModal({ cfg, onClose }: { cfg: any; onClose: () => void }) {
  const { data: auth } = useAuth();
  const meId = auth?.user?.id;
  const { toast } = useToast();
  const qc = useQueryClient();
  const base = cfg.basePath as string;
  const { data: all = [] } = useQuery<any[]>({ queryKey: [base] });
  const statuses: string[] = cfg.statuses || ["pending_approval"];
  const rows = (all as any[]).filter((r) => statuses.includes(r.status));
  const [sortBy, setSortBy] = useState<"amount" | "age">("amount");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [rowForm, setRowForm] = useState<{ id: string; kind: "reject" | "query" } | null>(null);
  const [rowNote, setRowNote] = useState("");
  const [bulkMode, setBulkMode] = useState<null | "reject" | "query">(null);
  const [bulkNote, setBulkNote] = useState("");
  const allIds = rows.map((r) => r.id);
  const actIds = sel.size > 0 ? Array.from(sel) : allIds;  // Approve/Reject act on ticked rows when any are selected, else the whole lane.
  const total = rows.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0);
  const sortedRows = [...rows].sort((a, b) => sortBy === "amount" ? (Number(b.totalAmount) || 0) - (Number(a.totalAmount) || 0) : (+new Date(a.createdAt || 0)) - (+new Date(b.createdAt || 0)));
  // Office purchases carry a batchId when HR bundled several requests into one group to send the CEO.
  const groups = (() => {
    const seen = new Map<string, any>(); const out: { key: string; batchId: string | null; rows: any[] }[] = [];
    for (const r of sortedRows) { const bid = r.batchId || null; if (!bid) { out.push({ key: `s-${r.id}`, batchId: null, rows: [r] }); continue; } let e = seen.get(bid); if (!e) { e = { key: `g-${bid}`, batchId: bid, rows: [] }; seen.set(bid, e); out.push(e); } e.rows.push(r); }
    return out;
  })();
  const gTotal = (arr: any[]) => arr.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0);
  const waitDays = (d: any) => Math.max(0, Math.floor((Date.now() - +new Date(d || Date.now())) / 86400000));
  const rejectBtn = "border-[#FF6F62]/40 text-[#FF6F62] hover:bg-[#FF6F62]/10 hover:text-[#FF6F62]";
  const queryBtn = "border-[#D98324]/40 text-[#D98324] hover:bg-[#FFA962]/15 hover:text-[#D98324]";
  const normUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
  const shortLink = (u: string) => { try { return new URL(normUrl(u)).host.replace(/^www\./, ""); } catch { return u; } };
  const invalidate = () => qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith(cfg.invalidateKey) });
  const single = useMutation({ mutationFn: ({ path, id, body }: any) => apiRequest("POST", `${base}/${id}/${path}`, body || {}), onSuccess: (_d, v: any) => { invalidate(); toast({ title: v.msg }); setRowForm(null); setRowNote(""); }, onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }) });
  const bulk = useMutation({ mutationFn: ({ path, ids, body }: any) => apiRequest("POST", `${base}/${path}`, { ids, ...(body || {}) }), onSuccess: (_d, v: any) => { invalidate(); toast({ title: v.msg }); setSel(new Set()); setBulkMode(null); setBulkNote(""); }, onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }) });
  const busy = single.isPending || bulk.isPending;
  const toggleSel = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{cfg.title} | {cfg.lane || "Pending"} ({rows.length})</DialogTitle></DialogHeader>
        <div className="flex items-center justify-end gap-1.5">
          <span className="text-[11px] text-muted-foreground">Sort</span>
          {(["amount", "age"] as const).map((s) => <button key={s} onClick={() => setSortBy(s)} className={`text-[11px] px-2 py-0.5 rounded-full transition-colors ${sortBy === s ? "bg-[#206295] text-white" : "bg-muted text-muted-foreground hover-elevate"}`} data-testid={`ceo-sort-${s}`}>{s === "amount" ? "Amount" : "Oldest"}</button>)}
        </div>
        <ScrollArea className="max-h-[60vh] pr-3 -mr-3">
          <div className="space-y-2">
            {sortedRows.length === 0 && <p className="text-sm text-muted-foreground py-10 text-center">Nothing pending here.</p>}
            {(() => {
              const renderRow = (r: any) => {
              const open = expanded === r.id;
              const amount = Number(r.totalAmount) || 0;
              const items = (r.items || []) as any[];
              const cc = (r.comments || []).length;
              return (
                <div key={r.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <Checkbox checked={sel.has(r.id)} onCheckedChange={() => toggleSel(r.id)} onClick={(e: any) => e.stopPropagation()} />
                    <button type="button" className="min-w-0 flex-1 flex items-center gap-3 text-left" onClick={() => setExpanded(open ? null : r.id)}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-[13px] font-semibold text-foreground truncate">{items.length ? `${items[0]?.description || "Item"}${Number(items[0]?.quantity) > 1 ? ` ×${items[0].quantity}` : ""}${items.length > 1 ? ` +${items.length - 1} more` : ""}` : (r.reference || "Request")}</p>
                          {isResubmittedThread(r.comments) && <Badge className="text-[9px] flex-shrink-0 bg-[#206295]/15 text-[#206295]">Resubmitted</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{r.employeeName || "Employee"}{r.department ? ` | ${r.department}` : ""}{items.length ? ` | ${items.length} item${items.length !== 1 ? "s" : ""}` : ""} | {r.reference}</p>
                      </div>
                      {waitDays(r.createdAt) >= 1 && <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${waitDays(r.createdAt) >= 3 ? "bg-[#FF6F62]/15 text-[#C4402F]" : "bg-muted text-muted-foreground"}`}>{waitDays(r.createdAt)}d</span>}
                      {cc > 0 && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground flex-shrink-0"><MessageSquare className="h-3.5 w-3.5" />{cc}</span>}
                      <span className="text-base font-bold text-[#206295] tabular-nums flex-shrink-0">{money(amount)}</span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                  {open && (
                    <div className="border-t border-border bg-muted/20 px-3 py-3 space-y-3">
                      <div className="rounded-lg border border-border/70 bg-card divide-y divide-border/60">
                        {items.map((it, i) => {
                          const link = it.finalLink || it.link;
                          return (
                            <div key={i} className="flex items-start gap-2 px-3 py-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-[13px] text-foreground">{it.description || "Item"} <span className="text-muted-foreground">× {it.quantity || 1}</span></p>
                                {link && <a href={normUrl(link)} target="_blank" rel="noreferrer" className="text-[11px] text-[#206295] hover:underline inline-flex items-center gap-1 mt-0.5"><ExternalLink className="h-3 w-3" />{shortLink(link)}</a>}
                              </div>
                              <span className="text-[13px] font-medium tabular-nums flex-shrink-0">{money((Number(it.unitPrice) || 0) * (Number(it.quantity) || 0))}</span>
                            </div>
                          );
                        })}
                        <div className="flex items-center justify-between px-3 py-2 bg-muted/40">
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Total</span>
                          <span className="text-sm font-bold text-[#206295] tabular-nums">{money(amount)}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Discussion</p>
                        <CommentThread basePath={base} id={r.id} comments={r.comments || []} invalidateKey={cfg.invalidateKey} meId={meId} />
                      </div>
                      {rowForm && rowForm.id === r.id ? (
                        <div className="space-y-2">
                          <Textarea autoFocus rows={2} value={rowNote} onChange={(e) => setRowNote(e.target.value)} placeholder={rowForm.kind === "reject" ? "Reason for rejection" : "What do you need from HR?"} />
                          <div className="flex justify-end gap-2">
                            <Button variant="secondary" size="sm" disabled={busy} onClick={() => { setRowForm(null); setRowNote(""); }}>Cancel</Button>
                            {rowForm.kind === "reject"
                              ? <Button size="sm" variant="outline" className={rejectBtn} disabled={busy || !rowNote.trim()} onClick={() => single.mutate({ path: "reject", id: r.id, body: { note: rowNote }, msg: "Rejected" })}>Confirm reject</Button>
                              : <Button size="sm" variant="outline" className={queryBtn} disabled={busy || !rowNote.trim()} onClick={() => single.mutate({ path: "query", id: r.id, body: { body: rowNote }, msg: "Query raised" })}>Send query</Button>}
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className={queryBtn} disabled={busy} onClick={() => { setRowForm({ id: r.id, kind: "query" }); setRowNote(""); }}><MessageSquare className="h-4 w-4 mr-1.5" /> Raise Query</Button>
                          <Button size="sm" variant="outline" className={rejectBtn} disabled={busy} onClick={() => { setRowForm({ id: r.id, kind: "reject" }); setRowNote(""); }}><X className="h-4 w-4 mr-1.5" /> Reject</Button>
                          <Button size="sm" className="btn-primary-gradient text-white" disabled={busy} onClick={() => single.mutate({ path: "approve", id: r.id, body: {}, msg: "Approved" })}><Check className="h-4 w-4 mr-1.5" /> Approve</Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
              };
              return cfg.grouped
                ? groups.map((g) => g.rows.length > 1
                    ? (
                      <div key={g.key} className="rounded-xl border border-[#206295]/25 bg-[#206295]/[0.03] p-2 space-y-2">
                        <div className="flex items-center justify-between px-1.5 pt-0.5">
                          <span className="text-[11px] font-semibold text-[#206295] uppercase tracking-wide flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> HR group | {g.rows.length} requests</span>
                          <span className="text-xs font-bold text-[#206295] tabular-nums">{money(gTotal(g.rows))}</span>
                        </div>
                        {g.rows.map(renderRow)}
                      </div>
                    )
                    : renderRow(g.rows[0]))
                : sortedRows.map(renderRow);
            })()}
          </div>
        </ScrollArea>
        {bulkMode && <Textarea autoFocus rows={2} value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} placeholder={bulkMode === "reject" ? `Reason for rejecting ${actIds.length}` : `Message HR about ${sel.size} selected`} />}
        {!bulkMode && sel.size > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-[#FFA962]/10 px-3 py-2">
            <span className="text-xs font-medium text-[#D98324]">{sel.size} selected</span>
            <Button size="sm" variant="outline" className={queryBtn} disabled={busy} onClick={() => setBulkMode("query")}><MessageSquare className="h-4 w-4 mr-1.5" /> Raise Query on {sel.size}</Button>
          </div>
        )}
        <DialogFooter className="items-center">
          <div className="mr-auto flex items-center gap-2.5">
            <span className="text-xl font-bold text-foreground tabular-nums">{money(total)}</span>
            <span className="h-4 w-px bg-border" /><span className="text-xs text-muted-foreground">{rows.length} item{rows.length !== 1 ? "s" : ""}</span>
          </div>
          {bulkMode ? (
            <>
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => { setBulkMode(null); setBulkNote(""); }}>Cancel</Button>
              {bulkMode === "reject"
                ? <Button size="sm" variant="outline" className={rejectBtn} disabled={busy || !bulkNote.trim() || !actIds.length} onClick={() => bulk.mutate({ path: "bulk-reject", ids: actIds, body: { note: bulkNote }, msg: sel.size > 0 ? `Rejected ${actIds.length}` : "Rejected all" })}><X className="h-4 w-4 mr-1.5" /> {sel.size > 0 ? `Reject ${actIds.length}` : "Reject all"}</Button>
                : <Button size="sm" variant="outline" className={queryBtn} disabled={busy || !bulkNote.trim() || !sel.size} onClick={() => bulk.mutate({ path: "bulk-query", ids: [...sel], body: { body: bulkNote }, msg: `Query raised on ${sel.size}` })}><MessageSquare className="h-4 w-4 mr-1.5" /> Send query</Button>}
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" className={rejectBtn} disabled={busy || !rows.length} onClick={() => setBulkMode("reject")}><X className="h-4 w-4 mr-1.5" /> {sel.size > 0 ? `Reject selected (${sel.size})` : "Reject all"}</Button>
              <Button size="sm" className="btn-primary-gradient text-white" disabled={busy || !rows.length} onClick={() => bulk.mutate({ path: "bulk-approve", ids: actIds, body: {}, msg: sel.size > 0 ? `Approved ${actIds.length}` : "Approved all" })}><Check className="h-4 w-4 mr-1.5" /> {sel.size > 0 ? `Approve selected (${sel.size})` : "Approve all"}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
