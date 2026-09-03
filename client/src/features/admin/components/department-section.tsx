import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, Search, Trash2, ChevronRight } from "lucide-react";

export function DepartmentSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newDept, setNewDept] = useState({ name: "", code: "" });
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: departments = [] } = useQuery<any[]>({ queryKey: ["/api/departments"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: designations = [] } = useQuery<any[]>({ queryKey: ["/api/designations"] });

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/departments", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({ title: "Department created" });
      setShowAdd(false);
      setNewDept({ name: "", code: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/departments/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/departments"] }); toast({ title: "Department deleted" }); },
    onError: (e: any) => toast({ title: "Couldn't delete", description: e.message, variant: "destructive" }),
  });

  const q = search.trim().toLowerCase();
  const filtered = departments.filter((d: any) => !q || `${d.name} ${d.code}`.toLowerCase().includes(q));

  const columns: DataTableColumn<any>[] = [
    {
      key: "name", header: "Department",
      render: (d) => (
        <div className="flex items-center gap-2 min-w-0">
          <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform flex-shrink-0", openId === d.id && "rotate-90 text-foreground")} />
          <span className="font-medium text-foreground truncate">{d.name}</span>
          <Badge variant="outline" className="text-[10px] flex-shrink-0">{d.code}</Badge>
        </div>
      ),
    },
    {
      key: "employees", header: "Employees",
      render: (d) => <span className="text-sm text-foreground">{employees.filter((e: any) => e.departmentId === d.id).length}</span>,
    },
    {
      key: "designations", header: "Designations",
      render: (d) => <span className="text-sm text-muted-foreground">{designations.filter((x: any) => x.departmentId === d.id).length}</span>,
    },
    {
      key: "actions", header: "", align: "right",
      render: (d) => (
        <Button
          size="icon" variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-[#C4402F]"
          onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete "${d.name}"? This can't be undone.`)) del.mutate(d.id); }}
          disabled={del.isPending}
          aria-label="Delete department"
          data-testid={`button-delete-dept-${d.id}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const renderEmployees = (d: any) => {
    const emps = employees.filter((e: any) => e.departmentId === d.id);
    if (!emps.length) return <p className="text-xs text-muted-foreground px-1 py-1.5">No employees in this department yet.</p>;
    return (
      <div className="space-y-0.5">
        {emps.map((e: any) => {
          const desig = designations.find((x: any) => x.id === e.designationId);
          return (
            <div key={e.id} className="flex items-center gap-3 rounded-lg px-1 py-1.5" data-testid={`dept-emp-${e.id}`}>
              <Avatar className="h-7 w-7 flex-shrink-0"><AvatarFallback className="text-[10px] bg-[#206295]/10 text-[#206295]">{`${e.firstName?.[0] || ""}${e.lastName?.[0] || ""}`.toUpperCase()}</AvatarFallback></Avatar>
              <span className="text-sm text-foreground flex-shrink-0">{e.firstName} {e.lastName}</span>
              <span className="text-xs text-muted-foreground truncate">
                {desig?.name || "No designation"} <span className="text-muted-foreground/40 mx-0.5">|</span> {e.email}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search departments…" className="pl-9" data-testid="input-search-depts" />
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-dept">
          <Plus className="h-4 w-4 mr-1.5" /> Add Department
        </Button>
      </div>
      {showAdd && (
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3 flex-wrap">
              <Input
                placeholder="Department name"
                value={newDept.name}
                onChange={e => setNewDept(n => ({ ...n, name: e.target.value }))}
                className="flex-1 min-w-32"
                data-testid="input-dept-name"
              />
              <Input
                placeholder="Code (e.g. ENG)"
                value={newDept.code}
                onChange={e => setNewDept(n => ({ ...n, code: e.target.value.toUpperCase() }))}
                className="w-28"
                data-testid="input-dept-code"
              />
              <Button
                size="sm"
                onClick={() => mutation.mutate(newDept)}
                disabled={mutation.isPending || !newDept.name || !newDept.code}
                data-testid="button-save-dept"
              >
                <Save className="h-4 w-4 mr-1.5" /> Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Card className="border-0"><CardContent className="p-0">
        <DataTable
          columns={columns}
          rows={filtered}
          getRowKey={(d) => d.id}
          showSerial
          onRowClick={(d) => setOpenId(openId === d.id ? null : d.id)}
          isExpanded={(d) => d.id === openId}
          renderExpanded={renderEmployees}
          emptyText="No departments match your search."
          testIdPrefix="dept-row"
        />
      </CardContent></Card>
    </div>
  );
}
