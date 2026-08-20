import { money, fmtDate, dayInRange, rangeSuffix, OP_PRIORITY, LIST_PAGE_SIZE } from "../../shared/approval-format";
import { ApprovalDateRange, ViewToggle } from "../../components/approval-ui";
import { OfficePurchaseBatchModal } from "./office-purchase-batch-modal";
import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { exportXlsx } from "@/lib/export-xlsx";
import { OfficePurchaseDetailDialog } from "@/features/company-workspace/office-purchases/components/office-purchase";
import { ShoppingCart, ArrowRight, ChevronLeft, Check, ChevronRight, MessageSquare, CalendarClock, IndianRupee, Eye, Download, ArrowDownUp, Building2, Clock, CheckSquare, CheckCircle2, Layers } from "lucide-react";
import { statusClass, statusLabel } from "@/lib/status";

export function OfficePurchaseApprovals({ allItems, canTriage, canCeo }: { allItems: any[]; canTriage: boolean; canCeo: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [batchItems, setBatchItems] = useState<any[] | null>(null);
  const [phase, setPhase] = useState<"pending" | "ordered" | "completed">("pending");
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({});
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date_desc");
  const [view, setView] = useState<"card" | "table">("card");
  const [selMode, setSelMode] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [openSecs, setOpenSecs] = useState<Set<string>>(new Set());  // pending sections expanded past the initial cap

  const baseList = useMemo(() => {
    if (phase === "ordered") return (allItems as any[]).filter((o) => o.status === "ordered");
    if (phase === "completed") return (allItems as any[]).filter((o) => ["delivered", "rejected", "cancelled"].includes(o.status));
    return (allItems as any[]).filter((o) => (canTriage && ["pending_hr", "priced", "approved", "under_review"].includes(o.status)) || (canCeo && ["pending_approval", "under_review"].includes(o.status)));
  }, [allItems, phase, canTriage, canCeo]);
  const statuses = useMemo(() => Array.from(new Set(baseList.map((o) => o.status))), [baseList]);
  const filtered = useMemo(() => baseList.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (priorityFilter !== "all" && (o.priority || "medium") !== priorityFilter) return false;
    if (!dayInRange(o.createdAt, range)) return false;
    return true;
  }), [baseList, statusFilter, priorityFilter, range]);
  const sorted = useMemo(() => {
    const s = [...filtered];
    s.sort((a, b) => {
      if (sortBy === "amount_desc") return Number(b.totalAmount) - Number(a.totalAmount);
      if (sortBy === "amount_asc") return Number(a.totalAmount) - Number(b.totalAmount);
      const da = +new Date(a.createdAt || 0), db = +new Date(b.createdAt || 0);
      return sortBy === "date_asc" ? da - db : db - da;
    });
    return s;
  }, [filtered, sortBy]);

  // Batched pending-approval requests collapse into one "group" entry (single CEO card).
  const entries = useMemo(() => {
    const seen = new Map<string, any>(); const out: any[] = [];
    for (const o of sorted) {
      if (o.batchId && o.status === "pending_approval") {
        let e = seen.get(o.batchId);
        if (!e) { e = { kind: "group", key: `g-${o.batchId}`, items: [] as any[] }; seen.set(o.batchId, e); out.push(e); }
        e.items.push(o);
      } else out.push({ kind: "single", key: o.id, o });
    }
    return out;
  }, [sorted]);

  const totalPages = Math.max(1, Math.ceil((view === "table" ? sorted.length : entries.length) / LIST_PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageItems = sorted.slice((curPage - 1) * LIST_PAGE_SIZE, curPage * LIST_PAGE_SIZE);
  const pageEntries = entries.slice((curPage - 1) * LIST_PAGE_SIZE, curPage * LIST_PAGE_SIZE);
  const hasRange = !!(range.from || range.to);

  const invalidateOp = () => qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/office-purchases") });
  const send = useMutation({
    mutationFn: (ids: string[]) => ids.length === 1
      ? apiRequest("POST", `/api/office-purchases/${ids[0]}/send`, {})
      : apiRequest("POST", "/api/office-purchases/batch-send", { ids }),
    onSuccess: (_d, ids) => { invalidateOp(); setSel(new Set()); setSelMode(false); toast({ title: ids.length > 1 ? "Group sent for approval" : "Sent for approval" }); },
    onError: (e: any) => toast({ title: "Couldn't send", description: e.message, variant: "destructive" }),
  });
  const pricedIds = useMemo(() => sorted.filter((o) => o.status === "priced").map((o) => o.id), [sorted]);
  const canGroup = canTriage && phase === "pending" && pricedIds.length > 0;
  const allPricedSelected = pricedIds.length > 0 && pricedIds.every((id) => sel.has(id));
  const toggleAllPriced = () => setSel(allPricedSelected ? new Set() : new Set(pricedIds));
  const toggleSel = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const exitSel = () => { setSelMode(false); setSel(new Set()); };

  const doExport = () => exportXlsx({
    filename: `office-purchases-${new Date().toISOString().slice(0, 10)}.xlsx`,
    sheet: "Office Purchases", title: `Office Purchases${rangeSuffix(range)}`,
    headers: ["Reference", "Requester", "Items", "Amount (INR)", "Status", "Priority", "Created"],
    rows: sorted.map((o) => [o.reference, o.employeeName || "", (o.items || []).map((i: any) => i.description).filter(Boolean).join("; "), Number(o.totalAmount || 0), statusLabel(o.status), o.priority || "medium", o.createdAt ? fmtDate(o.createdAt) : ""]),
  });

  const phaseToggle = (
    <div className="segmented-toggle inline-flex p-0.5 h-9 flex-shrink-0">
      {(["pending", "ordered", "completed"] as const).map((p) => (
        <button key={p} onClick={() => { setPhase(p); setPage(1); exitSel(); }} className={`px-3 h-full rounded-[10px] text-xs font-medium capitalize ${phase === p ? "btn-primary-gradient text-white" : "text-muted-foreground"}`} data-testid={`phase-${p}`}>{p}</button>
      ))}
    </div>
  );

  // ---- card renderers ----
  const singleCard = (o: any) => {
    const amt = Number(o.totalAmount || 0);
    const pr = OP_PRIORITY[o.priority || "medium"] || OP_PRIORITY.medium;
    const lines = Array.isArray(o.items) ? o.items : [];
    const summary = lines.length ? `${lines[0]?.description || "Item"}${lines.length > 1 ? ` +${lines.length - 1} more` : ""}` : "—";
    const selectable = selMode && o.status === "priced";
    const checked = sel.has(o.id);
    return (
      <div key={o.id} data-testid={`appr-op-${o.id}`} className={`group card-surface card-hover relative p-4 cursor-pointer ${selectable && checked ? "ring-2 ring-[#206295]" : ""} ${selMode && !selectable ? "opacity-60" : ""}`} onClick={() => (selectable ? toggleSel(o.id) : selMode ? undefined : setDetailId(o.id))}>
        <div className="flex items-center gap-5">
          {selMode && <Checkbox checked={checked} disabled={!selectable} onClick={(e: any) => e.stopPropagation()} onCheckedChange={() => selectable && toggleSel(o.id)} className="flex-shrink-0" />}
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-[13px] font-semibold tracking-wide text-foreground truncate">{o.reference}</span>
            </div>
            {amt > 0
              ? <div className="flex items-end gap-1 mt-1.5"><IndianRupee className="h-6 w-6 text-[#206295] mb-0.5" /><span className="text-[1.9rem] leading-none font-bold text-[#206295] tracking-tight tabular-nums">{amt.toLocaleString("en-IN")}</span></div>
              : <p className="text-sm text-muted-foreground mt-2">Amount pending HR pricing</p>}
            <div className="flex items-center gap-2.5 mt-2 text-sm min-w-0">
              <span className="flex-shrink-0"><span className="font-bold text-foreground">{o.employeeName || "Employee"}</span><span className="text-muted-foreground font-normal"> ({o.employeeCode || "—"})</span></span>
              <Separator orientation="vertical" className="h-3.5 flex-shrink-0" />
              <span className="min-w-0 truncate"><span className="text-muted-foreground">{lines.length} item{lines.length !== 1 ? "s" : ""}: </span><span className="text-muted-foreground">{summary}</span></span>
            </div>
          </div>
          <div className="self-center w-px h-20 rounded-full bg-border flex-shrink-0" />
          <div className="flex items-stretch gap-4 flex-shrink-0">
            <div className="w-[104px]">
              <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1">Submitted</p>
              <p className="text-sm font-semibold text-foreground mt-1">{o.createdAt ? fmtDate(o.createdAt) : "—"}</p>
            </div>
            <div className="w-px self-stretch bg-border rounded-full flex-shrink-0" />
            <div className="w-[104px]">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1">Dept</p>
              <p className="text-sm font-semibold text-foreground mt-1 truncate">{o.department || "—"}</p>
            </div>
            <div className="w-px self-stretch bg-border rounded-full flex-shrink-0" />
            <div className="w-[104px]">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1">Priority</p>
              <div className="mt-1"><Badge className={`text-[10px] px-2 py-0.5 font-semibold ${pr.cls}`}>{pr.label}</Badge></div>
            </div>
            <div className="w-px self-stretch bg-border rounded-full flex-shrink-0" />
            <div className="w-[104px]">
              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1">Status</p>
              <div className="mt-1"><Badge className={`text-[10px] ${statusClass(o.status)}`}>{statusLabel(o.status)}</Badge></div>
            </div>
            {!selMode && <>
              <div className="w-px self-stretch bg-border rounded-full flex-shrink-0" />
              <div className="flex items-center flex-shrink-0 pl-1" onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant="ghost" className="h-10 w-[100px] btn-glass text-[#206295] hover:text-[#206295]" onClick={() => setDetailId(o.id)} data-testid={`review-op-${o.id}`}><Eye className="h-4 w-4 mr-1.5" /> {phase === "pending" ? "Review" : "View"}</Button>
              </div>
            </>}
          </div>
        </div>
      </div>
    );
  };

  const groupCard = (entry: any) => {
    const its = entry.items as any[];
    const total = its.reduce((s, i) => s + Number(i.totalAmount || 0), 0);
    const itemCount = its.reduce((s, i) => s + (Array.isArray(i.items) ? i.items.length : 0), 0);
    const requesters = new Set(its.map((i) => i.employeeName).filter(Boolean)).size;
    return (
      <div key={entry.key} data-testid={`appr-op-group-${entry.key}`} className="group card-surface card-hover relative p-4 cursor-pointer ring-1 ring-[#206295]/25" onClick={() => setBatchItems(its)}>
        <div className="flex items-center gap-5">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-[#206295] flex-shrink-0" />
              <span className="text-[13px] font-semibold tracking-wide text-foreground truncate">Purchase group | {its.length} requests</span>
              <Badge className={`text-[10px] ${statusClass("pending_approval")}`}>{statusLabel("pending_approval")}</Badge>
            </div>
            <div className="flex items-end gap-1 mt-1.5"><IndianRupee className="h-6 w-6 text-[#206295] mb-0.5" /><span className="text-[1.9rem] leading-none font-bold text-[#206295] tracking-tight tabular-nums">{total.toLocaleString("en-IN")}</span></div>
            <p className="text-sm text-muted-foreground mt-2">{itemCount} item{itemCount !== 1 ? "s" : ""} | {requesters} requester{requesters !== 1 ? "s" : ""}</p>
          </div>
          <div className="self-center w-px h-20 rounded-full bg-border flex-shrink-0" />
          <div className="flex-shrink-0 pr-1" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" className="h-10 w-[104px] btn-glass text-[#206295] hover:text-[#206295]" onClick={() => setBatchItems(its)} data-testid={`review-op-group-${entry.key}`}><Eye className="h-4 w-4 mr-1.5" /> Review</Button>
          </div>
        </div>
      </div>
    );
  };

  // Pending is split into HR-stage sections (reimbursement-style) — each shown only if it has items.
  const SECTION_CAP = 5;  // render the first N of each pending section, "Show all" reveals the rest (keeps the page light)
  const opSection = (title: string, items: any[], tone?: "alert", Icon?: any) => {
    if (items.length === 0) return null;
    const open = openSecs.has(title);
    const shown = open ? items : items.slice(0, SECTION_CAP);
    return (
      <div className="space-y-2.5" key={title}>
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`h-3.5 w-3.5 ${tone === "alert" ? "text-[#C4402F]" : "text-muted-foreground"}`} />}
          <span className={`text-xs font-semibold uppercase tracking-wide ${tone === "alert" ? "text-[#C4402F]" : "text-muted-foreground"}`}>{title}</span>
          <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${tone === "alert" ? "bg-[#FF6F62]/20 text-[#C4402F]" : "bg-muted text-muted-foreground"}`}>{items.length}</span>
        </div>
        {shown.map((o) => singleCard(o))}
        {items.length > SECTION_CAP && (
          <button type="button" onClick={() => setOpenSecs((prev) => { const n = new Set(prev); open ? n.delete(title) : n.add(title); return n; })} className="text-xs font-medium text-[#206295] hover:underline" data-testid={`op-section-more-${title}`}>
            {open ? "Show fewer" : `Show all ${items.length}`}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {phaseToggle}
          <div className="h-7 w-px bg-foreground/30 mx-0.5" />
          <ViewToggle view={view} onChange={setView} />
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[150px] text-xs" data-testid="filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statuses.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[130px] text-xs" data-testid="filter-priority"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-9 w-[160px] text-xs" data-testid="sort-op"><ArrowDownUp className="h-3.5 w-3.5 mr-1 text-muted-foreground" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Newest first</SelectItem>
              <SelectItem value="date_asc">Oldest first</SelectItem>
              <SelectItem value="amount_desc">Amount: High → Low</SelectItem>
              <SelectItem value="amount_asc">Amount: Low → High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          {canGroup && !selMode && <Button variant="secondary" size="sm" className="h-9" onClick={() => setSelMode(true)} data-testid="op-group"><Layers className="h-4 w-4 mr-1.5" /> Group &amp; send</Button>}
          <ApprovalDateRange value={range} onChange={(v) => { setRange(v); setPage(1); }} />
          {phase === "completed" && <Button variant="secondary" size="sm" className="h-9" disabled={sorted.length === 0} onClick={doExport} data-testid="op-export"><Download className="h-4 w-4 mr-1.5" /> Export ({sorted.length})</Button>}
          {!(phase === "pending" && view === "card") && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)} data-testid="page-prev"><ChevronLeft className="h-4 w-4" /></Button>
              <span className="px-1 tabular-nums">{curPage} / {totalPages}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={curPage >= totalPages} onClick={() => setPage(curPage + 1)} data-testid="page-next"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
      </div>

      {/* Selection bar — pick priced requests to send singly or as a group */}
      {selMode && (
        <div className="card-surface rounded-2xl p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={toggleAllPriced} disabled={pricedIds.length === 0} data-testid="op-select-all"><CheckSquare className="h-4 w-4 mr-1" /> {allPricedSelected ? "Clear all" : "Select all"}</Button>
            <span className="text-sm font-medium">{sel.size} selected</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exitSel} data-testid="op-group-cancel">Cancel</Button>
            <Button size="sm" className="btn-primary-gradient" disabled={sel.size === 0 || send.isPending} onClick={() => send.mutate([...sel])} data-testid="op-group-send"><ArrowRight className="h-4 w-4 mr-1.5" /> Send {sel.size > 1 ? "group " : ""}for approval</Button>
          </div>
        </div>
      )}

      {/* Body — card or table view for the current phase */}
      {sorted.length === 0 ? (
        <div className="card-surface rounded-2xl py-16 text-center"><Check className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">{phase === "pending" ? "No office purchases awaiting your action" : phase === "ordered" ? "No orders in transit" : "No completed office purchases"}{hasRange ? " in this date range" : ""}.</p></div>
      ) : view === "table" ? (
        <div className="card-surface rounded-2xl">
          <DataTable
            columns={[
              { key: "reference", header: "Reference", cellClassName: "font-medium text-foreground" },
              { key: "requester", header: "Requester", render: (o: any) => <span className="text-foreground">{o.employeeName || "—"}<span className="text-muted-foreground"> ({o.employeeCode || "—"})</span></span> },
              { key: "items", header: "Items", cellClassName: "text-muted-foreground", render: (o: any) => `${(o.items || []).length} item${(o.items || []).length !== 1 ? "s" : ""}` },
              { key: "amount", header: "Amount", align: "right", cellClassName: "font-semibold text-foreground", render: (o: any) => Number(o.totalAmount) > 0 ? money(o.totalAmount) : "—" },
              { key: "priority", header: "Priority", render: (o: any) => { const pr = OP_PRIORITY[o.priority || "medium"] || OP_PRIORITY.medium; return <Badge className={`text-[10px] font-semibold ${pr.cls}`}>{pr.label}</Badge>; } },
              { key: "status", header: "Status", render: (o: any) => <Badge className={`text-xs ${statusClass(o.status)}`}>{statusLabel(o.status)}</Badge> },
              { key: "created", header: "Submitted", cellClassName: "text-muted-foreground", render: (o: any) => o.createdAt ? fmtDate(o.createdAt) : "—" },
              { key: "__view", header: "", align: "center", render: (o: any) => <Button size="sm" variant="ghost" className="h-8 text-[#206295]" onClick={(e) => { e.stopPropagation(); setDetailId(o.id); }} data-testid={`view-op-${o.id}`}><Eye className="h-3.5 w-3.5 mr-1" /> {phase === "pending" ? "Review" : "View"}</Button> },
            ]}
            rows={pageItems}
            getRowKey={(o: any) => o.id}
            onRowClick={(o: any) => setDetailId(o.id)}
            testIdPrefix="op-row"
          />
        </div>
      ) : phase === "pending" ? (
        selMode
          ? <div className="space-y-2.5">{sorted.filter((o) => o.status === "priced").map((o) => singleCard(o))}</div>
          : <div className="space-y-6">
              {opSection("Query from CEO", sorted.filter((o) => o.status === "under_review"), "alert", MessageSquare)}
              {opSection("Needs pricing", sorted.filter((o) => o.status === "pending_hr"))}
              {opSection("Ready to group & send", sorted.filter((o) => o.status === "priced"))}
              {opSection("Ready to order", sorted.filter((o) => o.status === "approved"))}
            </div>
      ) : (
        <div className="space-y-2.5">
          {pageEntries.map((entry: any) => entry.kind === "group" ? groupCard(entry) : singleCard(entry.o))}
        </div>
      )}

      <OfficePurchaseDetailDialog id={detailId} open={!!detailId} onClose={() => setDetailId(null)} context="approver" onPriced={(pid) => { setPhase("pending"); setSelMode(true); setSel(new Set([pid])); }} />
      {batchItems && <OfficePurchaseBatchModal items={batchItems} open={!!batchItems} onClose={() => setBatchItems(null)} />}
    </div>
  );
}
