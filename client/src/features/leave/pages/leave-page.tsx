import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth, isHR, isManager } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar, FileText } from "lucide-react";
import { reqYear, yearOptions } from "../lib/leave-model";
import {
  useLeaveRequests, useLeaveTypes, useLeaveBalances, useLeaveLedger, useUpdateLeaveStatus,
} from "../api/leave.api";
import { LeaveRequestRow } from "../components/leave-ui";
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
  const [activeTab, setActiveTab] = useState("my-leaves");
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

  const years = yearOptions(currentYear);
  const tabs = [
    { key: "my-leaves", label: "My Requests" },
    ...((isHR(user!) || isManager(user!)) ? [{ key: "team-leaves", label: "Team Requests", badge: teamRequests.length }] : []),
    { key: "ledger", label: "Leave Ledger" },
    ...(isHR(user!) ? [{ key: "all-requests", label: "All Requests" }] : []),
  ] as { key: string; label: string; badge?: number }[];

  const canApproveAny = user?.role === "super_admin" || user?.role === "manager";

  return (
    <div className="p-6 space-y-6 max-w-[92rem] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leave Management</h1>
          <p className="text-sm text-muted-foreground">Manage leave requests, balances, approvals &amp; team availability</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-32" data-testid="select-leave-year"><Calendar className="h-4 w-4 mr-1 text-muted-foreground" /><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <div className="h-10 w-px bg-border mx-1" />
          <Button variant="secondary" size="sm" onClick={() => setShowPolicy(true)} data-testid="button-leave-policy"><FileText className="h-4 w-4 mr-1" /> Leave Policy</Button>
          <Button size="sm" onClick={() => setShowApply(true)} data-testid="button-apply-leave"><Plus className="h-4 w-4 mr-1" /> Apply Leave</Button>
        </div>
      </div>

      {!emp && <p className="text-sm text-muted-foreground italic" data-testid="text-no-emp-profile">No employee profile linked to your account.</p>}

      {/* Tab buttons */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <Button key={t.key} size="sm" variant={activeTab === t.key ? "default" : "secondary"} onClick={() => setActiveTab(t.key)} data-testid={`tab-${t.key}`}>
            {t.label}
            {t.badge ? <Badge className="ml-1.5 bg-[#FFA962]/20 text-[#FFA962] text-xs">{t.badge}</Badge> : null}
          </Button>
        ))}
      </div>

      {/* ===== My Requests ===== */}
      {activeTab === "my-leaves" && (
        <MyLeavesTab
          myYear={myYear}
          leaveTypes={leaveTypes}
          leaveBalances={leaveBalances}
          selectedYear={selectedYear}
          isLoading={lrLoading}
          onApply={() => setShowApply(true)}
          onCancelRequest={(id) => updateLeave.mutate({ id, status: "cancelled" })}
        />
      )}

      {/* ===== Team Requests ===== */}
      {activeTab === "team-leaves" && (isHR(user!) || isManager(user!)) && (
        <Card className="border-0">
          <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Team Leave Requests</CardTitle></CardHeader>
          <CardContent>
            {teamRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No pending team leave requests</div>
            ) : (
              <div className="list-divider">
                {teamRequests.map((req: any) => (
                  <LeaveRequestRow key={req.id} request={req} leaveTypes={leaveTypes} employees={employees} canApprove={canApproveAny}
                    onApprove={(id: string) => updateLeave.mutate({ id, status: "approved" })}
                    onReject={(id: string) => updateLeave.mutate({ id, status: "rejected" })} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===== Leave Ledger ===== */}
      {activeTab === "ledger" && <LeaveLedgerCard ledger={ledger} leaveTypes={leaveTypes} />}

      {/* ===== All Requests ===== */}
      {activeTab === "all-requests" && isHR(user!) && (
        <Card className="border-0">
          <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">All Leave Requests</CardTitle></CardHeader>
          <CardContent>
            {leaveRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No leave requests</div>
            ) : (
              <div className="list-divider">
                {leaveRequests.map((req: any) => (
                  <LeaveRequestRow key={req.id} request={req} leaveTypes={leaveTypes} employees={employees} canApprove={canApproveAny && req.status === "pending"}
                    onApprove={(id: string) => updateLeave.mutate({ id, status: "approved" })}
                    onReject={(id: string) => updateLeave.mutate({ id, status: "rejected" })} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ApplyLeaveDialog open={showApply} onOpenChange={setShowApply} employeeId={emp?.id} leaveTypes={leaveTypes} leaveBalances={leaveBalances} />
      <LeavePolicyDialog open={showPolicy} onOpenChange={setShowPolicy} leaveTypes={leaveTypes} canEdit={user?.role === "super_admin"} />
    </div>
  );
}
