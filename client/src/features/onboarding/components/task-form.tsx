import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useCreateOnboardingTask } from "../api/onboarding.api";

const BLANK = { title: "", description: "", ownedByRole: "hr_admin", dueDaysFromJoin: 7 };

export function TaskFormDialog({ open, onClose, templateId, roleOptions }: {
  open: boolean;
  onClose: () => void;
  /** Template the task is added to. */
  templateId: string | null;
  roleOptions: { value: string; label: string }[];
}) {
  const { toast } = useToast();
  const [form, setForm] = useState(BLANK);
  const close = () => { setForm(BLANK); onClose(); };

  const create = useCreateOnboardingTask(templateId, {
    onSuccess: () => { toast({ title: "Task added" }); close(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Onboarding Task</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Task Title *</label>
            <Input value={form.title} onChange={(e) => setForm((t) => ({ ...t, title: e.target.value }))} className="mt-1" placeholder="e.g. Complete IT asset setup" data-testid="input-task-title" />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Input value={form.description} onChange={(e) => setForm((t) => ({ ...t, description: e.target.value }))} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Assigned To</label>
              <Select value={form.ownedByRole} onValueChange={(v) => setForm((t) => ({ ...t, ownedByRole: v }))}>
                <SelectTrigger className="mt-1" data-testid="select-task-owner">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Due (days from join)</label>
              <Input type="number" value={form.dueDaysFromJoin} onChange={(e) => setForm((t) => ({ ...t, dueDaysFromJoin: parseInt(e.target.value) || 7 }))} className="mt-1" min={1} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button onClick={() => create.mutate(form)} disabled={create.isPending || !form.title} data-testid="button-submit-task">
              {create.isPending ? "Adding..." : "Add Task"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
