import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useCreateVendor } from "../api/office-admin.api";

const BLANK = { name: "", category: "supplier", contactName: "", email: "", phone: "", gstNumber: "", panNumber: "" };

const CATEGORIES = [
  ["supplier", "Supplier"],
  ["service_provider", "Service Provider"],
  ["contractor", "Contractor"],
  ["consultant", "Consultant"],
  ["travel_agency", "Travel Agency"],
  ["other", "Other"],
] as const;

export function VendorFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm({ defaultValues: BLANK });
  const close = () => { form.reset(BLANK); onClose(); };

  const mutation = useCreateVendor({
    onSuccess: () => { toast({ title: "Vendor added" }); close(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Vendor</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5"><Label>Vendor Name *</Label><Input {...form.register("name", { required: true })} data-testid="input-vendor-name" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.watch("category")} onValueChange={(v) => form.setValue("category", v)}>
                <SelectTrigger data-testid="select-vendor-cat"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Contact Name</Label><Input {...form.register("contactName")} data-testid="input-vendor-contact" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" {...form.register("email")} data-testid="input-vendor-email" /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input type="tel" inputMode="tel" {...form.register("phone")} data-testid="input-vendor-phone" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>GST Number</Label><Input {...form.register("gstNumber")} data-testid="input-vendor-gst" /></div>
            <div className="space-y-1.5"><Label>PAN Number</Label><Input {...form.register("panNumber")} data-testid="input-vendor-pan" /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-save-vendor">
              {mutation.isPending ? "Adding..." : "Add Vendor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
