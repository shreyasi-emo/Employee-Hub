import { useState } from "react";
import { useAuth, isHR } from "@/lib/auth";
import { format } from "date-fns";
import { exportEmployeeRows } from "../lib/employee-export";
import { useEmployeeDirectory, useAllEmployees, useDepartments, useDesignations } from "../api/employees.api";
import {
  EmployeesHeader, EmployeesStats, EmployeesFilterBar, DepartmentPills,
  SelectionBar, EmployeesLoading, EmployeesEmpty,
} from "../components/employees-sections";
import { EmployeeCardGrid } from "../components/employee-card-grid";
import { EmployeesTable } from "../components/employees-table";
import { EmployeeFormDialog } from "../components/employee-form-dialog";
import { ImportEmployeesDialog } from "../components/import-employees-dialog";
import { InsightsPanel } from "../components/insights-panel";
import { BulkUpdateDialog } from "../components/bulk-update-dialog";
import { JoinersReportDialog } from "../components/joiners-report-dialog";

export default function EmployeesPage() {
  const { data: auth } = useAuth();
  const canManage = isHR(auth?.user!);

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
  const { data: allEmployees = [] } = useAllEmployees();
  const { data: departments = [] } = useDepartments();
  const { data: designations = [] } = useDesignations();

  const allLocations = Array.from(new Set(allEmployees.map((e) => e.workLocation).filter(Boolean))) as string[];
  // Status + search are server-side; department, location and type are filtered here so the
  // department pill counts stay based on the full status/search result.
  const filtered = employees.filter((e) =>
    (deptFilter === "all" || e.departmentId === deptFilter) &&
    (locFilter === "all" || e.workLocation === locFilter) &&
    (typeFilter === "all" || e.employmentType === typeFilter)
  );
  const deptCounts = departments.map((d) => ({ ...d, count: employees.filter((e) => e.departmentId === d.id).length }));

  const now = new Date();
  const newJoiners = allEmployees.filter((e) => e.joinDate && new Date(e.joinDate).getMonth() === now.getMonth() && new Date(e.joinDate).getFullYear() === now.getFullYear()).length;

  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id));
  const toggleAll = () => setSelected((s) => { const n = new Set(s); if (allSelected) filtered.forEach((e) => n.delete(e.id)); else filtered.forEach((e) => n.add(e.id)); return n; });
  const exitSelection = () => { setSelectionMode(false); setSelected(new Set()); };

  return (
    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 max-w-[92rem] mx-auto">
      <EmployeesHeader
        count={employees.length}
        statusFilter={statusFilter}
        lastUpdated={empQuery.dataUpdatedAt ? format(new Date(empQuery.dataUpdatedAt), "MMM d, h:mm a") : "—"}
        canManage={canManage}
        onInsights={() => setShowInsights(true)}
        onImport={() => setShowImport(true)}
        onJoinersReport={() => setShowExport(true)}
        onAdd={() => setShowAdd(true)}
      />

      <EmployeesStats
        totalEmployees={allEmployees.length}
        departmentCount={departments.length}
        locationCount={allLocations.length}
        newJoiners={newJoiners}
      />

      <EmployeesFilterBar
        search={search} onSearch={setSearch}
        statusFilter={statusFilter} onStatusFilter={setStatusFilter}
        locFilter={locFilter} onLocFilter={setLocFilter} allLocations={allLocations}
        typeFilter={typeFilter} onTypeFilter={setTypeFilter}
        viewMode={viewMode} onViewMode={setViewMode}
        selectionMode={selectionMode} onEnterSelection={() => setSelectionMode(true)}
        deptFilter={deptFilter} onDeptFilter={setDeptFilter}
        deptCounts={deptCounts} totalCount={employees.length}
      />

      <DepartmentPills
        totalCount={employees.length}
        deptCounts={deptCounts}
        value={deptFilter}
        onChange={setDeptFilter}
        selectionMode={selectionMode}
        onEnterSelection={() => setSelectionMode(true)}
      />

      {selectionMode && (
        <SelectionBar
          selectedCount={selected.size}
          canManage={canManage}
          onSelectAll={toggleAll}
          onBulkExport={() => exportEmployeeRows(filtered.filter((e) => selected.has(e.id)), { departments, designations })}
          onBulkUpdate={() => setShowBulk(true)}
          onExit={exitSelection}
        />
      )}

      {empQuery.isLoading ? (
        <EmployeesLoading />
      ) : filtered.length === 0 ? (
        <EmployeesEmpty />
      ) : viewMode === "card" ? (
        <EmployeeCardGrid
          employees={filtered}
          departments={departments}
          designations={designations}
          selectionMode={selectionMode}
          selected={selected}
          onToggle={toggleSel}
        />
      ) : (
        <EmployeesTable
          rows={filtered}
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
      <BulkUpdateDialog open={showBulk} onOpenChange={setShowBulk} ids={[...selected]} departments={departments} locations={allLocations} onDone={() => setSelected(new Set())} />
      <JoinersReportDialog open={showExport} onOpenChange={setShowExport} allEmployees={allEmployees} departments={departments} designations={designations} />
    </div>
  );
}
