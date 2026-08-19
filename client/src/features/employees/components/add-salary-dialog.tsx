import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateInput } from "@/components/shared/datetime-field";
import { useToast } from "@/hooks/use-toast";
import { useAddSalaryStructure } from "../api/employees.api";

export function AddSalaryDialog({ open, onOpenChange, employeeId }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employeeId: string;
}) {
  const { toast } = useToast();
  const form = useForm({
    defaultValues: {
      effectiveFrom: new Date().toISOString().split("T")[0],
      basicSalary: "",
      hra: "",
      specialAllowance: "",
      conveyanceAllowance: "1600",
      medicalAllowance: "1250",
      ctc: "",
      reason: "",
    },
  });

  const mutation = useAddSalaryStructure(employeeId, {
    onSuccess: () => {
      toast({ title: "Salary structure added" });
      onOpenChange(false);
      form.reset();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Salary Structure</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Effective From *</label>
            <div className="mt-1"><Controller control={form.control} name="effectiveFrom" render={({ field }) => <DateInput value={field.value || ""} onChange={field.onChange} />} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Basic Salary *</label>
              <Input {...form.register("basicSalary")} placeholder="e.g. 50000" className="mt-1" type="number" />
            </div>
            <div>
              <label className="text-sm font-medium">HRA</label>
              <Input {...form.register("hra")} placeholder="e.g. 20000" className="mt-1" type="number" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Special Allowance</label>
              <Input {...form.register("specialAllowance")} placeholder="e.g. 10000" className="mt-1" type="number" />
            </div>
            <div>
              <label className="text-sm font-medium">CTC (Annual) *</label>
              <Input {...form.register("ctc")} placeholder="e.g. 1200000" className="mt-1" type="number" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Reason for Change *</label>
            <Input {...form.register("reason")} placeholder="e.g. Annual appraisal 2025" className="mt-1" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save Salary Structure"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
