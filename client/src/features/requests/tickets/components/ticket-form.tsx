import { cap } from "../../shared/approval-format";
import { TICKET_CATEGORIES } from "../lib/ticket-categories";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { X } from "lucide-react";

// ===================== Forms =====================
export function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["/api/my-requests/summary"] });
    qc.invalidateQueries({ queryKey: ["/api/my-requests/purchases"] });
    qc.invalidateQueries({ queryKey: ["/api/my-requests/travels"] });
    qc.invalidateQueries({ queryKey: ["/api/my-requests/tickets"] });
    qc.invalidateQueries({ queryKey: ["/api/reimbursements"] });
  };
}

export function TicketForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const invalidate = useInvalidate();
  const form = useForm({ defaultValues: { category: "hr_query", subject: "", description: "", priority: "medium" } });
  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/my-requests/tickets", data),
    onSuccess: () => { invalidate(); toast({ title: "Ticket submitted successfully" }); form.reset(); onClose(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  // Cancel / X discards input (fresh form next open).
  const handleClose = () => { form.reset(); onClose(); };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Raise Support Ticket</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Category</Label>
              <Select value={form.watch("category")} onValueChange={(v) => form.setValue("category", v)}>
                <SelectTrigger data-testid="select-ticket-cat"><SelectValue /></SelectTrigger>
                <SelectContent>{TICKET_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{cap(c)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Priority</Label>
              <Select value={form.watch("priority")} onValueChange={(v) => form.setValue("priority", v)}>
                <SelectTrigger data-testid="select-ticket-pri"><SelectValue /></SelectTrigger>
                <SelectContent>{["low", "medium", "high", "critical"].map((c) => <SelectItem key={c} value={c}>{cap(c)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Subject *</Label><Input {...form.register("subject", { required: true })} placeholder="Brief subject…" /></div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea rows={3} {...form.register("description")} placeholder="Describe your issue in detail…" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-ticket">{mutation.isPending ? "Submitting…" : "Submit Ticket"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
