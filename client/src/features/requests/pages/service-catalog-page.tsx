import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth, isManager } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/shared/data-table";
import { NewRequestDialog } from "@/features/requests/office-purchases/components/office-purchase";
import { TravelApprovals, NewTravelDialog } from "@/features/requests/travel/components/travel";
import { canHrTriage, canCeoApprove, canProcureApprove, canTravelHr, canTravelCeo } from "../shared/permissions";
import { ShoppingCart, Car, Plane, TicketIcon, Receipt, ClipboardList, ShieldCheck, ArrowRight, ChevronLeft, Check, Users, CalendarClock, Eye, Package } from "lucide-react";
import { ReimbursementFormDialog } from "@/features/requests/reimbursements/components/reimbursement-form";
import { statusClass, statusLabel } from "@/lib/status";
import { cap, money, fmtDate, SERVICES } from "../shared/approval-format";
import { StatCard, NavCard } from "../components/approval-ui";
import { ActivityDetailModal } from "../components/activity-detail-modal";
import { ReimbApprovals } from "../components/reimb-approvals";
import { CompletedApprovals } from "../components/completed-approvals";
import { CeoReviewModal } from "../components/ceo-review-modal";
import { OfficePurchaseApprovals } from "../office-purchases/components/office-purchase-approvals";
import { TicketForm } from "../tickets/components/ticket-form";

