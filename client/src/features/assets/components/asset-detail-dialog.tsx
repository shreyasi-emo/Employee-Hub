import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Package, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { catColorOf, condColorOf, cleanAssetPayload } from "../lib/asset-taxonomy";
import { useUpdateAsset, useDeleteAsset } from "../api/assets.api";
import { AssetFormFields } from "./asset-form-fields";

/** Three modes in one dialog: read-only detail, inline edit, and delete confirm. */
export function AssetDetailDialog({ asset, employees, onClose, canEdit }: { asset: any; employees: any[]; onClose: () => void; canEdit: boolean }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({
    name: asset.name || "",
    assetCode: asset.assetCode || "",
    category: asset.category || "other",
    serialNumber: asset.serialNumber || "",
    condition: asset.condition || "good",
    employeeId: asset.employeeId || "",
    purchaseDate: asset.purchaseDate || "",
    purchaseValue: asset.purchaseValue || "",
    description: asset.description || "",
    status: asset.status || "available",
  });

  const assignedTo = employees.find((e: any) => e.id === asset.employeeId);
  const catColor = catColorOf(asset.category);
  const condColor = condColorOf(asset.condition);

  const updateMutation = useUpdateAsset(asset.id, {
    onSuccess: () => { toast({ title: "Asset updated" }); setEditing(false); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useDeleteAsset({
    onSuccess: () => { toast({ title: "Asset deleted" }); onClose(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSave = () => updateMutation.mutate(cleanAssetPayload(form));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            {editing ? "Edit Asset" : asset.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
        {confirmDelete ? (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive">Delete this asset?</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium">{asset.name}</span> ({asset.assetCode}) will be permanently removed. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate(asset.id)}
                disabled={deleteMutation.isPending}
                data-testid="button-confirm-delete-asset"
              >
                {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
              </Button>
            </div>
          </div>
        ) : editing ? (
          <>
            <AssetFormFields form={form} setForm={setForm} employees={employees} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending || !form.name || !form.assetCode}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{asset.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{asset.assetCode}</p>
              </div>
              <div className="flex flex-col gap-1 items-end">
                <Badge className={`text-xs capitalize ${catColor}`}>{asset.category?.replace("_", " ")}</Badge>
                <Badge className={`text-xs capitalize ${condColor}`}>{asset.condition}</Badge>
              </div>
            </div>

            <Separator />

            <div className="space-y-2 text-sm">
              {asset.serialNumber && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Serial No.</span>
                  <span className="font-mono text-xs">{asset.serialNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge
                  className={`text-xs capitalize ${asset.status === "assigned" ? "bg-[#206295]/12 text-[#206295]" : asset.status === "available" ? "bg-[#4BDCD9]/25 text-[#0E7C7B]" : "bg-muted text-muted-foreground"}`}
                >
                  {asset.status}
                </Badge>
              </div>
              {assignedTo && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assigned To</span>
                  <span className="font-medium">{assignedTo.firstName} {assignedTo.lastName}</span>
                </div>
              )}
              {asset.assignedDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Since</span>
                  <span>{format(new Date(asset.assignedDate), "MMM d, yyyy")}</span>
                </div>
              )}
              {asset.purchaseDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Purchase Date</span>
                  <span>{format(new Date(asset.purchaseDate), "MMM d, yyyy")}</span>
                </div>
              )}
              {asset.purchaseValue && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Value</span>
                  <span>₹{parseFloat(asset.purchaseValue).toLocaleString("en-IN")}</span>
                </div>
              )}
              {asset.description && (
                <div className="pt-1">
                  <p className="text-muted-foreground text-xs mb-1">Notes</p>
                  <p className="text-sm">{asset.description}</p>
                </div>
              )}
            </div>

            {canEdit && (
              <>
                <Separator />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setEditing(true)}
                    data-testid="button-edit-asset"
                  >
                    <Pencil className="h-4 w-4 mr-2" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 text-destructive hover:bg-destructive/10 hover:border-destructive"
                    onClick={() => setConfirmDelete(true)}
                    data-testid="button-delete-asset"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
