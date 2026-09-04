// The directory page's own chrome: title bar with its four actions, the overview
// cards, the search/filter row, the department pills, and the selection bar.

import { useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Users, Building2, UserPlus, X, MapPin, Download, Upload, BarChart3,
  LayoutGrid, Table as TableIcon, Pencil, ClipboardCheck, CheckSquare, MousePointerClick, SlidersHorizontal, MoreVertical,
} from "lucide-react";
import { format } from "date-fns";
import { EMP_TYPES, EMP_STATUSES, typeLabel, ACTIVE_TAB_STYLE } from "../lib/employee-constants";
import { StatCard } from "./employee-ui";

export function EmployeesHeader({ count, statusFilter, lastUpdated, canManage, onInsights, onImport, onJoinersReport, onAdd }: {
  count: number; statusFilter: string; lastUpdated: string; canManage: boolean;
  onInsights: () => void; onImport: () => void; onJoinersReport: () => void; onAdd: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Employees</h1>
        <p className="text-sm text-muted-foreground">{count} {statusFilter !== "all" ? statusFilter : ""} employee{count !== 1 ? "s" : ""}</p>
      </div>
      <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto">
        <span className="hidden sm:inline text-xs text-muted-foreground">Last updated: <span className="font-medium text-[#206295]">{lastUpdated}</span></span>
        {canManage && (
          <>
            {/* Desktop: the full action row (unchanged). */}
            <div className="hidden sm:flex items-center gap-2 flex-wrap">
              <div className="w-px self-stretch bg-border mx-1" />
              <Button variant="secondary" size="sm" onClick={onInsights} data-testid="button-insights"><BarChart3 className="h-4 w-4 mr-1" /> View Insights</Button>
              <Button variant="secondary" size="sm" onClick={onImport} data-testid="button-import"><Upload className="h-4 w-4 mr-1" /> Import</Button>
              <Button variant="secondary" size="sm" onClick={onJoinersReport} data-testid="button-joiners-report"><Download className="h-4 w-4 mr-1" /> Joiners Report</Button>
              <Button size="sm" onClick={onAdd} data-testid="button-add-employee"><UserPlus className="h-4 w-4 mr-1" /> Add Employee</Button>
            </div>
            {/* Mobile: primary + Insights on the left, overflow in a right-aligned kebab. */}
            <div className="flex sm:hidden items-center gap-2 w-full">
              <Button size="sm" onClick={onAdd} data-testid="button-add-employee-mobile"><UserPlus className="h-4 w-4 mr-1" /> Add</Button>
              <Button variant="secondary" size="sm" onClick={onInsights} data-testid="button-insights-mobile"><BarChart3 className="h-4 w-4 mr-1" /> Insights</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="icon" className="ml-auto" aria-label="More actions" data-testid="button-more-actions"><MoreVertical className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onImport} data-testid="menu-import"><Upload className="h-4 w-4 mr-2" /> Import</DropdownMenuItem>
                  <DropdownMenuItem onClick={onJoinersReport} data-testid="menu-joiners-report"><Download className="h-4 w-4 mr-2" /> Joiners Report</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function EmployeesStats({ totalEmployees, departmentCount, locationCount, newJoiners }: {
  totalEmployees: number; departmentCount: number; locationCount: number; newJoiners: number;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard title="Total Employees" value={totalEmployees} subtitle="All records" icon={Users} color="bg-[#206295]/15 text-[#206295]" />
      <StatCard title="Departments" value={departmentCount} subtitle="Across the org" icon={Building2} color="bg-[#4BDCD9]/25 text-[#206295]" />
      <StatCard title="Locations" value={locationCount} subtitle="Work locations" icon={MapPin} color="bg-[#206295]/15 text-[#206295]" />
      <StatCard title="New Joiners" value={newJoiners} subtitle={format(new Date(), "MMMM yyyy")} icon={ClipboardCheck} color="bg-[#4BDCD9]/25 text-[#206295]" />
    </div>
  );
}

const VIEW_BUTTONS: { v: "card" | "table"; icon: any; label: string }[] = [
  { v: "card", icon: LayoutGrid, label: "Card" }, { v: "table", icon: TableIcon, label: "Table" },
];

function ViewToggle({ viewMode, onViewMode }: { viewMode: "card" | "table"; onViewMode: (v: "card" | "table") => void }) {
  return (
    <div className="flex items-center gap-1 segmented-toggle p-1 flex-shrink-0">
      {VIEW_BUTTONS.map((b) => {
        const active = viewMode === b.v;
        return (
          <button key={b.v} onClick={() => onViewMode(b.v)} title={`${b.label} View`} data-testid={`view-mode-${b.v}`}
            className={`flex items-center justify-center h-8 w-10 rounded-[8px] transition-colors ${active ? "text-white" : "text-muted-foreground hover-elevate"}`}
            style={active ? ACTIVE_TAB_STYLE : undefined}>
            <b.icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

export function EmployeesFilterBar({
  search, onSearch, statusFilter, onStatusFilter, locFilter, onLocFilter, allLocations,
  typeFilter, onTypeFilter, viewMode, onViewMode, selectionMode, onEnterSelection,
  deptFilter, onDeptFilter, deptCounts, totalCount,
}: {
  search: string; onSearch: (v: string) => void;
  statusFilter: string; onStatusFilter: (v: string) => void;
  locFilter: string; onLocFilter: (v: string) => void; allLocations: string[];
  typeFilter: string; onTypeFilter: (v: string) => void;
  viewMode: "card" | "table"; onViewMode: (v: "card" | "table") => void;
  selectionMode?: boolean; onEnterSelection?: () => void;
  deptFilter: string; onDeptFilter: (v: string) => void; deptCounts: any[]; totalCount: number;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  // Active (non-default) filters — counted on the Filters button and shown as dismissible chips.
  const chips: { key: string; label: string; onClear: () => void }[] = [];
  if (statusFilter !== "active") chips.push({ key: "status", label: EMP_STATUSES.find((s) => s.value === statusFilter)?.label ?? "All statuses", onClear: () => onStatusFilter("active") });
  if (deptFilter !== "all") chips.push({ key: "dept", label: deptCounts.find((d) => d.id === deptFilter)?.name ?? "Department", onClear: () => onDeptFilter("all") });
  if (locFilter !== "all") chips.push({ key: "loc", label: locFilter, onClear: () => onLocFilter("all") });
  if (typeFilter !== "all") chips.push({ key: "type", label: typeLabel(typeFilter), onClear: () => onTypeFilter("all") });
  const resetAll = () => { onStatusFilter("active"); onDeptFilter("all"); onLocFilter("all"); onTypeFilter("all"); };

  return (
    <>
      {/* Desktop: search + every filter inline (unchanged). */}
      <div className="hidden sm:flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, or code..." value={search} onChange={(e) => onSearch(e.target.value)} className="pl-9" data-testid="input-search-employees" />
        </div>
        <Select value={statusFilter} onValueChange={onStatusFilter}>
          <SelectTrigger className="w-32" data-testid="select-status-filter"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="on_notice">On Notice</SelectItem><SelectItem value="exited">Exited</SelectItem><SelectItem value="all">All Status</SelectItem></SelectContent>
        </Select>
        <Select value={locFilter} onValueChange={onLocFilter}>
          <SelectTrigger className="w-36" data-testid="select-loc-filter"><SelectValue placeholder="Location" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Locations</SelectItem>{allLocations.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={onTypeFilter}>
          <SelectTrigger className="w-36" data-testid="select-type-filter"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Types</SelectItem>{EMP_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
        <ViewToggle viewMode={viewMode} onViewMode={onViewMode} />
      </div>

      {/* Mobile: search on its own row; every filter collapses behind one badged Filters sheet. */}
      <div className="sm:hidden space-y-3">
        {/* Search + Filters on one row — Filters sits to the right of the search. */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name, email, or code..." value={search} onChange={(e) => onSearch(e.target.value)} className="pl-9" data-testid="input-search-employees-mobile" />
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
                <FilterField label="Status">
                  <Select value={statusFilter} onValueChange={onStatusFilter}>
                    <SelectTrigger className="w-full" data-testid="sheet-status-filter"><SelectValue /></SelectTrigger>
                    <SelectContent>{EMP_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}<SelectItem value="all">All Status</SelectItem></SelectContent>
                  </Select>
                </FilterField>
                <FilterField label="Department">
                  <Select value={deptFilter} onValueChange={onDeptFilter}>
                    <SelectTrigger className="w-full" data-testid="sheet-dept-filter"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All Departments ({totalCount})</SelectItem>{deptCounts.filter((d) => d.count > 0).map((d) => <SelectItem key={d.id} value={d.id}>{d.name} ({d.count})</SelectItem>)}</SelectContent>
                  </Select>
                </FilterField>
                <FilterField label="Location">
                  <Select value={locFilter} onValueChange={onLocFilter}>
                    <SelectTrigger className="w-full" data-testid="sheet-loc-filter"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All Locations</SelectItem>{allLocations.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </FilterField>
                <FilterField label="Type">
                  <Select value={typeFilter} onValueChange={onTypeFilter}>
                    <SelectTrigger className="w-full" data-testid="sheet-type-filter"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All Types</SelectItem>{EMP_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
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
        {/* View toggle (left) + Select (right). */}
        <div className="flex items-center gap-2">
          <ViewToggle viewMode={viewMode} onViewMode={onViewMode} />
          {!selectionMode && onEnterSelection && (
            <Button variant="secondary" size="sm" className="ml-auto flex-shrink-0" onClick={onEnterSelection} data-testid="button-select-mobile"><MousePointerClick className="h-4 w-4 mr-1" /> Select</Button>
          )}
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

export function DepartmentPills({ totalCount, deptCounts, value, onChange, selectionMode, onEnterSelection }: {
  totalCount: number; deptCounts: any[]; value: string; onChange: (v: string) => void;
  selectionMode: boolean; onEnterSelection: () => void;
}) {
  // Desktop only — on mobile the department lives inside the Filters sheet (EmployeesFilterBar).
  return (
    <div className="hidden sm:flex items-center gap-2">
      <div className="flex gap-2 flex-1 flex-wrap">
        <button onClick={() => onChange("all")} data-testid="filter-dept-all"
          className={`flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${value === "all" ? "btn-primary-gradient text-white" : "bg-muted text-muted-foreground border border-border hover-elevate"}`}>
          All Departments ({totalCount})
        </button>
        {deptCounts.filter((d) => d.count > 0).map((d) => (
          <button key={d.id} onClick={() => onChange(d.id)} data-testid={`filter-dept-${d.id}`}
            className={`flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${value === d.id ? "btn-primary-gradient text-white" : "bg-muted text-muted-foreground border border-border hover-elevate"}`}>
            {d.name} ({d.count})
          </button>
        ))}
      </div>
      {!selectionMode && (
        <Button variant="secondary" size="sm" className="flex-shrink-0" onClick={onEnterSelection} data-testid="button-select">
          <MousePointerClick className="h-4 w-4 mr-1" /> Select
        </Button>
      )}
    </div>
  );
}

export function SelectionBar({ selectedCount, canManage, onSelectAll, onBulkExport, onBulkUpdate, onExit }: {
  selectedCount: number; canManage: boolean;
  onSelectAll: () => void; onBulkExport: () => void; onBulkUpdate: () => void; onExit: () => void;
}) {
  return (
    <Card className="border-0"><CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onSelectAll} data-testid="button-select-all"><CheckSquare className="h-4 w-4 mr-1" /> Select All</Button>
        <span className="text-sm font-medium">{selectedCount} selected</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={selectedCount === 0} onClick={onBulkExport}><Download className="h-4 w-4 mr-1" /> Bulk Export</Button>
        {canManage && <Button variant="secondary" size="sm" disabled={selectedCount === 0} onClick={onBulkUpdate}><Pencil className="h-4 w-4 mr-1" /> Bulk Update</Button>}
        <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={onExit} aria-label="Exit selection" data-testid="button-exit-selection"><X className="h-4 w-4" /></Button>
      </div>
    </CardContent></Card>
  );
}

export function EmployeesLoading() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>)}
    </div>
  );
}

export function EmployeesEmpty() {
  return (
    <div className="text-center py-16">
      <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-foreground">No employees found</h3>
      <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters</p>
    </div>
  );
}
