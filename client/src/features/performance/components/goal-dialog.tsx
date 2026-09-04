import { useState, useEffect } from "react";
import { useAuth, isHR } from "@/lib/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DateInput } from "@/components/shared/datetime-field";
import { useToast } from "@/hooks/use-toast";
import { GOAL_CATEGORIES, METRIC_TYPES, GOAL_STATUSES } from "../lib/performance-constants";

// ---- Goal Dialog ----
export function GoalDialog({ open, onClose, cycleId, goal, employees }: {
  open: boolean; onClose: () => void; cycleId: string; goal?: any; employees: any[];
}) {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!goal;

  const [form, setForm] = useState({
    title: goal?.title || "",
    description: goal?.description || "",
    category: goal?.category || "business",
    metricType: goal?.metricType || "output",
    targetValue: goal?.targetValue || "",
    unit: goal?.unit || "",
    weight: goal?.weight?.toString() || "0",
    dueDate: goal?.dueDate || "",
    status: goal?.status || "not_started",
    employeeId: goal?.employeeId || user?.employeeId || "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) => isEdit
      ? apiRequest("PATCH", `/api/performance/goals/${goal.id}`, data)
      : apiRequest("POST", "/api/performance/goals", { ...data, cycleId }),
    onSuccess: () => {
      qc.invalidateQueries({ predicate: q => (q.queryKey[0] as string)?.startsWith("/api/performance/goals") });
      toast({ title: isEdit ? "Goal updated" : "Goal created" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    const data: any = { ...form, weight: parseInt(form.weight) || 0 };
    if (!data.dueDate) delete data.dueDate;
    if (!data.startDate) delete data.startDate;
    mutation.mutate(data);
  };

  const canAssignToOthers = isHR(user!) || user?.role === "manager";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0 border-b border-border">
          <DialogTitle>{isEdit ? "Edit Goal" : "New Goal"}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
          {canAssignToOthers && !isEdit && (
            <div>
              <Label>Assign To</Label>
              <Select value={form.employeeId} onValueChange={v => setForm(f => ({ ...f, employeeId: v }))}>
                <SelectTrigger data-testid="select-goal-employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Title *</Label>
            <Input data-testid="input-goal-title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Goal title" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea data-testid="input-goal-description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Describe the goal..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger data-testid="select-goal-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GOAL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Metric Type</Label>
              <Select value={form.metricType} onValueChange={v => setForm(f => ({ ...f, metricType: v }))}>
                <SelectTrigger data-testid="select-goal-metric"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METRIC_TYPES.map(m => <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Target Value</Label>
              <Input data-testid="input-goal-target" type="number" inputMode="decimal" value={form.targetValue} onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))} placeholder="e.g. 100" />
            </div>
            <div>
              <Label>Unit</Label>
              <Input data-testid="input-goal-unit" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="e.g. %, INR" />
            </div>
            <div>
              <Label>Weight (%)</Label>
              <Input data-testid="input-goal-weight" type="number" min="0" max="100" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Due Date</Label>
              <DateInput testId="input-goal-due" value={form.dueDate} onChange={v => setForm(f => ({ ...f, dueDate: v }))} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger data-testid="select-goal-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(GOAL_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="px-6 py-4 border-t border-border flex-shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending || !form.title} data-testid="button-save-goal">
            {mutation.isPending ? "Saving..." : isEdit ? "Update Goal" : "Create Goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
