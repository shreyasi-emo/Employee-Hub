import { months } from "../lib/payroll-format";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export function CreatePayrollDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const today = new Date();
  const [form, setForm] = useState({
    month: today.getMonth() + 1,
    year: today.getFullYear(),
  });

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/payroll-runs", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
      toast({ title: "Payroll run created" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Payroll Run</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Month *</label>
              <Select
                value={String(form.month)}
                onValueChange={v => setForm(f => ({ ...f, month: parseInt(v) }))}
              >
                <SelectTrigger className="mt-1 w-full" data-testid="select-payroll-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Year *</label>
              <Input
                type="number"
                value={form.year}
                onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) }))}
                className="mt-1"
                data-testid="input-payroll-year"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending} data-testid="button-create-payroll">
              {mutation.isPending ? "Creating..." : "Create Payroll Run"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
