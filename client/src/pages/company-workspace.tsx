import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth, isManager } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePaged, PaginationBar } from "@/components/pagination";
import { DataTable } from "@/components/data-table";
import { useToast } from "@/hooks/use-toast";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { DateInput } from "@/components/datetime-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { exportXlsx } from "@/lib/export-xlsx";
import { NewRequestDialog, OfficePurchaseDetailDialog, canHrTriage, canCeoApprove } from "@/components/office-purchase";
import { canProcureApprove } from "@/components/procurement";
import { CommentThread } from "@/components/comment-thread";
import { TravelApprovals, NewTravelDialog, canTravelHr, canTravelCeo } from "@/components/travel";
import {
  ShoppingCart, Car, Plane, TicketIcon, Receipt, Plus, Trash2, ClipboardList,
  ShieldCheck, ArrowRight, ChevronLeft, Check, X, Users, ChevronRight, ChevronDown, MessageSquare,
  CalendarClock, ExternalLink, FileText, IndianRupee, MoreVertical, Eye, Download,
  Maximize2, ArrowDownUp, Building2, Hash, Paperclip, Clock, MousePointerClick, CheckSquare, CalendarRange,
  LayoutGrid, Table as TableIcon, CheckCircle2, Layers, Package,
} from "lucide-react";
import { format } from "date-fns";
import { ReimbursementFormDialog } from "@/components/reimbursement-form";
import { statusClass, statusLabel } from "@/lib/status";

// ---- helpers ----
const cap = (s?: string) => (s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "");
const money = (v: any) => `₹${Number(v || 0).toLocaleString("en-IN")}`;
const fmtDate = (d?: string) => { try { return d ? format(new Date(d), "MMM d, yyyy") : ""; } catch { return ""; } };
// A re-submitted claim relabels "Submitted on" → "Re-submitted On"; the original creation date shows on hover.
const reimbSubmittedInfo = (r: any): { label: string; date: any; resubmitted: boolean; originalDate?: any } => {
  try { const p = JSON.parse(r?.notes || "{}"); if (p && p.kind === "resubmitted_diff") return { label: "Re-submitted On", date: p.at || r.updatedAt || r.createdAt, resubmitted: true, originalDate: r.createdAt }; } catch { /* not JSON */ }
  return { label: "Submitted on", date: r?.createdAt, resubmitted: false };
};


function StatCard({ title, value, subtitle, icon: Icon, color, onClick }: { title: string; value: any; subtitle?: React.ReactNode; icon: any; color: string; onClick?: () => void; }) {
  const inner = (
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-[33px] leading-tight font-bold text-foreground truncate">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-xl flex-shrink-0 ${color}`}><Icon className="h-5 w-5" /></div>
      </div>
    </CardContent>
  );
  return onClick
    ? <button onClick={onClick} className="text-left w-full focus:outline-none"><Card className="border-0 card-hover h-full">{inner}</Card></button>
    : <Card className="border-0 card-hover">{inner}</Card>;
}

