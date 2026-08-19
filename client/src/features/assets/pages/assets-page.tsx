import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth, isHR } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useAssets, useDeleteAsset } from "../api/assets.api";
import {
  AssetsHeader, AssetsFilterBar, CategoryChips, AssetsLoading, AssetsEmpty, AssetGrid,
} from "../components/assets-sections";
import { AddAssetDialog } from "../components/add-asset-dialog";
import { AssetDetailDialog } from "../components/asset-detail-dialog";

export default function AssetsPage() {
  const { data: auth } = useAuth();
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

  const canManage = isHR(auth?.user!);

  // Category + status are filtered server-side; search is local.
  const filtered = assets.filter((a: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return a.name?.toLowerCase().includes(q) || a.assetCode?.toLowerCase().includes(q) || a.serialNumber?.toLowerCase().includes(q);
  });

  const assetsByCategory: Record<string, any[]> = {};
  for (const a of filtered) {
    const cat = a.category || "other";
    (assetsByCategory[cat] ||= []).push(a);
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <AssetsHeader total={assets.length} canManage={canManage} onAdd={() => setShowAdd(true)} />

      <AssetsFilterBar
        search={search} onSearch={setSearch}
        category={categoryFilter} onCategory={setCategoryFilter}
        status={statusFilter} onStatus={setStatusFilter}
      />

      <CategoryChips assetsByCategory={assetsByCategory} active={categoryFilter} onToggle={setCategoryFilter} />

      {isLoading ? (
        <AssetsLoading />
      ) : filtered.length === 0 ? (
        <AssetsEmpty />
      ) : (
        <AssetGrid
          assets={filtered}
          employees={employees}
          canManage={canManage}
          onOpen={setSelectedAsset}
          onQuickDelete={(id) => quickDelete.mutate(id)}
        />
      )}

      <AddAssetDialog open={showAdd} onOpenChange={setShowAdd} employees={employees} />

      {selectedAsset && (
        <AssetDetailDialog
          asset={selectedAsset}
          employees={employees}
          onClose={() => setSelectedAsset(null)}
          canEdit={canManage}
        />
      )}
    </div>
  );
}
