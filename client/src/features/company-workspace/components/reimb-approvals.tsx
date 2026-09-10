import { money, catStyle, dayInRange, rangeSuffix, reimbPriority, reimbSubmittedInfo, REIMB_PAGE_SIZE } from "../shared/approval-format";
import { ApprovalDateRange, ViewToggle } from "./approval-ui";
import { ApprovalToolbar } from "./approval-toolbar";
import { ApprovalModal, ApprovalFooter } from "./approval-modal";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { exportXlsx } from "@/lib/export-xlsx";
import { ReimbursementApprovalModal, exportReimbursement } from "@/features/company-workspace/reimbursements/components/reimbursement-approval-detail";
import { ChevronLeft, Check, X, ChevronRight, CalendarClock, FileText, IndianRupee, MoreVertical, Eye, Download, Maximize2, ArrowDownUp, Building2, Clock, MousePointerClick, CheckSquare } from "lucide-react";
import { format } from "date-fns";
import { statusClass, statusLabel } from "@/lib/status";
import { relDate, isJustUpdated } from "@/lib/format";
import { StageHeader } from "./stage-header";
import { useIsMobile } from "@/hooks/use-mobile";

// Premium card-based reimbursement approvals list. Finance = individual; CEO = + bulk.
export function ReimbApprovals({ items, allItems = [], nameByUser = {}, allowBulk, showPhaseToggle = false, asModal = false, open = true, onClose }: { items: any[]; allItems?: any[]; nameByUser?: Record<string, string>; allowBulk: boolean; showPhaseToggle?: boolean; asModal?: boolean; open?: boolean; onClose?: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [phase, setPhase] = useState<"pending" | "completed">("pending");
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({});
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated_desc");
  const [view, setView] = useState<"card" | "table">("card");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const isMobile = useIsMobile();
  const inRange = (d: any) => dayInRange(d, range);
  const approvedByName = (r: any) => nameByUser[r.approvedById] || nameByUser[r.financeApprovedById] || "—";

  const invalidate = () => qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/reimbursements") });
  const approve = useMutation({
    mutationFn: async (ids: string[]) => { for (const id of ids) await apiRequest("POST", `/api/reimbursements/${id}/approve`, {}); },
    onSuccess: (_d, ids: string[]) => {
      invalidate(); setSel(new Set());
      const n = ids.length;
      // A finance-stage ("submitted") approval only forwards the claim to the CEO — say so, don't imply it's fully approved.
      const financeStage = items.some((i) => ids.includes(i.id) && i.status === "submitted");
      toast({ title: financeStage
        ? (n > 1 ? `${n} claims forwarded to CEO` : "Forwarded to CEO for approval")
        : (n > 1 ? `${n} reimbursements approved` : "Reimbursement approved") });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const reject = useMutation({
    mutationFn: ({ id, note }: any) => apiRequest("POST", `/api/reimbursements/${id}/reject`, { note }),
    onSuccess: () => { invalidate(); toast({ title: "Reimbursement rejected" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const rejectAll = useMutation({
    mutationFn: async ({ ids, note }: { ids: string[]; note: string }) => { for (const id of ids) await apiRequest("POST", `/api/reimbursements/${id}/reject`, { note }); },
    onSuccess: () => { invalidate(); setSel(new Set()); toast({ title: "Reimbursement(s) rejected" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const approveAll = () => { if (sel.size === 0) return; if (window.confirm(`Approve all ${sel.size} selected reimbursement(s)? This cannot be undone.`)) approve.mutate([...sel]); };
  const rejectAllConfirm = () => { if (sel.size === 0) return; const note = window.prompt(`Reject all ${sel.size} selected reimbursement(s)? Enter a reason:`); if (note && note.trim()) rejectAll.mutate({ ids: [...sel], note: note.trim() }); };
  const doExport = (rows: any[]) => {
    const data = rows.map((r) => [r.reference, r.employeeName || "", r.employeeCode || "", r.department || "", r.category || "", Number(r.totalAmount || 0), r.createdAt ? format(new Date(r.createdAt), "dd MMM yyyy") : "", r.updatedAt ? format(new Date(r.updatedAt), "dd MMM yyyy") : "", statusLabel(r.status), approvedByName(r)]);
    exportXlsx({ filename: `reimbursement-approvals-${new Date().toISOString().slice(0, 10)}.xlsx`, sheet: "Reimbursements", title: `Reimbursement Approvals${rangeSuffix(range)}`, headers: ["Reference", "Requester", "Emp Code", "Department", "Category", "Amount (INR)", "Submitted", "Decision Date", "Status", "Approved By"], rows: data });
  };
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const openDetail = (r: any) => setDetail(r);

  // Pending = items awaiting this approver; Completed = decided claims (approved / rejected).
  const baseList = phase === "pending" ? items : (allItems as any[]).filter((r) => ["approved", "rejected"].includes(r.status));
  const categories = useMemo(() => Array.from(new Set(baseList.map((i) => i.category).filter(Boolean))), [baseList]);

  // filter (priority/category/date) -> sort
  const filtered = useMemo(() => baseList.filter((r) => {
    const pr = reimbPriority(Number(r.totalAmount || 0)).label.toLowerCase();
    if (priorityFilter !== "all" && pr !== priorityFilter) return false;
    if (catFilter !== "all" && r.category !== catFilter) return false;
    if (!inRange(r.createdAt)) return false;
    const qq = search.trim().toLowerCase();
    if (qq && !`${r.reference || ""} ${r.employeeName || ""} ${r.employeeCode || ""} ${r.department || ""} ${r.category || ""} ${r.businessPurpose || ""}`.toLowerCase().includes(qq)) return false;
    return true;
  }), [baseList, priorityFilter, catFilter, range, search]);
  const sorted = useMemo(() => {
    const s = [...filtered];
    s.sort((a, b) => {
      if (sortBy === "updated_desc") return +new Date(b.updatedAt || b.createdAt || 0) - +new Date(a.updatedAt || a.createdAt || 0);
      if (sortBy === "amount_desc") return Number(b.totalAmount) - Number(a.totalAmount);
      if (sortBy === "amount_asc") return Number(a.totalAmount) - Number(b.totalAmount);
      const da = +new Date(a.createdAt || 0), db = +new Date(b.createdAt || 0);
      return sortBy === "date_asc" ? da - db : db - da;
    });
    return s;
  }, [filtered, sortBy]);

  // Pending is stage-grouped and shown whole (no paging); Completed stays a paginated flat list.
  const grouped = phase === "pending";
  const totalPages = grouped ? 1 : Math.max(1, Math.ceil(sorted.length / REIMB_PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageItems = grouped ? sorted : sorted.slice((curPage - 1) * REIMB_PAGE_SIZE, curPage * REIMB_PAGE_SIZE);
  // Pending stage groups — one label per approver stage; a single-role queue naturally shows just one.
  const PENDING_STAGES: { title: string; has: (s: string) => boolean; tone?: "alert" }[] = [
    { title: "Changes requested", has: (s) => s === "under_review", tone: "alert" },
    { title: "Awaiting finance", has: (s) => s === "submitted" },
    { title: "Awaiting CEO", has: (s) => s === "finance_approved" },
  ];
  const stageGroups = (rows: any[]) => {
    const seen = new Set<string>();
    const groups = PENDING_STAGES.map((st) => {
      const gi = rows.filter((r) => st.has(r.status));
      gi.forEach((r) => seen.add(r.id));
      return { ...st, items: gi };
    }).filter((g) => g.items.length > 0);
    const rest = rows.filter((r) => !seen.has(r.id));
    if (rest.length) groups.push({ title: "In progress", has: () => true, items: rest } as any);
    return groups;
  };
  const allSelected = sorted.length > 0 && sorted.every((i) => sel.has(i.id));
  const selectedTotal = items.filter((i) => sel.has(i.id)).reduce((s, i) => s + Number(i.totalAmount || 0), 0);
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(sorted.map((i) => i.id)));
  const exitSelection = () => { setSelectionMode(false); setSel(new Set()); };

  // Pending / Completed toggle + date-range control (shared header chrome)
  const phaseToggle = (
    <div className="segmented-toggle inline-flex p-0.5 h-9 flex-shrink-0">
      <button onClick={() => { setPhase("pending"); setPage(1); exitSelection(); }} className={`px-3 h-full rounded-[10px] text-xs font-medium ${phase === "pending" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`} data-testid="phase-pending">Pending</button>
      <button onClick={() => { setPhase("completed"); setPage(1); exitSelection(); }} className={`px-3 h-full rounded-[10px] text-xs font-medium ${phase === "completed" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`} data-testid="phase-completed">Completed</button>
    </div>
  );
  const dateRange = <ApprovalDateRange value={range} onChange={(v) => { setRange(v); setPage(1); }} />;

  const footerNode = allowBulk && phase === "pending" ? (
    <ApprovalFooter
      total={sorted.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0)}
      itemCount={sorted.length}
      selectedCount={sel.size}
      busy={approve.isPending || rejectAll.isPending}
      onApprove={(sc) => approve.mutate(sc === "selected" ? Array.from(sel) : sorted.map((r) => r.id))}
      onReject={(sc, note) => rejectAll.mutate({ ids: sc === "selected" ? Array.from(sel) : sorted.map((r) => r.id), note })}
    />
  ) : undefined;

  const toolbarNode = (
    <ApprovalToolbar
      search={search}
      onSearch={(v) => { setSearch(v); setPage(1); }}
      viewToggle={<ViewToggle view={view} onChange={setView} />}
      filters={<>
        {showPhaseToggle && phaseToggle}
        <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[130px] text-xs flex-shrink-0" data-testid="filter-priority"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={catFilter} onValueChange={(v) => { setCatFilter(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[150px] text-xs flex-shrink-0" data-testid="filter-category"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </>}
      sort={
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-9 w-[160px] text-xs flex-shrink-0" data-testid="sort-reimb"><ArrowDownUp className="h-3.5 w-3.5 mr-1 text-muted-foreground" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updated_desc">Recently updated</SelectItem>
            <SelectItem value="date_desc">Newest first</SelectItem>
            <SelectItem value="date_asc">Oldest first</SelectItem>
            <SelectItem value="amount_desc">Amount: High → Low</SelectItem>
            <SelectItem value="amount_asc">Amount: Low → High</SelectItem>
          </SelectContent>
        </Select>
      }
      extra={<>
        {dateRange}
        {phase === "completed" && <Button variant="secondary" size="sm" className="h-9 flex-shrink-0" onClick={() => doExport(sorted)} data-testid="button-export-reimb"><Download className="h-4 w-4 mr-1" /> Export</Button>}
      </>}
      selectable={allowBulk && phase === "pending"}
      selectionMode={selectionMode}
      onSelect={() => setSelectionMode(true)}
      onExitSelect={exitSelection}
      allSelected={allSelected}
      onToggleAll={toggleAll}
      page={curPage}
      totalPages={totalPages}
      onPage={setPage}
      total={sorted.length}
      pageSize={REIMB_PAGE_SIZE}
    />
  );

  // Table columns — shared by the flat (Completed) and stage-grouped (pending) table renders.
  const reimbCols = [
    ...(allowBulk && selectionMode ? [{ key: "__sel", header: "", render: (r: any) => <div onClick={(e) => e.stopPropagation()}><Checkbox checked={sel.has(r.id)} onCheckedChange={() => toggle(r.id)} data-testid={`select-reimb-row-${r.id}`} /></div> }] : []),
    { key: "reference", header: "Reference", cellClassName: "font-medium text-foreground" },
    { key: "requester", header: "Requester", render: (r: any) => <span className="text-foreground">{r.employeeName || "—"}<span className="text-muted-foreground"> ({r.employeeCode || "—"})</span></span> },
    { key: "category", header: "Category", cellClassName: "text-muted-foreground capitalize", render: (r: any) => r.category || "—" },
    { key: "amount", header: "Amount", align: "right" as const, cellClassName: "font-semibold text-foreground", render: (r: any) => money(r.totalAmount) },
    { key: "submitted", header: "Submitted", cellClassName: "text-muted-foreground", render: (r: any) => r.createdAt ? format(new Date(r.createdAt), "dd MMM yyyy") : "—" },
    { key: "decision", header: "Decision Date", cellClassName: "text-muted-foreground", render: (r: any) => r.updatedAt ? format(new Date(r.updatedAt), "dd MMM yyyy") : "—" },
    { key: "status", header: "Status", render: (r: any) => <Badge className={`text-xs ${statusClass(r.status)}`}>{statusLabel(r.status)}</Badge> },
    { key: "approvedBy", header: "Approved By", cellClassName: "text-muted-foreground", render: (r: any) => approvedByName(r) },
    { key: "__view", header: "View", align: "center" as const, render: (r: any) => <Button size="sm" variant="ghost" className="h-8 text-[#206295]" onClick={(e) => { e.stopPropagation(); openDetail(r); }} data-testid={`view-completed-${r.id}`}><Eye className="h-3.5 w-3.5 mr-1" /> View</Button> },
  ];
  const reimbTable = (rows: any[], serialStart = 1) => (
    <div className="card-surface rounded-2xl">
      <DataTable columns={reimbCols} rows={rows} getRowKey={(r: any) => r.id} onRowClick={(r: any) => (selectionMode ? toggle(r.id) : openDetail(r))} testIdPrefix="completed-reimb" paginate={false} showSerial serialStart={serialStart} />
    </div>
  );
  const emptyState = (kind: "card" | "table") => {
    const msg = `${phase === "pending" ? "No reimbursements awaiting your approval" : "No completed reimbursements"}${range.from || range.to ? " in this date range" : ""}.`;
    return kind === "table"
      ? <div className="card-surface rounded-2xl p-10 text-center text-sm text-muted-foreground">{msg}</div>
      : <div className="card-surface rounded-2xl py-16 text-center"><Check className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">{msg}</p></div>;
  };

  // A reimbursement card by id — reused for the flat list (Completed) and inside each pending stage group.
  const reimbCard = (r: any) => {
          const amt = Number(r.totalAmount || 0);
          const pr = reimbPriority(amt);
          // Mobile: compact card — reference + category, amount + priority, employee | HOD, purpose, View.
          if (isMobile) {
            return (
              <div key={r.id} data-testid={`appr-reimb-${r.id}`} className={`card-surface card-hover relative p-3 cursor-pointer ${selectionMode && sel.has(r.id) ? "ring-2 ring-[#206295]" : isJustUpdated(r.updatedAt) ? "ring-1 ring-[#4BDCD9]/70" : ""}`} onClick={() => (selectionMode ? toggle(r.id) : openDetail(r))}>
                <div className="flex items-center gap-2">
                  {allowBulk && selectionMode && <Checkbox checked={sel.has(r.id)} onClick={(e: any) => e.stopPropagation()} onCheckedChange={() => toggle(r.id)} className="flex-shrink-0" data-testid={`select-reimb-${r.id}`} />}
                  <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-[13px] font-semibold text-foreground truncate flex-1">{r.reference}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{relDate(r.updatedAt || r.createdAt)}</span>
                  <Badge className="text-[10px] px-2 py-0.5 capitalize flex-shrink-0" style={catStyle(r.category || "other")}>{r.category || "—"}</Badge>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1.5">
                  <span className="text-xl font-bold text-[#206295] tabular-nums leading-none">₹{amt.toLocaleString("en-IN")}</span>
                  <Badge className={`text-[10px] flex-shrink-0 ${pr.cls}`}>{pr.label}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-1">
                  <span className="font-medium text-foreground">{r.employeeName || "Employee"}</span> ({r.employeeCode || "—"})<span className="mx-1.5 text-border">|</span>HOD: {r.hodName || "—"}
                </p>
                {r.businessPurpose && <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">{r.businessPurpose}</p>}
                {!selectionMode && (
                  <div onClick={(e) => e.stopPropagation()} className="mt-2">
                    <Button size="sm" variant="ghost" className="h-9 w-full btn-glass text-[#206295] hover:text-[#206295]" onClick={() => openDetail(r)} data-testid={`view-reimb-${r.id}`}><Eye className="h-4 w-4 mr-1.5" /> View</Button>
                  </div>
                )}
              </div>
            );
          }
          return (
            <div key={r.id} data-testid={`appr-reimb-${r.id}`}
              className={`group card-surface card-hover relative p-6 cursor-pointer ${selectionMode && sel.has(r.id) ? "ring-2 ring-[#206295]" : isJustUpdated(r.updatedAt) ? "ring-1 ring-[#4BDCD9]/70" : ""}`}
              onClick={() => (selectionMode ? toggle(r.id) : openDetail(r))}>
              {/* Overflow menu — top-right corner (hidden in selection mode) */}
              {!selectionMode && (
                <div className="absolute right-4 top-4" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" data-testid={`more-reimb-${r.id}`}><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => openDetail(r)}><Eye className="h-4 w-4 mr-2" /> View details</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/my-approvals/reimbursement/${r.id}`)}><Maximize2 className="h-4 w-4 mr-2" /> Open full page</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportReimbursement(r)}><Download className="h-4 w-4 mr-2" /> Export</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}

              <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
                {allowBulk && selectionMode && (
                  <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                    <Checkbox checked={sel.has(r.id)} onCheckedChange={() => toggle(r.id)} data-testid={`select-reimb-${r.id}`} />
                  </div>
                )}

                {/* Identity — reading flow: reference → amount → employee */}
                <div className="flex-1 min-w-0 lg:pr-6">
                  {/* 1 | Reference (heading) */}
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-[13px] font-semibold tracking-wide text-foreground truncate">{r.reference}</span>
                    <Badge className="text-[10px] px-2 py-0.5 capitalize" style={catStyle(r.category || "other")}>{r.category || "—"}</Badge>
                  </div>
                  {/* 2 | Amount (primary emphasis — blue) */}
                  <div className="flex items-end gap-1 mt-1.5">
                    <IndianRupee className="h-7 w-7 text-[#206295] mb-1" />
                    <span className="text-[2.1rem] leading-none font-bold text-[#206295] tracking-tight tabular-nums">{amt.toLocaleString("en-IN")}</span>
                  </div>
                  {/* 3 | Employee | HOD | Purpose (one line, small vertical separators) */}
                  <div className="flex items-center gap-2.5 mt-2.5 text-sm min-w-0">
                    <span className="flex-shrink-0">
                      <span className="font-bold text-foreground">{r.employeeName || "Employee"}</span>
                      <span className="text-muted-foreground font-normal"> ({r.employeeCode || "—"})</span>
                    </span>
                    <Separator orientation="vertical" className="h-3.5 flex-shrink-0" />
                    <span className="flex-shrink-0">
                      <span className="text-muted-foreground">HOD: </span>
                      <span className="font-semibold text-foreground/90">{r.hodName || "—"}</span>
                    </span>
                    {r.businessPurpose ? (
                      <>
                        <Separator orientation="vertical" className="h-3.5 flex-shrink-0" />
                        <span className="min-w-0 truncate"><span className="text-muted-foreground">Purpose: </span><span className="text-muted-foreground">{r.businessPurpose}</span></span>
                      </>
                    ) : null}
                  </div>
                </div>

                {/* Primary divider — longer, darker & thicker than the inner separators */}
                <div className="hidden lg:block self-center w-[1.4px] h-24 rounded-full bg-foreground/30 flex-shrink-0" />

                {/* Meta group — icon top-right, teal label, bolder value; items divided by separators */}
                <div className="flex flex-wrap lg:flex-nowrap items-stretch gap-x-6 gap-y-3 lg:gap-6 flex-shrink-0">
                  <div className="w-[112px] flex-shrink-0">
                    <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                    {(() => { const si = reimbSubmittedInfo(r); return si.resubmitted ? (
                      <TooltipProvider delayDuration={150}><Tooltip>
                        <TooltipTrigger asChild><p className="text-[12px] uppercase tracking-wide text-muted-foreground mt-1 underline decoration-dotted underline-offset-2 cursor-help w-fit">{si.label}</p></TooltipTrigger>
                        <TooltipContent>Originally created {si.originalDate ? format(new Date(si.originalDate), "dd MMM yyyy") : "—"}</TooltipContent>
                      </Tooltip></TooltipProvider>
                    ) : (
                      <p className="text-[12px] uppercase tracking-wide text-muted-foreground mt-1">{si.label}</p>
                    ); })()}
                    <p className="text-sm font-semibold text-foreground mt-1">{(() => { const si = reimbSubmittedInfo(r); return si.date ? format(new Date(si.date), "dd MMM yyyy") : "—"; })()}</p>
                  </div>
                  <Separator orientation="vertical" className="h-14 hidden lg:block" />
                  <div className="w-[150px] flex-shrink-0">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-[12px] uppercase tracking-wide text-muted-foreground mt-1">Department</p>
                    <p className="text-sm font-semibold text-foreground mt-1 truncate max-w-[150px]">{r.department || "—"}</p>
                  </div>
                  <Separator orientation="vertical" className="h-14 hidden lg:block" />
                  <div className="w-[88px] flex-shrink-0">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-[12px] uppercase tracking-wide text-muted-foreground mt-1">Priority</p>
                    <Badge className={`text-[10px] px-2 py-0.5 mt-1.5 font-semibold ${pr.cls}`}>{pr.label}</Badge>
                  </div>
                </div>

                {!selectionMode && (
                  <>
                    <Separator orientation="vertical" className="h-16 hidden lg:block" />
                    {/* View action */}
                    <div className="flex-shrink-0 pr-2" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" className="h-10 w-[108px] btn-glass text-[#206295] hover:text-[#206295]" onClick={() => openDetail(r)} data-testid={`view-reimb-${r.id}`}>
                        <Eye className="h-4 w-4 mr-1.5" /> View
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
  };

  const bodyNode = (
    <>
      {/* ===== Table view ===== */}
      {view === "table" && (
        sorted.length === 0 ? emptyState("table")
        : grouped ? (
          <div className="space-y-6">
            {stageGroups(sorted).map((g) => (
              <div key={g.title} className="space-y-2.5">
                <StageHeader label={g.title} count={g.items.length} tone={g.tone} />
                {reimbTable(g.items)}
              </div>
            ))}
          </div>
        ) : reimbTable(pageItems, (curPage - 1) * REIMB_PAGE_SIZE + 1)
      )}

      {/* ===== Card view ===== */}
      {view === "card" && (
        sorted.length === 0 ? emptyState("card")
        : grouped ? (
          <div className="space-y-6">
            {stageGroups(sorted).map((g) => (
              <div key={g.title} className="space-y-3">
                <StageHeader label={g.title} count={g.items.length} tone={g.tone} />
                <div className="space-y-3">{g.items.map(reimbCard)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">{pageItems.map(reimbCard)}</div>
        )
      )}
    </>
  );

  const detailNode = detail ? (
    <ReimbursementApprovalModal
      reimb={detail}
      canAct={detail.status !== "approved" && detail.status !== "rejected"}
      open={!!detail}
      onClose={() => setDetail(null)}
      onExpand={() => { const id = detail.id; setDetail(null); navigate(`/my-approvals/reimbursement/${id}`); }}
    />
  ) : null;

  if (asModal) {
    return (
      <>
        <ApprovalModal open={open} onClose={() => onClose?.()} icon={FileText} title="Reimbursement approvals" count={items.length} toolbar={toolbarNode} footer={footerNode}>
          <div className="space-y-4">{bodyNode}</div>
        </ApprovalModal>
        {detailNode}
      </>
    );
  }
  return (
    <div className="space-y-4">
      {toolbarNode}
      {bodyNode}
      {footerNode && <div className="border-t border-border pt-4">{footerNode}</div>}
      {detailNode}
    </div>
  );
}
