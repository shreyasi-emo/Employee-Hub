import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useRegularizations, useDecideOverride } from "../api/attendance.api";

// Pending attendance-override requests an HR/manager can approve or reject. Approving writes the
// corrected day (admin_override). Hidden when there are none. Mirrors WfhApprovalsCard.
export function OverrideApprovalsCard() {
  const { toast } = useToast();
  const { data: pending = [] } = useRegularizations("pending");
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const empName = (id: string) => { const e = (employees as any[]).find((x) => x.id === id); return e ? `${e.firstName || ""} ${e.lastName || ""}`.trim() : "Employee"; };
  const decide = useDecideOverride({
    onSuccess: () => toast({ title: "Override request updated", description: "The attendance day was corrected on approval." }),
    onError: (e: any) => toast({ title: "Couldn't update request", description: e.message, variant: "destructive" }),
  });
  if (!(pending as any[]).length) return null;
  return (
    <div className="card-surface rounded-2xl p-4">
      <p className="text-base font-semibold text-foreground mb-3 inline-flex items-center gap-2"><CalendarClock className="h-4 w-4 text-[#206295]" /> Pending Attendance Overrides <span className="text-xs font-normal text-muted-foreground">({(pending as any[]).length})</span></p>
      <div className="space-y-2">
        {(pending as any[]).map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">{empName(r.employeeId)}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {format(new Date(r.attendanceDate), "EEE, d MMM yyyy")}
                <span className="mx-1.5 text-border">|</span>
                correct to <span className="capitalize">{String(r.requestedStatus || "present").replace(/_/g, " ")}</span>
              </p>
              {r.reason && <p className="text-[11px] text-muted-foreground/70 truncate" title={r.reason}>{r.reason}</p>}
            </div>
            <Badge className="text-[10px] flex-shrink-0 bg-[#206295]/12 text-[#206295] hidden sm:block">Past date</Badge>
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, status: "rejected" })} data-testid={`override-reject-${r.id}`}>Reject</Button>
            <Button size="sm" className="btn-primary-gradient h-8 text-xs" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, status: "approved" })} data-testid={`override-approve-${r.id}`}>Approve</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
