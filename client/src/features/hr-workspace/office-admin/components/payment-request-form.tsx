import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useCreatePayment } from "../api/office-admin.api";

const BLANK = { vendorId: "", paymentType: "vendor_payment", amount: "", currency: "INR", description: "" };

const TYPES = [
  ["vendor_payment", "Vendor Payment"],
  ["reimbursement", "Reimbursement"],
  ["advance", "Advance"],
  ["utility", "Utility"],
  ["other", "Other"],
] as const;
const CURRENCIES = ["INR", "USD", "EUR"] as const;

export function PaymentRequestFormDialog({ open, onClose, vendors }: {
  open: boolean;
  onClose: () => void;
  /** Vendor list for the picker — the page already has it loaded. */
  vendors: any[];
}) {
  const { toast } = useToast();
  const form = useForm({ defaultValues: BLANK });
  const close = () => { form.reset(BLANK); onClose(); };

  const mutation = useCreatePayment({
    onSuccess: () => { toast({ title: "Payment created" }); close(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New Payment Request</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Payment Type</Label>
            <Select value={form.watch("paymentType")} onValueChange={(v) => form.setValue("paymentType", v)}>
              <SelectTrigger data-testid="select-pay-type"><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Vendor</Label>
            <Select value={form.watch("vendorId")} onValueChange={(v) => form.setValue("vendorId", v)}>
              <SelectTrigger data-testid="select-pay-vendor"><SelectValue placeholder="Select vendor..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Amount *</Label><Input type="number" min="0" {...form.register("amount", { required: true })} data-testid="input-pay-amount" /></div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={form.watch("currency")} onValueChange={(v) => form.setValue("currency", v)}>
                <SelectTrigger data-testid="select-pay-currency"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} {...form.register("description")} data-testid="textarea-pay-desc" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-save-payment">
              {mutation.isPending ? "Creating..." : "Create Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
