import { useMemo, useState } from "react";
import { Search, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";

const pctColor = (p: number) => p >= 90 ? "#0E7C7B" : p >= 75 ? "#B5611A" : "#C24A3E";

/** Full per-employee attendance summary for the selected period — same
 *  present-by-default model as the report. Owns its own search/filter/sort state. */
export function AttendanceSummaryTable({ reportRows, departments, from, to, onExportEmployee }: {
  reportRows: any[];
  departments: any[];
  from: string;
  to: string;
  onExportEmployee: (employeeId: string, name: string, from: string, to: string) => void;
}) {
  const [tblSearch, setTblSearch] = useState("");
  const [tblDept, setTblDept] = useState("all");
  const [tblLoc, setTblLoc] = useState("all");
  const [tblSort, setTblSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });

  const toggleSort = (key: string) => setTblSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" || key === "department" ? "asc" : "desc" });
  const tblLocations = useMemo(() => Array.from(new Set((reportRows as any[]).map((r) => r.location).filter(Boolean))).sort(), [reportRows]);
  const tableRows = useMemo(() => {
    let rows = (reportRows as any[]).slice();
    const q = tblSearch.trim().toLowerCase();
    if (q) rows = rows.filter((r) => `${r.name} ${r.code}`.toLowerCase().includes(q));
    if (tblDept !== "all") rows = rows.filter((r) => r.departmentId === tblDept);
    if (tblLoc !== "all") rows = rows.filter((r) => r.location === tblLoc);
    const { key, dir } = tblSort;
    rows.sort((a, b) => { const av = a[key], bv = b[key]; const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv)); return dir === "asc" ? cmp : -cmp; });
    return rows;
  }, [reportRows, tblSearch, tblDept, tblLoc, tblSort]);

  const tableColumns: DataTableColumn<any>[] = [
    { key: "code", header: "Employee ID", sortable: true, cellClassName: "text-muted-foreground tabular-nums" },
    { key: "name", header: "Employee", sortable: true, cellClassName: "font-medium text-foreground" },
    { key: "department", header: "Department", sortable: true, cellClassName: "text-muted-foreground" },
    { key: "present", header: "WFO", align: "right", sortable: true },
    { key: "wfh", header: "WFH", align: "right", sortable: true },
    { key: "onDuty", header: "On Duty", align: "right", sortable: true },
    { key: "halfDay", header: "Half", align: "right", sortable: true },
    { key: "absent", header: "Absent", align: "right", sortable: true },
    { key: "leave", header: "Leave", align: "right", sortable: true },
    { key: "workingDays", header: "Working Days", align: "right", sortable: true, cellClassName: "text-muted-foreground" },
    { key: "attendancePct", header: "Attendance %", align: "right", sortable: true, render: (r) => <span className="font-semibold" style={{ color: pctColor(r.attendancePct) }}>{r.attendancePct}%</span> },
    { key: "export", header: "Export", align: "center", render: (r) => (
      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-[10px] text-muted-foreground" title={`Export ${r.name}'s report`} onClick={() => onExportEmployee(r.employeeId, r.name, from, to)} data-testid={`export-emp-${r.employeeId}`}>
        <Download className="h-3.5 w-3.5" />
      </Button>
    ) },
  ];

  return (
    <div className="space-y-4">
      {/* One-line toolbar: title · separator · search · dept · location */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-foreground shrink-0">Attendance Summary</h2>
        <div className="h-10 w-px bg-foreground/30 shrink-0 mx-[7px]" />
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={tblSearch} onChange={(e) => setTblSearch(e.target.value)} placeholder="Search by name or code..." className="pl-9" data-testid="input-table-search" />
        </div>
        <Select value={tblDept} onValueChange={setTblDept}>
          <SelectTrigger className="w-44" data-testid="select-table-dept"><SelectValue placeholder="All Departments" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tblLoc} onValueChange={setTblLoc}>
          <SelectTrigger className="w-40" data-testid="select-table-loc"><SelectValue placeholder="All Locations" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {tblLocations.map((l: any) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Card className="border-0">
        <CardContent className="p-0">
          <DataTable
            columns={tableColumns}
            rows={tableRows}
            getRowKey={(r: any) => r.employeeId}
            sort={tblSort}
            onSortChange={toggleSort}
            emptyText="No employees match."
            testIdPrefix="table-row"
          />
        </CardContent>
      </Card>
    </div>
  );
}
