import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth, isHR } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Package, Plus, Search } from "lucide-react";
import { categoryColors } from "../lib/asset-taxonomy";
import { useAssets, useDeleteAsset } from "../api/assets.api";
import { AddAssetDialog } from "../components/add-asset-dialog";
import { AssetDetailDialog } from "../components/asset-detail-dialog";
import { AssetCard } from "../components/asset-card";

export default function AssetsPage() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);

  const { data: assets = [], isLoading } = useAssets(categoryFilter, statusFilter);
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });

  const quickDelete = useDeleteAsset({
    onSuccess: () => toast({ title: "Asset deleted" }),
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
          {filtered.map((asset: any) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              assignedTo={employees.find((e: any) => e.id === asset.employeeId)}
              canManage={hrUser}
              onOpen={() => setSelectedAsset(asset)}
              onQuickDelete={(id) => quickDelete.mutate(id)}
            />
          ))}
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
