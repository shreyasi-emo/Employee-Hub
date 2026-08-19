import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth, isHR, isManager } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, Users, Star, Calendar, Scale, BarChart3, TrendingUp, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MyGoalsTab } from "../components/my-goals-tab";
import { TeamGoalsTab } from "../components/team-goals-tab";
import { ReviewsTab } from "../components/reviews-tab";
import { CyclesTab } from "../components/cycles-tab";
import { CalibrationTab } from "../components/calibration-tab";
import { ReportsTab } from "../components/reports-tab";

// ---- Main Page ----
export default function PerformancePage() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const [selectedCycleId, setSelectedCycleId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("my-goals");

  const { data: cycles = [], isLoading: cyclesLoading } = useQuery<any[]>({ queryKey: ["/api/performance/cycles"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });

  const activeCycles = cycles.filter(c => c.status === "active");
  const effectiveCycleId = selectedCycleId || activeCycles[0]?.id || cycles[0]?.id || "";
  const selectedCycle = cycles.find(c => c.id === effectiveCycleId);

  const hrTabs = ["cycles", "reports", "calibration"];
  const allTabs = isHR(user!)
    ? ["my-goals", "team-goals", "reviews", "cycles", "calibration", "reports"]
    : user?.role === "manager"
    ? ["my-goals", "team-goals", "reviews"]
    : ["my-goals", "reviews"];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Performance</h1>
          <p className="text-sm text-muted-foreground">Manage KPIs, reviews, and performance cycles</p>
        </div>
        {cycles.length > 0 && (
          <Select value={effectiveCycleId} onValueChange={setSelectedCycleId}>
            <SelectTrigger className="w-48" data-testid="select-cycle">
              <SelectValue placeholder="Select cycle" />
            </SelectTrigger>
            <SelectContent>
              {cycles.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {cyclesLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1" data-testid="performance-tabs">
            {allTabs.map(tab => (
              <TabsTrigger key={tab} value={tab} className="text-xs capitalize" data-testid={`tab-${tab}`}>
                {tab === "my-goals" ? <><Target className="h-3.5 w-3.5 mr-1" />My Goals</> :
                 tab === "team-goals" ? <><Users className="h-3.5 w-3.5 mr-1" />Team Goals</> :
                 tab === "reviews" ? <><Star className="h-3.5 w-3.5 mr-1" />Reviews</> :
                 tab === "cycles" ? <><Settings2 className="h-3.5 w-3.5 mr-1" />Cycles</> :
                 tab === "calibration" ? <><BarChart3 className="h-3.5 w-3.5 mr-1" />Calibration</> :
                 <><TrendingUp className="h-3.5 w-3.5 mr-1" />Reports</>}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-4">
            <TabsContent value="my-goals">
              {effectiveCycleId ? (
                <MyGoalsTab cycleId={effectiveCycleId} employees={employees} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Target className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No active cycle found.</p>
                  {isHR(user!) && <Button size="sm" className="mt-3" onClick={() => setActiveTab("cycles")}>Create a Cycle</Button>}
                </div>
              )}
            </TabsContent>

            <TabsContent value="team-goals">
              {effectiveCycleId ? (
                <TeamGoalsTab cycleId={effectiveCycleId} employees={employees} />
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm">No active cycle found.</div>
              )}
            </TabsContent>

            <TabsContent value="reviews">
              {effectiveCycleId ? (
                <ReviewsTab cycleId={effectiveCycleId} cycle={selectedCycle} employees={employees} />
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm">No active cycle found.</div>
              )}
            </TabsContent>

            <TabsContent value="cycles">
              <CyclesTab onSelectCycle={id => { setSelectedCycleId(id); setActiveTab("my-goals"); }} />
            </TabsContent>

            <TabsContent value="calibration">
              {effectiveCycleId ? (
                <CalibrationTab cycleId={effectiveCycleId} employees={employees} />
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm">Select a cycle first.</div>
              )}
            </TabsContent>

            <TabsContent value="reports">
              {effectiveCycleId ? (
                <ReportsTab cycleId={effectiveCycleId} />
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm">Select a cycle first.</div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      )}
    </div>
  );
}
