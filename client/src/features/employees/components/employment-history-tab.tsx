import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { History } from "lucide-react";
import { format } from "date-fns";
import { useEmployeeHistory } from "../api/employees.api";

const HISTORY_FIELD_LABELS: Record<string, string> = {
  designation: "Designation",
  department: "Department",
  managerId: "Manager",
  location: "Location",
  employmentStatus: "Status",
};

/** Automatically-tracked changes to designation, department, manager and status. */
export function EmploymentHistoryTab({ empId }: { empId: string }) {
  const { data: history = [], isLoading } = useEmployeeHistory(empId);

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  if (history.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <History className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No employment history recorded yet.</p>
        <p className="text-xs mt-1">Changes to designation, department, manager, and status are tracked automatically.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((h: any) => (
        <Card key={h.id} data-testid={`history-entry-${h.id}`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <History className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground capitalize">
                    {HISTORY_FIELD_LABELS[h.changedField] || h.changedField} Changed
                  </span>
                  <Badge variant="outline" className="text-xs">{format(new Date(h.effectiveDate), "MMM d, yyyy")}</Badge>
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-sm flex-wrap">
                  {h.oldValue && (
                    <span className="px-2 py-0.5 rounded bg-destructive/10 text-destructive text-xs font-mono">{h.oldValue}</span>
                  )}
                  {h.oldValue && <span className="text-muted-foreground text-xs">→</span>}
                  {h.newValue && (
                    <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 text-xs font-mono">{h.newValue}</span>
                  )}
                </div>
                {h.reason && <p className="text-xs text-muted-foreground mt-1">Reason: {h.reason}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(h.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
