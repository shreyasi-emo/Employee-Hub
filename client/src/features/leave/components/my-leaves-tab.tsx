import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/shared/data-table";
import { Plane, Clock, Search, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { statusOf, canCancel, findCasualLeaveType } from "../lib/leave-model";
import { StatCard } from "./leave-ui";

/** The employee's own requests: four stat cards, filters, and the table.
 *  Owns its own search/status/type filter state. */
export function MyLeavesTab({ myYear, leaveTypes, leaveBalances, selectedYear, isLoading, onApply, onCancelRequest }: {
  myYear: any[];
  leaveTypes: any[];
  leaveBalances: any[];
  selectedYear: number;
  isLoading: boolean;
  onApply: () => void;
  onCancelRequest: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const filteredMy = myYear.filter((r: any) => {
    const lt = leaveTypes.find((l: any) => l.id === r.leaveTypeId);
    const matchSearch = !search || (lt?.name || "").toLowerCase().includes(search.toLowerCase()) || (r.reason || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    const matchType = typeFilter === "all" || r.leaveTypeId === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const clType = findCasualLeaveType(leaveTypes);
  const clBalance = parseFloat(leaveBalances.find((b: any) => b.leaveTypeId === clType?.id)?.closingBalance || "0");
  const pendingCount = myYear.filter((r: any) => r.status === "pending").length;
  const approvedDays = myYear.filter((r: any) => r.status === "approved").reduce((sum: number, r: any) => sum + parseFloat(r.totalDays || "0"), 0);
  const rejectedCount = myYear.filter((r: any) => r.status === "rejected").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Leave Balance" value={clBalance} subtitle="casual leave available" icon={Plane} color="bg-[#4BDCD9]/25 text-[#206295]" />
        <StatCard title="Pending Requests" value={pendingCount} subtitle="awaiting approval" icon={Clock} color="bg-[#206295]/15 text-[#206295]" />
        <StatCard title="Approved This Year" value={approvedDays} subtitle={`days taken in ${selectedYear}`} icon={CheckCircle2} color="bg-[#4BDCD9]/25 text-[#206295]" />
        <StatCard title="Rejected Requests" value={rejectedCount} subtitle={`in ${selectedYear}`} icon={XCircle} color="bg-[#FF6F62]/20 text-[#FF6F62]" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by leave type or reason..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-leave" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36" data-testid="select-status-filter"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40" data-testid="select-type-filter"><SelectValue placeholder="Leave Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {leaveTypes.map((lt: any) => <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-0"><CardContent className="p-0">
        {isLoading ? (
          <div className="p-4"><Skeleton className="h-32 w-full" /></div>
        ) : filteredMy.length === 0 ? (
          <div className="text-center py-12">
            <Plane className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{myYear.length === 0 ? "No leave requests yet" : "No requests match your filters"}</p>
            {myYear.length === 0 && <Button variant="outline" size="sm" className="mt-3" onClick={onApply}>Apply for Leave</Button>}
          </div>
        ) : (
          <DataTable
            columns={[
              { key: "type", header: "Leave Type", render: (r: any) => { const lt = leaveTypes.find((l: any) => l.id === r.leaveTypeId); return <span className="flex items-center gap-1.5 text-foreground"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: lt?.color || "#206295" }} />{lt?.name || "—"}</span>; } },
              { key: "dates", header: "Dates", cellClassName: "text-muted-foreground", render: (r: any) => <>{format(new Date(r.startDate), "MMM d")}{r.startDate !== r.endDate ? ` – ${format(new Date(r.endDate), "MMM d, yyyy")}` : `, ${format(new Date(r.startDate), "yyyy")}`}</> },
              { key: "days", header: "Days", cellClassName: "text-muted-foreground", render: (r: any) => `${r.totalDays}d` },
              { key: "reason", header: "Reason", cellClassName: "text-muted-foreground max-w-[16rem] truncate", render: (r: any) => r.reason || "—" },
              { key: "status", header: "Status", render: (r: any) => { const sc = statusOf(r.status); return <Badge className={`text-xs ${sc.bg} ${sc.text}`}>{sc.label}</Badge>; } },
              { key: "action", header: "Action", align: "right", render: (r: any) => canCancel(r) ? <Button size="sm" variant="outline" className="h-7 text-xs text-[#FF6F62] border-[#FF6F62]/30" onClick={() => onCancelRequest(r.id)} data-testid={`button-cancel-leave-${r.id}`}>Cancel</Button> : <span className="text-xs text-muted-foreground">—</span> },
            ]}
            rows={filteredMy}
            getRowKey={(r: any) => r.id}
            testIdPrefix="leave-row"
          />
        )}
      </CardContent></Card>
    </div>
  );
}
