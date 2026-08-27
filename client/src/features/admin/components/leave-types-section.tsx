import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

export function LeaveTypesSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: leaveTypes = [] } = useQuery<any[]>({ queryKey: ["/api/leave-types"] });
  const [showAdd, setShowAdd] = useState(false);
  const [newLT, setNewLT] = useState({
    name: "", code: "", color: "#3B82F6", isPaid: true,
    isCarryForward: false, maxDaysPerYear: 12,
  });

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/leave-types", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/leave-types"] });
      toast({ title: "Leave type created" });
      setShowAdd(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-leave-type">
          <Plus className="h-4 w-4 mr-1.5" /> Add Leave Type
        </Button>
      </div>
      {showAdd && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex gap-3 flex-wrap">
              <Input
                placeholder="Leave type name"
                value={newLT.name}
                onChange={e => setNewLT(n => ({ ...n, name: e.target.value }))}
                className="flex-1"
                data-testid="input-leave-type-name"
              />
              <Input
                placeholder="Code (e.g. CL)"
                value={newLT.code}
                onChange={e => setNewLT(n => ({ ...n, code: e.target.value.toUpperCase() }))}
                className="w-24"
              />
              <Input
                type="color"
                value={newLT.color}
                onChange={e => setNewLT(n => ({ ...n, color: e.target.value }))}
                className="w-16 p-1 h-9"
              />
              <Input
                type="number"
                placeholder="Max days/year"
                value={newLT.maxDaysPerYear}
                onChange={e => setNewLT(n => ({ ...n, maxDaysPerYear: parseInt(e.target.value) }))}
                className="w-36"
              />
            </div>
            <div className="flex gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={newLT.isPaid} onCheckedChange={v => setNewLT(n => ({ ...n, isPaid: v === true }))} />
                Paid
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={newLT.isCarryForward} onCheckedChange={v => setNewLT(n => ({ ...n, isCarryForward: v === true }))} />
                Carry Forward
              </label>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => mutation.mutate(newLT)} disabled={mutation.isPending || !newLT.name}>
                Create Leave Type
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="space-y-2">
        {leaveTypes.map((lt: any) => (
          <Card key={lt.id}>
            <CardContent className="p-3 flex items-center gap-3">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: lt.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground">{lt.name}</p>
                  <Badge variant="outline" className="text-xs">{lt.code}</Badge>
                  {lt.isPaid && <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">Paid</Badge>}
                  {lt.isCarryForward && <Badge variant="secondary" className="text-xs">Carry Forward</Badge>}
                  {lt.isEncashable && <Badge variant="secondary" className="text-xs">Encashable</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">Max {lt.maxDaysPerYear} days/year</p>
              </div>
              {lt.isActive ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">Active</Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-700 text-xs">Inactive</Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
