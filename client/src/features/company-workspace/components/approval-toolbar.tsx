import { type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PaginationBar } from "@/components/shared/pagination";
import { Search, MousePointerClick, CheckSquare } from "lucide-react";

// RULE: every vertical separator in a toolbar is the full control height (h-9) so it reads as a real
// divider between the search and the controls — never hand-roll a shorter one.
const TB_SEP = "self-stretch flex-shrink-0";

// Shared header row for every approval surface (reimbursement / office / procurement / travel) so they
// all read identically — only the filter/sort content differs. Layout: search (leftmost) · filters · sort
// · extra (view toggle / date range / export) · [right] Select · pagination. Selection *actions* stay with
// each caller (their bulk logic differs); this owns the uniform chrome only.
export function ApprovalToolbar({
  search, onSearch, searchPlaceholder = "Search requests…",
  viewToggle, filters, sort, extra,
  selectable, selectionMode, onSelect, onExitSelect, allSelected, onToggleAll, selectLabel = "Select",
  page, totalPages, onPage, total, pageSize,
}: {
  search: string; onSearch: (v: string) => void; searchPlaceholder?: string;
  viewToggle?: ReactNode; filters?: ReactNode; sort?: ReactNode; extra?: ReactNode;
  selectable?: boolean; selectionMode?: boolean; onSelect?: () => void; onExitSelect?: () => void;
  allSelected?: boolean; onToggleAll?: () => void; selectLabel?: string;
  page?: number; totalPages?: number; onPage?: (p: number) => void; total?: number; pageSize?: number;
}) {
  const showPager = typeof page === "number" && typeof totalPages === "number" && !!onPage && totalPages > 1;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[180px] max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={searchPlaceholder} className="h-9 pl-8" data-testid="approval-search" />
      </div>
      {viewToggle && <><Separator orientation="vertical" className={TB_SEP} />{viewToggle}</>}
      {filters}
      {sort}
      {extra}
      {(selectable || showPager) && (
        <div className="ml-auto flex items-center gap-2">
          {selectable && (selectionMode ? (
            <>
              {onToggleAll && <Button variant="outline" size="sm" className="h-9 flex-shrink-0" onClick={onToggleAll} data-testid="approval-select-all"><CheckSquare className="h-4 w-4 mr-1.5" /> {allSelected ? "Clear" : "All"}</Button>}
              <Button variant="secondary" size="sm" className="h-9 flex-shrink-0" onClick={onExitSelect} data-testid="approval-select-done">Done</Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" className="h-9 flex-shrink-0" onClick={onSelect} data-testid="approval-select">
              <MousePointerClick className="h-4 w-4 mr-1.5" /> {selectLabel}
            </Button>
          ))}
          {showPager && <PaginationBar page={page!} totalPages={totalPages!} onPage={onPage!} count={total ?? 0} size={pageSize ?? 15} compact />}
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
