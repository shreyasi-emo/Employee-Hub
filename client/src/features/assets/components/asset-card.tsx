import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, User, Calendar, X } from "lucide-react";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { catColorOf, condColorOf } from "../lib/asset-taxonomy";

export function AssetCard({ asset, assignedTo, canManage, onOpen, onQuickDelete }: {
  asset: any;
  assignedTo?: any;
  canManage: boolean;
  onOpen: () => void;
  onQuickDelete: (id: string) => void;
}) {
  const isMobile = useIsMobile();
  const catColor = catColorOf(asset.category);
  const condColor = condColorOf(asset.condition);

  const statusBadge =
    asset.status === "available" ? (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-[10px] flex-shrink-0">Available</Badge>
    ) : asset.status === "assigned" ? (
      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] flex-shrink-0">Assigned</Badge>
    ) : (
      <Badge variant="outline" className="text-[10px] capitalize flex-shrink-0">{asset.status}</Badge>
    );

  // Mobile: a compact single-row card (icon · name/code·category/condition·assignee · delete).
  if (isMobile) {
    return (
      <Card className="hover-elevate relative cursor-pointer" data-testid={`asset-${asset.id}`} onClick={onOpen}>
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm text-foreground truncate">{asset.name}</p>
                {statusBadge}
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {asset.assetCode}
                <span className="mx-1.5 text-border">|</span>
                <span className="capitalize">{asset.category?.replace("_", " ")}</span>
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1 min-w-0">
                <Badge className={`text-[10px] capitalize flex-shrink-0 ${condColor}`}>{asset.condition}</Badge>
                {assignedTo && (
                  <>
                    <span className="text-border flex-shrink-0">|</span>
                    <span className="inline-flex items-center gap-1 min-w-0"><User className="h-3 w-3 flex-shrink-0" /><span className="truncate">{assignedTo.firstName} {assignedTo.lastName}</span></span>
                  </>
                )}
                {asset.purchaseValue && (
                  <>
                    <span className="text-border flex-shrink-0">|</span>
                    <span className="whitespace-nowrap flex-shrink-0">₹{parseFloat(asset.purchaseValue).toLocaleString("en-IN")}</span>
                  </>
                )}
              </div>
            </div>
            {canManage && (
              <button
                className="w-7 h-7 rounded-full bg-background/80 border border-border flex items-center justify-center hover:bg-destructive hover:border-destructive hover:text-destructive-foreground text-muted-foreground flex-shrink-0"
                onClick={e => {
                  e.stopPropagation();
                  if (window.confirm(`Delete "${asset.name}"?`)) {
                    onQuickDelete(asset.id);
                  }
                }}
                data-testid={`button-delete-asset-${asset.id}`}
                title="Delete asset"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="hover-elevate relative cursor-pointer group"
      data-testid={`asset-${asset.id}`}
      onClick={onOpen}
    >
      {canManage && (
        <button
          className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-background/80 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:border-destructive hover:text-destructive-foreground text-muted-foreground"
          onClick={e => {
            e.stopPropagation();
            if (window.confirm(`Delete "${asset.name}"?`)) {
              onQuickDelete(asset.id);
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
}
