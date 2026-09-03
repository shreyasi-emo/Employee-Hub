import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Draft = {
  name: string; code: string; color: string;
  maxDaysPerYear: string; maxDaysPerRequest: string;
  isPaid: boolean; isCarryForward: boolean; maxCarryForwardDays: string;
  isEncashable: boolean; description: string;
};

const blank: Draft = {
  name: "", code: "", color: "#206295",
  maxDaysPerYear: "12", maxDaysPerRequest: "30",
  isPaid: true, isCarryForward: false, maxCarryForwardDays: "0",
  isEncashable: false, description: "",
};

const fromLeaveType = (lt: any): Draft => ({
  name: lt.name ?? "", code: lt.code ?? "", color: lt.color || "#206295",
  maxDaysPerYear: String(lt.maxDaysPerYear ?? 0), maxDaysPerRequest: String(lt.maxDaysPerRequest ?? 0),
  isPaid: !!lt.isPaid, isCarryForward: !!lt.isCarryForward, maxCarryForwardDays: String(lt.maxCarryForwardDays ?? 0),
  isEncashable: !!lt.isEncashable, description: lt.description ?? "",
});

/** Create OR edit a leave type — the single leave-type editor for the app. */
export function LeaveTypeFormDialog({
  open, onOpenChange, editing,
}: { open: boolean; onOpenChange: (v: boolean) => void; editing?: any | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = !!editing;
  const [draft, setDraft] = useState<Draft>(blank);

  useEffect(() => { if (open) setDraft(editing ? fromLeaveType(editing) : blank); }, [open, editing]);

  const save = useMutation({
    mutationFn: (data: any) => isEdit
      ? apiRequest("PUT", `/api/leave-types/${editing.id}`, data)
      : apiRequest("POST", "/api/leave-types", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/leave-types"] });
      toast({ title: isEdit ? "Leave type updated" : "Leave type created" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const submit = () => save.mutate({
    name: draft.name.trim(),
    code: draft.code.trim().toUpperCase(),
    color: draft.color,
    maxDaysPerYear: Number(draft.maxDaysPerYear) || 0,
    maxDaysPerRequest: Number(draft.maxDaysPerRequest) || 0,
    isPaid: draft.isPaid,
    isCarryForward: draft.isCarryForward,
    maxCarryForwardDays: draft.isCarryForward ? Number(draft.maxCarryForwardDays) || 0 : 0,
    isEncashable: draft.isEncashable,
    description: draft.description.trim(),
  });

  const valid = draft.name.trim() && draft.code.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle>{isEdit ? "Edit Leave Type" : "New Leave Type"}</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">
          {/* Identity */}
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Casual Leave" data-testid="input-lt-name" />
            </div>
            <div className="w-24 space-y-1.5">
              <Label className="text-xs">Code</Label>
              <Input value={draft.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="CL" data-testid="input-lt-code" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs block text-center">Colour</Label>
              <div className="relative h-9 w-9">
                <span className="block h-9 w-9 rounded-full border border-border shadow-sm" style={{ backgroundColor: draft.color }} />
                <input
                  type="color" value={draft.color} onChange={(e) => set({ color: e.target.value })}
                  className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                  aria-label="Leave type colour" data-testid="input-lt-color"
                />
              </div>
            </div>
          </div>

          {/* Limits */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Max days / year</Label>
              <Input type="number" min={0} value={draft.maxDaysPerYear} onChange={(e) => set({ maxDaysPerYear: e.target.value })} data-testid="input-lt-max-year" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Max days / request</Label>
              <Input type="number" min={0} value={draft.maxDaysPerRequest} onChange={(e) => set({ maxDaysPerRequest: e.target.value })} data-testid="input-lt-max-request" />
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3 rounded-xl border border-border p-4">
            <label className="flex items-center justify-between text-sm">
              <span>Paid leave</span>
              <Switch checked={draft.isPaid} onCheckedChange={(c) => set({ isPaid: c })} data-testid="switch-lt-paid" />
            </label>
            <div className="h-px bg-border" />
            <label className="flex items-center justify-between text-sm">
              <span>Carry forward</span>
              <Switch checked={draft.isCarryForward} onCheckedChange={(c) => set({ isCarryForward: c })} data-testid="switch-lt-cf" />
            </label>
            {draft.isCarryForward && (
              <div className="flex items-center justify-between gap-3 pl-1">
                <span className="text-xs text-muted-foreground">Max carry-forward days</span>
                <Input type="number" min={0} value={draft.maxCarryForwardDays} onChange={(e) => set({ maxCarryForwardDays: e.target.value })} className="h-8 w-24" data-testid="input-lt-cf-days" />
              </div>
            )}
            <div className="h-px bg-border" />
            <label className="flex items-center justify-between text-sm">
              <span>Encashable</span>
              <Switch checked={draft.isEncashable} onCheckedChange={(c) => set({ isEncashable: c })} data-testid="switch-lt-encashable" />
            </label>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs">Description <span className="text-muted-foreground/60">(optional)</span></Label>
            <Textarea rows={2} value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="Shown to employees in the leave policy." data-testid="input-lt-description" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={save.isPending || !valid} data-testid="button-save-leave-type">
            {save.isPending ? "Saving…" : isEdit ? "Save changes" : "Create leave type"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
