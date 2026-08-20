import { useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth, isManager } from "@/lib/auth";
import { canHrTriage, canCeoApprove, canProcureApprove, canTravelHr, canTravelCeo } from "../shared/permissions";
import { cap } from "../shared/approval-format";

// The data layer behind the Company Workspace hub and My Approvals. Both screens read the
// same queues and counts, so they share one hook rather than two copies free to drift.
//
// `view` decides which queries actually run: the hub-only lists stay disabled on the
// approvals screen, so they never compete for connections with the approval queues.
export function useWorkspaceData(view: "main" | "approvals") {
  const [location] = useLocation();
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

  return {
    user,
    role,
    canTeam,
    isApprover,
    canFinanceReimb,
    canCeoReimb,
    canReimbApprove,
    canOpTriage,
    canOpCeo,
    canOfficePurchase,
    canProc,
    actingCeo,
    isCeo,
    canApprove,
    canTravelApprove,
    summary,
    sumLoading,
    purchases,
    travels,
    tickets,
    reimb,
    officePurchases,
    myProcurement,
    teamData,
    svcRequests,
    movements,
    employees,
    opAll,
    procAll,
    travelAll,
    nameByUser,
    reqName,
    financeReimbQueue,
    ceoReimbQueue,
    officeTriageCount,
    officeCeoCount,
    pendingProc,
    travelPending,
    travelCeoPending,
    apprTotal,
    pendingReimbAmount,
    myOpenOp,
    myOpen,
    teamOpen,
    recent,
  };
}
