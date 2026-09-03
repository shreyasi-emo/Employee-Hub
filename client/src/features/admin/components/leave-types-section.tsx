import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Trash2, Pencil } from "lucide-react";
import { leaveTypeColor } from "../../leave/lib/leave-model";
import { LeaveTypeFormDialog } from "./leave-type-form-dialog";

export function LeaveTypesSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: leaveTypes = [] } = useQuery<any[]>({ queryKey: ["/api/leave-types"] });
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/leave-types/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/leave-types"] }); toast({ title: "Leave type removed" }); },
    onError: (e: any) => toast({ title: "Couldn't delete", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (lt: any) => { setEditing(lt); setFormOpen(true); };

  const q = search.trim().toLowerCase();
  const filtered = leaveTypes.filter((lt: any) => !q || `${lt.name || ""} ${lt.code || ""}`.toLowerCase().includes(q));

  const columns: DataTableColumn<any>[] = [
    {
      key: "name", header: "Leave Type",
      render: (lt) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: leaveTypeColor(lt) }} />
          <span className="font-medium text-foreground truncate">{lt.name}</span>
        </div>
      ),
    },
    {
      key: "code", header: "Code",
      render: (lt) => <Badge variant="outline" className="text-[10px]">{lt.code}</Badge>,
    },
    {
      key: "attrs", header: "Attributes",
      render: (lt) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          {lt.isPaid ? <Badge className="bg-[#206295]/12 text-[#206295] text-[10px]">Paid</Badge> : <Badge variant="secondary" className="text-[10px]">Unpaid</Badge>}
          {lt.isCarryForward && <Badge variant="secondary" className="text-[10px]">Carry Forward</Badge>}
          {lt.isEncashable && <Badge variant="secondary" className="text-[10px]">Encashable</Badge>}
        </div>
      ),
    },
    {
      key: "max", header: "Max / Year",
      render: (lt) => <span className="text-sm text-foreground">{lt.maxDaysPerYear} days</span>,
    },
    {
      key: "actions", header: "", align: "right",
      render: (lt) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            size="icon" variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); openEdit(lt); }}
            aria-label="Edit leave type"
            data-testid={`button-edit-leave-type-${lt.id}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon" variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-[#C4402F]"
            onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete "${lt.name}"? It's removed from new requests; existing history is kept.`)) del.mutate(lt.id); }}
            disabled={del.isPending}
            aria-label="Delete leave type"
            data-testid={`button-delete-leave-type-${lt.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leave types…" className="pl-9" data-testid="input-search-leave-types" />
        </div>
        <Button size="sm" onClick={openCreate} data-testid="button-add-leave-type">
          <Plus className="h-4 w-4 mr-1.5" /> Add Leave Type
        </Button>
      </div>

      <Card className="border-0"><CardContent className="p-0">
        <DataTable
          columns={columns}
          rows={filtered}
          getRowKey={(lt) => lt.id}
          emptyText="No leave types match your search."
          testIdPrefix="leave-type-row"
        />
      </CardContent></Card>

      <LeaveTypeFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} />
    </div>
  );
}
