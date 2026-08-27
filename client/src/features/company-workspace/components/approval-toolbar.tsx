import { type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MousePointerClick, ChevronLeft, ChevronRight } from "lucide-react";

// Shared header row for every approval surface (reimbursement / office / procurement / travel) so they
// all read identically — only the filter/sort content differs. Layout: search (leftmost) · filters · sort
// · extra (view toggle / date range / export) · [right] Select · pagination. Selection *actions* stay with
// each caller (their bulk logic differs); this owns the uniform chrome only.
export function ApprovalToolbar({
  search, onSearch, searchPlaceholder = "Search requests…",
  filters, sort, extra,
  selectable, selectionMode, onSelect, selectLabel = "Select",
  page, totalPages, onPage,
}: {
  search: string; onSearch: (v: string) => void; searchPlaceholder?: string;
  filters?: ReactNode; sort?: ReactNode; extra?: ReactNode;
  selectable?: boolean; selectionMode?: boolean; onSelect?: () => void; selectLabel?: string;
  page?: number; totalPages?: number; onPage?: (p: number) => void;
}) {
  const showPager = typeof page === "number" && typeof totalPages === "number" && !!onPage && totalPages > 1;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[180px] max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={searchPlaceholder} className="h-9 pl-8" data-testid="approval-search" />
      </div>
      {filters}
      {sort}
      {extra}
      {(selectable || showPager) && (
        <div className="ml-auto flex items-center gap-2">
          {selectable && !selectionMode && (
            <Button variant="secondary" size="sm" className="h-9 flex-shrink-0" onClick={onSelect} data-testid="approval-select">
              <MousePointerClick className="h-4 w-4 mr-1.5" /> {selectLabel}
            </Button>
          )}
          {showPager && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page! <= 1} onClick={() => onPage!(page! - 1)} data-testid="approval-page-prev"><ChevronLeft className="h-4 w-4" /></Button>
              <span className="px-1 tabular-nums">{page} / {totalPages}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page! >= totalPages!} onClick={() => onPage!(page! + 1)} data-testid="approval-page-next"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// A compact selection bar shown under the toolbar while selecting — Select all / count / Done, with the
// caller's bulk action buttons dropped in via `actions`. Shared so all surfaces select the same way.
export function ApprovalSelectionBar({ count, allSelected, onToggleAll, onDone, actions }: {
  count: number; allSelected: boolean; onToggleAll: () => void; onDone: () => void; actions?: ReactNode;
}) {
  return (
    <div className="card-surface rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onToggleAll} data-testid="approval-select-all">{allSelected ? "Clear" : "Select all"}</Button>
        <span className="text-sm font-medium">{count} selected</span>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <Button variant="secondary" size="sm" onClick={onDone} data-testid="approval-select-done">Done</Button>
      </div>
    </div>
  );
}
