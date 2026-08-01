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
import {
  ShoppingCart, Car, TicketIcon, Receipt, Plus, Trash2, ClipboardList,
  ShieldCheck, ArrowRight, ChevronLeft, Check, X, Users, Truck, ChevronRight,
  CalendarClock, ExternalLink, FileText, IndianRupee, MoreVertical, Eye, Download,
  Maximize2, ArrowDownUp, Building2, Hash, Paperclip, Clock, MousePointerClick, CheckSquare, CalendarRange,
} from "lucide-react";
import { format } from "date-fns";
import { ReimbursementFormDialog } from "@/components/reimbursement-form";
import { ReimbursementApprovalModal, exportReimbursement } from "@/components/reimbursement-approval-detail";
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


const REQ_PENDING = ["submitted", "in_review", "pending_ceo", "changes_requested"];
const MOV_PENDING = ["submitted", "needs_approval"];

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
  const canApprove = isApprover || canReimbApprove;

  // View is URL-driven so navigating to My Approvals updates the browser URL (and is shareable / back-button friendly)
  const view: "main" | "approvals" = location === "/my-approvals" ? "approvals" : "main";
  const setView = (v: "main" | "approvals") => navigate(v === "approvals" ? "/my-approvals" : "/company-workspace");
  const [openForm, setOpenForm] = useState<null | "purchase" | "travel" | "ticket" | "reimbursement">(null);
  const [apprTab, setApprTab] = useState<"requests" | "logistics" | "vehicles" | "reimbursements">("requests");

  // ---- data ----
  const { data: summary, isLoading: sumLoading } = useQuery<any>({ queryKey: ["/api/my-requests/summary"] });
  const { data: purchases = [] } = useQuery<any[]>({ queryKey: ["/api/my-requests/purchases"] });
  const { data: travels = [] } = useQuery<any[]>({ queryKey: ["/api/my-requests/travels"] });
  const { data: tickets = [] } = useQuery<any[]>({ queryKey: ["/api/my-requests/tickets"] });
  const { data: reimb = [] } = useQuery<any[]>({ queryKey: ["/api/reimbursements"] });
  const { data: teamData } = useQuery<any>({ queryKey: ["/api/team-requests"], enabled: canTeam, retry: false });

  // approval domains (super-admin / CEO)
  const { data: svcRequests = [] } = useQuery<any[]>({ queryKey: ["/api/requests"], enabled: isApprover });
  const { data: movements = [] } = useQuery<any[]>({ queryKey: ["/api/logistics/movements"], enabled: isApprover });
  const { data: bookings = [] } = useQuery<any[]>({ queryKey: ["/api/vehicles/bookings"], enabled: isApprover });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"], enabled: isApprover });

  const nameByUser = useMemo(() => {
    const m: Record<string, string> = {};
    employees.forEach((e: any) => { if (e.userId) m[e.userId] = `${e.firstName} ${e.lastName}`; });
    return m;
  }, [employees]);
  const reqName = (uid: string) => (uid === user?.id ? "You" : nameByUser[uid] || "—");

  const now = Date.now();
  const pendingSvc = useMemo(() => (svcRequests as any[]).filter((r) => REQ_PENDING.includes(r.status)), [svcRequests]);
  const pendingMov = useMemo(() => (movements as any[]).filter((m) => MOV_PENDING.includes(m.status)), [movements]);
  const pendingVeh = useMemo(() => (bookings as any[]).filter((b) => b.status !== "cancelled" && +new Date(b.endTime || b.startTime || 0) >= now), [bookings, now]);
  // Reimbursement approval queue, stage-aware:
  //  - Finance sees "submitted" (first review) · CEO sees "finance_approved" (final) · super_admin sees both
  const pendingReimb = useMemo(() => (reimb as any[]).filter((r) => {
    if (r.requesterId === user?.id) return false; // don't approve your own claim
    if (r.status === "submitted") return canFinanceReimb;       // Finance reviews
    if (r.status === "finance_approved") return canCeoReimb;    // CEO finalises
    return false;
  }), [reimb, canFinanceReimb, canCeoReimb, user?.id]);
  const apprTotal = (isApprover ? pendingSvc.length + pendingMov.length + pendingVeh.length : 0) + (canReimbApprove ? pendingReimb.length : 0);
  const pendingReimbAmount = useMemo(() => reimb.filter((r: any) => r.status === "submitted").reduce((s: number, r: any) => s + Number(r.totalAmount || 0), 0), [reimb]);

  const myOpen =
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
  }, [purchases, travels, tickets, reimb, svcRequests, movements, isApprover, nameByUser, now, user?.id]);

  const [detail, setDetail] = useState<any>(null);

  // ===================== Detailed: My Approvals =====================
  if (view === "approvals") {
    const tabs = [
      ...(isApprover ? [
        { key: "requests", label: "Service Requests", count: pendingSvc.length, icon: TicketIcon },
        { key: "logistics", label: "Logistics", count: pendingMov.length, icon: Truck },
        { key: "vehicles", label: "Vehicles", count: pendingVeh.length, icon: Car },
      ] : []),
      ...(canReimbApprove ? [{ key: "reimbursements", label: "Reimbursements", count: pendingReimb.length, icon: Receipt }] : []),
    ] as { key: string; label: string; count: number; icon: any }[];
    const effectiveTab = tabs.some((t) => t.key === apprTab) ? apprTab : tabs[0]?.key;
    return (
      <div className="p-6 space-y-6 max-w-[92rem] mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="icon" className="h-10 w-10 flex-shrink-0" onClick={() => setView("main")} aria-label="Back" data-testid="button-back-workspace"><ChevronLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Approvals</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{apprTotal} item{apprTotal !== 1 ? "s" : ""} awaiting your action</p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {tabs.map((t) => (
            <Button key={t.key} size="sm" variant={effectiveTab === t.key ? "default" : "secondary"} onClick={() => setApprTab(t.key as any)} data-testid={`appr-tab-${t.key}`}>
              <t.icon className="h-4 w-4 mr-1" /> {t.label}{t.count > 0 ? ` (${t.count})` : ""}
            </Button>
          ))}
        </div>

        {effectiveTab === "requests" && <ListApprovals allItems={svcRequests} navigate={navigate} name="Service Requests"
          isPending={(r) => REQ_PENDING.includes(r.status)} dateOf={(r) => r.createdAt} reviewHref={() => "/requests"}
          render={(r) => ({ title: r.title || cap(r.type) || "Service request", sub: `${reqName(r.requesterId)} · ${cap(r.routeToTeam || "")}`, status: r.status, date: r.createdAt })}
          columns={[
            { label: "Request", cell: (r) => <span className="font-medium text-foreground">{r.title || cap(r.type) || "Service request"}</span> },
            { label: "Requester", cell: (r) => reqName(r.requesterId) },
            { label: "Team", cell: (r) => <span className="capitalize text-muted-foreground">{cap(r.routeToTeam || "—")}</span> },
            { label: "Status", cell: (r) => <Badge className={`text-xs ${statusClass(r.status)}`}>{statusLabel(r.status)}</Badge> },
            { label: "Submitted", cell: (r) => (r.createdAt ? fmtDate(r.createdAt) : "—") },
            { label: "Handled By", cell: (r) => (r.assignedToId ? reqName(r.assignedToId) : "—") },
          ]}
          emptyPending="No service requests pending" emptyCompleted="No completed service requests" />}

        {effectiveTab === "logistics" && <LogisticsApprovals items={movements} reqName={reqName} navigate={navigate} canApprove={isApprover} />}

        {effectiveTab === "vehicles" && <ListApprovals allItems={bookings} navigate={navigate} name="Vehicle Bookings"
          isPending={(b) => b.status !== "cancelled" && +new Date(b.endTime || b.startTime || 0) >= now} dateOf={(b) => b.startTime} reviewHref={() => "/vehicles"}
          render={(b) => ({ title: b.purpose || "Vehicle booking", sub: `${reqName(b.requesterId)} · ${fmtDate(b.startTime)}`, status: b.status, date: b.startTime })}
          columns={[
            { label: "Purpose", cell: (b) => <span className="font-medium text-foreground">{b.purpose || "Vehicle booking"}</span> },
            { label: "Requester", cell: (b) => reqName(b.requesterId) },
            { label: "Start", cell: (b) => (b.startTime ? fmtDate(b.startTime) : "—") },
            { label: "End", cell: (b) => (b.endTime ? fmtDate(b.endTime) : "—") },
            { label: "Status", cell: (b) => <Badge className={`text-xs ${statusClass(b.status)}`}>{statusLabel(b.status)}</Badge> },
          ]}
          emptyPending="No upcoming vehicle bookings" emptyCompleted="No past vehicle bookings" />}

        {effectiveTab === "reimbursements" && <ReimbApprovals items={pendingReimb} allItems={reimb} nameByUser={nameByUser} allowBulk={canCeoReimb} />}
        {tabs.length === 0 && <Card className="border-0"><CardContent className="p-10 text-center text-sm text-muted-foreground">Nothing awaiting your approval.</CardContent></Card>}
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
          <StatCard title="Pending Purchases" value={summary?.purchases?.pending || 0} subtitle="awaiting action" icon={ShoppingCart} color="bg-[#206295]/15 text-[#206295]" />
          <StatCard title="Pending Travels" value={summary?.travels?.pending || 0} subtitle="awaiting action" icon={Car} color="bg-[#4BDCD9]/25 text-[#206295]" />
          <StatCard title="Open Tickets" value={summary?.tickets?.open || 0} subtitle="in progress" icon={TicketIcon} color="bg-[#206295]/15 text-[#206295]" />
          <StatCard title="Pending Reimbursements" value={money(pendingReimbAmount)} subtitle="awaiting approval" icon={Receipt} color="bg-[#FF6F62]/20 text-[#FF6F62]" />
        </div>
      )}

      {/* Service Catalog */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Service Catalog</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {SERVICES.map((s) => (
            <button key={s.key} onClick={() => setOpenForm(s.key)} data-testid={`service-${s.key}`} className="text-left focus:outline-none">
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
        <Card className="border-0"><CardContent className="p-0 overflow-x-auto">
          {recent.length === 0 ? (
            <div className="text-center py-12"><ClipboardList className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No activity in the last 7 days.</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground">
                <th className="p-3">Requester</th><th className="p-3">Type</th><th className="p-3">Details</th><th className="p-3">Status</th><th className="p-3">Approved By</th><th className="p-3">Date</th>
              </tr></thead>
              <tbody className="list-divider">
                {recent.map((r: any) => (
                  <tr key={`${r.type}-${r.id}`} className="hover-elevate cursor-pointer" onClick={() => setDetail(r)} data-testid={`activity-${r.id}`}>
                    <td className="p-3 text-foreground">{r.requester}</td>
                    <td className="p-3 text-muted-foreground">{r.type}</td>
                    <td className="p-3 text-foreground/80 max-w-[18rem] truncate">{r.details}</td>
                    <td className="p-3"><Badge className={`text-xs ${statusClass(r.status)}`}>{statusLabel(r.status)}</Badge></td>
                    <td className="p-3 text-muted-foreground">{r.approvedBy}</td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">{fmtDate(r.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent></Card>
      </div>

      {/* Service forms (open directly) */}
      <PurchaseForm open={openForm === "purchase"} onClose={() => setOpenForm(null)} />
      <TravelForm open={openForm === "travel"} onClose={() => setOpenForm(null)} />
      <TicketForm open={openForm === "ticket"} onClose={() => setOpenForm(null)} />
      <ReimbursementFormDialog open={openForm === "reimbursement"} onClose={() => setOpenForm(null)} />

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

const LIST_PAGE_SIZE = 8;

// Generic Pending/Completed approvals panel for the non-reimbursement tabs (service requests, logistics, vehicles).
// Mirrors the reimbursement tab layout: phase toggle + date range (+ export on Completed), pending list + completed table.
function ListApprovals({ allItems, isPending, dateOf, render, navigate, reviewHref, name, columns, actions, emptyPending, emptyCompleted }: {
  allItems: any[];
  isPending: (x: any) => boolean;
  dateOf: (x: any) => any;
  render: (x: any) => { title: string; sub: string; status: string; date?: any };
  navigate: (h: string) => void;
  reviewHref: (x: any) => string;
  name: string;
  columns: { label: string; align?: "right" | "center"; cell: (x: any) => any }[];
  actions?: (x: any) => any;
  emptyPending: string;
  emptyCompleted: string;
}) {
  const [phase, setPhase] = useState<"pending" | "completed">("pending");
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({});
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date_desc");
  const [page, setPage] = useState(1);

  const baseList = useMemo(() => allItems.filter((x) => (phase === "pending" ? isPending(x) : !isPending(x))), [allItems, phase, isPending]);
  const statuses = useMemo(() => Array.from(new Set(baseList.map((x) => render(x).status).filter(Boolean))), [baseList, render]);
  const filtered = useMemo(() => baseList.filter((x) => {
    if (statusFilter !== "all" && render(x).status !== statusFilter) return false;
    if (!dayInRange(dateOf(x), range)) return false;
    return true;
  }), [baseList, statusFilter, range, dateOf, render]);
  const sorted = useMemo(() => {
    const s = [...filtered];
    s.sort((a, b) => { const da = +new Date(dateOf(a) || 0), db = +new Date(dateOf(b) || 0); return sortBy === "date_asc" ? da - db : db - da; });
    return s;
  }, [filtered, sortBy, dateOf]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / LIST_PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageItems = sorted.slice((curPage - 1) * LIST_PAGE_SIZE, curPage * LIST_PAGE_SIZE);
  const hasRange = !!(range.from || range.to);

  const doExport = () => exportXlsx({
    filename: `${name.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.xlsx`,
    sheet: name.slice(0, 28),
    title: `${name}${rangeSuffix(range)}`,
    headers: ["Request", "Details", "Status", "Date"],
    rows: sorted.map((x) => { const d = render(x); return [d.title, d.sub, statusLabel(d.status), d.date ? fmtDate(d.date) : ""]; }),
  });

  const phaseToggle = (
    <div className="segmented-toggle inline-flex p-0.5 h-9 flex-shrink-0">
      <button onClick={() => { setPhase("pending"); setPage(1); }} className={`px-3 h-full rounded-[10px] text-xs font-medium ${phase === "pending" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`} data-testid="phase-pending">Pending</button>
      <button onClick={() => { setPhase("completed"); setPage(1); }} className={`px-3 h-full rounded-[10px] text-xs font-medium ${phase === "completed" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`} data-testid="phase-completed">Completed</button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* ===== Toolbar: phase toggle · date range · export · pagination ===== */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {phaseToggle}
          <div className="h-7 w-px bg-foreground/30 mx-0.5" />
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[150px] text-xs" data-testid="filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statuses.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-9 w-[150px] text-xs" data-testid="sort-list"><ArrowDownUp className="h-3.5 w-3.5 mr-1 text-muted-foreground" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Newest first</SelectItem>
              <SelectItem value="date_asc">Oldest first</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <ApprovalDateRange value={range} onChange={(v) => { setRange(v); setPage(1); }} />
          {phase === "completed" && (
            <Button variant="secondary" size="sm" className="h-9" disabled={sorted.length === 0} onClick={doExport} data-testid="appr-export"><Download className="h-4 w-4 mr-1.5" /> Export ({sorted.length})</Button>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)} data-testid="page-prev"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="px-1 tabular-nums">{curPage} / {totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={curPage >= totalPages} onClick={() => setPage(curPage + 1)} data-testid="page-next"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      {/* ===== Completed: table view ===== */}
      {phase === "completed" && (
        sorted.length === 0 ? (
          <div className="card-surface rounded-2xl py-16 text-center"><Check className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">{emptyCompleted}{hasRange ? " in this date range" : ""}.</p></div>
        ) : (
          <div className="card-surface rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground text-left">
                  {columns.map((c) => <th key={c.label} className={`px-4 py-2.5 font-medium whitespace-nowrap ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}`}>{c.label}</th>)}
                  <th className="px-4 py-2.5 font-medium text-center">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {pageItems.map((x: any) => (
                  <tr key={x.id} className="hover-elevate cursor-pointer" onClick={() => navigate(reviewHref(x))} data-testid={`completed-row-${x.id}`}>
                    {columns.map((c) => <td key={c.label} className={`px-4 py-3 ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}`}>{c.cell(x)}</td>)}
                    <td className="px-4 py-3 text-center"><Button size="sm" variant="ghost" className="h-8 text-[#206295]" onClick={(e) => { e.stopPropagation(); navigate(reviewHref(x)); }} data-testid={`view-row-${x.id}`}><Eye className="h-3.5 w-3.5 mr-1" /> View</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ===== Pending: list ===== */}
      {phase === "pending" && (
        sorted.length === 0 ? (
          <div className="card-surface rounded-2xl py-16 text-center"><Check className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">{emptyPending}{hasRange ? " in this date range" : ""}.</p></div>
        ) : (
          <Card className="border-0"><CardContent className="p-0">
            <div className="list-divider px-4">
              {pageItems.map((x: any) => { const d = render(x); return (
                <div key={x.id} className="flex items-center gap-3 py-3 flex-wrap cursor-pointer hover-elevate -mx-2 px-2 rounded-lg" onClick={() => navigate(reviewHref(x))} data-testid={`appr-item-${x.id}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{d.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{d.sub}</p>
                  </div>
                  <Badge className={`text-xs ${statusClass(d.status)}`}>{cap(d.status)}</Badge>
                  {actions ? actions(x) : <Button size="sm" variant="outline" className="h-8 text-xs" onClick={(e) => { e.stopPropagation(); navigate(reviewHref(x)); }}>Review</Button>}
                </div>
              ); })}
            </div>
          </CardContent></Card>
        )
      )}
    </div>
  );
}

// Logistics wrapper — owns the approve/reject mutation, delegates layout to ListApprovals.
function LogisticsApprovals({ items, reqName, navigate, canApprove }: { items: any[]; reqName: (u: string) => string; navigate: (h: string) => void; canApprove: boolean; }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const act = useMutation({
    mutationFn: ({ id, action, note }: any) => apiRequest("POST", `/api/logistics/movements/${id}/${action}`, note ? { note } : {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/logistics/movements"] }); toast({ title: "Updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  return (
    <ListApprovals
      allItems={items}
      isPending={(m) => MOV_PENDING.includes(m.status)}
      dateOf={(m) => m.createdAt}
      render={(m) => ({ title: m.title || m.notes || "Stock / asset movement", sub: `${reqName(m.requesterId)} · ${fmtDate(m.createdAt)}`, status: m.status, date: m.createdAt })}
      navigate={navigate}
      reviewHref={() => "/logistics"}
      name="Logistics Movements"
      columns={[
        { label: "Reference", cell: (m) => <span className="font-medium text-foreground">{m.reference || m.title || m.notes || "Movement"}</span> },
        { label: "Requester", cell: (m) => reqName(m.requesterId) },
        { label: "Status", cell: (m) => <Badge className={`text-xs ${statusClass(m.status)}`}>{statusLabel(m.status)}</Badge> },
        { label: "Date", cell: (m) => (m.createdAt ? fmtDate(m.createdAt) : "—") },
      ]}
      actions={(m) => (canApprove && m.status === "needs_approval" ? (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" className="h-8 text-xs text-[#FF6F62] border-[#FF6F62]/30" disabled={act.isPending}
            onClick={() => { const note = window.prompt("Reason for rejection?"); if (note) act.mutate({ id: m.id, action: "reject", note }); }}><X className="h-3.5 w-3.5 mr-1" /> Reject</Button>
          <Button size="sm" className="h-8 text-xs" disabled={act.isPending} onClick={() => act.mutate({ id: m.id, action: "approve" })}><Check className="h-3.5 w-3.5 mr-1" /> Approve</Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={(e) => { e.stopPropagation(); navigate("/logistics"); }}>Review</Button>
      ))}
      emptyPending="No logistics movements pending"
      emptyCompleted="No completed logistics movements"
    />
  );
}

// Priority is derived purely from the claim amount (brand-only colors).
const reimbPriority = (amt: number) =>
  amt >= 50000 ? { label: "High", cls: "bg-[#FF6F62]/15 text-[#FF6F62]" }
  : amt >= 10000 ? { label: "Medium", cls: "bg-[#206295]/15 text-[#206295]" }
  : { label: "Low", cls: "bg-[#64748B]/15 text-[#64748B]" };

// Category badge colors drawn from the brand palette (deterministic per category).
const CAT_PALETTE = ["#206295", "#0E7C7B", "#425B8D", "#64748B"];
const catStyle = (cat: string) => { const c = CAT_PALETTE[Math.abs([...(cat || "?")].reduce((a, ch) => a + ch.charCodeAt(0), 0)) % CAT_PALETTE.length]; return { color: c, backgroundColor: `${c}1f` }; };

const REIMB_PAGE_SIZE = 6;

// Premium card-based reimbursement approvals list. Finance = individual; CEO = + bulk.
function ReimbApprovals({ items, allItems = [], nameByUser = {}, allowBulk }: { items: any[]; allItems?: any[]; nameByUser?: Record<string, string>; allowBulk: boolean }) {
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
  const [sortBy, setSortBy] = useState("date_desc");
  const [page, setPage] = useState(1);
  const inRange = (d: any) => dayInRange(d, range);
  const approvedByName = (r: any) => nameByUser[r.approvedById] || nameByUser[r.financeApprovedById] || "—";

  const invalidate = () => qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/reimbursements") });
  const approve = useMutation({
    mutationFn: async (ids: string[]) => { for (const id of ids) await apiRequest("POST", `/api/reimbursements/${id}/approve`, {}); },
    onSuccess: () => { invalidate(); setSel(new Set()); toast({ title: "Reimbursement(s) approved" }); },
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
    return true;
  }), [baseList, priorityFilter, catFilter, range]);
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

  const totalPages = Math.max(1, Math.ceil(sorted.length / REIMB_PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageItems = sorted.slice((curPage - 1) * REIMB_PAGE_SIZE, curPage * REIMB_PAGE_SIZE);
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

  return (
    <div className="space-y-4">
      {/* ===== Toolbar: filters · sort · pagination · select ===== */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {phaseToggle}
          <div className="h-7 w-px bg-foreground/30 mx-0.5" />
          <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[130px] text-xs" data-testid="filter-priority"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={catFilter} onValueChange={(v) => { setCatFilter(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[150px] text-xs" data-testid="filter-category"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-9 w-[160px] text-xs" data-testid="sort-reimb"><ArrowDownUp className="h-3.5 w-3.5 mr-1 text-muted-foreground" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Newest first</SelectItem>
              <SelectItem value="date_asc">Oldest first</SelectItem>
              <SelectItem value="amount_desc">Amount: High → Low</SelectItem>
              <SelectItem value="amount_asc">Amount: Low → High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          {dateRange}
          {phase === "completed" && (
            <Button variant="secondary" size="sm" className="h-9" onClick={() => doExport(sorted)} data-testid="button-export-reimb"><Download className="h-4 w-4 mr-1" /> Export</Button>
          )}
          {allowBulk && phase === "pending" && !selectionMode && (
            <Button variant="secondary" size="sm" className="h-9" onClick={() => setSelectionMode(true)} data-testid="button-select">
              <MousePointerClick className="h-4 w-4 mr-1" /> Select
            </Button>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)} data-testid="page-prev"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="px-1 tabular-nums">{curPage} / {totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={curPage >= totalPages} onClick={() => setPage(curPage + 1)} data-testid="page-next"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      {/* ===== Selection bar (CEO bulk approval) ===== */}
      {allowBulk && selectionMode && (
        <Card className="border-0"><CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={toggleAll} data-testid="button-select-all"><CheckSquare className="h-4 w-4 mr-1" /> Select All</Button>
            <span className="text-sm font-medium">{sel.size} selected</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-end gap-0.5">
              <IndianRupee className="h-6 w-6 text-[#206295] mb-0.5" />
              <span className="text-2xl font-bold text-[#206295] tracking-tight tabular-nums">{selectedTotal.toLocaleString("en-IN")}</span>
            </div>
            <div className="h-9 w-px bg-foreground/30" />
            <Button size="sm" variant="outline" className="h-9 text-[#FF6F62] border-[#FF6F62]/40 hover:bg-[#FF6F62]/10" disabled={sel.size === 0 || rejectAll.isPending} onClick={rejectAllConfirm} data-testid="button-reject-all"><X className="h-4 w-4 mr-1.5" /> Reject All</Button>
            <Button size="sm" className="h-9 btn-primary-gradient" disabled={sel.size === 0 || approve.isPending} onClick={approveAll} data-testid="button-approve-all"><Check className="h-4 w-4 mr-1.5" /> Approve All</Button>
            <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={exitSelection} aria-label="Exit selection" data-testid="button-exit-selection"><X className="h-4 w-4" /></Button>
          </div>
        </CardContent></Card>
      )}

      {/* ===== Completed: table view ===== */}
      {phase === "completed" && (
        sorted.length === 0 ? (
          <div className="card-surface rounded-2xl p-10 text-center text-sm text-muted-foreground">No completed reimbursements{range.from || range.to ? " in this date range" : ""}.</div>
        ) : (
          <div className="card-surface rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground text-left">
                  <th className="px-4 py-2.5 font-medium">Reference</th>
                  <th className="px-4 py-2.5 font-medium">Requester</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                  <th className="px-4 py-2.5 font-medium whitespace-nowrap">Submitted</th>
                  <th className="px-4 py-2.5 font-medium whitespace-nowrap">Decision Date</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Approved By</th>
                  <th className="px-4 py-2.5 font-medium text-center">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {pageItems.map((r: any) => (
                  <tr key={r.id} className="hover-elevate cursor-pointer" onClick={() => openDetail(r)} data-testid={`completed-reimb-${r.id}`}>
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{r.reference}</td>
                    <td className="px-4 py-3 text-foreground">{r.employeeName || "—"}<span className="text-muted-foreground"> ({r.employeeCode || "—"})</span></td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{r.category || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap">{money(r.totalAmount)}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.createdAt ? format(new Date(r.createdAt), "dd MMM yyyy") : "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.updatedAt ? format(new Date(r.updatedAt), "dd MMM yyyy") : "—"}</td>
                    <td className="px-4 py-3"><Badge className={`text-xs ${statusClass(r.status)}`}>{statusLabel(r.status)}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground">{approvedByName(r)}</td>
                    <td className="px-4 py-3 text-center"><Button size="sm" variant="ghost" className="h-8 text-[#206295]" onClick={() => openDetail(r)} data-testid={`view-completed-${r.id}`}><Eye className="h-3.5 w-3.5 mr-1" /> View</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ===== Pending: cards ===== */}
      {phase === "pending" && (
        sorted.length === 0 ? (
          <div className="card-surface rounded-2xl py-16 text-center"><Check className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No reimbursements awaiting your approval{range.from || range.to ? " in this date range" : ""}.</p></div>
        ) : (
      <div className="space-y-3">
        {pageItems.map((r: any) => {
          const amt = Number(r.totalAmount || 0);
          const pr = reimbPriority(amt);
          return (
            <div key={r.id} data-testid={`appr-reimb-${r.id}`}
              className={`group card-surface card-hover relative p-6 cursor-pointer ${selectionMode && sel.has(r.id) ? "ring-2 ring-[#206295]" : ""}`}
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

              <div className="flex items-center gap-6">
                {allowBulk && selectionMode && (
                  <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                    <Checkbox checked={sel.has(r.id)} onCheckedChange={() => toggle(r.id)} data-testid={`select-reimb-${r.id}`} />
                  </div>
                )}

                {/* Identity — reading flow: reference → amount → employee */}
                <div className="flex-1 min-w-0 pr-6">
                  {/* 1 · Reference (heading) */}
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-[13px] font-semibold tracking-wide text-foreground truncate">{r.reference}</span>
                    <Badge className="text-[10px] px-2 py-0.5 capitalize" style={catStyle(r.category || "other")}>{r.category || "—"}</Badge>
                  </div>
                  {/* 2 · Amount (primary emphasis — blue) */}
                  <div className="flex items-end gap-1 mt-1.5">
                    <IndianRupee className="h-7 w-7 text-[#206295] mb-1" />
                    <span className="text-[2.1rem] leading-none font-bold text-[#206295] tracking-tight tabular-nums">{amt.toLocaleString("en-IN")}</span>
                  </div>
                  {/* 3 · Employee · HOD · Purpose (one line, small vertical separators) */}
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
                <div className="self-center w-[1.4px] h-24 rounded-full bg-foreground/30 flex-shrink-0" />

                {/* Meta group — icon top-right, teal label, bolder value; items divided by separators */}
                <div className="flex items-stretch gap-6 flex-shrink-0">
                  <div className="min-w-[104px]">
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
                  <Separator orientation="vertical" className="h-14" />
                  <div className="min-w-[104px]">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-[12px] uppercase tracking-wide text-muted-foreground mt-1">Department</p>
                    <p className="text-sm font-semibold text-foreground mt-1 truncate max-w-[150px]">{r.department || "—"}</p>
                  </div>
                  <Separator orientation="vertical" className="h-14" />
                  <div className="min-w-[88px]">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-[12px] uppercase tracking-wide text-muted-foreground mt-1">Priority</p>
                    <Badge className={`text-[10px] px-2 py-0.5 mt-1.5 font-semibold ${pr.cls}`}>{pr.label}</Badge>
                  </div>
                </div>

                {!selectionMode && (
                  <>
                    <Separator orientation="vertical" className="h-16" />
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
        })}
      </div>
        )
      )}

      {detail && (
        <ReimbursementApprovalModal
          reimb={detail}
          canAct={detail.status !== "approved" && detail.status !== "rejected"}
          open={!!detail}
          onClose={() => setDetail(null)}
          onExpand={() => { const id = detail.id; setDetail(null); navigate(`/my-approvals/reimbursement/${id}`); }}
        />
      )}
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

function TravelForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const invalidate = useInvalidate();
  const form = useForm({ defaultValues: { purpose: "", fromCity: "", toCity: "", travelDate: "", returnDate: "", preferences: "", estimatedBudget: "" } });
  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/my-requests/travels", { ...data, travelDate: data.travelDate || null, returnDate: data.returnDate || null, estimatedBudget: data.estimatedBudget ? Number(data.estimatedBudget) : null }),
    onSuccess: () => { invalidate(); toast({ title: "Travel request created as draft" }); form.reset(); onClose(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  // Cancel / X discards input (fresh form next open).
  const handleClose = () => { form.reset(); onClose(); };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New Travel Request</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5"><Label>Purpose *</Label><Textarea rows={2} {...form.register("purpose", { required: true })} placeholder="Business purpose for travel…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>From City *</Label><Input {...form.register("fromCity", { required: true })} placeholder="e.g. Bengaluru" /></div>
            <div className="space-y-1.5"><Label>To City *</Label><Input {...form.register("toCity", { required: true })} placeholder="e.g. Mumbai" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Travel Date *</Label><Controller control={form.control} name="travelDate" rules={{ required: true }} render={({ field }) => <DateInput value={field.value || ""} onChange={field.onChange} />} /></div>
            <div className="space-y-1.5"><Label>Return Date</Label><Controller control={form.control} name="returnDate" render={({ field }) => <DateInput value={field.value || ""} onChange={field.onChange} />} /></div>
          </div>
          <div className="space-y-1.5"><Label>Preferences / Constraints</Label><Textarea rows={2} {...form.register("preferences")} placeholder="Mode, hotel preferences, dietary needs…" /></div>
          <div className="space-y-1.5"><Label>Estimated Budget (₹)</Label><Input type="number" min="0" {...form.register("estimatedBudget")} placeholder="0" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-save-tr">{mutation.isPending ? "Saving…" : "Save as Draft"}</Button>
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

