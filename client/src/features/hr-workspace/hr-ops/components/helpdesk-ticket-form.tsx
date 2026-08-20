import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cap } from "@/features/company-workspace/shared/approval-format";
import { TICKET_CATEGORIES } from "@/features/company-workspace/tickets/lib/ticket-categories";
import { useCreateHelpdeskTicket } from "../api/hr-ops.api";

// The HR helpdesk ticket. Looks like the employee Support Ticket but writes to a different
// table (/api/workspace/tickets vs /api/my-requests/tickets), so they stay separate components
// and only share the category list.
const BLANK = { subject: "", description: "", category: "hr_query", priority: "medium" };
const PRIORITIES = ["low", "medium", "high", "critical"] as const;
const LABEL: Record<string, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };

export function HelpdeskTicketFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm({ defaultValues: BLANK });
  const close = () => { form.reset(BLANK); onClose(); };

  const mutation = useCreateHelpdeskTicket({
    onSuccess: () => { toast({ title: "Ticket raised" }); close(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Raise Helpdesk Ticket</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Subject *</Label>
            <Input {...form.register("subject", { required: true })} placeholder="Brief subject..." data-testid="input-ticket-subject" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={3} {...form.register("description")} placeholder="Describe your issue..." data-testid="textarea-ticket-desc" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.watch("category")} onValueChange={(v) => form.setValue("category", v)}>
                <SelectTrigger data-testid="select-ticket-category"><SelectValue /></SelectTrigger>
                <SelectContent>{TICKET_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{cap(c)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.watch("priority")} onValueChange={(v) => form.setValue("priority", v)}>
                <SelectTrigger data-testid="select-ticket-priority"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{LABEL[p]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-save-ticket">
              {mutation.isPending ? "Raising..." : "Raise Ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
