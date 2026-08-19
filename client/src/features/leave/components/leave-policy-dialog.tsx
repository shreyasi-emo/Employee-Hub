import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSaveLeaveType } from "../api/leave.api";

/** One leave type: read-only summary, or the company-wide editable form. */
function PolicyCard({ lt, editing }: { lt: any; editing: boolean }) {
  const { toast } = useToast();
  const [draft, setDraft] = useState({
    name: lt.name ?? "",
    isPaid: !!lt.isPaid,
    maxDaysPerYear: String(lt.maxDaysPerYear ?? 0),
    maxDaysPerRequest: String(lt.maxDaysPerRequest ?? 0),
    isCarryForward: !!lt.isCarryForward,
    maxCarryForwardDays: String(lt.maxCarryForwardDays ?? 0),
    isEncashable: !!lt.isEncashable,
    description: lt.description ?? "",
  });

  const save = useSaveLeaveType(lt.id, {
    onSuccess: () => toast({ title: "Leave policy updated" }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const submit = () => save.mutate({
    name: draft.name,
    isPaid: draft.isPaid,
    maxDaysPerYear: Number(draft.maxDaysPerYear) || 0,
    maxDaysPerRequest: Number(draft.maxDaysPerRequest) || 0,
    isCarryForward: draft.isCarryForward,
    maxCarryForwardDays: Number(draft.maxCarryForwardDays) || 0,
    isEncashable: draft.isEncashable,
    description: draft.description,
  });

  if (!editing) {
    return (
      <Card className="border-0"><CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: lt.color }} />
            <span className="text-sm font-medium text-foreground truncate">{lt.name}</span>
            <Badge className={`text-[10px] ${lt.isPaid ? "bg-[#4BDCD9]/25 text-[#206295]" : "bg-[#6A7366]/15 text-[#6A7366]"}`}>{lt.isPaid ? "Paid" : "Unpaid"}</Badge>
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0">{lt.code}</span>
        </div>
        {lt.description && <p className="text-xs text-muted-foreground mt-1.5">{lt.description}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
          <span>Max/year: <span className="text-[#206295] font-medium">{lt.maxDaysPerYear || "—"}</span></span>
          <span>Max/request: <span className="text-[#206295] font-medium">{lt.maxDaysPerRequest || "—"}</span></span>
          <span>Carry forward: <span className="text-foreground/80 font-medium">{lt.isCarryForward ? `${lt.maxCarryForwardDays}d` : "No"}</span></span>
          <span>Encashable: <span className="text-foreground/80 font-medium">{lt.isEncashable ? "Yes" : "No"}</span></span>
        </div>
      </CardContent></Card>
    );
  }

  return (
    <Card className="border-0"><CardContent className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: lt.color }} />
        <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="h-9 flex-1" />
        <span className="text-xs text-muted-foreground flex-shrink-0">{lt.code}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-muted-foreground">Max days / year</label><Input type="number" value={draft.maxDaysPerYear} onChange={(e) => setDraft((d) => ({ ...d, maxDaysPerYear: e.target.value }))} className="h-9 mt-1" /></div>
        <div><label className="text-xs text-muted-foreground">Max days / request</label><Input type="number" value={draft.maxDaysPerRequest} onChange={(e) => setDraft((d) => ({ ...d, maxDaysPerRequest: e.target.value }))} className="h-9 mt-1" /></div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <label className="flex items-center gap-2 text-sm"><Switch checked={draft.isPaid} onCheckedChange={(c) => setDraft((d) => ({ ...d, isPaid: c }))} /> Paid</label>
        <label className="flex items-center gap-2 text-sm"><Switch checked={draft.isCarryForward} onCheckedChange={(c) => setDraft((d) => ({ ...d, isCarryForward: c }))} /> Carry forward</label>
        {draft.isCarryForward && (
          <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">Max CF days</span><Input type="number" value={draft.maxCarryForwardDays} onChange={(e) => setDraft((d) => ({ ...d, maxCarryForwardDays: e.target.value }))} className="h-9 w-20" /></div>
        )}
        <label className="flex items-center gap-2 text-sm"><Switch checked={draft.isEncashable} onCheckedChange={(c) => setDraft((d) => ({ ...d, isEncashable: c }))} /> Encashable</label>
      </div>
      <div><label className="text-xs text-muted-foreground">Description</label><Textarea rows={2} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} className="mt-1" /></div>
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={save.isPending} data-testid={`button-save-policy-${lt.id}`}>{save.isPending ? "Saving…" : "Save"}</Button>
      </div>
    </CardContent></Card>
  );
}

export function LeavePolicyDialog({ open, onOpenChange, leaveTypes, canEdit }: { open: boolean; onOpenChange: (v: boolean) => void; leaveTypes: any[]; canEdit: boolean; }) {
  const [editing, setEditing] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setEditing(false); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle>Leave Policy</DialogTitle>
            {canEdit && (
              <Button variant="secondary" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => setEditing((e) => !e)} aria-label={editing ? "Done editing" : "Edit policy"} data-testid="button-edit-policy">
                {editing ? <CheckCircle2 className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </DialogHeader>
        {canEdit && editing && <p className="text-xs text-muted-foreground -mt-1">Editing applies company-wide for all employees.</p>}
        <div className="space-y-3">
          {leaveTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leave types configured.</p>
          ) : leaveTypes.map((lt) => <PolicyCard key={lt.id} lt={lt} editing={canEdit && editing} />)}
        </div>
      </DialogContent>
    </Dialog>
  );
}
