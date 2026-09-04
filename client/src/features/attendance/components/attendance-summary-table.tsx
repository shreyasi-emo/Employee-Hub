import { useMemo, useState } from "react";
import { Search, Download, SlidersHorizontal, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose, SheetTrigger } from "@/components/ui/sheet";
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
  const [filterSheet, setFilterSheet] = useState(false);
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
      {/* Desktop: one-line toolbar (unchanged). */}
      <div className="hidden sm:flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-foreground shrink-0">Attendance Summary</h2>
        <div className="w-px self-stretch bg-foreground/30 shrink-0 mx-[7px]" />
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

      {/* Mobile: title, then search + a Filters sheet (Department, Location). */}
      <div className="sm:hidden space-y-3">
        <h2 className="text-lg font-bold text-foreground">Attendance Summary</h2>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={tblSearch} onChange={(e) => setTblSearch(e.target.value)} placeholder="Search by name or code..." className="pl-9" data-testid="input-table-search-mobile" />
          </div>
          <Sheet open={filterSheet} onOpenChange={setFilterSheet}>
            <SheetTrigger asChild>
              <Button variant="secondary" size="sm" className="flex-shrink-0" data-testid="button-att-filters-mobile">
                <SlidersHorizontal className="h-4 w-4 mr-1.5" /> Filters
                {(tblDept !== "all" ? 1 : 0) + (tblLoc !== "all" ? 1 : 0) > 0 && <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#206295] px-1 text-[10px] font-bold text-white">{(tblDept !== "all" ? 1 : 0) + (tblLoc !== "all" ? 1 : 0)}</span>}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
              <SheetHeader className="text-left"><SheetTitle>Filters</SheetTitle></SheetHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Department</p>
                  <Select value={tblDept} onValueChange={setTblDept}>
                    <SelectTrigger className="w-full" data-testid="sheet-table-dept"><SelectValue placeholder="All Departments" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All Departments</SelectItem>{departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Location</p>
                  <Select value={tblLoc} onValueChange={setTblLoc}>
                    <SelectTrigger className="w-full" data-testid="sheet-table-loc"><SelectValue placeholder="All Locations" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All Locations</SelectItem>{tblLocations.map((l: any) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <SheetFooter className="flex-row gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setTblDept("all"); setTblLoc("all"); }} data-testid="sheet-table-reset">Reset</Button>
                <SheetClose asChild><Button className="flex-1 btn-primary-gradient text-white" data-testid="sheet-table-apply">Show results</Button></SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
        {(tblDept !== "all" || tblLoc !== "all") && (
          <div className="flex items-center gap-2 flex-wrap">
            {tblDept !== "all" && (
              <button onClick={() => setTblDept("all")} className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2.5 py-1 text-xs text-foreground hover-elevate" data-testid="chip-table-dept">
                <span className="truncate max-w-[8rem]">{departments.find((d: any) => d.id === tblDept)?.name ?? "Department"}</span> <X className="h-3 w-3 flex-shrink-0" />
              </button>
            )}
            {tblLoc !== "all" && (
              <button onClick={() => setTblLoc("all")} className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2.5 py-1 text-xs text-foreground hover-elevate" data-testid="chip-table-loc">
                <span className="truncate max-w-[8rem]">{tblLoc}</span> <X className="h-3 w-3 flex-shrink-0" />
              </button>
            )}
          </div>
        )}
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
