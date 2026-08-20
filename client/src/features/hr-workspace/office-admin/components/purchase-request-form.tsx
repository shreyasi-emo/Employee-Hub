import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DateInput } from "@/components/shared/datetime-field";
import { useToast } from "@/hooks/use-toast";
import { useCreatePurchaseRequest } from "../api/office-admin.api";

// Office Admin's own purchase request (vendors + payments side). Distinct from the employee
// Purchase Request on Company Workspace, which writes to /api/office-purchases.
const BLANK = { category: "office_supplies", notes: "", estimatedCost: "", neededByDate: "" };

const CATEGORIES = [
  ["office_supplies", "Office Supplies"],
  ["equipment", "Equipment"],
  ["software", "Software"],
  ["it_hardware", "IT Hardware"],
  ["furniture", "Furniture"],
  ["maintenance", "Maintenance"],
  ["other", "Other"],
] as const;

export function PurchaseRequestFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm({ defaultValues: BLANK });
  const close = () => { form.reset(BLANK); onClose(); };

  const mutation = useCreatePurchaseRequest({
    onSuccess: () => { toast({ title: "Purchase request created" }); close(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New Purchase Request</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.watch("category")} onValueChange={(v) => form.setValue("category", v)}>
              <SelectTrigger data-testid="select-pr-cat"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Description / Notes *</Label><Textarea rows={2} {...form.register("notes", { required: true })} data-testid="textarea-pr-notes" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Estimated Cost (₹)</Label><Input type="number" min="0" {...form.register("estimatedCost")} data-testid="input-pr-cost" /></div>
            <div className="space-y-1.5"><Label>Needed By</Label><Controller control={form.control} name="neededByDate" render={({ field }) => <DateInput value={field.value || ""} onChange={field.onChange} testId="input-pr-needed" />} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-save-pr">
              {mutation.isPending ? "Creating..." : "Create Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
