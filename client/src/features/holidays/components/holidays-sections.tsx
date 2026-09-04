// The holidays page's own chrome: title bar, the four overview cards, the
// filter row, and the list/loading/empty states.

import { useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Download, Search, List, CalendarDays, CalendarCheck, CalendarClock, Star, SlidersHorizontal, X, MoreVertical,
} from "lucide-react";
import { format } from "date-fns";
import { LOCATIONS } from "../lib/holidays";
import { StatCard, HolidayCard } from "./holiday-ui";

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

export function HolidaysHeader({ canManage, onExport, onAdd }: {
  canManage: boolean; onExport: () => void; onAdd: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Holiday Calendar</h1>
        <p className="text-sm text-muted-foreground mt-1">Company holidays, mandatory and optional, across locations</p>
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        {/* Desktop: Export + Add Holiday inline (unchanged). */}
        <div className="hidden sm:flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onExport} data-testid="button-export-holidays"><Download className="h-4 w-4 mr-1" /> Export</Button>
          {canManage && <Button size="sm" onClick={onAdd} data-testid="button-add-holiday"><Plus className="h-4 w-4 mr-1" /> Add Holiday</Button>}
        </div>
        {/* Mobile: Add Holiday visible; Export folds into a kebab. */}
        <div className="flex sm:hidden items-center gap-2 w-full">
          {canManage && <Button size="sm" onClick={onAdd} data-testid="button-add-holiday-mobile"><Plus className="h-4 w-4 mr-1" /> Add Holiday</Button>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="ml-auto" aria-label="More actions" data-testid="holidays-more-mobile"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onExport} data-testid="menu-export-holidays"><Download className="h-4 w-4 mr-2" /> Export</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

export function HolidaysStats({ total, mandatory, optional, nextHoliday, year }: {
  total: number; mandatory: number; optional: number; nextHoliday?: any; year: number;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard title="Total Holidays" value={total} subtitle={`in ${year}`} icon={CalendarDays} color="bg-[#206295]/15 text-[#206295]" />
      <StatCard title="Mandatory" value={mandatory} subtitle="company-wide" icon={CalendarCheck} color="bg-[#4BDCD9]/25 text-[#206295]" />
      <StatCard title="Optional" value={optional} subtitle="restricted holidays" icon={Star} color="bg-[#FF6F62]/20 text-[#FF6F62]" />
      <StatCard title="Next Holiday" value={nextHoliday ? format(new Date(nextHoliday.date), "MMM d") : "—"} subtitle={nextHoliday ? nextHoliday.name : "None upcoming"} icon={CalendarClock} color="bg-[#206295]/15 text-[#206295]" />
    </div>
  );
}

const VIEW_BUTTONS: { v: "list" | "calendar"; icon: any; label: string }[] = [
  { v: "list", icon: List, label: "List" },
  { v: "calendar", icon: CalendarDays, label: "Calendar" },
];

export function HolidaysFilterBar({
  view, onView, search, onSearch, year, onYear, years, location, onLocation, typeFilter, onTypeFilter,
}: {
  view: "list" | "calendar"; onView: (v: "list" | "calendar") => void;
  search: string; onSearch: (v: string) => void;
  year: number; onYear: (y: number) => void; years: number[];
  location: string; onLocation: (v: string) => void;
  typeFilter: string; onTypeFilter: (v: string) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  // Active (non-default) filters — counted on the Filters button and shown as dismissible chips.
  // Year always has a value (no "all"), so it lives in the sheet but isn't a dismissible chip.
  const chips: { key: string; label: string; onClear: () => void }[] = [];
  if (location !== "all") chips.push({ key: "location", label: location, onClear: () => onLocation("all") });
  if (typeFilter !== "all") chips.push({ key: "type", label: typeFilter === "mandatory" ? "Mandatory" : "Optional", onClear: () => onTypeFilter("all") });
  const resetAll = () => { onLocation("all"); onTypeFilter("all"); };

  return (
    <>
      {/* Desktop: view toggle + search + year/location/type inline (unchanged). */}
      <div className="hidden sm:flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 segmented-toggle p-1">
          {VIEW_BUTTONS.map((b) => (
            <button key={b.v} onClick={() => onView(b.v)} data-testid={`view-${b.v}`}
              className={`flex items-center gap-1 h-8 px-3 rounded-[8px] text-xs transition-colors ${view === b.v ? "btn-primary-gradient text-white" : "text-muted-foreground hover-elevate"}`}>
              <b.icon className="h-4 w-4" /> {b.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search holidays…" value={search} onChange={(e) => onSearch(e.target.value)} className="pl-9" data-testid="input-search-holidays" />
        </div>
        <Select value={String(year)} onValueChange={(v) => onYear(Number(v))}>
          <SelectTrigger className="w-28" data-testid="select-year"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={location} onValueChange={onLocation}>
          <SelectTrigger className="w-36" data-testid="select-location"><SelectValue placeholder="Location" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={onTypeFilter}>
          <SelectTrigger className="w-36" data-testid="select-type"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="mandatory">Mandatory</SelectItem>
            <SelectItem value="optional">Optional</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile: search + Filters on one row; view toggle below; year/location/type behind one badged Filters sheet. */}
      <div className="sm:hidden space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search holidays…" value={search} onChange={(e) => onSearch(e.target.value)} className="pl-9" data-testid="input-search-holidays-mobile" />
          </div>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="secondary" size="sm" className="flex-shrink-0" data-testid="button-filters-mobile">
                <SlidersHorizontal className="h-4 w-4 mr-1.5" /> Filters
                {chips.length > 0 && <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#206295] px-1 text-[10px] font-bold text-white">{chips.length}</span>}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
              <SheetHeader className="text-left"><SheetTitle>Filters</SheetTitle></SheetHeader>
              <div className="space-y-4 py-4">
                <FilterField label="Year">
                  <Select value={String(year)} onValueChange={(v) => onYear(Number(v))}>
                    <SelectTrigger className="w-full" data-testid="sheet-year"><SelectValue /></SelectTrigger>
                    <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </FilterField>
                <FilterField label="Location">
                  <Select value={location} onValueChange={onLocation}>
                    <SelectTrigger className="w-full" data-testid="sheet-location"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Locations</SelectItem>
                      {LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FilterField>
                <FilterField label="Type">
                  <Select value={typeFilter} onValueChange={onTypeFilter}>
                    <SelectTrigger className="w-full" data-testid="sheet-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="mandatory">Mandatory</SelectItem>
                      <SelectItem value="optional">Optional</SelectItem>
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
          <div className="flex items-center gap-1 segmented-toggle p-1 flex-shrink-0">
            {VIEW_BUTTONS.map((b) => (
              <button key={b.v} onClick={() => onView(b.v)} data-testid={`view-${b.v}-mobile`}
                className={`flex items-center gap-1 h-8 px-3 rounded-[8px] text-xs transition-colors ${view === b.v ? "btn-primary-gradient text-white" : "text-muted-foreground hover-elevate"}`}>
                <b.icon className="h-4 w-4" /> {b.label}
              </button>
            ))}
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

export function HolidaysLoading() {
  return <div className="space-y-3">{[...Array(4)].map((_, i) => <Card key={i} className="border-0"><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div>;
}

export function HolidaysEmpty({ canManage }: { canManage: boolean }) {
  return (
    <div className="text-center py-16">
      <CalendarDays className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-foreground">No holidays found</h3>
      <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters{canManage ? " or add one." : "."}</p>
    </div>
  );
}

export function HolidayList({ holidays, canManage, onEdit, onDelete }: {
  holidays: any[]; canManage: boolean; onEdit: (h: any) => void; onDelete: (h: any) => void;
}) {
  return (
    <div className="space-y-3">
      {holidays.map((h) => <HolidayCard key={h.id} h={h} canManage={canManage} onEdit={onEdit} onDelete={onDelete} />)}
    </div>
  );
}
