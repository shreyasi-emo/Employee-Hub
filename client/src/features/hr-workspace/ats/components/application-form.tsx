import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useCreateApplication } from "../api/ats.api";

const BLANK = { requisitionId: "", candidateId: "" };

// Joins a candidate to a requisition. Only approved/open requisitions can be applied to.
export function ApplicationFormDialog({ open, onClose, requisitions, candidates, firstStageId, initialCandidateId }: {
  open: boolean;
  onClose: () => void;
  requisitions: any[];
  candidates: any[];
  /** Pipeline stage a new application enters at. */
  firstStageId: string | undefined;
  /** Pre-selects the candidate — set by the "Apply" button on a candidate row. */
  initialCandidateId?: string;
}) {
  const { toast } = useToast();
  const form = useForm({ defaultValues: BLANK });
  const close = () => { form.reset(BLANK); onClose(); };

  useEffect(() => {
    if (open) form.reset({ ...BLANK, candidateId: initialCandidateId || "" });
  }, [open, initialCandidateId]);

  const mutation = useCreateApplication(firstStageId, {
    onSuccess: () => { toast({ title: "Application created" }); close(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const open_ = requisitions.filter((r) => ["approved", "open"].includes(r.status));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Create Application</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Job Requisition *</Label>
            <Select value={form.watch("requisitionId")} onValueChange={(v) => form.setValue("requisitionId", v)}>
              <SelectTrigger data-testid="select-app-req"><SelectValue placeholder="Select requisition..." /></SelectTrigger>
              <SelectContent>
                {open_.map((r) => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Candidate *</Label>
            <Select value={form.watch("candidateId")} onValueChange={(v) => form.setValue("candidateId", v)}>
              <SelectTrigger data-testid="select-app-candidate"><SelectValue placeholder="Select candidate..." /></SelectTrigger>
              <SelectContent>
                {candidates.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} — {c.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending || !form.watch("requisitionId") || !form.watch("candidateId")} data-testid="button-save-application">
              {mutation.isPending ? "Creating..." : "Create Application"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
