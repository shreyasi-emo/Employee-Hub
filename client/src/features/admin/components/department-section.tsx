import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Save } from "lucide-react";

export function DepartmentSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newDept, setNewDept] = useState({ name: "", code: "" });

  const { data: departments = [] } = useQuery<any[]>({ queryKey: ["/api/departments"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });

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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {departments.map((dept: any) => {
          const empCount = employees.filter((e: any) => e.departmentId === dept.id).length;
          return (
            <Card key={dept.id} data-testid={`dept-card-${dept.id}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{dept.name}</p>
                  <p className="text-xs text-muted-foreground">{dept.code} · {empCount} employees</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