const SERVICES = [
  { key: "purchase", title: "Purchase Request", desc: "Request equipment, supplies, or any business purchase", icon: ShoppingCart, color: "bg-[#4BDCD9]/25 text-[#206295]" },
  { key: "travel", title: "Travel Request", desc: "Plan business travel — flights, stays, transport", icon: Car, color: "bg-[#206295]/15 text-[#206295]" },
  { key: "ticket", title: "Support Ticket", desc: "Get help with IT, repairs, stationery, access & more", icon: TicketIcon, color: "bg-[#4BDCD9]/25 text-[#206295]" },
  { key: "reimbursement", title: "Reimbursement", desc: "Claim expenses with invoice details and track approval", icon: Receipt, color: "bg-[#FF6F62]/20 text-[#FF6F62]" },
] as const;

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
  const canApprove = isCeo || canOfficePurchase; // CEO cards; super_admin/HR → office triage; finance approves on its own /reimbursements page

  // View is URL-driven so navigating updates the browser URL (shareable / back-button friendly).
  const view: "main" | "approvals" = (location === "/my-approvals" || location === "/workspace/approvals") ? "approvals" : "main";
  const setView = (v: "main" | "approvals") => navigate(v === "approvals" ? "/my-approvals" : "/company-workspace");
  const [openForm, setOpenForm] = useState<null | "purchase" | "travel" | "ticket" | "reimbursement">(null);
  const [newReqOpen, setNewReqOpen] = useState(false);
  const [apprView, setApprView] = useState<"pending" | "completed">("pending");
  const [apprTab, setApprTab] = useState<string>("");
  const [travelModal, setTravelModal] = useState(false);
  const [batchCat, setBatchCat] = useState<any>(null);

  // ---- data ----
  const { data: summary, isLoading: sumLoading } = useQuery<any>({ queryKey: ["/api/my-requests/summary"] });
  const { data: purchases = [] } = useQuery<any[]>({ queryKey: ["/api/my-requests/purchases"] });
  const { data: travels = [] } = useQuery<any[]>({ queryKey: ["/api/my-requests/travels"] });
  const { data: tickets = [] } = useQuery<any[]>({ queryKey: ["/api/my-requests/tickets"] });
  const { data: reimb = [] } = useQuery<any[]>({ queryKey: ["/api/reimbursements"] });
  const { data: officePurchases = [] } = useQuery<any[]>({ queryKey: ["/api/office-purchases?mine=true"] });
  const { data: myProcurement = [] } = useQuery<any[]>({ queryKey: ["/api/procurement?mine=true"] });
  const { data: teamData } = useQuery<any>({ queryKey: ["/api/team-requests"], enabled: canTeam, retry: false });

  // approval domains (super-admin / CEO)
  const { data: svcRequests = [] } = useQuery<any[]>({ queryKey: ["/api/requests"], enabled: isApprover });
  const { data: movements = [] } = useQuery<any[]>({ queryKey: ["/api/logistics/movements"], enabled: isApprover });
  const { data: bookings = [] } = useQuery<any[]>({ queryKey: ["/api/vehicles/bookings"], enabled: isApprover });
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
  const pendingVeh = useMemo(() => (bookings as any[]).filter((b) => b.status !== "cancelled" && +new Date(b.endTime || b.startTime || 0) >= now), [bookings, now]);
  // Reimbursement approval queue, stage-aware:
  //  - Finance sees "submitted" (first review) | CEO sees "finance_approved" (final) | super_admin sees both
  const pendingReimb = useMemo(() => (reimb as any[]).filter((r) => {
    // You can't approve your own claim — except super_admin (emergency override; matches the backend).
    if (r.requesterId === user?.id && role !== "super_admin") return false;
    if (r.status === "submitted") return canFinanceReimb;       // Finance reviews
    if (r.status === "finance_approved") return canCeoReimb;    // CEO finalises
    return false;
  }), [reimb, canFinanceReimb, canCeoReimb, user?.id, role]);
  // Office purchases, split by layer so counts match what each screen shows.
  // First-layer HR triage (Pending phase = what super_admin/HR see on their normal My Approvals):
  const officeTriageCount = useMemo(() => (opAll as any[]).filter((o) => ["pending_hr", "priced", "approved", "under_review"].includes(o.status)).length, [opAll]);
  // CEO-layer office (the bulk card on the CEO Inbox): awaiting the CEO's decision.
  const officeCeoCount = useMemo(() => (opAll as any[]).filter((o) => ["pending_approval", "under_review"].includes(o.status)).length, [opAll]);
  const pendingProc = useMemo(() => (procAll as any[]).filter((o) => ["pending_approval", "under_review"].includes(o.status)).length, [procAll]);
  const travelPending = useMemo(() => (travelAll as any[]).filter((t) =>
    (canTravelHr(role) && ["pending_hr", "approved"].includes(t.status)) ||
    (canTravelCeo(role) && ["pending_approval", "under_review"].includes(t.status))
  ).length, [travelAll, role]);
  // Nav-card badge: CEO-layer only when isCeo (reimb+proc+office-CEO); first-layer office when a triage role.
  const apprTotal = (isCeo ? pendingReimb.length + pendingProc + officeCeoCount : 0) + (canOpTriage ? officeTriageCount : 0);
  // Approver → total awaiting THEIR approval (stage-aware queue). Employee → their own pending claims.
  const pendingReimbAmount = useMemo(() => {
    const rows = canReimbApprove
      ? pendingReimb
      : reimb.filter((r: any) => r.requesterId === user?.id && ["submitted", "finance_approved", "changes_requested"].includes(r.status));
    return rows.reduce((s: number, r: any) => s + Number(r.totalAmount || 0), 0);
  }, [canReimbApprove, pendingReimb, reimb, user?.id]);

  // The user's own in-flight purchases — office purchases + procurement (both count toward "Pending Purchases").
  const myOpenOp = useMemo(() =>
    (officePurchases as any[]).filter((o) => ["pending_hr", "priced", "pending_approval", "approved", "ordered"].includes(o.status)).length +
    (myProcurement as any[]).filter((o) => o.status === "pending_approval").length
  , [officePurchases, myProcurement]);
  const myOpen =
    myOpenOp +
    purchases.filter((p: any) => ["draft", "submitted", "pending_ceo", "changes_requested"].includes(p.status)).length +
    travels.filter((t: any) => ["draft", "submitted", "pending_ceo", "changes_requested"].includes(t.status)).length +
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
    travels.forEach((t: any) => rows.push({ id: t.id, kind: "travel", raw: t, requester: "You", type: "Travel", details: `${t.fromCity || "?"} → ${t.toCity || "?"}`, status: t.status, date: t.createdAt, approvedBy: t.assignedToName || "—" }));
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
    const reimbCeoStage = (reimb as any[]).filter((r) => r.status === "finance_approved" && (role === "super_admin" || r.requesterId !== user?.id));
    const reimbItems = reimbCeoStage.map((r) => ({ id: r.id, primary: r.reference || "Reimbursement", secondary: r.employeeName || reqName(r.requesterId), amount: Number(r.totalAmount) || 0 }));
    const opPend = (opAll as any[]).filter((o) => o.status === "pending_approval");
    const procPend = (procAll as any[]).filter((o) => o.status === "pending_approval");
    const opUR = (opAll as any[]).filter((o) => o.status === "under_review");
    const procUR = (procAll as any[]).filter((o) => o.status === "under_review");
    const travelPend = (travelAll as any[]).filter((t) => ["pending_approval", "under_review"].includes(t.status));
    const amtSum = (arr: any[], k = "totalAmount") => arr.reduce((s, x) => s + (Number(x[k]) || 0), 0);
    // Main inbox = ONE card per category (total ₹ + count, irrespective of HR grouping); the drill modal shows groups/items.
    const catCards = ([
      reimbCeoStage.length ? { key: "reimbursements", label: "Reimbursements", icon: Receipt, count: reimbCeoStage.length, total: amtSum(reimbCeoStage),
        cfg: { title: "Reimbursements", items: reimbItems, invalidateKey: "/api/reimbursements",
          approveFn: (ids: string[], note: string) => Promise.all(ids.map((id) => apiRequest("POST", `/api/reimbursements/${id}/approve`, { note }))),
          rejectFn: (ids: string[], note: string) => Promise.all(ids.map((id) => apiRequest("POST", `/api/reimbursements/${id}/reject`, { note }))) } } : null,
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
      canOpTriage ? { key: "office_purchases", label: "Office Purchases", icon: ShoppingCart, count: officeTriageCount } : null,
      canTravelApprove ? { key: "travel", label: "Travel", icon: Plane, count: travelPending } : null,
    ].filter(Boolean) as { key: string; label: string; icon: any; count: number }[]).sort((a, b) => b.count - a.count);
    const effectiveTab = apprTabs.some((t) => t.key === apprTab) ? apprTab : apprTabs[0]?.key;
    const headerTotal = isCeo
      ? catCards.reduce((s, c) => s + c.count, 0) + underReviewCards.reduce((s, c) => s + c.count, 0)
      : apprTabs.reduce((s, t) => s + t.count, 0);
    // Completed / decided history across the categories this user approves.
    const done = (arr: any[], statuses: string[]) => (arr as any[]).filter((x) => statuses.includes(x.status));
    const completedRows: { key: string; icon: any; title: string; sub: string; amount: number; date: any; status: string }[] = [];
    if (isCeo) done(reimb, ["approved", "rejected"]).forEach((r) => completedRows.push({ key: `rmb-${r.id}`, icon: Receipt, title: r.reference || "Reimbursement", sub: r.employeeName || reqName(r.requesterId), amount: Number(r.totalAmount) || 0, date: r.updatedAt || r.createdAt, status: r.status }));
    if (canOfficePurchase) done(opAll, ["approved", "rejected", "ordered", "delivered", "completed"]).forEach((o) => completedRows.push({ key: `op-${o.id}`, icon: ShoppingCart, title: o.reference, sub: o.employeeName || "Employee", amount: Number(o.totalAmount) || 0, date: o.updatedAt || o.createdAt, status: o.status }));
    if (isCeo) done(procAll, ["approved", "rejected"]).forEach((o) => completedRows.push({ key: `pr-${o.id}`, icon: Package, title: o.reference, sub: o.employeeName || "Employee", amount: Number(o.totalAmount) || 0, date: o.decidedAt || o.updatedAt || o.createdAt, status: o.status }));
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
                            <Button variant="secondary" className="mt-4 w-full" onClick={() => c.cfg.kind === "travel" ? setTravelModal(true) : setBatchCat(c.cfg)} data-testid={`inbox-view-${c.key}`}><Eye className="h-4 w-4 mr-1.5" /> Review</Button>
                          </div>
                        ))}
                      </div>
                    )}
                    {underReviewCards.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-[#FF6F62] flex-shrink-0" />
                          <h2 className="text-sm font-semibold text-foreground">Under review</h2>
                          <span className="text-xs text-muted-foreground">queries you raised, awaiting HR</span>
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
                {effectiveTab === "office_purchases" && <OfficePurchaseApprovals allItems={opAll} canTriage={canOpTriage} canCeo={false} />}
                {effectiveTab === "travel" && <TravelApprovals />}
              </>
            )}
          </>
        )}

        {batchCat && (batchCat.kind
          ? <CeoReviewModal key={batchCat.title + (batchCat.lane || "")} cfg={batchCat} onClose={() => setBatchCat(null)} />
          : <ApprovalBatchModal key={batchCat.title} cfg={batchCat} open onClose={() => setBatchCat(null)} />)}
        {travelModal && (
          <Dialog open onOpenChange={(o) => { if (!o) setTravelModal(false); }}>
            <DialogContent className="max-w-2xl max-h-[86vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Plane className="h-5 w-5 text-[#206295]" /> Travel approvals</DialogTitle></DialogHeader>
              <TravelApprovals />
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
          <StatCard title="Pending Travels" value={summary?.travels?.pending || 0} subtitle="awaiting action" icon={Car} color="bg-[#4BDCD9]/25 text-[#206295]" />
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
      <PurchaseForm open={openForm === "purchase"} onClose={() => setOpenForm(null)} />
      <NewTravelDialog open={openForm === "travel"} onClose={() => setOpenForm(null)} />
      <TicketForm open={openForm === "ticket"} onClose={() => setOpenForm(null)} />
      <ReimbursementFormDialog open={openForm === "reimbursement"} onClose={() => setOpenForm(null)} />
      <NewRequestDialog open={newReqOpen} onClose={() => setNewReqOpen(false)} />

      {detail && <ActivityDetailModal row={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

// Definition-list row inside the detail modal
function Field({ label, value }: { label: string; value: any }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right break-words min-w-0">{value}</span>
    </div>
  );
}

function ActivityDetailModal({ row, onClose }: { row: any; onClose: () => void }) {
  const r = row.raw || {};
  const itemsText = (arr: any) => Array.isArray(arr) && arr.length
    ? arr.map((i: any) => (i && typeof i === "object" ? `${i.description || i.name || "Item"}${i.qty ? ` ×${i.qty}` : ""}` : String(i))).join(", ")
    : null;
  const fields: [string, any][] = [];
  const add = (label: string, val: any) => fields.push([label, val]);

  switch (row.kind) {
    case "purchase":
      add("Category", cap(r.category)); add("Items", itemsText(r.items)); add("Estimated Cost", r.estimatedCost != null ? money(r.estimatedCost) : null);
      add("Department", r.department); add("Needed By", r.neededByDate ? fmtDate(r.neededByDate) : null); add("PO Number", r.poNumber); add("Notes", r.notes);
      break;
    case "travel":
      add("Purpose", r.purpose); add("Route", `${r.fromCity || "?"} → ${r.toCity || "?"}`); add("Travel Date", r.travelDate ? fmtDate(r.travelDate) : null);
      add("Return Date", r.returnDate ? fmtDate(r.returnDate) : null); add("Estimated Budget", r.estimatedBudget != null ? money(r.estimatedBudget) : null);
      add("Preferences", r.preferences); add("Assigned To", r.assignedToName); add("Notes", r.notes);
      break;
    case "ticket":
      add("Category", cap(r.category)); add("Subject", r.subject); add("Description", r.description); add("Priority", cap(r.priority));
      add("Resolved At", r.resolvedAt ? fmtDate(r.resolvedAt) : null);
      break;
    case "reimbursement":
      add("Reference", r.reference); add("Category", r.category); add("Amount", money(r.totalAmount)); add("Description", r.description);
      add("Invoice No.", r.invoiceNumber); add("Invoice Date", r.invoiceDate ? fmtDate(r.invoiceDate) : null); add("Decision Note", r.decisionNote);
      break;
    case "office_purchase":
      add("Reference", r.reference);
      add("Items", Array.isArray(r.items) ? r.items.map((i: any) => `${i.description || "Item"}${i.quantity ? ` ×${i.quantity}` : ""}`).filter(Boolean).join(", ") : null);
      add("Priority", cap(r.priority)); add("Total", Number(r.totalAmount) > 0 ? money(r.totalAmount) : null); add("Justification", r.justification);
      break;
    case "procurement":
      add("Reference", r.reference);
      add("Items", Array.isArray(r.items) ? r.items.map((i: any) => `${i.description || "Item"}${i.quantity ? ` ×${i.quantity}` : ""}`).filter(Boolean).join(", ") : null);
      add("Total", Number(r.totalAmount) > 0 ? money(r.totalAmount) : null); add("Purpose", r.justification);
      break;
    case "request":
      add("Reference", r.reference); add("Type", cap(r.type)); add("Title", r.title); add("Description", r.description); add("Routed To", r.routeToTeam);
      add("Quantity", r.quantity); add("Estimated Cost", r.estimatedCost != null ? money(r.estimatedCost) : null); add("Priority", cap(r.priority));
      add("Needed By", r.neededByDate ? fmtDate(r.neededByDate) : null); add("Resolution", r.resolutionNote);
      break;
    case "logistics":
      add("Reference", r.reference); add("Movement Type", cap(r.movementType)); add("Route", `${r.fromLocationText || "?"} → ${r.toLocationText || "?"}`);
      add("Items", itemsText(r.items)); add("Priority", cap(r.priority)); add("Requested Date", r.requestedDate ? fmtDate(r.requestedDate) : null);
      add("Carrier", r.carrier); add("Tracking", r.trackingNumber); add("Estimated Cost", r.estimatedCost != null ? money(r.estimatedCost) : null); add("Notes", r.notes);
      break;
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{row.type} Details</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`text-xs ${statusClass(row.status)}`}>{statusLabel(row.status)}</Badge>
            <span className="text-xs text-muted-foreground">{fmtDate(row.date)}</span>
          </div>
          <div className="list-divider">
            <Field label="Requester" value={row.requester} />
            {fields.map(([l, v]) => <Field key={l} label={l} value={v} />)}
            <Field label="Approved By" value={row.approvedBy && row.approvedBy !== "—" ? row.approvedBy : null} />
          </div>
          {r.invoiceUrl && (
            <a href={r.invoiceUrl} target="_blank" rel="noreferrer" className="text-xs text-[#206295] inline-flex items-center gap-1 hover:underline">
              <ExternalLink className="h-3 w-3" /> View invoice
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NavCard({ title, count, subtitle, icon: Icon, onClick }: { title: string; count: number; subtitle?: string; icon: any; onClick: () => void; }) {
  return (
    <button onClick={onClick} className="text-left w-full focus:outline-none" data-testid={`nav-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <Card className="border-0 card-hover"><CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-[#4BDCD9]/25 text-[#206295] flex-shrink-0"><Icon className="h-5 w-5" /></div>
            <div className="min-w-0">
              {/* count is 20% larger than the label text */}
              <p className="text-sm text-muted-foreground truncate">{title}</p>
              <p className="text-[1.05rem] leading-tight font-bold text-foreground">
                {count} <span className="text-sm font-normal text-muted-foreground">{subtitle}</span>
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </div>
      </CardContent></Card>
    </button>
  );
}

// Notion-style date picker (matches /attendance): single date by default, "End date" toggle to make it a range.
// Returns a { from?, to? } range of Date objects; a single date is represented as from === to.
function ApprovalDateRange({ value, onChange }: { value: { from?: Date; to?: Date }; onChange: (v: { from?: Date; to?: Date }) => void }) {
  const [endDate, setEndDate] = useState(!!(value.from && value.to && +value.from !== +value.to));
  const hasRange = endDate && value.to && value.from && +value.to !== +value.from;
  const label = value.from
    ? hasRange ? `${format(value.from!, "MMM d")} – ${format(value.to!, "MMM d, yyyy")}` : format(value.from, "MMM d, yyyy")
    : "Date range";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9" data-testid="appr-date-range"><CalendarRange className="h-4 w-4 mr-1.5" /> {label}</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-3">
        {/* Selected start / end summary */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 text-sm font-medium px-3 py-1.5 rounded-[12px] border border-border text-center">
            {value.from ? format(value.from, "MMM d, yyyy") : "Start date"}
          </div>
          {endDate && (
            <>
              <span className="text-muted-foreground text-xs">→</span>
              <div className="flex-1 text-sm font-medium px-3 py-1.5 rounded-[12px] border border-border text-center">
                {hasRange ? format(value.to!, "MMM d, yyyy") : "End date"}
              </div>
            </>
          )}
        </div>

        {endDate ? (
          <Calendar mode="range" selected={value as any} onSelect={(r: any) => onChange(r ?? {})} defaultMonth={value.from} />
        ) : (
          <Calendar mode="single" selected={value.from} onSelect={(d: any) => d && onChange({ from: d, to: d })} defaultMonth={value.from} />
        )}

        {/* End date toggle */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
          <span className="text-sm font-medium">End date</span>
          <Switch
            checked={endDate}
            onCheckedChange={(c) => {
              setEndDate(c);
              if (!c && value.from) onChange({ from: value.from, to: value.from });
              else if (c && value.from) onChange({ from: value.from, to: undefined });
            }}
            data-testid="switch-appr-end-date"
          />
        </div>
        {(value.from || value.to) && (
          <Button variant="ghost" size="sm" className="w-full mt-1" onClick={() => { setEndDate(false); onChange({}); }}>Clear</Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Shared day-range filter used across approver lists. A blank range passes everything.
const dayInRange = (d: any, range: { from?: Date; to?: Date }) => {
  if (!range.from && !range.to) return true;
  if (!d) return false;
  const day = format(new Date(d), "yyyy-MM-dd");
  if (range.from && day < format(range.from, "yyyy-MM-dd")) return false;
  if (range.to && day > format(range.to, "yyyy-MM-dd")) return false;
  return true;
};
const rangeSuffix = (range: { from?: Date; to?: Date }) =>
  range.from || range.to ? ` (${range.from ? format(range.from, "MMM d") : "…"} to ${range.to ? format(range.to, "MMM d, yyyy") : "…"})` : "";

// Card / Table view switch, shared across the approval lists.
function ViewToggle({ view, onChange }: { view: "card" | "table"; onChange: (v: "card" | "table") => void }) {
  return (
    <div className="segmented-toggle inline-flex p-0.5 h-9 flex-shrink-0">
      {([["card", LayoutGrid], ["table", TableIcon]] as const).map(([v, Icon]) => (
        <button key={v} onClick={() => onChange(v)} title={`${v === "card" ? "Card" : "Table"} view`} data-testid={`view-${v}`}
          className={`px-2.5 h-full rounded-[10px] flex items-center transition-colors ${view === v ? "btn-primary-gradient text-white" : "text-muted-foreground hover-elevate"}`}>
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

const LIST_PAGE_SIZE = 15;


// ===================== Office Purchase approvals (HR triage + CEO approval) =====================
const OP_PRIORITY: Record<string, { label: string; cls: string }> = {
  high: { label: "High", cls: "bg-[#FF6F62]/15 text-[#FF6F62]" },
  medium: { label: "Medium", cls: "bg-[#206295]/15 text-[#206295]" },
  low: { label: "Low", cls: "bg-[#64748B]/15 text-[#64748B]" },
};
// Read-only history of decided items across the categories this user approves.
function CompletedApprovals({ rows }: { rows: { key: string; icon: any; title: string; sub: string; amount: number; date: any; status: string }[] }) {
  const { pageItems, page, setPage, totalPages, count, size } = usePaged(rows);
  if (rows.length === 0) return <div className="card-surface rounded-2xl py-16 text-center"><Check className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No completed approvals yet.</p></div>;
  return (
    <div className="space-y-2.5">
      {pageItems.map((r) => (
        <div key={r.key} className="card-surface p-4 flex items-center gap-4">
          <span className="h-9 w-9 rounded-xl bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0"><r.icon className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap"><span className="text-[13px] font-semibold text-foreground truncate">{r.title}</span><Badge className={`text-[10px] ${statusClass(r.status)}`}>{statusLabel(r.status)}</Badge></div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{r.sub}{r.date ? ` | ${fmtDate(r.date)}` : ""}</p>
          </div>
          {r.amount > 0 && <span className="text-sm font-bold text-[#206295] tabular-nums flex-shrink-0">{money(r.amount)}</span>}
        </div>
      ))}
      <PaginationBar page={page} totalPages={totalPages} count={count} size={size} onPage={setPage} />
    </div>
  );
}
// Inbox bulk-approval modal — every pending item in one category, X to drop, Approve/Reject all on the rest.
// CEO review — expand-a-row: compact list, open a row for its receipt + discussion thread + per-item
// Approve / Reject / Raise Query. Footer keeps Approve-all / Reject-all; tick rows to query several.
// Live-fetches its category so the list updates as items are decided or moved to Under Review.
function CeoReviewModal({ cfg, onClose }: { cfg: any; onClose: () => void }) {
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
                        <p className="text-[13px] font-semibold text-foreground truncate">{items.length ? `${items[0]?.description || "Item"}${Number(items[0]?.quantity) > 1 ? ` ×${items[0].quantity}` : ""}${items.length > 1 ? ` +${items.length - 1} more` : ""}` : (r.reference || "Request")}</p>
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
        {bulkMode && <Textarea autoFocus rows={2} value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} placeholder={bulkMode === "reject" ? "Reason for rejecting all" : `Message HR about ${sel.size} selected`} />}
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
                ? <Button size="sm" variant="outline" className={rejectBtn} disabled={busy || !bulkNote.trim() || !rows.length} onClick={() => bulk.mutate({ path: "bulk-reject", ids: allIds, body: { note: bulkNote }, msg: "Rejected all" })}><X className="h-4 w-4 mr-1.5" /> Reject all</Button>
                : <Button size="sm" variant="outline" className={queryBtn} disabled={busy || !bulkNote.trim() || !sel.size} onClick={() => bulk.mutate({ path: "bulk-query", ids: [...sel], body: { body: bulkNote }, msg: `Query raised on ${sel.size}` })}><MessageSquare className="h-4 w-4 mr-1.5" /> Send query</Button>}
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" className={rejectBtn} disabled={busy || !rows.length} onClick={() => setBulkMode("reject")}><X className="h-4 w-4 mr-1.5" /> Reject all</Button>
              <Button size="sm" className="btn-primary-gradient text-white" disabled={busy || !rows.length} onClick={() => bulk.mutate({ path: "bulk-approve", ids: allIds, body: {}, msg: "Approved all" })}><Check className="h-4 w-4 mr-1.5" /> Approve all</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function ApprovalBatchModal({ cfg, open, onClose }: { cfg: any; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const items: { id: string; primary: string; secondary: string; amount: number }[] = cfg?.items || [];
  const kept = items.filter((i) => !dropped.has(i.id));
  const keptIds = kept.map((i) => i.id);
  const total = kept.reduce((s, i) => s + (i.amount || 0), 0);
  const invalidate = () => qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith(cfg.invalidateKey) });
  const approve = useMutation({ mutationFn: () => cfg.approveFn(keptIds, note), onSuccess: () => { invalidate(); toast({ title: kept.length > 1 ? `${kept.length} approved` : "Approved" }); onClose(); }, onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }) });
  const reject = useMutation({ mutationFn: () => cfg.rejectFn(keptIds, note), onSuccess: () => { invalidate(); toast({ title: kept.length > 1 ? `${kept.length} rejected` : "Rejected" }); onClose(); }, onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }) });
  const busy = approve.isPending || reject.isPending;
  const rejectBtn = "border-[#FF6F62]/40 text-[#FF6F62] hover:bg-[#FF6F62]/10 hover:text-[#FF6F62]";
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{cfg.title}</DialogTitle></DialogHeader>
        <ScrollArea className="max-h-[55vh] pr-3 -mr-3">
          <div className="space-y-2">
            {kept.length === 0 && <p className="text-sm text-muted-foreground py-10 text-center">Nothing selected.{dropped.size > 0 && <> <button className="text-[#206295] hover:underline" onClick={() => setDropped(new Set())}>Undo</button></>}</p>}
            {kept.map((i) => (
              <div key={i.id} className="rounded-lg border bg-muted/30 px-3 py-2.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{i.primary}</p>
                  <p className="text-xs text-muted-foreground truncate">{i.secondary}</p>
                </div>
                {i.amount > 0 && <span className="text-sm font-semibold text-[#206295] tabular-nums flex-shrink-0">{money(i.amount)}</span>}
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-[#FF6F62] flex-shrink-0" disabled={busy} onClick={() => setDropped((p) => { const n = new Set(p); n.add(i.id); return n; })} aria-label="Remove"><X className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </ScrollArea>
        {dropped.size > 0 && kept.length > 0 && <p className="text-xs text-muted-foreground">{dropped.size} removed | <button className="text-[#206295] hover:underline" onClick={() => setDropped(new Set())}>Undo</button></p>}
        {rejecting && <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for rejection" rows={2} autoFocus />}
        <DialogFooter className="items-center">
          <div className="mr-auto flex items-center gap-2.5">
            <span className="text-xl font-bold text-foreground tabular-nums">{total > 0 ? money(total) : `${kept.length} item${kept.length !== 1 ? "s" : ""}`}</span>
            {total > 0 && <><span className="h-4 w-px bg-border" /><span className="text-xs text-muted-foreground">{kept.length} item{kept.length !== 1 ? "s" : ""}</span></>}
          </div>
          {rejecting ? (
            <>
              <Button variant="secondary" onClick={() => { setRejecting(false); setNote(""); }} disabled={busy}>Cancel</Button>
              <Button variant="outline" className={rejectBtn} disabled={busy || !note.trim() || !kept.length} onClick={() => reject.mutate()}><X className="h-4 w-4 mr-1.5" /> Reject {kept.length}</Button>
            </>
          ) : (
            <>
              <Button variant="outline" className={rejectBtn} disabled={busy || !kept.length} onClick={() => setRejecting(true)}><X className="h-4 w-4 mr-1.5" /> Reject all</Button>
              <Button className="btn-primary-gradient text-white" disabled={busy || !kept.length} onClick={() => approve.mutate()}><Check className="h-4 w-4 mr-1.5" /> Approve all</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
// One CEO card for a whole HR-sent batch — opens a table with approve/reject-all.
function OfficePurchaseBatchModal({ items, open, onClose }: { items: any[]; open: boolean; onClose: () => void }) {
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
      <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0"><Layers className="h-5 w-5" /></span>
            Purchase group | {items.length} request{items.length !== 1 ? "s" : ""}
          </DialogTitle>
        </DialogHeader>
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
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 text-[#FF6F62] border-[#FF6F62]/40" disabled={busy} onClick={() => reject.mutate()}><X className="h-4 w-4 mr-1.5" /> Reject all</Button>
          <Button className="btn-primary-gradient flex-1" disabled={busy} onClick={() => approve.mutate()}><Check className="h-4 w-4 mr-1.5" /> Approve all</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OfficePurchaseApprovals({ allItems, canTriage, canCeo }: { allItems: any[]; canTriage: boolean; canCeo: boolean }) {
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
  const opSection = (title: string, items: any[], tone?: "alert", Icon?: any) => items.length === 0 ? null : (
    <div className="space-y-2.5" key={title}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className={`h-3.5 w-3.5 ${tone === "alert" ? "text-[#C4402F]" : "text-muted-foreground"}`} />}
        <span className={`text-xs font-semibold uppercase tracking-wide ${tone === "alert" ? "text-[#C4402F]" : "text-muted-foreground"}`}>{title}</span>
        <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${tone === "alert" ? "bg-[#FF6F62]/20 text-[#C4402F]" : "bg-muted text-muted-foreground"}`}>{items.length}</span>
      </div>
      {items.map((o) => singleCard(o))}
    </div>
  );

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


// ===================== Forms =====================
function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["/api/my-requests/summary"] });
    qc.invalidateQueries({ queryKey: ["/api/my-requests/purchases"] });
    qc.invalidateQueries({ queryKey: ["/api/my-requests/travels"] });
    qc.invalidateQueries({ queryKey: ["/api/my-requests/tickets"] });
    qc.invalidateQueries({ queryKey: ["/api/reimbursements"] });
  };
}

function PurchaseForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const invalidate = useInvalidate();
  const form = useForm({ defaultValues: { category: "office_supplies", items: [{ description: "", qty: 1, estimatedCost: "", link: "" }], notes: "", neededByDate: "" } });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const mutation = useMutation({
    mutationFn: (data: any) => {
      const total = data.items.reduce((s: number, i: any) => s + (Number(i.estimatedCost) || 0), 0);
      return apiRequest("POST", "/api/my-requests/purchases", { category: data.category, items: data.items.filter((i: any) => i.description), estimatedCost: total || null, neededByDate: data.neededByDate || null, notes: data.notes || null });
    },
    onSuccess: () => { invalidate(); toast({ title: "Purchase request created as draft" }); form.reset(); onClose(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  // Cancel / X discards input (fresh form next open).
  const handleClose = () => { form.reset(); onClose(); };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New Purchase Request</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5"><Label>Category *</Label>
            <Select value={form.watch("category")} onValueChange={(v) => form.setValue("category", v)}>
              <SelectTrigger data-testid="select-pr-category"><SelectValue /></SelectTrigger>
              <SelectContent>{["office_supplies", "equipment", "software", "furniture", "marketing", "training", "other"].map((c) => <SelectItem key={c} value={c}>{cap(c)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Items *</Label>
            {fields.map((field, i) => (
              <div key={field.id} className="grid grid-cols-12 gap-1.5 items-start bg-muted/40 rounded-lg p-2.5">
                <div className="col-span-5 space-y-1"><p className="text-xs text-muted-foreground">Description</p><Input {...form.register(`items.${i}.description`, { required: true })} placeholder="Item name…" className="h-8 text-xs" /></div>
                <div className="col-span-2 space-y-1"><p className="text-xs text-muted-foreground">Qty</p><Input type="number" min="1" {...form.register(`items.${i}.qty`)} className="h-8 text-xs" /></div>
                <div className="col-span-3 space-y-1"><p className="text-xs text-muted-foreground">Est. ₹</p><Input type="number" min="0" {...form.register(`items.${i}.estimatedCost`)} placeholder="0" className="h-8 text-xs" /></div>
                <div className="col-span-2 flex items-end justify-center pb-0.5"><Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => fields.length > 1 && remove(i)}><Trash2 className="h-3.5 w-3.5 text-[#FF6F62]" /></Button></div>
                <div className="col-span-12"><Input {...form.register(`items.${i}.link`)} placeholder="Product link (optional)" className="h-8 text-xs" /></div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => append({ description: "", qty: 1, estimatedCost: "", link: "" })}><Plus className="h-3.5 w-3.5 mr-1.5" /> Add Item</Button>
          </div>
          <div className="space-y-1.5"><Label>Needed By Date</Label><Controller control={form.control} name="neededByDate" render={({ field }) => <DateInput value={field.value || ""} onChange={field.onChange} />} /></div>
          <div className="space-y-1.5"><Label>Notes / Justification</Label><Textarea rows={2} {...form.register("notes")} placeholder="Why is this needed?" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-save-pr">{mutation.isPending ? "Saving…" : "Save as Draft"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TicketForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const invalidate = useInvalidate();
  const form = useForm({ defaultValues: { category: "hr_query", subject: "", description: "", priority: "medium" } });
  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/my-requests/tickets", data),
    onSuccess: () => { invalidate(); toast({ title: "Ticket submitted successfully" }); form.reset(); onClose(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  // Cancel / X discards input (fresh form next open).
  const handleClose = () => { form.reset(); onClose(); };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Raise Support Ticket</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Category</Label>
              <Select value={form.watch("category")} onValueChange={(v) => form.setValue("category", v)}>
                <SelectTrigger data-testid="select-ticket-cat"><SelectValue /></SelectTrigger>
                <SelectContent>{["hr_query", "stationery", "office_repairs", "guest_access", "it_support", "payroll", "leave", "other"].map((c) => <SelectItem key={c} value={c}>{cap(c)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Priority</Label>
              <Select value={form.watch("priority")} onValueChange={(v) => form.setValue("priority", v)}>
                <SelectTrigger data-testid="select-ticket-pri"><SelectValue /></SelectTrigger>
                <SelectContent>{["low", "medium", "high", "critical"].map((c) => <SelectItem key={c} value={c}>{cap(c)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Subject *</Label><Input {...form.register("subject", { required: true })} placeholder="Brief subject…" /></div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea rows={3} {...form.register("description")} placeholder="Describe your issue in detail…" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-ticket">{mutation.isPending ? "Submitting…" : "Submit Ticket"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

