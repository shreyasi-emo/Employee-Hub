import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Pencil, TrendingUp, CheckCircle2, ChevronDown, ChevronUp, Edit, Lock } from "lucide-react";
import { format } from "date-fns";
import { GOAL_STATUSES } from "../lib/performance-constants";

// ---- Goal Card ----
export function GoalCard({ goal, onEdit, onProgress, onApprove, canManage }: {
  goal: any; onEdit: () => void; onProgress: () => void; onApprove: () => void; canManage: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusInfo = GOAL_STATUSES[goal.status] || GOAL_STATUSES.not_started;
  const StatusIcon = statusInfo.icon;

  return (
    <Card className="group" data-testid={`card-goal-${goal.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-foreground truncate">{goal.title}</span>
              <Badge variant="outline" className="text-xs">{goal.category}</Badge>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${statusInfo.color}`}>
                <StatusIcon className="h-3 w-3" />{statusInfo.label}
              </span>
              {goal.isApproved && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Approved</span>}
              {goal.isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
              <span>Weight: <strong>{goal.weight}%</strong></span>
              {goal.targetValue && <span>Target: <strong>{goal.targetValue} {goal.unit}</strong></span>}
              {goal.dueDate && <span>Due: <strong>{format(new Date(goal.dueDate), "dd MMM yyyy")}</strong></span>}
              <span className="capitalize">{goal.metricType}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(e => !e)} data-testid={`button-expand-goal-${goal.id}`}>
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onProgress} title="Update progress" data-testid={`button-progress-${goal.id}`}>
              <TrendingUp className="h-3.5 w-3.5" />
            </Button>
            {canManage && !goal.isLocked && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} data-testid={`button-edit-goal-${goal.id}`}>
                <Edit className="h-3.5 w-3.5" />
              </Button>
            )}
            {canManage && !goal.isApproved && !goal.isLocked && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={onApprove} title="Approve goal" data-testid={`button-approve-goal-${goal.id}`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        {expanded && goal.description && (
          <p className="mt-2 text-sm text-muted-foreground border-t pt-2">{goal.description}</p>
        )}
      </CardContent>
    </Card>
  );
}