export default function CompanyWorkspacePage() {
  const [location, navigate] = useLocation();
  const { data: auth } = useAuth();
  const user = auth?.user;

  const canTeam = isManager(user!);
  const role = user?.role;
  const isApprover = !!role && ["super_admin", "ceo_approver"].includes(role); // CEO-domain: service requests, logistics, vehicles
  const canFinanceReimb = role === "finance" || role === "super_admin";         // Finance-stage review (finance; super_admin as emergency override)
  const canCeoReimb = role === "ceo_approver" || role === "super_admin";         // final approval (+ bulk) — CEO; super_admin as emergency override
  const canReimbApprove = canFinanceReimb || canCeoReimb;
  // Office Purchase approvers: HR triages (price / order / deliver), CEO approves; super_admin does both.
  const canOpTriage = canHrTriage(role);
  const canOpCeo = canCeoApprove(role);
  const canOfficePurchase = canOpTriage || canOpCeo;
  const canProc = canProcureApprove(role);   // Procurement approvals: CEO / super_admin
  // "CEO Inbox" (/workspace/approvals) is a super-admin-only super-access tab: super_admin acts AS the CEO
  // there (same view as the CEO's My Approvals) for when the CEO is unavailable. Super_admin's OWN
  // /my-approvals does NOT show the CEO cards — only the CEO (ceo_approver) sees them on /my-approvals.
  const actingCeo = role === "super_admin" && location === "/workspace/approvals";
  const isCeo = role === "ceo_approver" || actingCeo;
  const canApprove = isCeo || canOfficePurchase || canReimbApprove; // CEO cards; HR office triage; finance/CEO reimbursements

  // View is URL-driven so navigating updates the browser URL (shareable / back-button friendly).
  const view: "main" | "approvals" = (location === "/my-approvals" || location === "/workspace/approvals") ? "approvals" : "main";
  const setView = (v: "main" | "approvals") => navigate(v === "approvals" ? "/my-approvals" : "/company-workspace");
  const [openForm, setOpenForm] = useState<null | "purchase" | "travel" | "ticket" | "reimbursement">(null);
  const [newReqOpen, setNewReqOpen] = useState(false);
  const [apprView, setApprView] = useState<"pending" | "completed">("pending");
  const [apprTab, setApprTab] = useState<string>("");
  const [travelModal, setTravelModal] = useState(false);
  const [reimbModal, setReimbModal] = useState(false);
  const [batchCat, setBatchCat] = useState<any>(null);

  // ---- data ----
  // Dashboard-only queries are gated to the main view so they don't compete for connections on the CEO Inbox
  // (which only needs reimb + opAll/procAll/travelAll + employees). This stops the travel card loading last.
  const onMain = view === "main";
  const { data: summary, isLoading: sumLoading } = useQuery<any>({ queryKey: ["/api/my-requests/summary"], enabled: onMain });
  const { data: purchases = [] } = useQuery<any[]>({ queryKey: ["/api/my-requests/purchases"], enabled: onMain });
  // New travel lives in tripRequests (/api/travel), not the legacy my-requests/travels table — pull the user's own trips (incl. co-traveller).
  const { data: travels = [] } = useQuery<any[]>({ queryKey: ["/api/travel", "mine"], queryFn: () => apiRequest("GET", "/api/travel?mine=true"), enabled: onMain });
  const { data: tickets = [] } = useQuery<any[]>({ queryKey: ["/api/my-requests/tickets"], enabled: onMain });
  // Slim list (no base64 invoice images) — the inbox only needs metadata; the detail modal pulls full images by id.
  const { data: reimb = [] } = useQuery<any[]>({ queryKey: ["/api/reimbursements?summary=true"] });
  const { data: officePurchases = [] } = useQuery<any[]>({ queryKey: ["/api/office-purchases?mine=true"], enabled: onMain });
  const { data: myProcurement = [] } = useQuery<any[]>({ queryKey: ["/api/procurement?mine=true"], enabled: onMain });
  const { data: teamData } = useQuery<any>({ queryKey: ["/api/team-requests"], enabled: canTeam && onMain, retry: false });

  // approval domains (super-admin / CEO) — svc requests + logistics feed Recent Activities (main view only).
  const { data: svcRequests = [] } = useQuery<any[]>({ queryKey: ["/api/requests"], enabled: isApprover && onMain });
  const { data: movements = [] } = useQuery<any[]>({ queryKey: ["/api/logistics/movements"], enabled: isApprover && onMain });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"], enabled: isApprover });
  // Office purchases needing an approver's attention (HR triage / CEO approval).
  const { data: opAll = [] } = useQuery<any[]>({ queryKey: ["/api/office-purchases"], enabled: canOfficePurchase });
  const { data: procAll = [] } = useQuery<any[]>({ queryKey: ["/api/procurement"], enabled: canProc });
  const canTravelApprove = canTravelHr(role) || canTravelCeo(role);
  const { data: travelAll = [] } = useQuery<any[]>({ queryKey: ["/api/travel"], enabled: canTravelApprove });

  const nameByUser = useMemo(() => {
    const m: Record<string, string> = {};
    employees.forEach((e: any) => { if (e.userId) m[e.userId] = `${e.firstName} ${e.lastName}`; });
    return m;
  }, [employees]);
  const reqName = (uid: string) => (uid === user?.id ? "You" : nameByUser[uid] || "—");

  const now = Date.now();
  // Reimbursement queues are split by STAGE so one claim never sits in two inboxes at once:
  //  - finance stage ("submitted")     → first-layer review surface (My Approvals reimbursement tab)
  //  - CEO stage ("finance_approved")  → CEO Inbox card (final sign-off)
  // super_admin sees the finance stage on My Approvals and the CEO stage on the CEO Inbox — separate places, never both.
  const ownGate = (r: any) => !(r.requesterId === user?.id && role !== "super_admin"); // can't approve your own claim (super_admin override, matches backend)
  const financeReimbQueue = useMemo(() => (reimb as any[]).filter((r) => r.status === "submitted" && canFinanceReimb && ownGate(r)), [reimb, canFinanceReimb, user?.id, role]);
  const ceoReimbQueue = useMemo(() => (reimb as any[]).filter((r) => r.status === "finance_approved" && canCeoReimb && ownGate(r)), [reimb, canCeoReimb, user?.id, role]);
  // Office purchases, split by layer so counts match what each screen shows.
  // First-layer HR triage (Pending phase = what super_admin/HR see on their normal My Approvals):
  const officeTriageCount = useMemo(() => (opAll as any[]).filter((o) => ["pending_hr", "priced", "approved", "under_review"].includes(o.status)).length, [opAll]);
  // CEO-layer office (the bulk card on the CEO Inbox): awaiting the CEO's decision.
  const officeCeoCount = useMemo(() => (opAll as any[]).filter((o) => ["pending_approval", "under_review"].includes(o.status)).length, [opAll]);
  const pendingProc = useMemo(() => (procAll as any[]).filter((o) => ["pending_approval", "under_review"].includes(o.status)).length, [procAll]);
  const travelPending = useMemo(() => (travelAll as any[]).filter((t) => ["pending_hr", "approved", "under_review"].includes(t.status)).length, [travelAll]);
  const travelCeoPending = useMemo(() => (travelAll as any[]).filter((t) => ["pending_approval", "under_review"].includes(t.status)).length, [travelAll]);
  // Nav-card badge: CEO-layer only when isCeo (reimb+proc+office-CEO+travel-CEO); first-layer office/travel when a triage role.
  const apprTotal = isCeo
    ? ceoReimbQueue.length + pendingProc + officeCeoCount + travelCeoPending
    : (canReimbApprove ? financeReimbQueue.length : 0) + (canOpTriage ? officeTriageCount : 0) + (canTravelApprove ? travelPending : 0);
  // Approver → total awaiting THEIR approval (both stages they can act on). Employee → their own pending claims.
  const pendingReimbAmount = useMemo(() => {
    const rows = canReimbApprove
      ? [...financeReimbQueue, ...ceoReimbQueue]
      : reimb.filter((r: any) => r.requesterId === user?.id && ["submitted", "finance_approved", "changes_requested"].includes(r.status));
    return rows.reduce((s: number, r: any) => s + Number(r.totalAmount || 0), 0);
  }, [canReimbApprove, financeReimbQueue, ceoReimbQueue, reimb, user?.id]);

  // The user's own in-flight purchases — office purchases + procurement (both count toward "Pending Purchases").
  const myOpenOp = useMemo(() =>
    (officePurchases as any[]).filter((o) => ["pending_hr", "priced", "pending_approval", "under_review", "approved", "ordered"].includes(o.status)).length +
    (myProcurement as any[]).filter((o) => ["pending_approval", "under_review"].includes(o.status)).length
  , [officePurchases, myProcurement]);
  const myOpen =
    myOpenOp +
    purchases.filter((p: any) => ["draft", "submitted", "pending_ceo", "changes_requested"].includes(p.status)).length +
    travels.filter((t: any) => ["pending_hr", "pending_approval", "under_review", "approved"].includes(t.status)).length +
    tickets.filter((t: any) => ["open", "in_progress", "need_info"].includes(t.status)).length +
    // Only the current user's OWN reimbursements (approvers receive the full list here).
    reimb.filter((r: any) => r.requesterId === user?.id && ["submitted", "changes_requested"].includes(r.status)).length;

  const teamOpen = useMemo(() => {
    if (!teamData) return 0;
    const pend = (arr: any[], st: string[]) => (arr || []).filter((x) => st.includes(x.status)).length;
    return pend(teamData.purchases, ["draft", "submitted", "pending_ceo", "changes_requested"]) +
      pend(teamData.travels, ["draft", "submitted", "pending_ceo", "changes_requested"]) +
      pend(teamData.tickets, ["open", "in_progress", "need_info"]);
  }, [teamData]);

  // ---- recent activities (last 7 days) ----
  const recent = useMemo(() => {
    const weekAgo = now - 7 * 86400000;
    const rows: any[] = [];
    purchases.forEach((p: any) => rows.push({ id: p.id, kind: "purchase", raw: p, requester: "You", type: "Purchase", details: `${cap(p.category) || "Purchase"} Request`, status: p.status, date: p.createdAt, approvedBy: "—" }));
    travels.forEach((t: any) => rows.push({ id: t.id, kind: "travel", raw: t, requester: "You", type: "Travel", details: t.category === "flight" ? `${t.details?.fromCity || "?"} → ${t.details?.toCity || "?"}` : t.category === "stay" ? (t.details?.city || "Stay") : `${t.details?.from || "?"} → ${t.details?.to || "?"}`, status: t.status, date: t.startDate || t.createdAt, approvedBy: "—" }));
    tickets.forEach((t: any) => rows.push({ id: t.id, kind: "ticket", raw: t, requester: "You", type: "Ticket", details: t.subject || "Support Ticket", status: t.status, date: t.createdAt, approvedBy: "—" }));
    officePurchases.forEach((p: any) => {
      const item0 = Array.isArray(p.items) && p.items[0]?.description ? p.items[0].description : "";
      const extra = Array.isArray(p.items) && p.items.length > 1 ? ` +${p.items.length - 1} more` : "";
      rows.push({ id: p.id, kind: "office_purchase", raw: p, requester: "You", type: "Office Purchase", details: item0 ? `${item0}${extra}` : (p.reference || "Office Purchase"), status: p.status, date: p.createdAt, approvedBy: "—" });
    });
    myProcurement.forEach((p: any) => {
      const item0 = Array.isArray(p.items) && p.items[0]?.description ? p.items[0].description : "";
      const extra = Array.isArray(p.items) && p.items.length > 1 ? ` +${p.items.length - 1} more` : "";
      rows.push({ id: p.id, kind: "procurement", raw: p, requester: "You", type: "Procurement", details: item0 ? `${item0}${extra}` : (p.reference || "Procurement"), status: p.status, date: p.createdAt, approvedBy: "—" });
    });
    reimb.forEach((r: any) => {
      const isOwn = r.requesterId === user?.id;
      const requester = isOwn ? "You" : (nameByUser[r.requesterId] || r.employeeName || "—");
      const approvedBy = r.status === "approved"
        ? (nameByUser[r.approvedById] || "CEO")
        : r.status === "finance_approved"
        ? (nameByUser[r.financeApprovedById] || "Finance")
        : "—";
      rows.push({ id: r.id, kind: "reimbursement", raw: r, requester, type: "Reimbursement", details: r.reference || cap(r.category) || "Reimbursement", status: r.status, date: r.createdAt, approvedBy });
    });
    if (isApprover) {
      (svcRequests as any[]).forEach((r) => rows.push({ id: r.id, kind: "request", raw: r, requester: reqName(r.requesterId), type: "Service Request", details: r.title || cap(r.type) || "Request", status: r.status, date: r.createdAt, approvedBy: r.assignedToId ? reqName(r.assignedToId) : "—" }));
      (movements as any[]).forEach((m) => rows.push({ id: m.id, kind: "logistics", raw: m, requester: reqName(m.requesterId), type: "Logistics", details: m.reference || m.notes || "Stock / asset movement", status: m.status, date: m.createdAt, approvedBy: "—" }));
    }
    return rows.filter((r) => r.date && +new Date(r.date) >= weekAgo).sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 20);
  }, [purchases, travels, tickets, reimb, officePurchases, myProcurement, svcRequests, movements, isApprover, nameByUser, now, user?.id]);

  const [detail, setDetail] = useState<any>(null);

  // ===================== Detailed: My Approvals =====================
  if (view === "approvals") {
    // In-place bulk-approval inbox — one card per pure approve/reject category, actioned in a modal (no screen jump).
    // Reimbursement card = CEO-stage only (finance_approved); finance-stage (submitted) is first-layer, NOT the CEO's —
    // so the CEO Inbox (super_admin acting as CEO) shows exactly what the CEO sees, never leaks finance-stage claims.
    const opPend = (opAll as any[]).filter((o) => o.status === "pending_approval");
    const procPend = (procAll as any[]).filter((o) => o.status === "pending_approval");
    const opUR = (opAll as any[]).filter((o) => o.status === "under_review");
    const procUR = (procAll as any[]).filter((o) => o.status === "under_review");
    const travelPend = (travelAll as any[]).filter((t) => ["pending_approval", "under_review"].includes(t.status));
    const amtSum = (arr: any[], k = "totalAmount") => arr.reduce((s, x) => s + (Number(x[k]) || 0), 0);
    // Main inbox = ONE card per category (total ₹ + count, irrespective of HR grouping); the drill modal shows groups/items.
    const catCards = ([
      ceoReimbQueue.length ? { key: "reimbursements", label: "Reimbursements", icon: Receipt, count: ceoReimbQueue.length, total: amtSum(ceoReimbQueue), cfg: { kind: "reimb" } } : null,
      opPend.length ? { key: "office_purchases", label: "Office Purchases", icon: ShoppingCart, count: opPend.length, total: amtSum(opPend),
        cfg: { title: "Office Purchases", kind: "office", grouped: true, basePath: "/api/office-purchases", invalidateKey: "/api/office-purchases" } } : null,
      procPend.length ? { key: "procurement", label: "Procurement", icon: Package, count: procPend.length, total: amtSum(procPend),
        cfg: { title: "Procurement", kind: "procurement", basePath: "/api/procurement", invalidateKey: "/api/procurement" } } : null,
      travelPend.length ? { key: "travel", label: "Travel", icon: Plane, count: travelPend.length, total: amtSum(travelPend, "amount"), cfg: { kind: "travel" } } : null,
    ].filter(Boolean) as { key: string; label: string; icon: any; count: number; total: number; cfg: any }[]);
    // "Under review" (queries you raised, on hold) — a separate section below the main cards.
    const underReviewCards = ([
      opUR.length ? { key: "op_ur", label: "Office Purchases", icon: ShoppingCart, count: opUR.length, total: amtSum(opUR),
        cfg: { title: "Office Purchases", lane: "Under Review", statuses: ["under_review"], kind: "office", grouped: true, basePath: "/api/office-purchases", invalidateKey: "/api/office-purchases" } } : null,
      procUR.length ? { key: "proc_ur", label: "Procurement", icon: Package, count: procUR.length, total: amtSum(procUR),
        cfg: { title: "Procurement", lane: "Under Review", statuses: ["under_review"], kind: "procurement", basePath: "/api/procurement", invalidateKey: "/api/procurement" } } : null,
    ].filter(Boolean) as { key: string; label: string; icon: any; count: number; total: number; cfg: any }[]);
    // Non-CEO approvers get a category tab strip (auto-sorted by pending count = priority); the CEO keeps the bulk-cards inbox.
    const apprTabs = ([
      canReimbApprove ? { key: "reimbursements", label: "Reimbursements", icon: Receipt, count: financeReimbQueue.length } : null,
      canOpTriage ? { key: "office_purchases", label: "Office Purchases", icon: ShoppingCart, count: officeTriageCount } : null,
      canTravelApprove ? { key: "travel", label: "Travel", icon: Plane, count: travelPending } : null,
    ].filter(Boolean) as { key: string; label: string; icon: any; count: number }[]).sort((a, b) => b.count - a.count);
    const effectiveTab = apprTabs.some((t) => t.key === apprTab) ? apprTab : apprTabs[0]?.key;
    const headerTotal = isCeo
      ? catCards.reduce((s, c) => s + c.count, 0) + underReviewCards.reduce((s, c) => s + c.count, 0)
      : apprTabs.reduce((s, t) => s + t.count, 0);
    // Completed / decided history across the categories this user approves.
    const done = (arr: any[], statuses: string[]) => (arr as any[]).filter((x) => statuses.includes(x.status));
    const completedRows: { key: string; icon: any; cat: string; title: string; sub: string; amount: number; date: any; status: string }[] = [];
    if (isCeo) done(reimb, ["approved", "rejected"]).forEach((r) => completedRows.push({ key: `rmb-${r.id}`, icon: Receipt, cat: "Reimbursements", title: r.reference || "Reimbursement", sub: r.employeeName || reqName(r.requesterId), amount: Number(r.totalAmount) || 0, date: r.updatedAt || r.createdAt, status: r.status }));
    if (canOfficePurchase) done(opAll, ["approved", "rejected", "ordered", "delivered", "completed"]).forEach((o) => completedRows.push({ key: `op-${o.id}`, icon: ShoppingCart, cat: "Office Purchases", title: o.reference, sub: o.employeeName || "Employee", amount: Number(o.totalAmount) || 0, date: o.updatedAt || o.createdAt, status: o.status }));
    if (isCeo) done(procAll, ["approved", "rejected"]).forEach((o) => completedRows.push({ key: `pr-${o.id}`, icon: Package, cat: "Procurement", title: o.reference, sub: o.employeeName || "Employee", amount: Number(o.totalAmount) || 0, date: o.decidedAt || o.updatedAt || o.createdAt, status: o.status }));
    if (canTravelApprove) done(travelAll, ["booked", "rejected", "cancelled"]).forEach((t) => completedRows.push({ key: `tv-${t.id}`, icon: Plane, cat: "Travel", title: t.reference, sub: t.employeeName || "Employee", amount: Number(t.amount) || 0, date: t.bookedAt || t.decidedAt || t.updatedAt || t.createdAt, status: t.status }));
    completedRows.sort((a, b) => +new Date(b.date || 0) - +new Date(a.date || 0));
    return (
      <div className="p-6 space-y-6 max-w-[92rem] mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="icon" className="h-10 w-10 flex-shrink-0" onClick={() => setView("main")} aria-label="Back" data-testid="button-back-workspace"><ChevronLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{actingCeo ? "CEO Inbox" : "My Approvals"}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{actingCeo ? "Super-access — acting on the CEO's behalf | " : ""}{headerTotal} item{headerTotal !== 1 ? "s" : ""} awaiting action</p>
          </div>
        </div>

        {isCeo ? (
          <>
            <div className="flex gap-2">
              {(["pending", "completed"] as const).map((v) => (
                <Button key={v} size="sm" variant={apprView === v ? "default" : "secondary"} onClick={() => setApprView(v)} data-testid={`appr-view-${v}`}>
                  {v === "pending" ? "Pending" : "Completed"}
                  {v === "pending" && headerTotal > 0 && <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${apprView === "pending" ? "bg-white/25 text-white" : "bg-[#FF6F62] text-white"}`}>{headerTotal}</span>}
                </Button>
              ))}
            </div>
            {apprView === "pending" ? (
              (catCards.length === 0 && underReviewCards.length === 0)
                ? <div className="card-surface rounded-2xl py-16 text-center"><Check className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">Nothing awaiting your approval.</p></div>
                : <div className="space-y-8">
                    {catCards.length > 0 && (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {catCards.map((c) => (
                          <div key={c.key} className="card-surface card-hover p-5 flex flex-col" data-testid={`inbox-cat-${c.key}`}>
                            <div className="flex items-center gap-2.5">
                              <span className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#206295]/10 text-[#206295]"><c.icon className="h-4 w-4" /></span>
                              <div className="min-w-0"><p className="text-sm font-semibold text-foreground truncate">{c.label}</p><p className="text-xs text-muted-foreground">{c.count} pending</p></div>
                            </div>
                            <p className="mt-4 text-[26px] font-bold tabular-nums leading-none text-[#206295]">{c.total > 0 ? money(c.total) : `${c.count} to review`}</p>
                            <Button variant="secondary" className="mt-4 w-full" onClick={() => c.cfg.kind === "travel" ? setTravelModal(true) : c.cfg.kind === "reimb" ? setReimbModal(true) : setBatchCat(c.cfg)} data-testid={`inbox-view-${c.key}`}><Eye className="h-4 w-4 mr-1.5" /> Review</Button>
                          </div>
                        ))}
                      </div>
                    )}
                    {underReviewCards.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-[#FF6F62] flex-shrink-0" />
                          <h2 className="text-sm font-semibold text-foreground">Under review</h2>
                          <span className="text-xs text-muted-foreground">queries you raised — awaiting a reply</span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          {underReviewCards.map((c) => (
                            <div key={c.key} className="card-surface card-hover p-5 flex flex-col ring-1 ring-[#FF6F62]/25" data-testid={`inbox-ur-${c.key}`}>
                              <div className="flex items-center gap-2.5">
                                <span className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#FF6F62]/15 text-[#C4402F]"><c.icon className="h-4 w-4" /></span>
                                <div className="min-w-0"><p className="text-sm font-semibold text-foreground truncate">{c.label}</p><p className="text-xs text-[#C4402F]">{c.count} under review</p></div>
                              </div>
                              <p className="mt-4 text-[26px] font-bold tabular-nums leading-none text-[#C4402F]">{c.total > 0 ? money(c.total) : `${c.count}`}</p>
                              <Button variant="secondary" className="mt-4 w-full" onClick={() => setBatchCat(c.cfg)} data-testid={`inbox-ur-view-${c.key}`}><Eye className="h-4 w-4 mr-1.5" /> Review</Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
            ) : (
              <CompletedApprovals rows={completedRows} />
            )}
          </>
        ) : (
          <>
            {/* Non-CEO approvers: category tabs at the top, ordered by pending count, active tab highlighted. */}
            <div className="flex gap-2 flex-wrap">
              {apprTabs.map((t) => (
                <Button key={t.key} size="sm" variant={effectiveTab === t.key ? "default" : "secondary"} onClick={() => setApprTab(t.key)} data-testid={`appr-tab-${t.key}`}>
                  <t.icon className="h-4 w-4 mr-1.5" /> {t.label}
                  {t.count > 0 && <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${effectiveTab === t.key ? "bg-white/25 text-white" : "bg-[#FF6F62] text-white"}`}>{t.count}</span>}
                </Button>
              ))}
            </div>
            {apprTabs.length === 0 ? (
              <div className="card-surface rounded-2xl py-16 text-center"><Check className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">Nothing awaiting your approval.</p></div>
            ) : (
              <>
                {effectiveTab === "reimbursements" && <ReimbApprovals items={financeReimbQueue} allItems={reimb} nameByUser={nameByUser} allowBulk={canCeoReimb} />}
                {effectiveTab === "office_purchases" && <OfficePurchaseApprovals allItems={opAll} canTriage={canOpTriage} canCeo={false} />}
                {effectiveTab === "travel" && <TravelApprovals scope="hr" />}
              </>
            )}
          </>
        )}

        {batchCat && <CeoReviewModal key={batchCat.title + (batchCat.lane || "")} cfg={batchCat} onClose={() => setBatchCat(null)} />}
        {travelModal && (
          <Dialog open onOpenChange={(o) => { if (!o) setTravelModal(false); }}>
            <DialogContent className="max-w-2xl max-h-[86vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Plane className="h-5 w-5 text-[#206295]" /> Travel approvals</DialogTitle></DialogHeader>
              <TravelApprovals scope="ceo" />
            </DialogContent>
          </Dialog>
        )}
        {reimbModal && (
          <Dialog open onOpenChange={(o) => { if (!o) setReimbModal(false); }}>
            <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-[#206295]" /> Reimbursement approvals</DialogTitle></DialogHeader>
              <ReimbApprovals items={ceoReimbQueue} allItems={reimb} nameByUser={nameByUser} allowBulk={canCeoReimb} />
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  // ===================== Main =====================
  return (
    <div className="p-6 space-y-6 max-w-[92rem] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Company Workspace</h1>
        <p className="text-sm text-muted-foreground mt-1">Your office operations hub — raise requests, track status, and manage approvals</p>
      </div>

      {/* Overview cards */}
      {sumLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Card key={i} className="border-0"><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Pending Purchases" value={myOpenOp} subtitle="in progress" icon={ShoppingCart} color="bg-[#206295]/15 text-[#206295]" />
          <StatCard title="Pending Travels" value={(travels as any[]).filter((t: any) => ["pending_hr", "pending_approval", "under_review", "approved"].includes(t.status)).length} subtitle="in progress" icon={Car} color="bg-[#4BDCD9]/25 text-[#206295]" />
          <StatCard title="Open Tickets" value={summary?.tickets?.open || 0} subtitle="in progress" icon={TicketIcon} color="bg-[#206295]/15 text-[#206295]" />
          <StatCard title="Pending Reimbursements" value={money(pendingReimbAmount)} subtitle={canReimbApprove ? "awaiting your approval" : "your pending claims"} icon={Receipt} color="bg-[#FF6F62]/20 text-[#FF6F62]" />
        </div>
      )}

      {/* Service Catalog */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Service Catalog</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {SERVICES.map((s) => (
            <button key={s.key} onClick={() => s.key === "purchase" ? setNewReqOpen(true) : setOpenForm(s.key)} data-testid={`service-${s.key}`} className="text-left focus:outline-none">
              <Card className="border-0 card-hover h-full"><CardContent className="p-5">
                <div className={`p-2.5 rounded-xl w-fit mb-3 ${s.color}`}><s.icon className="h-5 w-5" /></div>
                <h3 className="font-semibold text-sm text-foreground mb-1">{s.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#206295]">Open form <ArrowRight className="h-3 w-3" /></span>
              </CardContent></Card>
            </button>
          ))}
        </div>
      </div>

      {/* Requests & Approvals (navigation cards) */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Requests &amp; Approvals</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NavCard title="My Requests" count={myOpen} subtitle="open items" icon={ClipboardList} onClick={() => navigate("/my-requests")} />
          {canTeam && <NavCard title="Team Requests" count={teamOpen} subtitle="from your reports" icon={Users} onClick={() => navigate("/team-requests")} />}
          {canApprove && <NavCard title="My Approvals" count={apprTotal} subtitle="awaiting action" icon={ShieldCheck} onClick={() => setView("approvals")} />}
        </div>
      </div>

      {/* Recent Activities */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Recent Activities</h2>
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> showing last 7 days</span>
        </div>
        <Card className="border-0"><CardContent className="p-0">
          {recent.length === 0 ? (
            <div className="text-center py-12"><ClipboardList className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No activity in the last 7 days.</p></div>
          ) : (
            <DataTable
              columns={[
                { key: "requester", header: "Requester", cellClassName: "text-foreground" },
                { key: "type", header: "Type", cellClassName: "text-muted-foreground" },
                { key: "details", header: "Details", cellClassName: "text-foreground/80 max-w-[18rem] truncate" },
                { key: "status", header: "Status", render: (r: any) => <Badge className={`text-xs ${statusClass(r.status)}`}>{statusLabel(r.status)}</Badge> },
                { key: "approvedBy", header: "Approved By", cellClassName: "text-muted-foreground" },
                { key: "date", header: "Date", cellClassName: "text-muted-foreground", render: (r: any) => fmtDate(r.date) },
              ]}
              rows={recent}
              getRowKey={(r: any) => `${r.type}-${r.id}`}
              onRowClick={(r: any) => setDetail(r)}
              testIdPrefix="activity"
            />
          )}
        </CardContent></Card>
      </div>

      {/* Service forms (open directly) */}
      <NewTravelDialog open={openForm === "travel"} onClose={() => setOpenForm(null)} />
      <TicketForm open={openForm === "ticket"} onClose={() => setOpenForm(null)} />
      <ReimbursementFormDialog open={openForm === "reimbursement"} onClose={() => setOpenForm(null)} />
      <NewRequestDialog open={newReqOpen} onClose={() => setNewReqOpen(false)} />

      {detail && <ActivityDetailModal row={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
