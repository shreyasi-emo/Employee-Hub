import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/shared/data-table";
import { ShoppingCart, Car, TicketIcon, Receipt, ClipboardList, ShieldCheck, ArrowRight, Users, CalendarClock } from "lucide-react";
import { NewRequestDialog } from "@/features/company-workspace/office-purchases/components/office-purchase";
import { NewTravelDialog } from "@/features/company-workspace/travel/components/travel";
import { ReimbursementFormDialog } from "@/features/company-workspace/reimbursements/components/reimbursement-form";
import { statusClass, statusLabel } from "@/lib/status";
import { money, fmtDate, SERVICES } from "../shared/approval-format";
import { StatCard, NavCard } from "../components/approval-ui";
import { ActivityDetailModal } from "../components/activity-detail-modal";
import { TicketForm } from "../tickets/components/ticket-form";
import { useWorkspaceData } from "../api/workspace.api";
import { appendDraft } from "../shared/drafts";

// /company-workspace — the office-operations hub. Four overview figures, the service catalog
// that raises a request, navigation into My Requests / Team Requests / My Approvals, and the
// last seven days of activity. Each service card opens its own form.
export default function CompanyWorkspacePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const {
    canTeam, canApprove, canReimbApprove,
    summary, sumLoading, travels,
    myOpenOp, myOpen, teamOpen, apprTotal, pendingReimbAmount, pendingReimbCount, recent,
  } = useWorkspaceData("main");

  const [openForm, setOpenForm] = useState<null | "purchase" | "travel" | "ticket" | "reimbursement">(null);
  const [newReqOpen, setNewReqOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  // Drafts raised here go to the same store My Requests → Drafts reads from.
  const saveDraft = (type: string, data: any) => {
    if (appendDraft(type, data)) toast({ title: "Saved to Drafts" });
    else toast({ title: "Could not save draft", description: "Local storage is full.", variant: "destructive" });
  };

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
          {/* Money, not a count — the subtitle names the claims so it can't be read as a fourth count. */}
          <StatCard title="Pending Reimbursements" value={money(pendingReimbAmount)} subtitle={`${pendingReimbCount} ${pendingReimbCount === 1 ? "claim" : "claims"} ${canReimbApprove ? "awaiting your approval" : "pending"}`} icon={Receipt} color="bg-[#FF6F62]/20 text-[#FF6F62]" />
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
          {canApprove && <NavCard title="My Approvals" count={apprTotal} subtitle="awaiting action" icon={ShieldCheck} onClick={() => navigate("/my-approvals")} />}
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

      {/* Service forms (open directly). Each takes onSaveDraft so a half-finished request can be
          kept here too — drafts land in the one drafts store and are finished from
          My Requests → Drafts. Without it these dialogs hide their "Save as Draft" button. */}
      <NewTravelDialog open={openForm === "travel"} onClose={() => setOpenForm(null)} onSaveDraft={(data) => saveDraft("trip", data)} />
      <TicketForm open={openForm === "ticket"} onClose={() => setOpenForm(null)} onSaveDraft={(data: any) => saveDraft("ticket", data)} />
      <ReimbursementFormDialog open={openForm === "reimbursement"} onClose={() => setOpenForm(null)} onSaveDraft={(data) => saveDraft("reimbursement", data)} />
      <NewRequestDialog open={newReqOpen} onClose={() => setNewReqOpen(false)} onSaveDraft={(data) => saveDraft(data.kind === "procurement" ? "procurement" : "office", data)} />

      {detail && <ActivityDetailModal row={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
