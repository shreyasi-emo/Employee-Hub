// Presentational pieces for the leave screen.

import { StatCard } from "@/components/shared/stat-card";
export { StatCard };

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { statusOf, avatarColor, leaveTypeColor } from "../lib/leave-model";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";

// Human date range for a request: "Dec 20 – Dec 22, 2026" (single day → one date).
function leaveRange(r: any) {
  const s = new Date(r.startDate), e = new Date(r.endDate);
  if (r.startDate === r.endDate) return format(s, "MMM d, yyyy");
  return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
}

/** Neat, house-styled table for leave requests (Team Requests / All Requests). */
export function LeaveRequestsTable({ requests, leaveTypes, employees, onApprove, onReject, onCancel, canApprove, myEmpId, emptyText }: any) {
  const ltById = new Map<string, any>((leaveTypes || []).map((l: any) => [l.id, l]));
  const empById = new Map<string, any>((employees || []).map((e: any) => [e.id, e]));
  const showActions = requests.some((r: any) => r.status === "pending" && (canApprove || (myEmpId && r.employeeId === myEmpId)));

  const columns: DataTableColumn<any>[] = [
    {
      key: "employee", header: "Employee",
      render: (r) => {
        const emp = empById.get(r.employeeId); const c = avatarColor(r.employeeId);
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-7 w-7 flex-shrink-0"><AvatarFallback className="text-[11px] font-semibold" style={{ backgroundColor: `${c}26`, color: c }}>{emp ? `${emp.firstName[0]}${emp.lastName[0]}` : "?"}</AvatarFallback></Avatar>
            <span className="font-medium text-foreground truncate">{emp ? `${emp.firstName} ${emp.lastName}` : "—"}</span>
          </div>
        );
      },
    },
    {
      key: "type", header: "Type",
      render: (r) => { const lt = ltById.get(r.leaveTypeId); return lt ? <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: leaveTypeColor(lt) }} />{lt.name}</span> : <span className="text-muted-foreground/50">—</span>; },
    },
    { key: "dates", header: "Dates", render: (r) => <span className="text-foreground/80">{leaveRange(r)}</span> },
    { key: "days", header: "Days", align: "right", render: (r) => <span>{Number(r.totalDays)}</span> },
    {
      key: "reason", header: "Reason", cellClassName: "max-w-[18rem]",
      render: (r) => r.reason ? <span className="text-muted-foreground line-clamp-1" title={r.reason}>{r.reason}</span> : <span className="text-muted-foreground/40">—</span>,
    },
    { key: "status", header: "Status", render: (r) => { const sc = statusOf(r.status); return <Badge className={`${sc.bg} ${sc.text}`}>{sc.label}</Badge>; } },
    ...(showActions ? [{
      key: "actions", header: "", align: "right" as const,
      render: (r: any) => {
        if (r.status !== "pending") return null;
        if (canApprove) {
          return (
            <div className="flex items-center gap-1.5 justify-end">
              <Button size="sm" variant="outline" className="h-7 text-[#C4402F] border-[#C4402F]/30 text-xs px-2.5" onClick={(e) => { e.stopPropagation(); onReject(r.id); }} data-testid={`button-reject-leave-${r.id}`}>Reject</Button>
              <Button size="sm" className="h-7 text-xs px-3" onClick={(e) => { e.stopPropagation(); onApprove(r.id); }} data-testid={`button-approve-leave-${r.id}`}>Approve</Button>
            </div>
          );
        }
        if (myEmpId && r.employeeId === myEmpId) {
          return <div className="flex justify-end"><Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={(e) => { e.stopPropagation(); onCancel(r.id); }}>Cancel</Button></div>;
        }
        return null;
      },
    }] : []),
  ];

  return <DataTable columns={columns} rows={requests} getRowKey={(r) => r.id} emptyText={emptyText || "No leave requests"} testIdPrefix="leave-request" />;
}

/** One request row, used by the Team Requests and All Requests lists. */
export function LeaveRequestRow({ request, leaveTypes, employees, onApprove, onReject, onCancel, canApprove, isMine }: any) {
  const lt = leaveTypes.find((l: any) => l.id === request.leaveTypeId);
  const emp = employees.find((e: any) => e.id === request.employeeId);
  const sc = statusOf(request.status);
  const c = avatarColor(request.employeeId);
  return (
    <div className="flex items-start gap-3 py-3" data-testid={`leave-request-${request.id}`}>
      <Avatar className="h-8 w-8 flex-shrink-0"><AvatarFallback className="text-xs" style={{ backgroundColor: `${c}26`, color: c }}>{emp ? `${emp.firstName[0]}${emp.lastName[0]}` : "?"}</AvatarFallback></Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className="text-sm font-medium text-foreground">{emp ? `${emp.firstName} ${emp.lastName}` : "You"}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {lt && <span className="text-xs flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: leaveTypeColor(lt) }} />{lt.name}</span>}
              <span className="text-xs text-muted-foreground">
                {format(new Date(request.startDate), "MMM d")}
                {request.startDate !== request.endDate && ` - ${format(new Date(request.endDate), "MMM d, yyyy")}`}
                {request.startDate === request.endDate && `, ${format(new Date(request.startDate), "yyyy")}`}
              </span>
              <span className="text-xs text-muted-foreground">{request.totalDays}d</span>
            </div>
            {request.reason && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">"{request.reason}"</p>}
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${sc.bg} ${sc.text}`}>{sc.label}</Badge>
            {canApprove && request.status === "pending" && (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 text-[#FF6F62] border-[#FF6F62]/30 text-xs px-2" onClick={() => onReject(request.id)} data-testid={`button-reject-leave-${request.id}`}>Reject</Button>
                <Button size="sm" className="h-7 text-xs px-2" onClick={() => onApprove(request.id)} data-testid={`button-approve-leave-${request.id}`}>Approve</Button>
              </div>
            )}
            {isMine && request.status === "pending" && (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => onCancel(request.id)}>Cancel</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
