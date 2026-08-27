import { DAYS, SHORT_DAYS } from "../lib/days";
import { clampEnd } from "@/lib/date-range";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateInput } from "@/components/shared/datetime-field";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export function AssignShiftDialog({ open, onOpenChange, employees, shifts }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employees: any[];
  shifts: any[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [form, setForm] = useState({ employeeId: "", shiftId: "", effectiveFrom: "", effectiveTo: "" });

  const mutation = useMutation({
    mutationFn: (data: any) => bulkMode
      ? apiRequest("POST", "/api/shift-assignments/bulk", { employeeIds: selectedEmployees, ...data })
      : apiRequest("POST", "/api/shift-assignments", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/shift-assignments"] });
      toast({ title: bulkMode ? `Shift assigned to ${selectedEmployees.length} employees` : "Shift assigned" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleEmployee = (id: string) => {
    setSelectedEmployees(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  };

  const handleSubmit = () => {
    const data = {
      shiftId: form.shiftId,
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo || undefined,
    };
    if (bulkMode) {
      if (selectedEmployees.length === 0) return toast({ title: "Select at least one employee", variant: "destructive" });
      mutation.mutate(data);
    } else {
      mutation.mutate({ ...data, employeeId: form.employeeId });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Shift</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${!bulkMode ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              onClick={() => setBulkMode(false)}
            >Single Employee</button>
            <button
              type="button"
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${bulkMode ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              onClick={() => setBulkMode(true)}
            >Bulk Assign</button>
          </div>

          {bulkMode ? (
            <div>
              <label className="text-sm font-medium">Select Employees ({selectedEmployees.length} selected)</label>
              <div className="mt-1 border border-border rounded-md divide-y divide-border max-h-40 overflow-y-auto">
                {employees.map(e => (
                  <label key={e.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50">
                    <Checkbox checked={selectedEmployees.includes(e.id)} onCheckedChange={() => toggleEmployee(e.id)} />
                    <span className="text-sm">{e.firstName} {e.lastName}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{e.employeeCode}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium">Employee</label>
              <Select value={form.employeeId} onValueChange={v => setForm(f => ({ ...f, employeeId: v }))}>
                <SelectTrigger className="mt-1" data-testid="select-assign-employee">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Shift</label>
            <Select value={form.shiftId} onValueChange={v => setForm(f => ({ ...f, shiftId: v }))}>
              <SelectTrigger className="mt-1" data-testid="select-shift">
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent>
                {shifts.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name} ({s.startTime} – {s.endTime})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Effective From *</label>
              <DateInput value={form.effectiveFrom} onChange={v => setForm(f => ({ ...f, effectiveFrom: v, effectiveTo: clampEnd(v, f.effectiveTo) }))} className="mt-1" testId="input-effective-from" />
            </div>
            <div>
              <label className="text-sm font-medium">Effective To</label>
              <DateInput value={form.effectiveTo} onChange={v => setForm(f => ({ ...f, effectiveTo: v }))} minDate={form.effectiveFrom || undefined} className="mt-1" />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={mutation.isPending || !form.shiftId || !form.effectiveFrom}
              data-testid="button-submit-assignment"
            >
              {mutation.isPending ? "Assigning..." : "Assign Shift"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
