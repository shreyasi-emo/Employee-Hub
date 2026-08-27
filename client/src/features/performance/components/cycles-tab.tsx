import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth, isHR } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DateInput } from "@/components/shared/datetime-field";
import { Plus, Calendar, Lock, Archive, Play, Pencil, CheckCircle2, RefreshCw, Settings2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { CYCLE_STATUS_COLORS } from "../lib/performance-constants";
import { clampEnd } from "@/lib/date-range";
import { statusBadge } from "./status-badge";

// ---- Cycles Tab (HR) ----
export function CyclesTab({ onSelectCycle }: { onSelectCycle: (id: string) => void }) {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "", selfReviewEnabled: true, managerReviewEnabled: true, calibrationEnabled: false, goalWeightEnforced: false });

  const { data: cycles = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/performance/cycles"] });
  const { data: ratingScales = [] } = useQuery<any[]>({ queryKey: ["/api/performance/rating-scales"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/performance/cycles", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/performance/cycles"] });
      toast({ title: "Cycle created" });
      setShowCreate(false);
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/performance/cycles/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/performance/cycles"] }),
  });

  const statusTransitions: Record<string, string[]> = {
    draft: ["active"],
    active: ["locked"],
    locked: ["archived"],
    archived: [],
  };

  if (isLoading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{cycles.length} cycles</span>
        {isHR(user!) && (
          <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-create-cycle">
            <Plus className="h-4 w-4 mr-1" /> New Cycle
          </Button>
        )}
      </div>

      {cycles.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Settings2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No performance cycles yet.</p>
          {isHR(user!) && <Button size="sm" className="mt-3" onClick={() => setShowCreate(true)}>Create First Cycle</Button>}
        </div>
      ) : (
        <div className="space-y-3">
          {cycles.map(c => (
            <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" data-testid={`card-cycle-${c.id}`} onClick={() => onSelectCycle(c.id)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{c.name}</span>
                    {statusBadge(c.status, CYCLE_STATUS_COLORS)}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span>{format(new Date(c.startDate), "dd MMM yyyy")} → {format(new Date(c.endDate), "dd MMM yyyy")}</span>
                    <span>{c.selfReviewEnabled ? "Self ✓" : ""} {c.managerReviewEnabled ? "Manager ✓" : ""} {c.calibrationEnabled ? "Calibration ✓" : ""}</span>
                  </div>
                </div>
                {isHR(user!) && (
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    {(statusTransitions[c.status] || []).map(nextStatus => (
                      <Button
                        key={nextStatus}
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs capitalize"
                        onClick={() => updateStatus.mutate({ id: c.id, status: nextStatus })}
                        data-testid={`button-cycle-${nextStatus}`}
                      >
                        {nextStatus === "active" ? <><RefreshCw className="h-3 w-3 mr-1" />Activate</> : nextStatus === "locked" ? <><Lock className="h-3 w-3 mr-1" />Lock</> : <><CheckCircle2 className="h-3 w-3 mr-1" />Archive</>}
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Performance Cycle</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Cycle Name *</Label>
              <Input data-testid="input-cycle-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. H1 2026" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date *</Label>
                <DateInput testId="input-cycle-start" value={form.startDate} onChange={v => setForm(f => ({ ...f, startDate: v, endDate: clampEnd(v, f.endDate) }))} />
              </div>
              <div>
                <Label>End Date *</Label>
                <DateInput testId="input-cycle-end" value={form.endDate} onChange={v => setForm(f => ({ ...f, endDate: v }))} minDate={form.startDate || undefined} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Features</Label>
              {[
                { key: "selfReviewEnabled", label: "Self Review" },
                { key: "managerReviewEnabled", label: "Manager Review" },
                { key: "calibrationEnabled", label: "Calibration" },
                { key: "goalWeightEnforced", label: "Enforce Goal Weights (sum=100%)" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={(form as any)[key]}
                    onCheckedChange={v => setForm(f => ({ ...f, [key]: v === true }))}
                    data-testid={`checkbox-${key}`}
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.name || !form.startDate || !form.endDate} data-testid="button-confirm-create-cycle">
              {createMutation.isPending ? "Creating..." : "Create Cycle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
