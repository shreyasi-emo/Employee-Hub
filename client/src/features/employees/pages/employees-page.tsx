import { useState } from "react";
import { useAuth, isHR } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePaged, PaginationBar } from "@/components/shared/pagination";
import {
  Search, Users, Building2, UserPlus, X, MapPin, Download, Upload, BarChart3,
  LayoutGrid, Table as TableIcon, Pencil, ClipboardCheck, CheckSquare, MousePointerClick,
} from "lucide-react";
import { format } from "date-fns";
import { EMP_TYPES, ACTIVE_TAB_STYLE } from "../lib/employee-constants";
import { exportEmployeeRows } from "../lib/employee-export";
import { useEmployeeDirectory, useAllEmployees, useDepartments, useDesignations } from "../api/employees.api";
import { StatCard, EmployeeCard } from "../components/employee-ui";
import { EmployeesTable } from "../components/employees-table";
import { EmployeeFormDialog } from "../components/employee-form-dialog";
import { ImportEmployeesDialog } from "../components/import-employees-dialog";
import { InsightsPanel } from "../components/insights-panel";
import { BulkUpdateDialog } from "../components/bulk-update-dialog";
import { JoinersReportDialog } from "../components/joiners-report-dialog";

export default function EmployeesPage() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const canManage = isHR(user!);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [deptFilter, setDeptFilter] = useState("all");
  const [locFilter, setLocFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const empQuery = useEmployeeDirectory(statusFilter, search);
  const employees = empQuery.data ?? [];
  const isLoading = empQuery.isLoading;
  const { data: allEmployees = [] } = useAllEmployees();
  const { data: departments = [] } = useDepartments();
  const { data: designations = [] } = useDesignations();

  const allLocations = Array.from(new Set(allEmployees.map((e) => e.workLocation).filter(Boolean))) as string[];
  // client-side Department + Location + Type filtering
  const filtered = employees.filter((e) =>
    (deptFilter === "all" || e.departmentId === deptFilter) &&
    (locFilter === "all" || e.workLocation === locFilter) &&
    (typeFilter === "all" || e.employmentType === typeFilter)
  );
  const displayed = filtered;
  const cardPaged = usePaged(displayed);
  const deptCounts = departments.map((d) => ({ ...d, count: employees.filter((e) => e.departmentId === d.id).length }));

  // overview cards
  const now = new Date();
  const newJoiners = allEmployees.filter((e) => e.joinDate && new Date(e.joinDate).getMonth() === now.getMonth() && new Date(e.joinDate).getFullYear() === now.getFullYear()).length;
  const lastUpdated = empQuery.dataUpdatedAt ? format(new Date(empQuery.dataUpdatedAt), "MMM d, h:mm a") : "—";

  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSel = () => setSelected(new Set());
  const allSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id));
  const toggleAll = () => setSelected((s) => { const n = new Set(s); if (allSelected) filtered.forEach((e) => n.delete(e.id)); else filtered.forEach((e) => n.add(e.id)); return n; });
  const exitSelection = () => { setSelectionMode(false); clearSel(); };

  const viewButtons: { v: typeof viewMode; icon: any; label: string }[] = [
    { v: "card", icon: LayoutGrid, label: "Card" }, { v: "table", icon: TableIcon, label: "Table" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[92rem] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground">{employees.length} {statusFilter !== "all" ? statusFilter : ""} employee{employees.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground">Last updated: <span className="font-medium text-[#206295]">{lastUpdated}</span></span>
          {canManage && (
            <div className="flex items-center gap-2">
              <div className="h-8 w-px bg-border mx-1" />
              <Button variant="secondary" size="sm" onClick={() => setShowInsights(true)} data-testid="button-insights"><BarChart3 className="h-4 w-4 mr-1" /> View Insights</Button>
              <Button variant="secondary" size="sm" onClick={() => setShowImport(true)} data-testid="button-import"><Upload className="h-4 w-4 mr-1" /> Import</Button>
              <Button variant="secondary" size="sm" onClick={() => setShowExport(true)} data-testid="button-joiners-report"><Download className="h-4 w-4 mr-1" /> Joiners Report</Button>
              <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-employee"><UserPlus className="h-4 w-4 mr-1" /> Add Employee</Button>
            </div>
          )}
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Employees" value={allEmployees.length} subtitle="All records" icon={Users} color="bg-[#206295]/15 text-[#206295]" />
        <StatCard title="Departments" value={departments.length} subtitle="Across the org" icon={Building2} color="bg-[#4BDCD9]/25 text-[#206295]" />
        <StatCard title="Locations" value={allLocations.length} subtitle="Work locations" icon={MapPin} color="bg-[#206295]/15 text-[#206295]" />
        <StatCard title="New Joiners" value={newJoiners} subtitle={format(now, "MMMM yyyy")} icon={ClipboardCheck} color="bg-[#4BDCD9]/25 text-[#206295]" />
      </div>

      {/* Search + filters + view toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, or code..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-employees" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32" data-testid="select-status-filter"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="on_notice">On Notice</SelectItem><SelectItem value="exited">Exited</SelectItem><SelectItem value="all">All Status</SelectItem></SelectContent>
        </Select>
        <Select value={locFilter} onValueChange={setLocFilter}>
          <SelectTrigger className="w-36" data-testid="select-loc-filter"><SelectValue placeholder="Location" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Locations</SelectItem>{allLocations.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36" data-testid="select-type-filter"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Types</SelectItem>{EMP_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex items-center gap-1 segmented-toggle p-1">
          {viewButtons.map((b) => {
            const active = viewMode === b.v;
            return (
              <button key={b.v} onClick={() => setViewMode(b.v)} title={`${b.label} View`} data-testid={`view-mode-${b.v}`}
                className={`flex items-center justify-center h-8 w-10 rounded-[8px] transition-colors ${active ? "text-white" : "text-muted-foreground hover-elevate"}`}
                style={active ? ACTIVE_TAB_STYLE : undefined}>
                <b.icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Department tabs + Select entry */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-2 flex-wrap flex-1">
          <button onClick={() => setDeptFilter("all")} data-testid="filter-dept-all"
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${deptFilter === "all" ? "btn-primary-gradient text-white" : "bg-muted text-muted-foreground border border-border hover-elevate"}`}>
            All Departments ({employees.length})
          </button>
          {deptCounts.filter((d) => d.count > 0).map((d) => (
            <button key={d.id} onClick={() => setDeptFilter(d.id)} data-testid={`filter-dept-${d.id}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${deptFilter === d.id ? "btn-primary-gradient text-white" : "bg-muted text-muted-foreground border border-border hover-elevate"}`}>
              {d.name} ({d.count})
            </button>
          ))}
        </div>
        {!selectionMode && (
          <Button variant="secondary" size="sm" className="flex-shrink-0" onClick={() => setSelectionMode(true)} data-testid="button-select">
            <MousePointerClick className="h-4 w-4 mr-1" /> Select
          </Button>
        )}
      </div>

      {/* Selection bar */}
      {selectionMode && (
        <Card className="border-0"><CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={toggleAll} data-testid="button-select-all"><CheckSquare className="h-4 w-4 mr-1" /> Select All</Button>
            <span className="text-sm font-medium">{selected.size} selected</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={selected.size === 0} onClick={() => exportEmployeeRows(filtered.filter((e) => selected.has(e.id)), { departments, designations })}><Download className="h-4 w-4 mr-1" /> Bulk Export</Button>
            {canManage && <Button variant="secondary" size="sm" disabled={selected.size === 0} onClick={() => setShowBulk(true)}><Pencil className="h-4 w-4 mr-1" /> Bulk Update</Button>}
            <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={exitSelection} aria-label="Exit selection" data-testid="button-exit-selection"><X className="h-4 w-4" /></Button>
          </div>
        </CardContent></Card>
      )}

      {/* Body */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16"><Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" /><h3 className="text-lg font-semibold text-foreground">No employees found</h3><p className="text-sm text-muted-foreground mt-1">Try adjusting your filters</p></div>
      ) : viewMode === "card" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {cardPaged.pageItems.map((emp) => <EmployeeCard key={emp.id} employee={emp} departments={departments} designations={designations} selectionMode={selectionMode} selected={selected.has(emp.id)} onToggle={() => toggleSel(emp.id)} />)}
          </div>
          <PaginationBar page={cardPaged.page} totalPages={cardPaged.totalPages} count={cardPaged.count} size={cardPaged.size} onPage={cardPaged.setPage} />
        </div>
      ) : (
        <EmployeesTable
          rows={displayed}
          departments={departments}
          designations={designations}
          selectionMode={selectionMode}
          selected={selected}
          allSelected={allSelected}
          onToggle={toggleSel}
          onToggleAll={toggleAll}
        />
      )}

      <EmployeeFormDialog open={showAdd} onOpenChange={setShowAdd} departments={departments} designations={designations} employees={allEmployees} knownLocations={allLocations} />
      <ImportEmployeesDialog open={showImport} onOpenChange={setShowImport} departments={departments} designations={designations} />
      <InsightsPanel open={showInsights} onOpenChange={setShowInsights} employees={allEmployees} departments={departments} />
      <BulkUpdateDialog open={showBulk} onOpenChange={setShowBulk} ids={[...selected]} departments={departments} locations={allLocations} onDone={clearSel} />
      <JoinersReportDialog open={showExport} onOpenChange={setShowExport} allEmployees={allEmployees} departments={departments} designations={designations} />
    </div>
  );
}
