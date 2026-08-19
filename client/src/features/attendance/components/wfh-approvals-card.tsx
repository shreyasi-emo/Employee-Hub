import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useWfhPending, useDecideWfh } from "../api/attendance.api";

// Pending WFH requests a manager/HR can approve or reject. Hidden when there are none.
export function WfhApprovalsCard() {
  const { toast } = useToast();
  const { data: pending = [] } = useWfhPending();
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const empName = (id: string) => { const e = (employees as any[]).find((x) => x.id === id); return e ? `${e.firstName || ""} ${e.lastName || ""}`.trim() : "Employee"; };
  const decide = useDecideWfh({
    onSuccess: () => toast({ title: "WFH request updated" }),
    onError: (e: any) => toast({ title: "Couldn't update request", description: e.message, variant: "destructive" }),
  });
  if (!(pending as any[]).length) return null;
  return (
    <div className="card-surface rounded-2xl p-4">
      <p className="text-base font-semibold text-foreground mb-3 inline-flex items-center gap-2"><Home className="h-4 w-4 text-[#0E7C7B]" /> Pending WFH Requests <span className="text-xs font-normal text-muted-foreground">({(pending as any[]).length})</span></p>
      <div className="space-y-2">
        {(pending as any[]).map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">{empName(r.employeeId)}</p>
              <p className="text-[11px] text-muted-foreground truncate">{format(new Date(r.date), "EEE, d MMM yyyy")}{r.meta?.reason ? ` · ${r.meta.reason}` : ""}</p>
            </div>
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={decide.isPending} onClick={() => decide.mutate({ employeeId: r.employeeId, date: r.date, decision: "rejected" })} data-testid={`wfh-reject-${r.employeeId}-${r.date}`}>Reject</Button>
            <Button size="sm" className="btn-primary-gradient h-8 text-xs" disabled={decide.isPending} onClick={() => decide.mutate({ employeeId: r.employeeId, date: r.date, decision: "approved" })} data-testid={`wfh-approve-${r.employeeId}-${r.date}`}>Approve</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
