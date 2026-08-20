import { ERR_BORDER, FieldError } from "../components/request-ui";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NewRequestDialog, OfficePurchaseDetailDialog } from "@/features/requests/office-purchases/components/office-purchase";
import { NewTravelDialog, TravelDetailDialog, TRAVEL_CATS } from "@/features/requests/travel/components/travel";
import { ProcurementDetailDialog } from "@/features/requests/procurement/components/procurement";
import { useToast } from "@/hooks/use-toast";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { DateInput } from "@/components/shared/datetime-field";
import { Plus, ShoppingCart, Car, TicketIcon, Receipt, ChevronLeft, Package, Trash2, Search, LayoutGrid, Table2, ArrowDownUp, Save, FileEdit } from "lucide-react";
import { format } from "date-fns";
import { ReimbursementFormDialog, reimbDraftComplete } from "@/features/requests/reimbursements/components/reimbursement-form";
import { statusClass, statusLabel } from "@/lib/status";
import { formatDate, money, matchesFilter, amountOf, searchText, itemsHeadline, DONE_STATUS } from "../shared/request-format";
import { readDrafts, writeDrafts, newDraftId, type Draft } from "../shared/drafts";
import { TICKET_CATEGORIES } from "../tickets/lib/ticket-categories";
import { cap } from "../shared/approval-format";
import { RequestTable } from "../components/request-table";
import { RequestDetailModal } from "../components/request-detail-modal";
import { RequestCard } from "../components/request-card";
import { PurchaseRequestCard } from "../components/purchase-request-card";
import { DraftCard } from "../components/draft-card";
import { ReimbCardView } from "../reimbursements/components/reimb-card-view";

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
  const [phase, setPhase] = useState<"active" | "completed">("active"); // In Progress / Completed — mirrors the approval screens' phase toggle
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ type: string; item: any } | null>(null);
  const [showPRForm, setShowPRForm] = useState(false);
  const [showTRForm, setShowTRForm] = useState(false);
  const [showTicketForm, setShowTicketForm] = useState(false);
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
      if (initTab === "purchases") setShowPRForm(true);
      else if (initTab === "travels") { setEditingDraftId(null); setTripInitial(null); setShowNewTravel(true); }
      else if (initTab === "tickets") setShowTicketForm(true);
    }
  }, [autoNew, initTab]);

  const { data: purchases = [], isLoading: loadPR } = useQuery<any[]>({ queryKey: ["/api/my-requests/purchases"] });
  const { data: travels = [], isLoading: loadTR } = useQuery<any[]>({ queryKey: ["/api/my-requests/travels"] });
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

  // PR form with items
  const prForm = useForm({
    defaultValues: {
      category: "office_supplies",
      items: [{ description: "", qty: 1, estimatedCost: "", link: "" }],
      notes: "",
      neededByDate: "",
    },
  });
  const { fields, append, remove } = useFieldArray({ control: prForm.control, name: "items" });

  // Travel form
  const trForm = useForm({
    defaultValues: { purpose: "", fromCity: "", toCity: "", travelDate: "", returnDate: "", preferences: "", estimatedBudget: "" }
  });

  // Ticket form
  const ticketForm = useForm({
    defaultValues: { category: "hr_query", subject: "", description: "", priority: "medium" }
  });

  // Subscribe to each form's validation errors so required-field styling re-renders.
  const prErrors = prForm.formState.errors as any;
  const trErrors = trForm.formState.errors as any;
  const tkErrors = ticketForm.formState.errors as any;

  // Closing a form without saving (Cancel / X / click-away) discards all input — a fresh form opens next time.
  // (Submitting or "Save as Draft" already persist + reset separately.)
  const closePR = () => { setShowPRForm(false); setEditingDraftId(null); prForm.reset(); };
  const closeTR = () => { setShowTRForm(false); setEditingDraftId(null); trForm.reset(); };
  const closeTicket = () => { setShowTicketForm(false); setEditingDraftId(null); ticketForm.reset(); };

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
    setShowPRForm(false); setShowTRForm(false); setShowTicketForm(false); setShowReimbForm(false); setReimbInitial(null);
    prForm.reset(); trForm.reset(); ticketForm.reset();
    toast({ title: "Saved to Drafts" });
  };
  const editDraft = (d: Draft) => {
    setEditingDraftId(d.id);
    setReimbForceValidate(false);
    if (d.type === "trip") { setTripInitial(d.data); setShowNewTravel(true); }
    else if (d.type === "office" || d.type === "procurement") { setNewKind(d.type); setNewInitialData(d.data); setOpNewOpen(true); }
    else if (d.type === "purchase") { prForm.reset({ category: "office_supplies", items: [{ description: "", qty: 1, estimatedCost: "", link: "" }], notes: "", neededByDate: "", ...d.data }); setShowPRForm(true); }
    else if (d.type === "travel") { setTripInitial(null); setShowNewTravel(true); } // legacy travel drafts → new travel dialog
    else if (d.type === "ticket") { ticketForm.reset({ category: "hr_query", subject: "", description: "", priority: "medium", ...d.data }); setShowTicketForm(true); }
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
    if (d.type === "purchase") { const items = Array.isArray(x.items) ? x.items : []; return items.length > 0 && items.every((i: any) => (i.description || "").trim()); }
    if (d.type === "travel") return !!((x.purpose || "").trim() && (x.fromCity || "").trim() && (x.toCity || "").trim() && x.travelDate);
    if (d.type === "ticket") return !!((x.subject || "").trim());
    return reimbDraftComplete(x);
  };

  const submitDraft = async (d: Draft) => {
    // Missing mandatory fields → don't submit; open the pre-filled form with validation shown.
    if (!draftComplete(d)) {
      editDraft(d);
      if (d.type === "purchase") setTimeout(() => prForm.trigger(), 0);
      else if (d.type === "travel") setTimeout(() => trForm.trigger(), 0);
      else if (d.type === "ticket") setTimeout(() => ticketForm.trigger(), 0);
      else if (!["office", "procurement", "trip"].includes(d.type)) setReimbForceValidate(true); // office/procurement/trip: the dialog's own Submit stays disabled until valid
      toast({ title: "Please complete the required fields", variant: "destructive" });
      return;
    }
    setSubmittingDraftId(d.id);
    try {
      const x = d.data || {};
      if (d.type === "purchase") {
        const total = (x.items || []).reduce((s: number, i: any) => s + (Number(i.estimatedCost) || 0), 0);
        const pr = await apiRequest("POST", "/api/my-requests/purchases", { category: x.category, items: (x.items || []).filter((i: any) => i.description), estimatedCost: total || null, neededByDate: x.neededByDate || null, notes: x.notes || null });
        await apiRequest("POST", `/api/my-requests/purchases/${pr.id}/submit`, {});
      } else if (d.type === "travel") {
        const tr = await apiRequest("POST", "/api/my-requests/travels", { ...x, travelDate: x.travelDate || null, returnDate: x.returnDate || null, estimatedBudget: x.estimatedBudget ? Number(x.estimatedBudget) : null });
        await apiRequest("POST", `/api/my-requests/travels/${tr.id}/submit`, {});
      } else if (d.type === "ticket") {
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

  const createPRMutation = useMutation({
    mutationFn: async (data: any) => {
      const totalEstimated = data.items.reduce((sum: number, i: any) => sum + (Number(i.estimatedCost) || 0), 0);
      const pr = await apiRequest("POST", "/api/my-requests/purchases", {
        category: data.category,
        items: data.items.filter((i: any) => i.description),
        estimatedCost: totalEstimated || null,
        neededByDate: data.neededByDate || null,
        notes: data.notes || null,
      });
      await apiRequest("POST", `/api/my-requests/purchases/${pr.id}/submit`, {});
      return pr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-requests/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-requests/summary"] });
      setShowPRForm(false); prForm.reset();
      if (editingDraftId) { removeDraft(editingDraftId); setEditingDraftId(null); }
      toast({ title: "Purchase request submitted for approval" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createTRMutation = useMutation({
    mutationFn: async (data: any) => {
      const tr = await apiRequest("POST", "/api/my-requests/travels", {
        ...data,
        travelDate: data.travelDate || null,
        returnDate: data.returnDate || null,
        estimatedBudget: data.estimatedBudget ? Number(data.estimatedBudget) : null,
      });
      await apiRequest("POST", `/api/my-requests/travels/${tr.id}/submit`, {});
      return tr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-requests/travels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-requests/summary"] });
      setShowTRForm(false); trForm.reset();
      if (editingDraftId) { removeDraft(editingDraftId); setEditingDraftId(null); }
      toast({ title: "Travel request submitted for approval" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createTicketMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/my-requests/tickets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-requests/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-requests/summary"] });
      setShowTicketForm(false); ticketForm.reset();
      if (editingDraftId) { removeDraft(editingDraftId); setEditingDraftId(null); }
      toast({ title: "Ticket submitted successfully" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const submitPRMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/my-requests/purchases/${id}/submit`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-requests/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-requests/summary"] });
      toast({ title: "Submitted for CEO approval" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const submitTRMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/my-requests/travels/${id}/submit`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-requests/travels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-requests/summary"] });
      toast({ title: "Submitted for CEO approval" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (id: string, type: "purchase" | "travel" | "ticket") => {
    if (type === "purchase") submitPRMutation.mutate(id);
    else if (type === "travel") submitTRMutation.mutate(id);
  };

  const renderEmpty = (msg: string) => (
    <Card className="py-12"><CardContent className="text-center text-sm text-muted-foreground">{msg}</CardContent></Card>
  );

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

  // Shared header controls (view · phase · search · status filter · sort · primary button)
  const controls = (newBtn: React.ReactNode, showPhase = false) => (
    <div className="flex items-center gap-3">
      {/* View toggle — icon only */}
      <div className="segmented-toggle inline-flex p-0.5 h-10 flex-shrink-0">
        <button onClick={() => setView("card")} aria-label="Card view" data-testid="view-card" className={`px-3 h-full rounded-[10px] inline-flex items-center justify-center ${view === "card" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`}><LayoutGrid className="h-4 w-4" /></button>
        <button onClick={() => setView("table")} aria-label="Table view" data-testid="view-table" className={`px-3 h-full rounded-[10px] inline-flex items-center justify-center ${view === "table" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`}><Table2 className="h-4 w-4" /></button>
      </div>
      <div className="h-10 w-px flex-shrink-0 bg-foreground/30" />
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
  );

  const fPurchases = refine(purchases as any[], "purchase");
  const fTravels = refine(travels as any[], "travel");
  const fTickets = refine(tickets as any[], "ticket");
  const fReimb = refine(reimbursements as any[], "reimbursement");
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
  const tvPaged = usePaged(fTravels);
  const tkPaged = usePaged(fTickets);
  const rbPaged = usePaged(fReimb);
  const opPaged = usePaged(fOP);
  const prPaged = usePaged(fProc);

  return (
    <div className="p-6 space-y-5 max-w-[92rem] mx-auto">
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
        <TabsList>
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
              <Plus className="h-4 w-4 mr-1.5" /> New Travel Request
            </Button>
          , true)}
          {loadTrips ? <Skeleton className="h-24 w-full" /> :
            (myTrips as any[]).length === 0 ? renderEmpty("No travel requests yet.") :
            (() => {
              const tripCard = (t: any) => {
                const c = TRAVEL_CATS[t.category] || TRAVEL_CATS.flight;
                const route = t.category === "flight" ? `${t.details?.fromCity || "?"} → ${t.details?.toCity || "?"}` : t.category === "stay" ? (t.details?.city || "") : `${t.details?.from || "?"} → ${t.details?.to || "?"}`;
                return (
                  <div key={t.id} className="card-surface card-hover p-4 flex items-center gap-4 cursor-pointer" onClick={() => setTravelDetailId(t.id)} data-testid={`trip-${t.id}`}>
                    <span className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${c.tint}1a`, color: c.tint }}><c.icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap"><span className="text-[13px] font-semibold text-foreground truncate">{t.reference}</span><Badge className={`text-[10px] ${statusClass(t.status)}`}>{statusLabel(t.status)}</Badge></div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{c.label} | {route}{t.startDate ? ` | ${format(new Date(t.startDate), "MMM d, yyyy")}` : ""}</p>
                    </div>
                    {Number(t.amount) > 0 && <span className="text-sm font-bold text-[#206295] tabular-nums flex-shrink-0">₹{Number(t.amount).toLocaleString("en-IN")}</span>}
                  </div>
                );
              };
              const done = (myTrips as any[]).filter((t) => DONE_STATUS.trip.includes(t.status));
              const active = (myTrips as any[]).filter((t) => !DONE_STATUS.trip.includes(t.status));
              const shown = phase === "active" ? active : done;
              if (shown.length === 0) return renderEmpty(phase === "active" ? "No trips in progress." : "No completed trips.");
              return <div className="space-y-3">{shown.map(tripCard)}</div>;
            })()
          }
        </TabsContent>

        <TabsContent value="tickets" className="mt-4 space-y-5">
          {controls(
            <Button size="sm" onClick={() => { setEditingDraftId(null); ticketForm.reset(); setShowTicketForm(true); }} data-testid="button-new-ticket">
              <Plus className="h-4 w-4 mr-1.5" /> Raise Ticket
            </Button>
          )}
          {loadTickets ? <Skeleton className="h-24 w-full" /> :
            fTickets.length === 0 ? renderEmpty((tickets as any[]).length === 0 ? "No tickets yet." : "No tickets match this filter.") :
            view === "table" ? <RequestTable type="ticket" items={fTickets} onOpen={(it) => setDetail({ type: "ticket", item: it })} /> :
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
              <Plus className="h-4 w-4 mr-1.5" /> New Reimbursement
            </Button>
          )}
          {loadReimb ? <Skeleton className="h-24 w-full" /> :
            fReimb.length === 0 ? renderEmpty((reimbursements as any[]).length === 0 ? "No reimbursements yet." : "No reimbursements match this filter.") :
            view === "table" ? <RequestTable type="reimbursement" items={fReimb} onOpen={openReimb} /> :
            <div className="space-y-5">
              <ReimbCardView items={rbPaged.pageItems} onOpen={openReimb} />
              <PaginationBar page={rbPaged.page} totalPages={rbPaged.totalPages} count={rbPaged.count} size={rbPaged.size} onPage={rbPaged.setPage} />
            </div>
          }
        </TabsContent>

        <TabsContent value="office-purchases" className="mt-4 space-y-5">
          {controls(
            <Button size="sm" onClick={() => { setEditingDraftId(null); setNewInitialData(null); setNewKind("office"); setOpNewOpen(true); }} data-testid="button-new-office-purchase">
              <Plus className="h-4 w-4 mr-1.5" /> New Office Purchase
            </Button>
          , true)}
          {loadOP ? <Skeleton className="h-24 w-full" /> :
            fOP.length === 0 ? renderEmpty((officePurchases as any[]).length === 0 ? "No office purchases yet." : "No office purchases match this filter.") :
            (() => {
              const done = fOP.filter((o: any) => DONE_STATUS.office.includes(o.status));
              const active = fOP.filter((o: any) => !DONE_STATUS.office.includes(o.status));
              const shown = phase === "active" ? active : done;
              if (shown.length === 0) return renderEmpty(phase === "active" ? "Nothing in progress." : "Nothing completed yet.");
              return view === "table" ? (
                <Card className="border-0"><CardContent className="p-0">
                  <DataTable
                    columns={[
                      { key: "reference", header: "Reference", cellClassName: "font-medium text-foreground", render: (o: any) => o.reference },
                      { key: "item", header: "Item", cellClassName: "text-foreground max-w-[20rem] truncate", render: (o: any) => itemsHeadline(o.items) },
                      { key: "priority", header: "Priority", cellClassName: "capitalize text-muted-foreground", render: (o: any) => o.priority || "medium" },
                      { key: "amount", header: "Amount", align: "right", cellClassName: "font-semibold text-foreground", render: (o: any) => Number(o.totalAmount) > 0 ? money(o.totalAmount) : "—" },
                      { key: "status", header: "Status", render: (o: any) => <Badge className={`text-xs ${statusClass(o.status)}`}>{statusLabel(o.status)}</Badge> },
                      { key: "created", header: "Created", cellClassName: "text-muted-foreground", render: (o: any) => o.createdAt ? formatDate(o.createdAt) : "—" },
                    ]}
                    rows={shown}
                    getRowKey={(o: any) => o.id}
                    onRowClick={(o: any) => setOpDetailId(o.id)}
                    testIdPrefix="op-row"
                  />
                </CardContent></Card>
              ) : (
                <div className="space-y-3">{shown.map((o: any) => <PurchaseRequestCard key={o.id} item={o} kind="office" onOpen={setOpDetailId} />)}</div>
              );
            })()
          }
        </TabsContent>

        <TabsContent value="procurement" className="mt-4 space-y-5">
          {controls(
            <Button size="sm" onClick={() => { setEditingDraftId(null); setNewInitialData(null); setNewKind("procurement"); setOpNewOpen(true); }} data-testid="button-new-procurement">
              <Plus className="h-4 w-4 mr-1.5" /> New Procurement
            </Button>
          , true)}
          {loadProc ? <Skeleton className="h-24 w-full" /> :
            fProc.length === 0 ? renderEmpty((procurement as any[]).length === 0 ? "No procurement requests yet." : "No procurement requests match this filter.") :
            (() => {
              const done = fProc.filter((o: any) => DONE_STATUS.procurement.includes(o.status));
              const active = fProc.filter((o: any) => !DONE_STATUS.procurement.includes(o.status));
              const shown = phase === "active" ? active : done;
              if (shown.length === 0) return renderEmpty(phase === "active" ? "Nothing in progress." : "Nothing completed yet.");
              return view === "table" ? (
                <Card className="border-0"><CardContent className="p-0">
                  <DataTable
                    columns={[
                      { key: "reference", header: "Reference", cellClassName: "font-medium text-foreground", render: (o: any) => o.reference },
                      { key: "item", header: "Item", cellClassName: "text-foreground max-w-[20rem] truncate", render: (o: any) => itemsHeadline(o.items) },
                      { key: "amount", header: "Amount", align: "right", cellClassName: "font-semibold text-foreground", render: (o: any) => Number(o.totalAmount) > 0 ? money(o.totalAmount) : "—" },
                      { key: "status", header: "Status", render: (o: any) => <Badge className={`text-xs ${statusClass(o.status)}`}>{statusLabel(o.status)}</Badge> },
                      { key: "created", header: "Created", cellClassName: "text-muted-foreground", render: (o: any) => o.createdAt ? formatDate(o.createdAt) : "—" },
                    ]}
                    rows={shown}
                    getRowKey={(o: any) => o.id}
                    onRowClick={(o: any) => setProcDetailId(o.id)}
                    testIdPrefix="proc-row"
                  />
                </CardContent></Card>
              ) : (
                <div className="space-y-3">{shown.map((o: any) => <PurchaseRequestCard key={o.id} item={o} kind="procurement" onOpen={setProcDetailId} />)}</div>
              );
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

      {/* Purchase Request Form */}
      <Dialog open={showPRForm} onOpenChange={(v) => { if (!v) closePR(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Purchase Request</DialogTitle></DialogHeader>
          <form onSubmit={prForm.handleSubmit(data => createPRMutation.mutate(data))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={prForm.watch("category")} onValueChange={v => prForm.setValue("category", v)}>
                <SelectTrigger data-testid="select-pr-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="office_supplies">Office Supplies</SelectItem>
                  <SelectItem value="equipment">Equipment / Hardware</SelectItem>
                  <SelectItem value="software">Software / Subscription</SelectItem>
                  <SelectItem value="furniture">Furniture</SelectItem>
                  <SelectItem value="marketing">Marketing Materials</SelectItem>
                  <SelectItem value="training">Training / Books</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Items *</Label>
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-1.5 items-start bg-muted/40 rounded-lg p-2.5">
                  <div className="col-span-5 space-y-1">
                    <p className="text-xs text-muted-foreground">Description</p>
                    <Input {...prForm.register(`items.${index}.description`, { required: true })} placeholder="Item name..." className={`h-8 text-xs ${prErrors.items?.[index]?.description ? ERR_BORDER : ""}`} data-testid={`input-item-desc-${index}`} />
                    <FieldError show={prErrors.items?.[index]?.description} msg="Required" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <p className="text-xs text-muted-foreground">Qty</p>
                    <Input type="number" min="1" {...prForm.register(`items.${index}.qty`)} className="h-8 text-xs" data-testid={`input-item-qty-${index}`} />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <p className="text-xs text-muted-foreground">Est. Cost (₹)</p>
                    <Input type="number" min="0" {...prForm.register(`items.${index}.estimatedCost`)} placeholder="0" className="h-8 text-xs" data-testid={`input-item-cost-${index}`} />
                  </div>
                  <div className="col-span-2 flex items-end justify-center pb-0.5">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => fields.length > 1 && remove(index)} data-testid={`button-remove-item-${index}`}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <div className="col-span-12">
                    <Input {...prForm.register(`items.${index}.link`)} placeholder="Product link (optional)" className="h-8 text-xs" data-testid={`input-item-link-${index}`} />
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => append({ description: "", qty: 1, estimatedCost: "", link: "" })} data-testid="button-add-item">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Item
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label>Needed By Date</Label>
              <Controller control={prForm.control} name="neededByDate" render={({ field }) => <DateInput value={field.value || ""} onChange={field.onChange} testId="input-pr-needed-by" />} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes / Justification</Label>
              <Textarea rows={2} {...prForm.register("notes")} placeholder="Why is this needed?" data-testid="textarea-pr-notes" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closePR}>Cancel</Button>
              <Button type="button" variant="secondary" className="btn-glass text-[#206295]" onClick={() => saveDraft("purchase", prForm.getValues())} data-testid="button-draft-pr">
                <Save className="h-4 w-4 mr-1.5" /> Save as Draft
              </Button>
              <Button type="submit" disabled={createPRMutation.isPending} data-testid="button-save-pr">
                {createPRMutation.isPending ? "Submitting..." : "Submit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Legacy travel form removed — travel now uses NewTravelDialog (chooser: Flights / Stays / Transport). */}

      {/* Ticket Form */}
      <Dialog open={showTicketForm} onOpenChange={(v) => { if (!v) closeTicket(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Raise Support Ticket</DialogTitle></DialogHeader>
          <form onSubmit={ticketForm.handleSubmit(data => createTicketMutation.mutate(data))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={ticketForm.watch("category")} onValueChange={v => ticketForm.setValue("category", v)}>
                  <SelectTrigger data-testid="select-ticket-cat"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TICKET_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{cap(c)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={ticketForm.watch("priority")} onValueChange={v => ticketForm.setValue("priority", v)}>
                  <SelectTrigger data-testid="select-ticket-pri"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Subject *</Label>
              <Input {...ticketForm.register("subject", { required: true })} placeholder="Brief subject..." className={tkErrors.subject ? ERR_BORDER : ""} data-testid="input-ticket-subject" />
              <FieldError show={tkErrors.subject} msg="Subject is required" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={3} {...ticketForm.register("description")} placeholder="Describe your issue in detail..." data-testid="textarea-ticket-desc" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeTicket}>Cancel</Button>
              <Button type="button" variant="secondary" className="btn-glass text-[#206295]" onClick={() => saveDraft("ticket", ticketForm.getValues())} data-testid="button-draft-ticket">
                <Save className="h-4 w-4 mr-1.5" /> Save as Draft
              </Button>
              <Button type="submit" disabled={createTicketMutation.isPending} data-testid="button-submit-ticket">
                {createTicketMutation.isPending ? "Submitting..." : "Submit Ticket"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
