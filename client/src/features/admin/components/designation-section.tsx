import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, Search, Trash2 } from "lucide-react";

export function DesignationSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newDesig, setNewDesig] = useState({ name: "", grade: "", departmentId: "" });
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");

  const { data: designations = [] } = useQuery<any[]>({ queryKey: ["/api/designations"] });
  const { data: departments = [] } = useQuery<any[]>({ queryKey: ["/api/departments"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/designations", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/designations"] });
      toast({ title: "Designation created" });
      setShowAdd(false);
      setNewDesig({ name: "", grade: "", departmentId: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/designations/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/designations"] }); toast({ title: "Designation deleted" }); },
    onError: (e: any) => toast({ title: "Couldn't delete", description: e.message, variant: "destructive" }),
  });

  const q = search.trim().toLowerCase();
  const matches = (d: any) => !q || (d.name || "").toLowerCase().includes(q) || (d.grade || "").toLowerCase().includes(q);
  const byGrade = (a: any, b: any) => (a.grade || "").localeCompare(b.grade || "") || (a.name || "").localeCompare(b.name || "");

  // Segregate designations by department — each department renders its own table.
  const groups: { id: string; name: string; rows: any[] }[] = [];
  for (const dept of [...departments].sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""))) {
    if (deptFilter !== "all" && dept.id !== deptFilter) continue;
    const rows = designations.filter((d: any) => d.departmentId === dept.id && matches(d)).sort(byGrade);
    if (rows.length) groups.push({ id: dept.id, name: dept.name, rows });
  }
  if (deptFilter === "all") {
    const orphan = designations.filter((d: any) => !departments.some((x: any) => x.id === d.departmentId) && matches(d)).sort(byGrade);
    if (orphan.length) groups.push({ id: "none", name: "No department", rows: orphan });
  }

  const columns: DataTableColumn<any>[] = [
    {
      key: "grade", header: "Grade", headClassName: "w-28", cellClassName: "w-28",
      render: (d) => d.grade ? <Badge variant="outline" className="text-[10px]">{d.grade}</Badge> : <span className="text-muted-foreground/50">—</span>,
    },
    {
      key: "name", header: "Designation",
      render: (d) => <span className="font-medium text-foreground">{d.name}</span>,
    },
    {
      key: "employees", header: "Employee(s)", headClassName: "w-72", cellClassName: "w-72",
      render: (d) => {
        const holders = employees.filter((e: any) => e.designationId === d.id);
        if (!holders.length) return <span className="text-muted-foreground/50">—</span>;
        const names = holders.map((e: any) => `${e.firstName} ${e.lastName}`).join(", ");
        return <span className="block truncate text-sm text-foreground" title={names}>{names}</span>;
      },
    },
    {
      key: "actions", header: "", align: "right", headClassName: "w-16", cellClassName: "w-16",
      render: (d) => (
        <Button
          size="icon" variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-[#C4402F]"
          onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete "${d.name}"? This can't be undone.`)) del.mutate(d.id); }}
          disabled={del.isPending}
          aria-label="Delete designation"
          data-testid={`button-delete-desig-${d.id}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search designations…" className="pl-9" data-testid="input-search-desigs" />
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-48" data-testid="select-desig-dept-filter"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Departments</SelectItem>{departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-desig">
          <Plus className="h-4 w-4 mr-1.5" /> Add Designation
        </Button>
      </div>
      {showAdd && (
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3 flex-wrap">
              <Input
                placeholder="Designation name"
                value={newDesig.name}
                onChange={e => setNewDesig(n => ({ ...n, name: e.target.value }))}
                className="flex-1 min-w-32"
                data-testid="input-desig-name"
              />
              <Input
                placeholder="Grade (e.g. L4)"
                value={newDesig.grade}
                onChange={e => setNewDesig(n => ({ ...n, grade: e.target.value }))}
                className="w-28"
              />
              <Select value={newDesig.departmentId} onValueChange={v => setNewDesig(n => ({ ...n, departmentId: v }))}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() => mutation.mutate(newDesig)}
                disabled={mutation.isPending || !newDesig.name}
                data-testid="button-save-desig"
              >
                <Save className="h-4 w-4 mr-1.5" /> Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">No designations match those filters.</p>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.id} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <h3 className="text-sm font-semibold text-foreground">{g.name}</h3>
                <Badge variant="secondary" className="text-[10px]">{g.rows.length}</Badge>
              </div>
              <Card className="border-0"><CardContent className="p-0">
                <DataTable columns={columns} rows={g.rows} getRowKey={(d) => d.id} fixedLayout testIdPrefix={`desig-row-${g.id}`} />
              </CardContent></Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
