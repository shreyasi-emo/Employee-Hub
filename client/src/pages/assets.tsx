import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, isHR } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/shared/datetime-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Package, Plus, Search, Calendar, User, X, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const categoryColors: Record<string, string> = {
  laptop: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  mobile: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  desktop: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  monitor: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  peripherals: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  software: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  furniture: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  access_card: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  phone: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
};

const conditionColors: Record<string, string> = {
  new: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  excellent: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  good: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  fair: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  poor: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

function AssetFormFields({ form, setForm, employees }: { form: any; setForm: any; employees: any[] }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Asset Name *</label>
          <Input value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} className="mt-1" data-testid="input-asset-name" />
        </div>
        <div>
          <label className="text-sm font-medium">Asset Code *</label>
          <Input value={form.assetCode} onChange={e => setForm((f: any) => ({ ...f, assetCode: e.target.value.toUpperCase() }))} className="mt-1" placeholder="e.g. LAPTOP-042" data-testid="input-asset-code" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Category</label>
          <Select value={form.category} onValueChange={v => setForm((f: any) => ({ ...f, category: v }))}>
            <SelectTrigger className="mt-1" data-testid="select-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(categoryColors).map(c => (
                <SelectItem key={c} value={c} className="capitalize">{c.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Condition</label>
          <Select value={form.condition} onValueChange={v => setForm((f: any) => ({ ...f, condition: v }))}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(conditionColors).map(c => (
                <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Serial Number</label>
        <Input value={form.serialNumber} onChange={e => setForm((f: any) => ({ ...f, serialNumber: e.target.value }))} className="mt-1" placeholder="e.g. SN-XXXXX" />
      </div>
      <div>
        <label className="text-sm font-medium">Assign To Employee</label>
        <Select value={form.employeeId || "unassigned"} onValueChange={v => setForm((f: any) => ({ ...f, employeeId: v === "unassigned" ? "" : v }))}>
          <SelectTrigger className="mt-1" data-testid="select-employee">
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {employees.map((e: any) => (
              <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Purchase Date</label>
          <DateInput value={form.purchaseDate} onChange={v => setForm((f: any) => ({ ...f, purchaseDate: v }))} className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">Purchase Value (₹)</label>
          <Input type="number" value={form.purchaseValue} onChange={e => setForm((f: any) => ({ ...f, purchaseValue: e.target.value }))} className="mt-1" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Status</label>
        <Select value={form.status} onValueChange={v => setForm((f: any) => ({ ...f, status: v }))}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <Input value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} className="mt-1" placeholder="Optional notes" />
      </div>
    </div>
  );
}

function AddAssetDialog({ open, onOpenChange, employees }: { open: boolean; onOpenChange: (v: boolean) => void; employees: any[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const emptyForm = { name: "", assetCode: "", category: "laptop", serialNumber: "", condition: "good", employeeId: "", purchaseDate: "", purchaseValue: "", description: "", status: "available" };
  const [form, setForm] = useState(emptyForm);

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/assets", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({ title: "Asset created" });
      onOpenChange(false);
      setForm(emptyForm);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    mutation.mutate({
      ...form,
      purchaseValue: form.purchaseValue || undefined,
      purchaseDate: form.purchaseDate || undefined,
      employeeId: form.employeeId || undefined,
      assignedDate: form.employeeId ? new Date().toISOString().split("T")[0] : undefined,
      status: form.employeeId ? "assigned" : form.status,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Asset</DialogTitle>
        </DialogHeader>
        <AssetFormFields form={form} setForm={setForm} employees={employees} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending || !form.name || !form.assetCode} data-testid="button-submit-asset">
            {mutation.isPending ? "Creating..." : "Create Asset"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssetDetailDialog({ asset, employees, onClose, canEdit }: { asset: any; employees: any[]; onClose: () => void; canEdit: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
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
  const catColor = categoryColors[asset.category] || categoryColors.other;
  const condColor = conditionColors[asset.condition] || conditionColors.good;

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/assets/${asset.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({ title: "Asset updated" });
      setEditing(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/assets/${asset.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({ title: "Asset deleted" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSave = () => {
    updateMutation.mutate({
      ...form,
      purchaseValue: form.purchaseValue || undefined,
      purchaseDate: form.purchaseDate || undefined,
      employeeId: form.employeeId || undefined,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            {editing ? "Edit Asset" : asset.name}
          </DialogTitle>
        </DialogHeader>

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
                onClick={() => deleteMutation.mutate()}
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
                  className={`text-xs capitalize ${asset.status === "assigned" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" : asset.status === "available" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : "bg-gray-100 text-gray-800 dark:bg-gray-700"}`}
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
      </DialogContent>
    </Dialog>
  );
}

export default function AssetsPage() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);

  const queryKey = `/api/assets?category=${categoryFilter !== "all" ? categoryFilter : ""}&status=${statusFilter !== "all" ? statusFilter : ""}`;
  const { data: assets = [], isLoading } = useQuery<any[]>({ queryKey: [queryKey] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });

  const quickDelete = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/assets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({ title: "Asset deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = assets.filter((a: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return a.name?.toLowerCase().includes(q) || a.assetCode?.toLowerCase().includes(q) || a.serialNumber?.toLowerCase().includes(q);
  });

  const assetsByCategory: Record<string, any[]> = {};
  for (const a of filtered) {
    const cat = a.category || "other";
    if (!assetsByCategory[cat]) assetsByCategory[cat] = [];
    assetsByCategory[cat].push(a);
  }

  const hrUser = isHR(user!);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Assets</h1>
          <p className="text-sm text-muted-foreground">{assets.length} assets total</p>
        </div>
        {hrUser && (
          <Button onClick={() => setShowAdd(true)} data-testid="button-add-asset">
            <Plus className="h-4 w-4 mr-2" />
            Add Asset
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, code, serial..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-assets"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40" data-testid="select-category-filter">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.keys(categoryColors).map(c => (
              <SelectItem key={c} value={c} className="capitalize">{c.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 flex-wrap">
        {Object.entries(assetsByCategory).filter(([, items]) => items.length > 0).map(([cat, items]) => (
          <button
            key={cat}
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-opacity hover:opacity-80 ${categoryColors[cat] || categoryColors.other}`}
            onClick={() => setCategoryFilter(cat === categoryFilter ? "all" : cat)}
            data-testid={`chip-category-${cat}`}
          >
            {cat.replace("_", " ")} ({items.length})
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Package className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground">No assets found</h3>
          <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((asset: any) => {
            const assignedTo = employees.find((e: any) => e.id === asset.employeeId);
            const catColor = categoryColors[asset.category] || categoryColors.other;
            const condColor = conditionColors[asset.condition] || conditionColors.good;

            return (
              <Card
                key={asset.id}
                className="hover-elevate relative cursor-pointer group"
                data-testid={`asset-${asset.id}`}
                onClick={() => setSelectedAsset(asset)}
              >
                {hrUser && (
                  <button
                    className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-background/80 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:border-destructive hover:text-destructive-foreground text-muted-foreground"
                    onClick={e => {
                      e.stopPropagation();
                      if (window.confirm(`Delete "${asset.name}"?`)) {
                        quickDelete.mutate(asset.id);
                      }
                    }}
                    data-testid={`button-delete-asset-${asset.id}`}
                    title="Delete asset"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end pr-6">
                      <Badge className={`text-xs capitalize ${catColor}`}>{asset.category?.replace("_", " ")}</Badge>
                      {asset.status === "available" ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">Available</Badge>
                      ) : asset.status === "assigned" ? (
                        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs">Assigned</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs capitalize">{asset.status}</Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground leading-tight">{asset.name}</p>
                    <p className="text-xs text-muted-foreground">{asset.assetCode}</p>
                    {asset.serialNumber && (
                      <p className="text-xs text-muted-foreground">S/N: {asset.serialNumber}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Badge className={`text-xs capitalize ${condColor}`}>{asset.condition}</Badge>
                    {assignedTo && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {assignedTo.firstName} {assignedTo.lastName}
                        </span>
                      </div>
                    )}
                    {asset.assignedDate && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          Since {format(new Date(asset.assignedDate), "MMM d, yyyy")}
                        </span>
                      </div>
                    )}
                    {asset.purchaseValue && (
                      <p className="text-xs text-muted-foreground">
                        ₹{parseFloat(asset.purchaseValue).toLocaleString("en-IN")}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AddAssetDialog open={showAdd} onOpenChange={setShowAdd} employees={employees} />

      {selectedAsset && (
        <AssetDetailDialog
          asset={selectedAsset}
          employees={employees}
          onClose={() => setSelectedAsset(null)}
          canEdit={hrUser}
        />
      )}
    </div>
  );
}
