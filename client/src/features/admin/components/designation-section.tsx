import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save } from "lucide-react";

export function DesignationSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newDesig, setNewDesig] = useState({ name: "", grade: "", departmentId: "" });

  const { data: designations = [] } = useQuery<any[]>({ queryKey: ["/api/designations"] });
  const { data: departments = [] } = useQuery<any[]>({ queryKey: ["/api/departments"] });

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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {designations.map((d: any) => {
          const dept = departments.find((dept: any) => dept.id === d.departmentId);
          return (
            <Card key={d.id}>
              <CardContent className="p-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.grade && `${d.grade} · `}{dept?.name || "No department"}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
