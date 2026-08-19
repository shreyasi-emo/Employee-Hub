import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, TrendingUp, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { useEmployeeGoals } from "../api/employees.api";

const GOAL_STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-600",
  on_track: "bg-green-100 text-green-700",
  at_risk: "bg-yellow-100 text-yellow-700",
  off_track: "bg-red-100 text-red-700",
  completed: "bg-blue-100 text-blue-700",
};

const cycleStatusClass = (status: string) =>
  status === "active" ? "bg-green-100 text-green-700" :
  status === "locked" ? "bg-orange-100 text-orange-700" :
  status === "archived" ? "bg-red-100 text-red-700" :
  "bg-gray-100 text-gray-600";

/** This employee's goals grouped by performance cycle, with per-cycle weight totals. */
export function EmployeePerformanceHistory({ empId }: { empId: string }) {
  const { data: cycles = [], isLoading: cyclesLoading } = useQuery<any[]>({ queryKey: ["/api/performance/cycles"] });
  const { data: allGoals = [] } = useEmployeeGoals(empId);

  if (cyclesLoading) return <Skeleton className="h-48 w-full" />;

  if (cycles.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Target className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No performance cycles configured yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {cycles.map((cycle: any) => {
        const cycleGoals = allGoals.filter(g => g.cycleId === cycle.id);
        const totalWeight = cycleGoals.reduce((s, g) => s + (g.weight || 0), 0);
        const completed = cycleGoals.filter(g => g.status === "completed").length;
        const onTrack = cycleGoals.filter(g => g.status === "on_track").length;

        return (
          <Card key={cycle.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  {cycle.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cycleStatusClass(cycle.status)}`}>{cycle.status}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(cycle.startDate), "MMM yyyy")} – {format(new Date(cycle.endDate), "MMM yyyy")}
              </p>
            </CardHeader>
            <CardContent>
              {cycleGoals.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No goals set for this cycle.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <span>{cycleGoals.length} goals</span>
                    <span className={totalWeight === 100 ? "text-green-600" : "text-yellow-600"}>
                      Total weight: {totalWeight}%
                    </span>
                    <span className="text-green-600">{completed} completed</span>
                    <span className="text-blue-600">{onTrack} on track</span>
                  </div>
                  <div className="space-y-1.5">
                    {cycleGoals.map(g => (
                      <div key={g.id} className="flex items-center justify-between gap-3 p-2 rounded-md bg-muted/40">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs truncate">{g.title}</span>
                          <Badge variant="outline" className="text-xs flex-shrink-0">{g.category}</Badge>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-muted-foreground">{g.weight}%</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${GOAL_STATUS_COLORS[g.status] || ""}`}>
                            {g.status?.replace(/_/g, " ")}
                          </span>
                          {g.isApproved && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
