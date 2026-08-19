import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth, isHR } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GoalDialog } from "./goal-dialog";
import { ProgressDialog } from "./progress-dialog";
import { GoalCard } from "./goal-card";

// ---- My Goals Tab ----
export function MyGoalsTab({ cycleId, employees }: { cycleId: string; employees: any[] }) {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editGoal, setEditGoal] = useState<any>(null);
  const [progressGoal, setProgressGoal] = useState<any>(null);

  const queryKey = `/api/performance/goals?cycleId=${cycleId}&employeeId=${user?.employeeId || ""}`;
  const { data: myGoals = [], isLoading } = useQuery<any[]>({ queryKey: [queryKey] });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/performance/goals/${id}`, { isApproved: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [queryKey] }); toast({ title: "Goal approved" }); },
  });

  const totalWeight = myGoals.reduce((s, g) => s + (g.weight || 0), 0);

  if (isLoading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{myGoals.length} goals</span>
          <span className={`text-sm font-medium ${totalWeight === 100 ? "text-green-600" : "text-yellow-600"}`}>
            Total weight: {totalWeight}%
          </span>
        </div>
        {!isLoading && (
          <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-add-goal">
            <Plus className="h-4 w-4 mr-1" /> Add Goal
          </Button>
        )}
      </div>

      {myGoals.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Target className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No goals yet for this cycle.</p>
          <Button className="mt-3" size="sm" onClick={() => setShowCreate(true)}>Set your first goal</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {myGoals.map(g => (
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
      )}

      {showCreate && <GoalDialog open cycleId={cycleId} employees={employees} onClose={() => setShowCreate(false)} />}
      {editGoal && <GoalDialog open cycleId={cycleId} goal={editGoal} employees={employees} onClose={() => setEditGoal(null)} />}
      {progressGoal && <ProgressDialog open goal={progressGoal} onClose={() => setProgressGoal(null)} />}
    </div>
  );
}
