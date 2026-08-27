import { money, isResubmittedThread } from "../shared/approval-format";
import { formatDate } from "../shared/request-format";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CommentThread } from "@/components/shared/comment-thread";
import { DataTable } from "@/components/shared/data-table";
import { ApprovalCard } from "./approval-card";
import { ApprovalToolbar } from "./approval-toolbar";
import { ApprovalModal, ApprovalFooter } from "./approval-modal";
import { ViewToggle } from "./approval-ui";
import { Check, X, MessageSquare, ExternalLink, Layers, ShoppingCart, Package, ArrowDownUp, CalendarClock, Building2 } from "lucide-react";

// Priority chip for office purchases (procurement carries no priority).
const PRI: Record<string, string> = { high: "bg-[#FF6F62]/20 text-[#C4402F]", medium: "bg-[#FFA962]/25 text-[#D98324]", low: "bg-[#64748B]/15 text-[#64748B]" };
const priBadge = (p: string) => <Badge className={`text-[10px] px-2 py-0.5 capitalize font-semibold ${PRI[p] || PRI.medium}`}>{p || "medium"}</Badge>;

// CEO Inbox drill modal for office purchases & procurement — runs on the shared ApprovalModal shell
// (header · toolbar · body · footer), same as reimbursement & travel. Card view = accordion rows (open
// for receipt + discussion + per-item Approve/Reject/Raise Query); table view = scannable list. Footer
// keeps Approve-all / Reject-all; tick rows to act on a subset.
export function CeoReviewModal({ cfg, onClose }: { cfg: any; onClose: () => void }) {
  const { data: auth } = useAuth();
  const meId = auth?.user?.id;
  const { toast } = useToast();
  const qc = useQueryClient();
  const base = cfg.basePath as string;
  const { data: all = [] } = useQuery<any[]>({ queryKey: [base] });
  const statuses: string[] = cfg.statuses || ["pending_approval"];
  const isProc = cfg.kind === "procurement";
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [sortBy, setSortBy] = useState<"amount" | "age">("amount");
  const [view, setView] = useState<"card" | "table">("card");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [rowForm, setRowForm] = useState<{ id: string; kind: "reject" | "query" } | null>(null);
  const [rowNote, setRowNote] = useState("");
  const [page, setPage] = useState(1);

  const q = search.trim().toLowerCase();
  const rows = (all as any[])
    .filter((r) => statuses.includes(r.status))
    .filter((r) => cfg.kind !== "office" || priorityFilter === "all" || (r.priority || "medium") === priorityFilter)
    .filter((r) => !q || `${r.reference || ""} ${r.employeeName || ""} ${r.employeeCode || ""} ${r.department || ""} ${(r.items || []).map((i: any) => i.description).join(" ")}`.toLowerCase().includes(q));
  const allIds = rows.map((r) => r.id);
  const total = rows.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0);
  const sortedRows = [...rows].sort((a, b) => sortBy === "amount" ? (Number(b.totalAmount) || 0) - (Number(a.totalAmount) || 0) : (+new Date(a.createdAt || 0)) - (+new Date(b.createdAt || 0)));
  // Office purchases carry a batchId when HR bundled several requests into one group to send the CEO.
  const groups = (() => {
    const seen = new Map<string, any>(); const out: { key: string; batchId: string | null; rows: any[] }[] = [];
    for (const r of sortedRows) { const bid = r.batchId || null; if (!bid) { out.push({ key: `s-${r.id}`, batchId: null, rows: [r] }); continue; } let e = seen.get(bid); if (!e) { e = { key: `g-${bid}`, batchId: bid, rows: [] }; seen.set(bid, e); out.push(e); } e.rows.push(r); }
    return out;
  })();
  const gTotal = (arr: any[]) => arr.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0);
  // Card view paginates by group (HR bundles), table view by flat row — pager shows whichever's active.
  const pageSize = view === "table" ? 15 : 8;
  const pageUnits = view === "table" ? sortedRows.length : groups.length;
  const totalPages = Math.max(1, Math.ceil(pageUnits / pageSize));
  const curPage = Math.min(page, totalPages);
  const pagedGroups = view === "card" ? groups.slice((curPage - 1) * pageSize, curPage * pageSize) : [];
  const pagedRows = view === "table" ? sortedRows.slice((curPage - 1) * pageSize, curPage * pageSize) : [];

  const rejectBtn = "border-[#FF6F62]/40 text-[#FF6F62] hover:bg-[#FF6F62]/10 hover:text-[#FF6F62]";
  const queryBtn = "border-[#D98324]/40 text-[#D98324] hover:bg-[#FFA962]/15 hover:text-[#D98324]";
  const normUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
  const shortLink = (u: string) => { try { return new URL(normUrl(u)).host.replace(/^www\./, ""); } catch { return u; } };
  const invalidate = () => qc.invalidateQueries({ predicate: (qq) => typeof qq.queryKey[0] === "string" && (qq.queryKey[0] as string).startsWith(cfg.invalidateKey) });
  const single = useMutation({ mutationFn: ({ path, id, body }: any) => apiRequest("POST", `${base}/${id}/${path}`, body || {}), onSuccess: (_d, v: any) => { invalidate(); toast({ title: v.msg }); setRowForm(null); setRowNote(""); }, onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }) });
  const bulk = useMutation({ mutationFn: ({ path, ids, body }: any) => apiRequest("POST", `${base}/${path}`, { ids, ...(body || {}) }), onSuccess: (_d, v: any) => { invalidate(); toast({ title: v.msg }); setSel(new Set()); setSelectionMode(false); }, onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }) });
  const busy = single.isPending || bulk.isPending;
  const toggleSel = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = allIds.length > 0 && allIds.every((id) => sel.has(id));
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(allIds));
  const exitSelection = () => { setSelectionMode(false); setSel(new Set()); };
  const changeView = (v: "card" | "table") => { setView(v); setPage(1); };

  const renderRow = (r: any) => {
    const open = expanded === r.id;
    const amount = Number(r.totalAmount) || 0;
    const items = (r.items || []) as any[];
    const itemSummary = items.length ? `${items[0]?.description || "Item"}${Number(items[0]?.quantity) > 1 ? ` ×${items[0].quantity}` : ""}${items.length > 1 ? ` +${items.length - 1} more` : ""}` : "—";
    return (
      <ApprovalCard
        key={r.id}
        testId={`appr-${cfg.kind}-${r.id}`}
        icon={isProc ? Package : ShoppingCart}
        reference={r.reference || "Request"}
        badge={!isProc && r.priority ? priBadge(r.priority) : undefined}
        resubmitted={isResubmittedThread(r.comments)}
        amount={amount}
        amountFallback="Not priced yet"
        requesterName={r.employeeName || "Employee"}
        requesterCode={r.employeeCode}
        facts={[{ value: itemSummary, truncate: true }]}
        meta={[
          { icon: CalendarClock, label: "Submitted", value: formatDate(r.createdAt), width: "w-[120px]" },
          { icon: Building2, label: "Department", value: r.department || "—", width: "w-[150px]" },
          { icon: Layers, label: "Items", value: String(items.length), width: "w-[64px]" },
        ]}
        selectable
        selectionMode={selectionMode}
        selected={sel.has(r.id)}
        onToggleSelect={() => toggleSel(r.id)}
        expandable
        expanded={open}
        onToggleExpand={() => setExpanded(open ? null : r.id)}
      >
        <div className="space-y-3">
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
      </ApprovalCard>
    );
  };

  const tableColumns = [
    ...(selectionMode ? [{ key: "__sel", header: "", render: (r: any) => <div onClick={(e) => e.stopPropagation()}><Checkbox checked={sel.has(r.id)} onCheckedChange={() => toggleSel(r.id)} /></div> }] : []),
    { key: "reference", header: "Reference", cellClassName: "font-medium text-foreground", render: (r: any) => r.reference || "—" },
    { key: "requester", header: "Requester", render: (r: any) => <span className="text-foreground">{r.employeeName || "—"}<span className="text-muted-foreground"> ({r.employeeCode || "—"})</span></span> },
    { key: "department", header: "Department", cellClassName: "text-muted-foreground", render: (r: any) => r.department || "—" },
    { key: "items", header: "Items", cellClassName: "text-muted-foreground", render: (r: any) => String((r.items || []).length) },
    ...(isProc ? [] : [{ key: "priority", header: "Priority", render: (r: any) => priBadge(r.priority) }]),
    { key: "amount", header: "Amount", align: "right" as const, cellClassName: "font-semibold text-foreground", render: (r: any) => money(Number(r.totalAmount) || 0) },
  ];

  return (
    <ApprovalModal
      open
      onClose={onClose}
      icon={isProc ? Package : ShoppingCart}
      title={`${cfg.title} | ${cfg.lane || "Pending"}`}
      count={rows.length}
      toolbar={
        <ApprovalToolbar
          search={search}
          onSearch={(v) => { setSearch(v); setPage(1); }}
          viewToggle={<ViewToggle view={view} onChange={changeView} />}
          filters={cfg.kind === "office" ? (
            <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v as any); setPage(1); }}>
              <SelectTrigger className="h-9 w-[130px] text-xs flex-shrink-0" data-testid="ceo-priority"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          ) : undefined}
          sort={
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="h-9 w-[160px] text-xs flex-shrink-0" data-testid="ceo-sort"><ArrowDownUp className="h-3.5 w-3.5 mr-1 text-muted-foreground" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="amount">Amount: High → Low</SelectItem>
                <SelectItem value="age">Oldest first</SelectItem>
              </SelectContent>
            </Select>
          }
          selectable selectionMode={selectionMode}
          onSelect={() => setSelectionMode(true)} onExitSelect={exitSelection}
          allSelected={allSelected} onToggleAll={toggleAll}
          page={curPage} totalPages={totalPages} onPage={setPage} total={pageUnits} pageSize={pageSize}
        />
      }
      footer={
        <ApprovalFooter
          total={total}
          itemCount={rows.length}
          selectedCount={sel.size}
          busy={busy}
          onApprove={(scope) => bulk.mutate({ path: "bulk-approve", ids: scope === "selected" ? Array.from(sel) : allIds, body: {}, msg: scope === "selected" ? `Approved ${sel.size}` : "Approved all" })}
          onReject={(scope, note) => bulk.mutate({ path: "bulk-reject", ids: scope === "selected" ? Array.from(sel) : allIds, body: { note }, msg: scope === "selected" ? `Rejected ${sel.size}` : "Rejected all" })}
          onQuery={(note) => bulk.mutate({ path: "bulk-query", ids: Array.from(sel), body: { body: note }, msg: `Query raised on ${sel.size}` })}
        />
      }
    >
      {view === "table" ? (
        <div className="card-surface rounded-2xl overflow-hidden">
          <DataTable
            columns={tableColumns}
            rows={pagedRows}
            getRowKey={(r: any) => r.id}
            paginate={false}
            emptyText="Nothing pending here."
            onRowClick={(r: any) => { if (selectionMode) toggleSel(r.id); else { setView("card"); setExpanded(r.id); } }}
            testIdPrefix={`ceo-${cfg.kind}`}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {pagedGroups.length === 0 && <p className="text-sm text-muted-foreground py-10 text-center">Nothing pending here.</p>}
          {pagedGroups.map((g) => (cfg.grouped && g.rows.length > 1)
            ? (
              <div key={g.key} className="rounded-xl border border-[#206295]/25 bg-[#206295]/[0.03] p-2 space-y-2">
                <div className="flex items-center justify-between px-1.5 pt-0.5">
                  <span className="text-[11px] font-semibold text-[#206295] uppercase tracking-wide flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> HR group | {g.rows.length} requests</span>
                  <span className="text-xs font-bold text-[#206295] tabular-nums">{money(gTotal(g.rows))}</span>
                </div>
                {g.rows.map(renderRow)}
              </div>
            )
            : renderRow(g.rows[0]))}
        </div>
      )}
    </ApprovalModal>
  );
}
