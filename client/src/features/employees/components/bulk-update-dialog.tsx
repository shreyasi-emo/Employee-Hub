import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { EMP_TYPES } from "../lib/employee-constants";
import { useBulkUpdateEmployees } from "../api/employees.api";

/** Set one field across the selected employees. */
export function BulkUpdateDialog({ open, onOpenChange, ids, departments, locations, onDone }: {
  open: boolean; onOpenChange: (v: boolean) => void; ids: string[]; departments: any[]; locations: string[]; onDone: () => void;
}) {
  const { toast } = useToast();
  const bulkUpdate = useBulkUpdateEmployees();
  const [field, setField] = useState("departmentId");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function apply() {
    if (!value) return;
    setBusy(true);
    try {
      await bulkUpdate(ids, field, value);
      toast({ title: `Updated ${ids.length} employee${ids.length !== 1 ? "s" : ""}` });
      onDone(); onOpenChange(false);
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Bulk Update · {ids.length} selected</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Field</p>
            <Select value={field} onValueChange={(v) => { setField(v); setValue(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="departmentId">Department</SelectItem>
                <SelectItem value="workLocation">Location</SelectItem>
                <SelectItem value="employmentType">Employment Type</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">New value</p>
            <Select value={value} onValueChange={setValue}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {field === "departmentId" && departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                {field === "workLocation" && locations.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                {field === "employmentType" && EMP_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={apply} disabled={busy || !value}>{busy ? "Updating…" : "Apply"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
