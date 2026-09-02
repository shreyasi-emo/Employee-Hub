import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { BLANK_ASSET, cleanAssetPayload } from "../lib/asset-taxonomy";
import { useCreateAsset } from "../api/assets.api";
import { AssetFormFields } from "./asset-form-fields";

export function AddAssetDialog({ open, onOpenChange, employees }: { open: boolean; onOpenChange: (v: boolean) => void; employees: any[] }) {
  const { toast } = useToast();
  const [form, setForm] = useState(BLANK_ASSET);

  const mutation = useCreateAsset({
    onSuccess: () => {
      toast({ title: "Asset created" });
      onOpenChange(false);
      setForm(BLANK_ASSET);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    mutation.mutate({
      ...cleanAssetPayload(form),
      assignedDate: form.employeeId ? new Date().toISOString().split("T")[0] : undefined,
      status: form.employeeId ? "assigned" : form.status,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0 border-b border-border">
          <DialogTitle>Add Asset</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          <AssetFormFields form={form} setForm={setForm} employees={employees} />
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending || !form.name || !form.assetCode} data-testid="button-submit-asset">
            {mutation.isPending ? "Creating..." : "Create Asset"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
