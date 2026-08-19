import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth, isHR } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Target, Users, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GoalDialog } from "./goal-dialog";
import { ProgressDialog } from "./progress-dialog";
import { GoalCard } from "./goal-card";

// ---- Team Goals Tab ----
export function TeamGoalsTab({ cycleId, employees }: { cycleId: string; employees: any[] }) {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filterEmp, setFilterEmp] = useState("all");
  const [editGoal, setEditGoal] = useState<any>(null);
  const [progressGoal, setProgressGoal] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);

  const queryKey = `/api/performance/goals?cycleId=${cycleId}`;
  const { data: allGoals = [], isLoading } = useQuery<any[]>({ queryKey: [queryKey] });

  const filtered = filterEmp === "all" ? allGoals : allGoals.filter(g => g.employeeId === filterEmp);

  const grouped = filtered.reduce((acc: Record<string, any[]>, g) => {
    if (!acc[g.employeeId]) acc[g.employeeId] = [];
    acc[g.employeeId].push(g);
    return acc;
  }, {});

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/performance/goals/${id}`, { isApproved: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [queryKey] }); toast({ title: "Goal approved" }); },
  });

  if (isLoading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterEmp} onValueChange={setFilterEmp}>
            <SelectTrigger className="w-48 h-8 text-xs" data-testid="select-team-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{filtered.length} goals</span>
        </div>
        {isHR(user!) && (
          <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-assign-goal">
            <Plus className="h-4 w-4 mr-1" /> Assign Goal
          </Button>
        )}
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No goals found for the selected filter.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([empId, empGoals]) => {
          const emp = employees.find(e => e.id === empId);
          const totalWeight = empGoals.reduce((s, g) => s + (g.weight || 0), 0);
          return (
            <div key={empId} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {emp ? `${emp.firstName} ${emp.lastName}` : "Unknown"}
                </span>
                <span className={`text-xs ${totalWeight === 100 ? "text-green-600" : "text-yellow-600"}`}>
                  ({totalWeight}% weight)
                </span>
                <span className="text-xs text-muted-foreground">{empGoals.length} goals</span>
              </div>
              {empGoals.map(g => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  onEdit={() => setEditGoal(g)}
                  onProgress={() => setProgressGoal(g)}
                  onApprove={() => approveMutation.mutate(g.id)}
                  canManage={isHR(user!) || user?.role === "manager"}
                />
              ))}
            </div>
          );
        })
      )}
      {showCreate && <GoalDialog open cycleId={cycleId} employees={employees} onClose={() => setShowCreate(false)} />}
      {editGoal && <GoalDialog open cycleId={cycleId} goal={editGoal} employees={employees} onClose={() => setEditGoal(null)} />}
      {progressGoal && <ProgressDialog open goal={progressGoal} onClose={() => setProgressGoal(null)} />}
    </div>
  );
}
