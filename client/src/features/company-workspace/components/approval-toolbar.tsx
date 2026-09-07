import { type ReactNode, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose, SheetFooter } from "@/components/ui/sheet";
import { PaginationBar } from "@/components/shared/pagination";
import { Search, MousePointerClick, CheckSquare, SlidersHorizontal } from "lucide-react";

// RULE: every vertical separator in a toolbar is the full control height (h-9) so it reads as a real
// divider between the search and the controls — never hand-roll a shorter one.
const TB_SEP = "self-stretch flex-shrink-0";

// Shared header row for every approval surface (reimbursement / office / procurement / travel) so they
// all read identically — only the filter/sort content differs. Layout: search (leftmost) | filters | sort
// | extra (view toggle / date range / export) | [right] Select | pagination. Selection *actions* stay with
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const hasSheetContent = !!(filters || sort || extra);
  // Select + pager cluster, reused on the desktop row and the mobile second row.
  const selectPager = (selectable || showPager) ? (
    <div className="flex items-center gap-2">
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
  ) : null;
  return (
    <>
      {/* Desktop — original inline row (unchanged). */}
      <div className="hidden sm:flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={searchPlaceholder} className="h-9 pl-8" data-testid="approval-search" />
        </div>
        {viewToggle && <><Separator orientation="vertical" className={TB_SEP} />{viewToggle}</>}
        {filters}
        {sort}
        {extra}
        {selectPager && <div className="ml-auto">{selectPager}</div>}
      </div>

      {/* Mobile — search + a Filters bottom sheet (phase / filters / sort / date range stack inside); view toggle hidden (card-only). */}
      <div className="sm:hidden space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={searchPlaceholder} className="h-9 pl-8" data-testid="approval-search-mobile" />
          </div>
          {hasSheetContent && (
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="secondary" size="sm" className="h-9 flex-shrink-0" data-testid="approval-filters-mobile"><SlidersHorizontal className="h-4 w-4 mr-1.5" /> Filters</Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
                <SheetHeader className="text-left"><SheetTitle>Filters</SheetTitle></SheetHeader>
                <div className="flex flex-col gap-3 py-4 [&>*]:w-full [&_[role=combobox]]:w-full [&_.segmented-toggle]:w-full [&_.segmented-toggle]:justify-between">
                  {filters}
                  {sort}
                  {extra}
                </div>
                <SheetFooter><SheetClose asChild><Button className="w-full btn-primary-gradient text-white" data-testid="approval-filters-done">Show results</Button></SheetClose></SheetFooter>
              </SheetContent>
            </Sheet>
          )}
        </div>
        {selectPager}
      </div>
    </>
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
