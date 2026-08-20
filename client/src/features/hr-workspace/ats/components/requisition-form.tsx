import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useCreateRequisition } from "../api/ats.api";

const BLANK = {
  title: "", departmentId: "", noOfPositions: "1", jobType: "full_time",
  workMode: "onsite", description: "", requirements: "", salaryMin: "", salaryMax: "",
};

const JOB_TYPES = [
  ["full_time", "Full Time"], ["part_time", "Part Time"],
  ["contract", "Contract"], ["internship", "Internship"],
] as const;
const WORK_MODES = [["onsite", "On-site"], ["remote", "Remote"], ["hybrid", "Hybrid"]] as const;

export function RequisitionFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm({ defaultValues: BLANK });
  const close = () => { form.reset(BLANK); onClose(); };

  const mutation = useCreateRequisition({
    onSuccess: () => { toast({ title: "Requisition created" }); close(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Create Job Requisition</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Job Title *</Label>
            <Input {...form.register("title", { required: true })} placeholder="e.g. Senior Backend Engineer" data-testid="input-req-title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Positions</Label>
              <Input type="number" min="1" {...form.register("noOfPositions")} data-testid="input-req-positions" />
            </div>
            <div className="space-y-1.5">
              <Label>Job Type</Label>
              <Select value={form.watch("jobType")} onValueChange={(v) => form.setValue("jobType", v)}>
                <SelectTrigger data-testid="select-req-jobtype"><SelectValue /></SelectTrigger>
                <SelectContent>{JOB_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Work Mode</Label>
            <Select value={form.watch("workMode")} onValueChange={(v) => form.setValue("workMode", v)}>
              <SelectTrigger data-testid="select-req-workmode"><SelectValue /></SelectTrigger>
              <SelectContent>{WORK_MODES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Salary Min</Label>
              <Input type="number" placeholder="e.g. 600000" {...form.register("salaryMin")} data-testid="input-req-salmin" />
            </div>
            <div className="space-y-1.5">
              <Label>Salary Max</Label>
              <Input type="number" placeholder="e.g. 1200000" {...form.register("salaryMax")} data-testid="input-req-salmax" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={3} {...form.register("description")} placeholder="Role description..." data-testid="textarea-req-description" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-create-req">
              {mutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
