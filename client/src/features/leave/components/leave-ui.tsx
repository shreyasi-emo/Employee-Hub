// Presentational pieces for the leave screen.

import { StatCard } from "@/components/shared/stat-card";
export { StatCard };

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { statusOf, avatarColor } from "../lib/leave-model";

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
              {lt && <span className="text-xs flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: lt.color }} />{lt.name}</span>}
              <span className="text-xs text-muted-foreground">
                {format(new Date(request.startDate), "MMM d")}
                {request.startDate !== request.endDate && ` - ${format(new Date(request.endDate), "MMM d, yyyy")}`}
                {request.startDate === request.endDate && `, ${format(new Date(request.startDate), "yyyy")}`}
              </span>
              <span className="text-xs text-muted-foreground">· {request.totalDays}d</span>
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
