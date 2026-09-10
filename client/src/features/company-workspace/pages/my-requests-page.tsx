import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { usePaged, PaginationBar } from "@/components/shared/pagination";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose, SheetTrigger } from "@/components/ui/sheet";
import { NewRequestDialog, OfficePurchaseDetailDialog } from "@/features/company-workspace/office-purchases/components/office-purchase";
import { NewTravelDialog, TravelDetailDialog } from "@/features/company-workspace/travel/components/travel";
import { ProcurementDetailDialog } from "@/features/company-workspace/procurement/components/procurement";
import { useToast } from "@/hooks/use-toast";
import { DateInput } from "@/components/shared/datetime-field";
import { Plus, ShoppingCart, Car, TicketIcon, Receipt, ChevronLeft, Package, Trash2, Search, LayoutGrid, Table2, ArrowDownUp, Save, FileEdit, SlidersHorizontal, X } from "lucide-react";
import { ReimbursementFormDialog, reimbDraftComplete } from "@/features/company-workspace/reimbursements/components/reimbursement-form";
import { statusClass, statusLabel } from "@/lib/status";
import { formatDate, money, matchesFilter, amountOf, searchText, itemsHeadline, DONE_STATUS } from "../shared/request-format";
import { relDate } from "@/lib/format";
import { readDrafts, writeDrafts, newDraftId, type Draft } from "../shared/drafts";
import { TicketForm } from "../tickets/components/ticket-form";
import { RequestTable } from "../components/request-table";
import { RequestDetailModal } from "../components/request-detail-modal";
import { RequestCard } from "../components/request-card";
import { PurchaseRequestCard } from "../components/purchase-request-card";
import { TravelRequestCard } from "../components/travel-request-card";
import { DraftCard } from "../components/draft-card";
import { ReimbCardView } from "../reimbursements/components/reimb-card-view";

// Labels for the mobile Filters sheet's active chips (Status + Sort).
const STATUS_CHIP_LABELS: Record<string, string> = { pending: "Pending", approved: "Approved", rejected: "Rejected" };
const SORT_CHIP_LABELS: Record<string, string> = {
  status_change: "Latest Status Change", date_desc: "Newest", date_asc: "Oldest",
  amount_desc: "Amount: High → Low", amount_asc: "Amount: Low → High",
};

// In-Progress stage buckets per request type — the list groups under these full-width headers
// (most-actionable first); every terminal status lives under the Completed toggle (DONE_STAGE).
type StageDef = { key: string; label: string; has: (s: string) => boolean };
const STAGE_DEFS: Record<string, StageDef[]> = {
  office: [
    { key: "hr", label: "Awaiting HR", has: (s) => s === "pending_hr" },
    { key: "query", label: "Needs your reply", has: (s) => s === "under_review" },
    { key: "approval", label: "Awaiting approval", has: (s) => ["priced", "pending_approval"].includes(s) },
    { key: "order", label: "Approved", has: (s) => s === "approved" },
    { key: "ordered", label: "Ordered", has: (s) => s === "ordered" },
  ],
  procurement: [
    { key: "approval", label: "Awaiting approval", has: (s) => s === "pending_approval" },
    { key: "query", label: "Needs your reply", has: (s) => s === "under_review" },
  ],
  ticket: [
    { key: "open", label: "Open", has: (s) => s === "open" },
    { key: "progress", label: "In progress", has: (s) => s === "in_progress" },
    { key: "info", label: "Needs your info", has: (s) => s === "need_info" },
  ],
  reimbursement: [
    { key: "changes", label: "Changes requested", has: (s) => s === "changes_requested" },
    { key: "finance", label: "Awaiting finance", has: (s) => s === "submitted" },
    { key: "ceo", label: "Awaiting CEO", has: (s) => s === "finance_approved" },
    { key: "query", label: "Under review", has: (s) => s === "under_review" },
  ],
  travel: [
    { key: "hr", label: "Awaiting HR", has: (s) => s === "pending_hr" },
    { key: "approval", label: "Awaiting approval", has: (s) => ["pending_approval", "under_review"].includes(s) },
    { key: "book", label: "Awaiting booking", has: (s) => s === "approved" },
  ],
};
// Terminal statuses shown under the Completed toggle.
const DONE_STAGE: Record<string, string[]> = {
  office: ["delivered", "rejected", "cancelled"],
  procurement: ["approved", "rejected", "cancelled"],
  ticket: ["resolved", "closed"],
  reimbursement: ["approved", "rejected", "cancelled"],
  travel: ["booked", "rejected", "cancelled"],
};

// Full-width stage header: label + count + a hairline rule filling the row. Wraps cleanly on phone.
function StageHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2.5 pt-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-muted text-[10px] font-bold text-muted-foreground flex-shrink-0">{count}</span>
      <span className="h-px flex-1 bg-border/70 rounded-full" />
    </div>
  );
}

