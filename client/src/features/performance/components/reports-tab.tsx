import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { BarChart3, Target, Users, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { GOAL_STATUSES } from "../lib/performance-constants";

// ---- Reports Tab ----
export function ReportsTab({ cycleId }: { cycleId: string }) {
  const { data: report, isLoading } = useQuery<any>({
    queryKey: [`/api/performance/reports/distribution/${cycleId}`],
    enabled: !!cycleId,
  });

  if (isLoading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  const stats = report?.goalStats;
  const dist = report?.ratingDistribution || {};
  const maxCount = Math.max(...Object.values(dist) as number[], 1);

  return (
    <div className="space-y-4">
      {/* Goal Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Goals", value: stats?.total || 0, icon: Target, color: "text-blue-500" },
          { label: "Completed", value: stats?.completed || 0, icon: CheckCircle2, color: "text-green-500" },
          { label: "On Track", value: stats?.onTrack || 0, icon: TrendingUp, color: "text-emerald-500" },
          { label: "At Risk / Off Track", value: (stats?.atRisk || 0) + (stats?.offTrack || 0), icon: AlertTriangle, color: "text-red-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`h-6 w-6 ${color}`} />
              <div>
                <p className="text-xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rating Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Final Rating Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(dist).length === 0 ? (
            <p className="text-sm text-muted-foreground">No finalized reviews yet.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(dist).map(([rating, count]: [string, any]) => (
                <div key={rating} className="flex items-center gap-3">
                  <span className="text-xs w-16 text-muted-foreground">Rating {rating}</span>
                  <Progress value={(count / maxCount) * 100} className="h-3 flex-1" />
                  <span className="text-xs w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            <strong>{report?.totalReviews || 0}</strong> reviews in this cycle.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
