// The page's own chrome: title bar, stat cards, and the filter/sort/view toolbar.
// Kept beside the page so announcements-page.tsx stays a list of named parts.

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/shared/stat-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Megaphone, Plus, ArrowDownUp, List, LayoutGrid, SlidersHorizontal, X } from "lucide-react";
import { catMeta } from "../lib/categories";

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

export function AnnouncementsHeader({ canManage, onNew }: { canManage: boolean; onNew: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Announcements</h1>
        <p className="text-sm text-muted-foreground mt-1">Stay informed with the latest updates and important notifications.</p>
      </div>
      {canManage && (
        <Button onClick={onNew} className="btn-primary-gradient" data-testid="button-new-announcement">
          <Plus className="h-4 w-4 mr-2" /> New Announcement
        </Button>
      )}
    </div>
  );
}

export function AnnouncementStats({ announcements, categories }: { announcements: any[]; categories: string[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard title="Total" value={announcements.length} subtitle="All announcements" icon={Megaphone} color="bg-[#206295]/15 text-[#206295]" />
      {categories.map((cat) => {
        const meta = catMeta(cat);
        return (
          <StatCard
            key={cat}
            title={cap(cat)}
            value={announcements.filter((a) => a.category === cat).length}
            subtitle={meta.desc}
            icon={meta.icon}
            color={meta.tile}
          />
        );
      })}
    </div>
  );
}

export function AnnouncementsToolbar({ announcements, categories, categoryFilter, onCategory, sort, onSort, view, onView }: {
  announcements: any[]; categories: string[];
  categoryFilter: string; onCategory: (v: string) => void;
  sort: string; onSort: (v: string) => void;
  view: "list" | "grid"; onView: (v: "list" | "grid") => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  // Active (non-default) filters — counted on the Filters button and shown as dismissible chips.
  const chips: { key: string; label: string; onClear: () => void }[] = [];
  if (categoryFilter !== "all") chips.push({ key: "category", label: cap(categoryFilter), onClear: () => onCategory("all") });
  if (sort !== "latest") chips.push({ key: "sort", label: "Oldest first", onClear: () => onSort("latest") });
  const resetAll = () => { onCategory("all"); onSort("latest"); };

  return (
    <>
      {/* Desktop: category tabs + sort + view toggle inline (unchanged). */}
      <div className="hidden sm:flex items-center justify-between gap-3 flex-wrap">
        {/* Canonical shadcn Tabs (same as My Requests / Team Requests) */}
        <Tabs value={categoryFilter} onValueChange={onCategory} className="min-w-0 max-w-full overflow-x-auto no-scrollbar">
          <TabsList>
            <TabsTrigger value="all" data-testid="filter-all">All ({announcements.length})</TabsTrigger>
            {categories.map((c) => (
              <TabsTrigger key={c} value={c} data-testid={`filter-${c}`}>
                {cap(c)} ({announcements.filter((a) => a.category === c).length})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-3">
          <Select value={sort} onValueChange={onSort}>
            <SelectTrigger className="h-10 w-[170px] gap-1 flex-shrink-0" data-testid="select-sort">
              <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Sort:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>

          {/* Canonical view toggle (segmented-toggle + btn-primary-gradient), same as My Requests */}
          <div className="segmented-toggle inline-flex p-0.5 h-10 flex-shrink-0">
            <button onClick={() => onView("list")} aria-label="List view" data-testid="view-list" className={`px-3 h-full rounded-[10px] inline-flex items-center justify-center ${view === "list" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`}><List className="h-4 w-4" /></button>
            <button onClick={() => onView("grid")} aria-label="Grid view" data-testid="view-grid" className={`px-3 h-full rounded-[10px] inline-flex items-center justify-center ${view === "grid" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`}><LayoutGrid className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {/* Mobile: Filters on its own row (no search on this toolbar); view toggle below; category + sort behind one badged Filters sheet. */}
      <div className="sm:hidden space-y-3">
        <div className="flex items-center gap-2">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="secondary" size="sm" className="ml-auto" data-testid="button-filters-mobile">
                <SlidersHorizontal className="h-4 w-4 mr-1.5" /> Filters
                {chips.length > 0 && <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#206295] px-1 text-[10px] font-bold text-white">{chips.length}</span>}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
              <SheetHeader className="text-left"><SheetTitle>Filters</SheetTitle></SheetHeader>
              <div className="space-y-4 py-4">
                <FilterField label="Category">
                  <Select value={categoryFilter} onValueChange={onCategory}>
                    <SelectTrigger className="w-full" data-testid="sheet-category-filter"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All ({announcements.length})</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>{cap(c)} ({announcements.filter((a) => a.category === c).length})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>
                <FilterField label="Sort">
                  <Select value={sort} onValueChange={onSort}>
                    <SelectTrigger className="w-full" data-testid="sheet-sort"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="latest">Newest</SelectItem>
                      <SelectItem value="oldest">Oldest</SelectItem>
                    </SelectContent>
                  </Select>
                </FilterField>
              </div>
              <SheetFooter className="flex-row gap-2">
                <Button variant="outline" className="flex-1" onClick={resetAll} data-testid="sheet-reset">Reset</Button>
                <SheetClose asChild><Button className="flex-1 btn-primary-gradient text-white" data-testid="sheet-apply">Show results</Button></SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
        <div className="flex items-center gap-2">
          {/* Canonical view toggle (segmented-toggle + btn-primary-gradient), same as My Requests */}
          <div className="segmented-toggle inline-flex p-0.5 h-10 flex-shrink-0">
            <button onClick={() => onView("list")} aria-label="List view" data-testid="view-list-mobile" className={`px-3 h-full rounded-[10px] inline-flex items-center justify-center ${view === "list" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`}><List className="h-4 w-4" /></button>
            <button onClick={() => onView("grid")} aria-label="Grid view" data-testid="view-grid-mobile" className={`px-3 h-full rounded-[10px] inline-flex items-center justify-center ${view === "grid" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`}><LayoutGrid className="h-4 w-4" /></button>
          </div>
        </div>
        {chips.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {chips.map((c) => (
              <button key={c.key} onClick={c.onClear} className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2.5 py-1 text-xs text-foreground hover-elevate" data-testid={`chip-${c.key}`}>
                <span className="truncate max-w-[8rem]">{c.label}</span> <X className="h-3 w-3 flex-shrink-0" />
              </button>
            ))}
            {chips.length > 1 && <button onClick={resetAll} className="text-xs font-medium text-[#206295] underline underline-offset-2" data-testid="chip-clear-all">Clear all</button>}
          </div>
        )}
      </div>
    </>
  );
}

export function AnnouncementsLoading() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
    </div>
  );
}

export function AnnouncementsEmpty({ canManage }: { canManage: boolean }) {
  return (
    <div className="text-center py-16">
      <Megaphone className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-foreground">No announcements</h3>
      <p className="text-sm text-muted-foreground mt-1">
        {canManage ? "Create your first announcement" : "Check back later"}
      </p>
    </div>
  );
}