export default function MyRequestsPage() {
  const { data: auth } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();
  const [, navigate] = useLocation();

  // Tab comes from the clean path (/my-requests/<tab>); query is only used for the auto-open flag.
  const params = new URLSearchParams(location.split("?")[1] || "");
  const pathTab = location.replace(/\?.*$/, "").replace(/^\/my-requests\/?/, "");
  // "Purchases" (legacy) is retired in favour of "Office Purchases"; redirect old links/default.
  const rawTab = pathTab || params.get("tab") || "office-purchases";
  const initTab = rawTab === "purchases" ? "office-purchases" : rawTab;
  const autoNew = params.get("new") === "true";

  const [tab, setTab] = useState(initTab);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("status_change");
  const [view, setView] = useState<"card" | "table">("card");
  const [filterSheet, setFilterSheet] = useState(false); // mobile Filters bottom-sheet (Status + Sort)
  const [phase, setPhase] = useState<"active" | "completed">("active"); // In Progress / Completed — mirrors the approval screens' phase toggle
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ type: string; item: any } | null>(null);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketInitial, setTicketInitial] = useState<any>(null);
  const [ticketForceValidate, setTicketForceValidate] = useState(false);
  const [showReimbForm, setShowReimbForm] = useState(false);

  // ---- Drafts ----
  const [drafts, setDrafts] = useState<Draft[]>(() => readDrafts());
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [reimbInitial, setReimbInitial] = useState<any>(null);
  const [reimbResubmit, setReimbResubmit] = useState<{ id: string; decisionNote?: string; editable?: { fields: string[]; lines: number[] } } | null>(null);
  const [reimbForceValidate, setReimbForceValidate] = useState(false);
  const [submittingDraftId, setSubmittingDraftId] = useState<string | null>(null);
  const persistDrafts = (next: Draft[]) => { setDrafts(next); if (!writeDrafts(next)) toast({ title: "Could not save draft", description: "Local storage is full.", variant: "destructive" }); };
  const removeDraft = (id: string) => persistDrafts(readDrafts().filter((d) => d.id !== id));

  // Auto-open form if navigated from service catalog
  useEffect(() => {
    if (autoNew) {
      if (initTab === "travels") { setEditingDraftId(null); setTripInitial(null); setShowNewTravel(true); }
      else if (initTab === "tickets") setShowTicketForm(true);
    }
  }, [autoNew, initTab]);

  const { data: myTrips = [], isLoading: loadTrips } = useQuery<any[]>({ queryKey: ["/api/travel?mine=true"] });
  const [showNewTravel, setShowNewTravel] = useState(false);
  const [travelDetailId, setTravelDetailId] = useState<string | null>(null);
  const [tripInitial, setTripInitial] = useState<any>(null);
  const { data: tickets = [], isLoading: loadTickets } = useQuery<any[]>({ queryKey: ["/api/my-requests/tickets"] });
  const { data: reimbursements = [], isLoading: loadReimb } = useQuery<any[]>({ queryKey: ["/api/reimbursements?mine=true"] });
  const { data: officePurchases = [], isLoading: loadOP } = useQuery<any[]>({ queryKey: ["/api/office-purchases?mine=true"] });
  const [opDetailId, setOpDetailId] = useState<string | null>(null);
  const [opNewOpen, setOpNewOpen] = useState(false);
  const [newKind, setNewKind] = useState<"office" | "procurement" | undefined>(undefined);
  const [newInitialData, setNewInitialData] = useState<any>(null);
  const { data: procurement = [], isLoading: loadProc } = useQuery<any[]>({ queryKey: ["/api/procurement?mine=true"] });
  const [procDetailId, setProcDetailId] = useState<string | null>(null);



  // Ticket form

  // Subscribe to each form's validation errors so required-field styling re-renders.

  // Closing a form without saving (Cancel / X / click-away) discards all input — a fresh form opens next time.
  // (Submitting or "Save as Draft" already persist + reset separately.)
  const closeTicket = () => { setShowTicketForm(false); setEditingDraftId(null); setTicketInitial(null); setTicketForceValidate(false); };

  // Open a "changes requested" reimbursement in the form to edit & resubmit; everything else opens the read-only detail.
  const openReimb = (it: any) => {
    if (it.status !== "changes_requested") { setDetail({ type: "reimbursement", item: it }); return; }
    let editable: { fields: string[]; lines: number[] } | undefined;
    try { const p = JSON.parse(it.notes || "{}"); if (p && p.kind === "change_request") editable = { fields: p.fields || [], lines: p.lines || [] }; } catch {}
    setEditingDraftId(null);
    setReimbInitial({ businessPurpose: it.businessPurpose, periodFrom: it.periodFrom, periodTo: it.periodTo, items: Array.isArray(it.lines) ? it.lines : [], cashAdvance: it.cashAdvance });
    setReimbResubmit({ id: it.id, decisionNote: it.decisionNote, editable });
    setShowReimbForm(true);
  };

  // ---- Draft actions ----
  const saveDraft = (type: string, data: any) => {
    const base = readDrafts().filter((d) => d.id !== editingDraftId);
    const id = editingDraftId || newDraftId();
    persistDrafts([{ id, type, data, savedAt: Date.now() }, ...base]);
    setEditingDraftId(null);
    setShowTicketForm(false); setTicketInitial(null); setTicketForceValidate(false); setShowReimbForm(false); setReimbInitial(null);
    toast({ title: "Saved to Drafts" });
  };
  const editDraft = (d: Draft) => {
    setEditingDraftId(d.id);
    setReimbForceValidate(false);
    if (d.type === "trip") { setTripInitial(d.data); setShowNewTravel(true); }
    else if (d.type === "office" || d.type === "procurement") { setNewKind(d.type); setNewInitialData(d.data); setOpNewOpen(true); }
    else if (d.type === "purchase") { setNewKind("office"); setNewInitialData(null); setOpNewOpen(true); } // legacy purchase drafts → current Office Purchase dialog
    else if (d.type === "travel") { setTripInitial(null); setShowNewTravel(true); } // legacy travel drafts → new travel dialog
    else if (d.type === "ticket") { setTicketInitial(d.data); setShowTicketForm(true); }
    else { setReimbInitial(d.data); setShowReimbForm(true); }
  };
  // Mandatory-field check per draft type — mirrors each form's own required fields.
  const draftComplete = (d: Draft): boolean => {
    const x = d.data || {};
    if (d.type === "trip") return false; // always open the travel dialog to finish + submit
    if (d.type === "office" || d.type === "procurement") {
      const items = Array.isArray(x.items) ? x.items : [];
      if (!items.length) return false;
      return d.type === "procurement"
        ? items.every((i: any) => (i.description || "").trim() && Number(i.quantity) > 0 && Number(i.unitPrice) > 0 && (i.finalLink || "").trim())
        : items.every((i: any) => (i.description || "").trim() && Number(i.quantity) > 0);
    }
    // "purchase" / "travel" are retired draft types from the old flow. Never submit them straight
    // through — reopen the current dialog so the data is re-entered against today's fields.
    if (d.type === "purchase" || d.type === "travel") return false;
    if (d.type === "ticket") return !!((x.subject || "").trim());
    return reimbDraftComplete(x);
  };

  const submitDraft = async (d: Draft) => {
    // Missing mandatory fields → don't submit; open the pre-filled form with validation shown.
    if (!draftComplete(d)) {
      editDraft(d);
      if (d.type === "ticket") setTicketForceValidate(true);
      else if (!["office", "procurement", "trip", "purchase", "travel"].includes(d.type)) setReimbForceValidate(true); // these dialogs keep their own Submit disabled until valid
      toast({ title: "Please complete the required fields", variant: "destructive" });
      return;
    }
    setSubmittingDraftId(d.id);
    try {
      const x = d.data || {};
      if (d.type === "ticket") {
        await apiRequest("POST", "/api/my-requests/tickets", x);
      } else if (d.type === "office") {
        const items = (x.items || []).filter((it: any) => (it.description || "").trim());
        await apiRequest("POST", "/api/office-purchases", { justification: x.justification || null, items: items.map((it: any) => ({ description: (it.description || "").trim(), quantity: Number(it.quantity) || 1, suggestedLinks: (it.suggestedLinks || []).filter(Boolean) })) });
      } else if (d.type === "procurement") {
        const items = (x.items || []).filter((it: any) => (it.description || "").trim());
        await apiRequest("POST", "/api/procurement", { category: "amazon", justification: x.justification || null, items: items.map((it: any) => ({ description: (it.description || "").trim(), quantity: Number(it.quantity) || 1, link: (it.finalLink || "").trim(), unitPrice: Number(it.unitPrice) || 0 })) });
      } else {
        const items = x.items || [];
        const subTotal = items.reduce((s: number, it: any) => s + (Number(it.amount) || 0), 0);
        await apiRequest("POST", "/api/reimbursements", { businessPurpose: x.businessPurpose, periodFrom: x.periodFrom || null, periodTo: x.periodTo || null, category: items.length === 1 && items[0].nature ? items[0].nature : "Mixed", totalAmount: String(subTotal), cashAdvance: String(Number(x.cashAdvance) || 0), currency: "INR", description: x.businessPurpose, lines: items.map((it: any) => ({ invoiceNo: it.invoiceNo || null, invoiceDate: it.invoiceDate || null, description: it.description, nature: it.nature, amount: Number(it.amount) || 0, fileName: it.fileName || null, fileType: it.fileType || null, fileData: it.fileData || null })) });
      }
      removeDraft(d.id);
      queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/") });
      toast({ title: "Draft submitted" });
    } catch (e: any) {
      toast({ title: "Submit failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmittingDraftId(null);
    }
  };






  const renderEmpty = (msg: string) => (
    <Card className="py-12"><CardContent className="text-center text-sm text-muted-foreground">{msg}</CardContent></Card>
  );

  // Split a list into full-width stage sections (most-actionable first); `renderGroup` draws each
  // section's body — a list of cards for card view, or one DataTable for table view.
  const renderStageSections = (items: any[], type: string, renderGroup: (groupItems: any[]) => React.ReactNode, emptyMsg: string) => {
    const defs = STAGE_DEFS[type] || [];
    const seen = new Set<string>();
    const groups = defs.map((st) => {
      const gi = items.filter((x) => st.has(x.status));
      gi.forEach((x) => seen.add(x.id));
      return { key: st.key, label: st.label, items: gi };
    }).filter((g) => g.items.length > 0);
    const rest = items.filter((x) => !seen.has(x.id));   // any status not mapped to a stage — never drop it
    if (rest.length) groups.push({ key: "other", label: "In progress", items: rest });
    if (groups.length === 0) return renderEmpty(emptyMsg);
    return (
      <div className="space-y-6">
        {groups.map((g) => (
          <div key={g.key} className="space-y-3">
            <StageHeader label={g.label} count={g.items.length} />
            {renderGroup(g.items)}
          </div>
        ))}
      </div>
    );
  };
  // Card view: one card per item within each stage section.
  const renderStageGroups = (items: any[], type: string, renderCard: (x: any) => React.ReactNode, emptyMsg: string) =>
    renderStageSections(items, type, (gi) => gi.map(renderCard), emptyMsg);
  const isDoneStage = (type: string, status: string) => (DONE_STAGE[type] || []).includes(status);

  // status filter -> search -> sort, applied per tab.
  const refine = (list: any[], type: string) => {
    const q = search.trim().toLowerCase();
    let r = list.filter((x) => matchesFilter(x.status, statusFilter));
    if (q) r = r.filter((x) => searchText(type, x).includes(q));
    const changedAt = (x: any) => +new Date(x.updatedAt || x.createdAt || 0);
    r = [...r].sort((a, b) => {
      if (sortBy === "amount_desc") return amountOf(type, b) - amountOf(type, a);
      if (sortBy === "amount_asc") return amountOf(type, a) - amountOf(type, b);
      if (sortBy === "status_change") {
        // "Changes Requested" pinned to the very top, then most-recently-updated first.
        const cr = (x: any) => (x.status === "changes_requested" ? 1 : 0);
        if (cr(a) !== cr(b)) return cr(b) - cr(a);
        return changedAt(b) - changedAt(a);
      }
      const da = +new Date(a.createdAt || 0), db = +new Date(b.createdAt || 0);
      return sortBy === "date_asc" ? da - db : db - da;
    });
    return r;
  };

  // In Progress / Completed toggle — same segmented control as the approval screens (replaces the old sections).
  const phaseToggle = (
    <div className="segmented-toggle inline-flex p-0.5 h-10 flex-shrink-0" data-testid="req-phase-toggle">
      {(["active", "completed"] as const).map((p) => (
        <button key={p} onClick={() => setPhase(p)} data-testid={`req-phase-${p}`} className={`px-3 h-full rounded-[10px] text-xs font-medium ${phase === p ? "btn-primary-gradient text-white" : "text-muted-foreground"}`}>
          {p === "active" ? "In Progress" : "Completed"}
        </button>
      ))}
    </div>
  );

  // Mobile-only clone of the phase toggle (distinct test-ids so it can coexist with the desktop one).
  // Open the "new request" form for the currently-selected tab (used by the mobile category row).
  const openNewForTab = () => {
    setEditingDraftId(null);
    if (tab === "travels") { setTripInitial(null); setShowNewTravel(true); }
    else if (tab === "tickets") { setTicketInitial(null); setTicketForceValidate(false); setShowTicketForm(true); }
    else if (tab === "reimbursements") { setReimbInitial(null); setReimbResubmit(null); setReimbForceValidate(false); setShowReimbForm(true); }
    else if (tab === "office-purchases") { setNewInitialData(null); setNewKind("office"); setOpNewOpen(true); }
    else if (tab === "procurement") { setNewInitialData(null); setNewKind("procurement"); setOpNewOpen(true); }
  };

  // Shared header controls (view | phase | search | status filter | sort | primary button).
  // Desktop keeps the original inline strip; mobile keeps toggles + New visible and folds
  // Status + Sort into a Filters bottom-sheet with dismissible active chips.
  const controls = (newBtn: React.ReactNode, showPhase = false) => {
    const filterChips: { key: string; label: string; onClear: () => void }[] = [];
    if (statusFilter !== "all") filterChips.push({ key: "status", label: STATUS_CHIP_LABELS[statusFilter] ?? statusFilter, onClear: () => setStatusFilter("all") });
    if (sortBy !== "status_change") filterChips.push({ key: "sort", label: SORT_CHIP_LABELS[sortBy] ?? sortBy, onClear: () => setSortBy("status_change") });
    if (showPhase && phase !== "active") filterChips.push({ key: "phase", label: "Completed", onClear: () => setPhase("active") });
    const resetFilters = () => { setStatusFilter("all"); setSortBy("status_change"); setPhase("active"); };
    return (
      <>
        {/* Desktop — original inline toolbar (unchanged). */}
        <div className="hidden sm:flex items-center gap-3 flex-wrap">
          {/* View toggle — icon only */}
          <div className="segmented-toggle inline-flex p-0.5 h-10 flex-shrink-0">
            <button onClick={() => setView("card")} aria-label="Card view" data-testid="view-card" className={`px-3 h-full rounded-[10px] inline-flex items-center justify-center ${view === "card" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`}><LayoutGrid className="h-4 w-4" /></button>
            <button onClick={() => setView("table")} aria-label="Table view" data-testid="view-table" className={`px-3 h-full rounded-[10px] inline-flex items-center justify-center ${view === "table" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`}><Table2 className="h-4 w-4" /></button>
          </div>
          <div className="w-px self-stretch flex-shrink-0 bg-foreground/30" />
          {showPhase && phaseToggle}
          {/* Search — fills available width */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search requests…" className="pl-8 h-10 w-full" data-testid="input-search-requests" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 w-[130px] flex-shrink-0" data-testid="select-status-filter"><SelectValue placeholder="Filter" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-10 w-[230px] gap-1 flex-shrink-0" data-testid="select-sort"><ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" /><span className="text-muted-foreground">Sort:</span><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="status_change">Latest Status Change</SelectItem>
              <SelectItem value="date_desc">Newest</SelectItem>
              <SelectItem value="date_asc">Oldest</SelectItem>
              <SelectItem value="amount_desc">Amount: High → Low</SelectItem>
              <SelectItem value="amount_asc">Amount: Low → High</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-shrink-0">{newBtn}</div>
        </div>

        {/* Mobile — search + Filters on one row; view | phase toggles + New below. */}
        <div className="sm:hidden space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search requests…" className="pl-8 h-10 w-full" data-testid="input-search-requests-mobile" />
            </div>
            <Sheet open={filterSheet} onOpenChange={setFilterSheet}>
              <SheetTrigger asChild>
                <Button variant="secondary" size="sm" className="flex-shrink-0" data-testid="button-filters-mobile">
                  <SlidersHorizontal className="h-4 w-4 mr-1.5" /> Filters
                  {filterChips.length > 0 && <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#206295] px-1 text-[10px] font-bold text-white">{filterChips.length}</span>}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
                <SheetHeader className="text-left"><SheetTitle>Filters</SheetTitle></SheetHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Status</p>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full" data-testid="sheet-status-filter"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {showPhase && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">Show</p>
                      <Select value={phase} onValueChange={(v) => setPhase(v as any)}>
                        <SelectTrigger className="w-full" data-testid="sheet-phase"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Sort</p>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-full" data-testid="sheet-sort"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="status_change">Latest Status Change</SelectItem>
                        <SelectItem value="date_desc">Newest</SelectItem>
                        <SelectItem value="date_asc">Oldest</SelectItem>
                        <SelectItem value="amount_desc">Amount: High → Low</SelectItem>
                        <SelectItem value="amount_asc">Amount: Low → High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <SheetFooter className="flex-row gap-2">
                  <Button variant="outline" className="flex-1" onClick={resetFilters} data-testid="sheet-reset">Reset</Button>
                  <SheetClose asChild><Button className="flex-1 btn-primary-gradient text-white" data-testid="sheet-apply">Show results</Button></SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
          {/* Category + New + Drafts live in the mobile tab row above; phase moved into the Filters sheet. */}
          {filterChips.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {filterChips.map((c) => (
                <button key={c.key} onClick={c.onClear} className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2.5 py-1 text-xs text-foreground hover-elevate" data-testid={`chip-${c.key}`}>
                  <span className="truncate max-w-[8rem]">{c.label}</span> <X className="h-3 w-3 flex-shrink-0" />
                </button>
              ))}
              {filterChips.length > 1 && <button onClick={resetFilters} className="text-xs font-medium text-[#206295] underline underline-offset-2" data-testid="chip-clear-all">Clear all</button>}
            </div>
          )}
        </div>
      </>
    );
  };

  const fTickets = refine(tickets as any[], "ticket");
  const fReimb = refine(reimbursements as any[], "reimbursement");
  // Active (In Progress) vs terminal (Completed) split, per the phase toggle.
  const tkActive = fTickets.filter((t) => !isDoneStage("ticket", t.status));
  const tkDone = fTickets.filter((t) => isDoneStage("ticket", t.status));
  const rbActive = fReimb.filter((r) => !isDoneStage("reimbursement", r.status));
  const rbDone = fReimb.filter((r) => isDoneStage("reimbursement", r.status));
  const opQuery = search.trim().toLowerCase();
  const fOP = (officePurchases as any[]).filter((o) =>
    matchesFilter(o.status, statusFilter) &&
    (opQuery === "" || `${o.reference || ""} ${(o.items || []).map((i: any) => i.description).join(" ")}`.toLowerCase().includes(opQuery))
  );
  const fProc = (procurement as any[]).filter((o) =>
    matchesFilter(o.status, statusFilter) &&
    (opQuery === "" || `${o.reference || ""} ${(o.items || []).map((i: any) => i.description).join(" ")}`.toLowerCase().includes(opQuery))
  );
  // 15-per-page pagination for the card views (table views paginate via DataTable).
  const tkPaged = usePaged(tkDone);
  const rbPaged = usePaged(rbDone);
  const opPaged = usePaged(fOP);
  const prPaged = usePaged(fProc);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[92rem] mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="icon" className="h-10 w-10 flex-shrink-0" onClick={() => navigate("/company-workspace")} aria-label="Back" data-testid="button-back">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Requests</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track all your purchase, travel, support and reimbursement requests</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); navigate(`/my-requests/${v}`); }} data-testid="tabs-my-requests">
        {/* Mobile: category dropdown + New + Drafts (replaces the tab strip). */}
        <div className="sm:hidden flex items-center gap-2">
          <Select value={tab === "drafts" ? "" : tab} onValueChange={(v) => { setTab(v); navigate(`/my-requests/${v}`); }}>
            <SelectTrigger className="flex-1 min-w-0 h-10" data-testid="select-tab-mobile"><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="office-purchases">Purchases{(officePurchases as any[]).length > 0 ? ` (${(officePurchases as any[]).length})` : ""}</SelectItem>
              <SelectItem value="procurement">Procurement{(procurement as any[]).length > 0 ? ` (${(procurement as any[]).length})` : ""}</SelectItem>
              <SelectItem value="travels">Travel{(myTrips as any[]).length > 0 ? ` (${(myTrips as any[]).length})` : ""}</SelectItem>
              <SelectItem value="tickets">Tickets{(tickets as any[]).length > 0 ? ` (${(tickets as any[]).length})` : ""}</SelectItem>
              <SelectItem value="reimbursements">Reimbursements{(reimbursements as any[]).length > 0 ? ` (${(reimbursements as any[]).length})` : ""}</SelectItem>
            </SelectContent>
          </Select>
          {tab !== "drafts" && <Button size="sm" className="flex-shrink-0" onClick={openNewForTab} data-testid="button-new-mobile"><Plus className="h-4 w-4 mr-1" /> New</Button>}
          <Button size="sm" variant={tab === "drafts" ? "default" : "secondary"} className="flex-shrink-0" onClick={() => { setTab("drafts"); navigate("/my-requests/drafts"); }} data-testid="button-drafts-mobile"><FileEdit className="h-4 w-4 mr-1" /> Drafts{drafts.length > 0 ? ` (${drafts.length})` : ""}</Button>
        </div>
        <TabsList className="hidden sm:inline-flex sm:flex-wrap">
          <TabsTrigger value="office-purchases">
            <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
            Purchases {(officePurchases as any[]).length > 0 && `(${(officePurchases as any[]).length})`}
          </TabsTrigger>
          <TabsTrigger value="procurement">
            <Package className="h-3.5 w-3.5 mr-1.5" />
            Procurement {(procurement as any[]).length > 0 && `(${(procurement as any[]).length})`}
          </TabsTrigger>
          <TabsTrigger value="travels">
            <Car className="h-3.5 w-3.5 mr-1.5" />
            Travel {(myTrips as any[]).length > 0 && `(${(myTrips as any[]).length})`}
          </TabsTrigger>
          <TabsTrigger value="tickets">
            <TicketIcon className="h-3.5 w-3.5 mr-1.5" />
            Tickets {(tickets as any[]).length > 0 && `(${(tickets as any[]).length})`}
          </TabsTrigger>
          <TabsTrigger value="reimbursements">
            <Receipt className="h-3.5 w-3.5 mr-1.5" />
            Reimbursements {(reimbursements as any[]).length > 0 && `(${(reimbursements as any[]).length})`}
          </TabsTrigger>
          <TabsTrigger value="drafts">
            <FileEdit className="h-3.5 w-3.5 mr-1.5" />
            Drafts {drafts.length > 0 && `(${drafts.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="travels" className="mt-4 space-y-5">
          {controls(
            <Button size="sm" onClick={() => { setEditingDraftId(null); setTripInitial(null); setShowNewTravel(true); }} data-testid="button-new-travel">
              <Plus className="h-4 w-4 mr-1.5" /><span className="hidden sm:inline">New Travel Request</span><span className="sm:hidden">New</span>
            </Button>
          , true)}
          {loadTrips ? <Skeleton className="h-24 w-full" /> :
            (myTrips as any[]).length === 0 ? renderEmpty("No travel requests yet.") :
            (() => {
              const active = (myTrips as any[]).filter((t) => !isDoneStage("travel", t.status));
              const done = (myTrips as any[]).filter((t) => isDoneStage("travel", t.status)).sort((a, b) => +new Date(b.updatedAt || b.createdAt || 0) - +new Date(a.updatedAt || a.createdAt || 0));
              const card = (t: any) => <TravelRequestCard key={t.id} item={t} onOpen={setTravelDetailId} />;
              if (phase === "active") return renderStageGroups(active, "travel", card, "No trips in progress.");
              return done.length === 0 ? renderEmpty("No completed trips.") : <div className="space-y-3">{done.map(card)}</div>;
            })()
          }
        </TabsContent>

        <TabsContent value="tickets" className="mt-4 space-y-5">
          {controls(
            <Button size="sm" onClick={() => { setEditingDraftId(null); setTicketInitial(null); setTicketForceValidate(false); setShowTicketForm(true); }} data-testid="button-new-ticket">
              <Plus className="h-4 w-4 mr-1.5" /> Raise Ticket
            </Button>
          , true)}
          {loadTickets ? <Skeleton className="h-24 w-full" /> :
            fTickets.length === 0 ? renderEmpty((tickets as any[]).length === 0 ? "No tickets yet." : "No tickets match this filter.") :
            view === "table" ? (phase === "active"
              ? renderStageSections(tkActive, "ticket", (gi) => <RequestTable type="ticket" items={gi} onOpen={(it) => setDetail({ type: "ticket", item: it })} />, "No tickets in progress.")
              : <RequestTable type="ticket" items={tkDone} onOpen={(it) => setDetail({ type: "ticket", item: it })} />) :
            phase === "active" ? renderStageGroups(tkActive, "ticket", (t: any) => <RequestCard key={t.id} item={t} type="ticket" onOpen={(it) => setDetail({ type: "ticket", item: it })} />, "No tickets in progress.") :
            tkDone.length === 0 ? renderEmpty("No completed tickets.") :
            <div className="space-y-3">
              {tkPaged.pageItems.map(t => (
                <RequestCard key={t.id} item={t} type="ticket" onOpen={(it) => setDetail({ type: "ticket", item: it })} />
              ))}
              <PaginationBar page={tkPaged.page} totalPages={tkPaged.totalPages} count={tkPaged.count} size={tkPaged.size} onPage={tkPaged.setPage} />
            </div>
          }
        </TabsContent>

        <TabsContent value="reimbursements" className="mt-4 space-y-5">
          {controls(
            <Button size="sm" onClick={() => { setEditingDraftId(null); setReimbInitial(null); setReimbResubmit(null); setReimbForceValidate(false); setShowReimbForm(true); }} data-testid="button-new-reimbursement">
              <Plus className="h-4 w-4 mr-1.5" /><span className="hidden sm:inline">New Reimbursement</span><span className="sm:hidden">New</span>
            </Button>
          , true)}
          {loadReimb ? <Skeleton className="h-24 w-full" /> :
            fReimb.length === 0 ? renderEmpty((reimbursements as any[]).length === 0 ? "No reimbursements yet." : "No reimbursements match this filter.") :
            view === "table" ? (phase === "active"
              ? renderStageSections(rbActive, "reimbursement", (gi) => <RequestTable type="reimbursement" items={gi} onOpen={openReimb} />, "No reimbursements in progress.")
              : <RequestTable type="reimbursement" items={rbDone} onOpen={openReimb} />) :
            phase === "active" ? renderStageGroups(rbActive, "reimbursement", (r: any) => <RequestCard key={r.id} item={r} type="reimbursement" onOpen={openReimb} />, "No reimbursements in progress.") :
            rbDone.length === 0 ? renderEmpty("No completed reimbursements.") :
            <div className="space-y-5">
              <ReimbCardView items={rbPaged.pageItems} onOpen={openReimb} />
              <PaginationBar page={rbPaged.page} totalPages={rbPaged.totalPages} count={rbPaged.count} size={rbPaged.size} onPage={rbPaged.setPage} />
            </div>
          }
        </TabsContent>

        <TabsContent value="office-purchases" className="mt-4 space-y-5">
          {controls(
            <Button size="sm" onClick={() => { setEditingDraftId(null); setNewInitialData(null); setNewKind("office"); setOpNewOpen(true); }} data-testid="button-new-office-purchase">
              <Plus className="h-4 w-4 mr-1.5" /><span className="hidden sm:inline">New Office Purchase</span><span className="sm:hidden">New</span>
            </Button>
          , true)}
          {loadOP ? <Skeleton className="h-24 w-full" /> :
            fOP.length === 0 ? renderEmpty((officePurchases as any[]).length === 0 ? "No office purchases yet." : "No office purchases match this filter.") :
            (() => {
              const done = fOP.filter((o: any) => DONE_STATUS.office.includes(o.status));
              const active = fOP.filter((o: any) => !DONE_STATUS.office.includes(o.status));
              if ((phase === "active" ? active : done).length === 0) return renderEmpty(phase === "active" ? "Nothing in progress." : "Nothing completed yet.");
              const opCols = [
                { key: "reference", header: "Reference", cellClassName: "font-medium text-foreground", render: (o: any) => o.reference },
                { key: "item", header: "Item", cellClassName: "text-foreground max-w-[20rem] truncate", render: (o: any) => itemsHeadline(o.items) },
                { key: "priority", header: "Priority", cellClassName: "capitalize text-muted-foreground", render: (o: any) => o.priority || "medium" },
                { key: "amount", header: "Amount", align: "right" as const, cellClassName: "font-semibold text-foreground", render: (o: any) => Number(o.totalAmount) > 0 ? money(o.totalAmount) : "—" },
                { key: "status", header: "Status", render: (o: any) => <Badge className={`text-xs ${statusClass(o.status)}`}>{statusLabel(o.status)}</Badge> },
                { key: "updated", header: "Last Updated", cellClassName: "text-muted-foreground", render: (o: any) => relDate(o.updatedAt || o.createdAt) },
              ];
              const opTable = (rows: any[]) => <Card className="border-0"><CardContent className="p-0"><DataTable columns={opCols} rows={rows} getRowKey={(o: any) => o.id} onRowClick={(o: any) => setOpDetailId(o.id)} testIdPrefix="op-row" showSerial /></CardContent></Card>;
              const opCard = (o: any) => <PurchaseRequestCard key={o.id} item={o} kind="office" onOpen={setOpDetailId} />;
              if (view === "table") return phase === "active" ? renderStageSections(active, "office", opTable, "Nothing in progress.") : opTable(done);
              return phase === "active" ? renderStageGroups(active, "office", opCard, "Nothing in progress.") : <div className="space-y-3">{done.map(opCard)}</div>;
            })()
          }
        </TabsContent>

        <TabsContent value="procurement" className="mt-4 space-y-5">
          {controls(
            <Button size="sm" onClick={() => { setEditingDraftId(null); setNewInitialData(null); setNewKind("procurement"); setOpNewOpen(true); }} data-testid="button-new-procurement">
              <Plus className="h-4 w-4 mr-1.5" /><span className="hidden sm:inline">New Procurement</span><span className="sm:hidden">New</span>
            </Button>
          , true)}
          {loadProc ? <Skeleton className="h-24 w-full" /> :
            fProc.length === 0 ? renderEmpty((procurement as any[]).length === 0 ? "No procurement requests yet." : "No procurement requests match this filter.") :
            (() => {
              const done = fProc.filter((o: any) => DONE_STATUS.procurement.includes(o.status));
              const active = fProc.filter((o: any) => !DONE_STATUS.procurement.includes(o.status));
              if ((phase === "active" ? active : done).length === 0) return renderEmpty(phase === "active" ? "Nothing in progress." : "Nothing completed yet.");
              const prCols = [
                { key: "reference", header: "Reference", cellClassName: "font-medium text-foreground", render: (o: any) => o.reference },
                { key: "item", header: "Item", cellClassName: "text-foreground max-w-[20rem] truncate", render: (o: any) => itemsHeadline(o.items) },
                { key: "amount", header: "Amount", align: "right" as const, cellClassName: "font-semibold text-foreground", render: (o: any) => Number(o.totalAmount) > 0 ? money(o.totalAmount) : "—" },
                { key: "status", header: "Status", render: (o: any) => <Badge className={`text-xs ${statusClass(o.status)}`}>{statusLabel(o.status)}</Badge> },
                { key: "updated", header: "Last Updated", cellClassName: "text-muted-foreground", render: (o: any) => relDate(o.updatedAt || o.createdAt) },
              ];
              const prTable = (rows: any[]) => <Card className="border-0"><CardContent className="p-0"><DataTable columns={prCols} rows={rows} getRowKey={(o: any) => o.id} onRowClick={(o: any) => setProcDetailId(o.id)} testIdPrefix="proc-row" showSerial /></CardContent></Card>;
              const prCard = (o: any) => <PurchaseRequestCard key={o.id} item={o} kind="procurement" onOpen={setProcDetailId} />;
              if (view === "table") return phase === "active" ? renderStageSections(active, "procurement", prTable, "Nothing in progress.") : prTable(done);
              return phase === "active" ? renderStageGroups(active, "procurement", prCard, "Nothing in progress.") : <div className="space-y-3">{done.map(prCard)}</div>;
            })()
          }
        </TabsContent>

        <TabsContent value="drafts" className="mt-4 space-y-5">
          {drafts.length === 0
            ? renderEmpty("No saved drafts. Use “Save as Draft” in any request form.")
            : (
              <div className="space-y-3">
                {drafts.slice().sort((a, b) => b.savedAt - a.savedAt).map((d) => (
                  <DraftCard key={d.id} draft={d} onEdit={editDraft}
                    onDelete={(dd) => { if (window.confirm("Delete this draft permanently?")) removeDraft(dd.id); }}
                    onSubmit={submitDraft} submitting={submittingDraftId === d.id} />
                ))}
              </div>
            )}
        </TabsContent>
      </Tabs>

      {/* Office Purchase — new-request chooser + detail (cancel / flag) */}
      <NewRequestDialog open={opNewOpen} onClose={() => { setOpNewOpen(false); setNewKind(undefined); setNewInitialData(null); }} initialKind={newKind} initialData={newInitialData}
        onSaveDraft={(data) => saveDraft(data.kind === "procurement" ? "procurement" : "office", data)}
        onSubmitted={() => { if (editingDraftId) { removeDraft(editingDraftId); setEditingDraftId(null); } }} />
      <OfficePurchaseDetailDialog id={opDetailId} open={!!opDetailId} onClose={() => setOpDetailId(null)} context="owner" />
      <ProcurementDetailDialog id={procDetailId} open={!!procDetailId} onClose={() => setProcDetailId(null)} context="owner" />
      <NewTravelDialog open={showNewTravel} onClose={() => { setShowNewTravel(false); setTripInitial(null); }} initialData={tripInitial}
        onSaveDraft={(data) => saveDraft("trip", data)}
        onSubmitted={() => { if (editingDraftId) { removeDraft(editingDraftId); setEditingDraftId(null); } }} />
      <TravelDetailDialog id={travelDetailId} open={!!travelDetailId} onClose={() => setTravelDetailId(null)} context="owner" />


      <TicketForm
        open={showTicketForm}
        onClose={closeTicket}
        onSaveDraft={(data: any) => saveDraft("ticket", data)}
        initialData={ticketInitial}
        autoValidate={ticketForceValidate}
        onSubmitted={() => { if (editingDraftId) { removeDraft(editingDraftId); setEditingDraftId(null); } }} />

      <ReimbursementFormDialog
        open={showReimbForm}
        onClose={() => { setShowReimbForm(false); setReimbInitial(null); setEditingDraftId(null); setReimbResubmit(null); setReimbForceValidate(false); }}
        onSuccess={() => { if (editingDraftId) { removeDraft(editingDraftId); setEditingDraftId(null); } }}
        initialData={reimbInitial}
        onSaveDraft={(data) => saveDraft("reimbursement", data)}
        reimbursementId={reimbResubmit?.id}
        decisionNote={reimbResubmit?.decisionNote}
        editable={reimbResubmit?.editable}
        autoValidate={reimbForceValidate}
      />

      <RequestDetailModal detail={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
