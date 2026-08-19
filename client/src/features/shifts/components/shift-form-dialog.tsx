import { DAYS, SHORT_DAYS } from "../lib/days";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export function ShiftFormDialog({ open, onOpenChange, editShift }: { open: boolean; onOpenChange: (v: boolean) => void; editShift?: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [weeklyOff, setWeeklyOff] = useState<string[]>(editShift?.weeklyOff || ["saturday", "sunday"]);
  const [form, setForm] = useState({
    name: editShift?.name || "",
    startTime: editShift?.startTime || "09:00",
    endTime: editShift?.endTime || "18:00",
    graceMinutes: editShift?.graceMinutes ?? 10,
    description: editShift?.description || "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) => editShift
      ? apiRequest("PUT", `/api/shifts/${editShift.id}`, data)
      : apiRequest("POST", "/api/shifts", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({ title: editShift ? "Shift updated" : "Shift created" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleDay = (day: string) => {
    setWeeklyOff(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editShift ? "Edit Shift" : "Create Shift"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Shift Name *</label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" placeholder="e.g. General Shift" data-testid="input-shift-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Start Time *</label>
              <Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="mt-1" data-testid="input-shift-start" />
            </div>
            <div>
              <label className="text-sm font-medium">End Time *</label>
              <Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="mt-1" data-testid="input-shift-end" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Grace Period (minutes)</label>
            <Input type="number" value={form.graceMinutes} onChange={e => setForm(f => ({ ...f, graceMinutes: parseInt(e.target.value) || 0 }))} className="mt-1" min={0} max={60} />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Weekly Off Days</label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((day, i) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${weeklyOff.includes(day) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
                  data-testid={`toggle-day-${day}`}
                >
                  {SHORT_DAYS[i]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1" placeholder="Optional notes" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={() => mutation.mutate({ ...form, weeklyOff })}
              disabled={mutation.isPending || !form.name || !form.startTime || !form.endTime}
              data-testid="button-submit-shift"
            >
              {mutation.isPending ? "Saving..." : editShift ? "Update" : "Create Shift"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
