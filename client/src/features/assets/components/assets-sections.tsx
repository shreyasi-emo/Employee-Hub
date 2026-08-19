// The assets page's own chrome: title bar, filter row, category chips, and the
// grid / loading / empty states.

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Plus, Search } from "lucide-react";
import { categoryColors } from "../lib/asset-taxonomy";
import { AssetCard } from "./asset-card";

export function AssetsHeader({ total, canManage, onAdd }: { total: number; canManage: boolean; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Assets</h1>
        <p className="text-sm text-muted-foreground">{total} assets total</p>
      </div>
      {canManage && (
        <Button onClick={onAdd} data-testid="button-add-asset">
          <Plus className="h-4 w-4 mr-2" />
          Add Asset
        </Button>
      )}
    </div>
  );
}

export function AssetsFilterBar({ search, onSearch, category, onCategory, status, onStatus }: {
  search: string; onSearch: (v: string) => void;
  category: string; onCategory: (v: string) => void;
  status: string; onStatus: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, code, serial..."
          value={search}
          onChange={e => onSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-assets"
        />
      </div>
      <Select value={category} onValueChange={onCategory}>
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
      <Select value={status} onValueChange={onStatus}>
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
  );
}

/** Tinted count chips, one per category present in the filtered set. Clicking toggles that filter. */
export function CategoryChips({ assetsByCategory, active, onToggle }: {
  assetsByCategory: Record<string, any[]>; active: string; onToggle: (cat: string) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {Object.entries(assetsByCategory).filter(([, items]) => items.length > 0).map(([cat, items]) => (
        <button
          key={cat}
          className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-opacity hover:opacity-80 ${categoryColors[cat] || categoryColors.other}`}
          onClick={() => onToggle(cat === active ? "all" : cat)}
          data-testid={`chip-category-${cat}`}
        >
          {cat.replace("_", " ")} ({items.length})
        </button>
      ))}
    </div>
  );
}

export function AssetsLoading() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-44 w-full rounded-lg" />)}
    </div>
  );
}

export function AssetsEmpty() {
  return (
    <div className="text-center py-16">
      <Package className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-foreground">No assets found</h3>
      <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filters</p>
    </div>
  );
}

export function AssetGrid({ assets, employees, canManage, onOpen, onQuickDelete }: {
  assets: any[]; employees: any[]; canManage: boolean;
  onOpen: (a: any) => void; onQuickDelete: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {assets.map((asset: any) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          assignedTo={employees.find((e: any) => e.id === asset.employeeId)}
          canManage={canManage}
          onOpen={() => onOpen(asset)}
          onQuickDelete={onQuickDelete}
        />
      ))}
    </div>
  );
}
