import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth, isHR, isManager, isExecutive } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar, FileText, MoreVertical } from "lucide-react";
import { reqYear, yearOptions } from "../lib/leave-model";
import {
  useLeaveRequests, useLeaveTypes, useLeaveBalances, useLeaveLedger, useUpdateLeaveStatus, useEndLeaveRequest,
} from "../api/leave.api";
import { LeaveRequestsTable } from "../components/leave-ui";
import { MyLeavesTab } from "../components/my-leaves-tab";
import { LeaveLedgerCard } from "../components/leave-ledger-card";
import { ApplyLeaveDialog } from "../components/apply-leave-dialog";
import { LeavePolicyDialog } from "../components/leave-policy-dialog";

export default function LeavePage() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const emp = auth?.employee;
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();

  const [showApply, setShowApply] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  // Deep-link support: /leave?action=apply (used by the dashboard's Apply Leave button) opens the form.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("action") === "apply") setShowApply(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Deep-link the tab: /leave?tab=team-leaves (dashboard "Pending Leave Approvals") opens Team Requests.
  const [activeTab, setActiveTab] = useState(() => {
    const t = new URLSearchParams(window.location.search).get("tab") || "";
    return ["team-leaves", "ledger", "all-requests"].includes(t) ? t : "my-leaves";
  });
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: leaveRequests = [], isLoading: lrLoading } = useLeaveRequests();
  const { data: leaveTypes = [] } = useLeaveTypes();
  const { data: leaveBalances = [] } = useLeaveBalances(emp?.id, selectedYear);
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: ledger = [] } = useLeaveLedger(emp?.id);

  const myLeaveRequests = leaveRequests.filter((r: any) => r.employeeId === emp?.id);
  const teamRequests = leaveRequests.filter((r: any) => r.employeeId !== emp?.id && r.status === "pending");
  const myYear = myLeaveRequests.filter((r: any) => reqYear(r) === selectedYear);

  const updateLeave = useUpdateLeaveStatus({
    onSuccess: () => toast({ title: "Leave request updated" }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const endLeave = useEndLeaveRequest({
    onSuccess: () => toast({ title: "Leave ended", description: "Remaining days returned to your balance." }),
    onError: (e: any) => toast({ title: "Couldn't end leave", description: e.message, variant: "destructive" }),
  });

  const years = yearOptions(currentYear);
  // Executives (CEO/CTO) never apply for leave — no "My Requests"/Ledger, only the approvals view.
  const exec = isExecutive(user!);
  const tabs = [
    ...(!exec ? [{ key: "my-leaves", label: "My Requests" }] : []),
    ...((isHR(user!) || isManager(user!) || exec) ? [{ key: "team-leaves", label: "Team Requests", badge: teamRequests.length }] : []),
    ...(!exec ? [{ key: "ledger", label: "Leave Ledger" }] : []),
    ...(isHR(user!) ? [{ key: "all-requests", label: "All Requests" }] : []),
  ] as { key: string; label: string; badge?: number }[];
  // Fall back to the first visible tab when the stored one isn't available for this role.
  const currentTab = tabs.some((t) => t.key === activeTab) ? activeTab : (tabs[0]?.key ?? "my-leaves");

  const canApproveAny = user?.role === "super_admin" || user?.role === "manager" || exec;

  return (
    <div className="p-6 space-y-6 max-w-[92rem] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leave Management</h1>
          <p className="text-sm text-muted-foreground">Manage leave requests, balances, approvals &amp; team availability</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {/* Desktop: year + Leave Policy + Apply Leave inline (unchanged). */}
          <div className="hidden sm:flex items-center gap-2 flex-wrap">
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-32" data-testid="select-leave-year"><Calendar className="h-4 w-4 mr-1 text-muted-foreground" /><SelectValue /></SelectTrigger>
              <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <div className="w-px self-stretch bg-border mx-1" />
            <Button variant="secondary" size="sm" onClick={() => setShowPolicy(true)} data-testid="button-leave-policy"><FileText className="h-4 w-4 mr-1" /> Leave Policy</Button>
            {!exec && <Button size="sm" onClick={() => setShowApply(true)} data-testid="button-apply-leave"><Plus className="h-4 w-4 mr-1" /> Apply Leave</Button>}
          </div>
          {/* Mobile: keep the year Select + Apply Leave visible; Leave Policy folds into a kebab. */}
          <div className="flex sm:hidden items-center gap-2 w-full">
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-32" data-testid="select-leave-year-mobile"><Calendar className="h-4 w-4 mr-1 text-muted-foreground" /><SelectValue /></SelectTrigger>
              <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
            {!exec && <Button size="sm" onClick={() => setShowApply(true)} data-testid="button-apply-leave-mobile"><Plus className="h-4 w-4 mr-1" /> Apply Leave</Button>}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" className="ml-auto" aria-label="More actions" data-testid="button-leave-more-mobile"><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowPolicy(true)} data-testid="menu-leave-policy"><FileText className="h-4 w-4 mr-2" /> Leave Policy</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {!emp && <p className="text-sm text-muted-foreground italic" data-testid="text-no-emp-profile">No employee profile linked to your account.</p>}

      {/* Tab buttons */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <Button key={t.key} size="sm" variant={currentTab === t.key ? "default" : "secondary"} onClick={() => setActiveTab(t.key)} data-testid={`tab-${t.key}`}>
            {t.label}
            {t.badge ? <Badge className={`ml-1.5 text-xs ${currentTab === t.key ? "bg-white/25 text-white" : "bg-[#206295]/12 text-[#206295]"}`}>{t.badge}</Badge> : null}
          </Button>
        ))}
      </div>

      {/* ===== My Requests ===== */}
      {currentTab === "my-leaves" && (
        <MyLeavesTab
          myYear={myYear}
          leaveTypes={leaveTypes}
          leaveBalances={leaveBalances}
          selectedYear={selectedYear}
          isLoading={lrLoading}
          onApply={() => setShowApply(true)}
          onCancelRequest={(id) => { if (window.confirm("Cancel this leave request? Any deducted balance is restored.")) updateLeave.mutate({ id, status: "cancelled" }); }}
          onEndRequest={(id) => { if (window.confirm("End this leave from today? The remaining days are returned to your balance.")) endLeave.mutate(id); }}
        />
      )}

      {/* ===== Team Requests ===== */}
      {currentTab === "team-leaves" && (isHR(user!) || isManager(user!) || exec) && (
        <Card className="border-0">
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Team Leave Requests</CardTitle></CardHeader>
          <LeaveRequestsTable
            requests={teamRequests}
            leaveTypes={leaveTypes}
            employees={employees}
            canApprove={canApproveAny}
            emptyText="No pending team leave requests"
            onApprove={(id: string) => updateLeave.mutate({ id, status: "approved" })}
            onReject={(id: string) => updateLeave.mutate({ id, status: "rejected" })}
          />
        </Card>
      )}

      {/* ===== Leave Ledger ===== */}
      {currentTab === "ledger" && <LeaveLedgerCard ledger={ledger} leaveTypes={leaveTypes} />}

      {/* ===== All Requests ===== */}
      {currentTab === "all-requests" && isHR(user!) && (
        <Card className="border-0">
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">All Leave Requests</CardTitle></CardHeader>
          <LeaveRequestsTable
            requests={leaveRequests}
            leaveTypes={leaveTypes}
            employees={employees}
            canApprove={canApproveAny}
            emptyText="No leave requests"
            onApprove={(id: string) => updateLeave.mutate({ id, status: "approved" })}
            onReject={(id: string) => updateLeave.mutate({ id, status: "rejected" })}
          />
        </Card>
      )}

      <ApplyLeaveDialog open={showApply} onOpenChange={setShowApply} employeeId={emp?.id} leaveTypes={leaveTypes} leaveBalances={leaveBalances} />
      <LeavePolicyDialog open={showPolicy} onOpenChange={setShowPolicy} leaveTypes={leaveTypes} />
    </div>
  );
}
