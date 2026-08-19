import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Plus, Scale, Lock, Users, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { statusBadge } from "./status-badge";

// ---- Calibration Tab ----
export function CalibrationTab({ cycleId, employees }: { cycleId: string; employees: any[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedDept, setSelectedDept] = useState("all");

  const { data: sessions = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/performance/calibration/${cycleId}`],
    enabled: !!cycleId,
  });
  const { data: allReviews = [] } = useQuery<any[]>({
    queryKey: [`/api/performance/reviews/${cycleId}`],
    enabled: !!cycleId,
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/performance/calibration/${cycleId}`, { participants: [], adjustments: [] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/performance/calibration/${cycleId}`] }),
  });

  const lockMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/performance/calibration/${id}`, { status: "locked" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/performance/calibration/${cycleId}`] });
      toast({ title: "Calibration session locked" });
    },
  });

  // Rating distribution from reviews
  const dist = allReviews.reduce((acc: Record<string, number>, r: any) => {
    const rating = r.finalOutcome?.finalRating || r.managerReview?.rating;
    if (rating) acc[rating] = (acc[rating] || 0) + 1;
    return acc;
  }, {});

  const maxCount = Math.max(...Object.values(dist), 1);

  return (
    <div className="space-y-4">
      {/* Rating Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Rating Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(dist).length === 0 ? (
            <p className="text-sm text-muted-foreground">No manager reviews submitted yet.</p>
          ) : (
            <div className="space-y-2">
              {["1", "2", "3", "4", "5"].map(rating => {
                const count = dist[rating] || 0;
                const pct = Math.round((count / (allReviews.length || 1)) * 100);
                return (
                  <div key={rating} className="flex items-center gap-3">
                    <span className="text-xs w-16 text-muted-foreground">Rating {rating}</span>
                    <Progress value={(count / maxCount) * 100} className="h-3 flex-1" />
                    <span className="text-xs w-16 text-right">{count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-Employee Adjustments */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Calibration Sessions</span>
        <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending} data-testid="button-new-calibration">
          <Plus className="h-4 w-4 mr-1" /> New Session
        </Button>
      </div>

      {isLoading ? <Skeleton className="h-32 w-full" /> : sessions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">No calibration sessions yet. Create one to start adjusting ratings.</div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <Card key={s.id} data-testid={`card-calibration-${s.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Session</span>
                      {statusBadge(s.status, { open: "bg-green-100 text-green-700", locked: "bg-orange-100 text-orange-700" })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(s.adjustments as any[])?.length || 0} adjustments
                    </p>
                  </div>
                  {s.status === "open" && (
                    <Button size="sm" variant="outline" onClick={() => lockMutation.mutate(s.id)} disabled={lockMutation.isPending} data-testid={`button-lock-calibration-${s.id}`}>
                      <Lock className="h-3.5 w-3.5 mr-1" /> Lock Session
                    </Button>
                  )}
                </div>
                {/* Show employees with their current vs proposed ratings */}
                <div className="mt-3 space-y-1">
                  {allReviews.slice(0, 5).map((r: any) => {
                    const emp = employees.find(e => e.id === r.employeeId);
                    const currentRating = r.managerReview?.rating || "—";
                    return (
                      <div key={r.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                        <span>{emp ? `${emp.firstName} ${emp.lastName}` : "Unknown"}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Manager: {currentRating}</span>
                          {r.finalOutcome?.finalRating && <span className="font-medium text-green-600">Final: {r.finalOutcome.finalRating}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
