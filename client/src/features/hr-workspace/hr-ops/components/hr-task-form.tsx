import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DateInput } from "@/components/shared/datetime-field";
import { useToast } from "@/hooks/use-toast";
import { useCreateHrTask } from "../api/hr-ops.api";

const BLANK = { title: "", description: "", priority: "medium", dueDate: "", category: "general" };
const PRIORITIES = ["low", "medium", "high", "critical"] as const;
const LABEL: Record<string, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };

export function HrTaskFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm({ defaultValues: BLANK });
  const close = () => { form.reset(BLANK); onClose(); };

  const mutation = useCreateHrTask({
    onSuccess: () => { toast({ title: "Task created" }); close(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New HR Task</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input {...form.register("title", { required: true })} placeholder="Task title..." data-testid="input-task-title" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={2} {...form.register("description")} placeholder="Task description..." data-testid="textarea-task-desc" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.watch("priority")} onValueChange={(v) => form.setValue("priority", v)}>
                <SelectTrigger data-testid="select-task-priority"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{LABEL[p]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Controller control={form.control} name="dueDate" render={({ field }) => <DateInput value={field.value || ""} onChange={field.onChange} testId="input-task-due" />} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-save-task">
              {mutation.isPending ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
