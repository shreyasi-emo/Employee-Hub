import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useCreateCandidate } from "../api/ats.api";

const BLANK = { name: "", email: "", phone: "", currentRole: "", currentCompany: "", experienceYears: "", source: "linkedin" };

const SOURCES = [
  ["linkedin", "LinkedIn"], ["naukri", "Naukri"], ["referral", "Referral"],
  ["agency", "Agency"], ["direct", "Direct Apply"], ["other", "Other"],
] as const;

export function CandidateFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm({ defaultValues: BLANK });
  const close = () => { form.reset(BLANK); onClose(); };

  const mutation = useCreateCandidate({
    onSuccess: () => { toast({ title: "Candidate added" }); close(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Candidate</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Full Name *</Label>
            <Input {...form.register("name", { required: true })} placeholder="e.g. John Doe" data-testid="input-cand-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" {...form.register("email", { required: true })} placeholder="john@email.com" data-testid="input-cand-email" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input type="tel" inputMode="tel" {...form.register("phone")} placeholder="+91 9876543210" data-testid="input-cand-phone" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Current Role</Label>
              <Input {...form.register("currentRole")} data-testid="input-cand-role" />
            </div>
            <div className="space-y-1.5">
              <Label>Current Company</Label>
              <Input {...form.register("currentCompany")} data-testid="input-cand-company" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Experience (years)</Label>
              <Input type="number" min="0" {...form.register("experienceYears")} data-testid="input-cand-exp" />
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={form.watch("source")} onValueChange={(v) => form.setValue("source", v)}>
                <SelectTrigger data-testid="select-cand-source"><SelectValue /></SelectTrigger>
                <SelectContent>{SOURCES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-save-candidate">
              {mutation.isPending ? "Adding..." : "Add Candidate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
