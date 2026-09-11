import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { RequestDialog } from "@/components/shared/request-dialog";
import { DateInput } from "@/components/shared/datetime-field";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Clock, Plus, Sparkles, UserPlus, X, Pencil, Trash2, Lock, Hand, Users, CalendarClock, ChevronDown } from "lucide-react";
import { useOpsShiftDay, useCreateOpsSlot, useUpdateOpsSlot, useDeleteOpsSlot, useAssignOpsShift, useUnassignOpsShift, useAutoAssignOpsShifts } from "../api/ops-shifts.api";

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDay = (d: string) => { const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? format(new Date(+m[1], +m[2] - 1, +m[3]), "EEEE, d MMM yyyy") : d; };
const TYPE: Record<string, { label: string; cls: string; Icon: any }> = {
  assigned: { label: "Assigned", cls: "bg-[#206295]/15 text-[#206295]", Icon: Lock },
  self: { label: "Self", cls: "bg-[#4BDCD9]/25 text-[#0E7C7B]", Icon: Hand },
  auto: { label: "Auto", cls: "bg-[#64748B]/15 text-[#64748B]", Icon: Sparkles },
};

function SlotDialog({ open, onClose, date, initial }: { open: boolean; onClose: () => void; date: string; initial?: any }) {
  const { toast } = useToast();
  const editing = !!initial;
  const [f, setF] = useState<any>(initial ? { ...initial } : { name: "", startTime: "09:00", endTime: "17:00", capacity: 1, openForSelection: false, notes: "" });
  const set = (p: any) => setF((x: any) => ({ ...x, ...p }));
  const create = useCreateOpsSlot({ onSuccess: () => { toast({ title: "Slot created" }); onClose(); }, onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }) });
  const update = useUpdateOpsSlot({ onSuccess: () => { toast({ title: "Slot updated" }); onClose(); }, onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }) });
  const busy = create.isPending || update.isPending;
  const valid = f.name.trim() && f.startTime && f.endTime && Number(f.capacity) > 0;
  const submit = () => {
    const body = { name: f.name.trim(), startTime: f.startTime, endTime: f.endTime, capacity: Math.max(1, Math.floor(Number(f.capacity) || 1)), openForSelection: !!f.openForSelection, notes: f.notes?.trim() || null };
    if (editing) update.mutate({ id: initial.id, data: body }); else create.mutate({ ...body, date });
  };
  return (
    <RequestDialog open={open} onClose={onClose} title={editing ? "Edit slot" : "New shift slot"} subtitle={fmtDay(date)} minHeight="auto"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button className="btn-primary-gradient" disabled={!valid || busy} onClick={submit} data-testid="slot-save">{editing ? "Save" : "Create slot"}</Button></>}>
      <div className="px-6 pb-4 space-y-3">
        <div className="space-y-1"><Label className="text-[11px]">Shift name</Label><Input className="h-9" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Morning" data-testid="slot-name" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label className="text-[11px]">Start time</Label><Input className="h-9" type="time" value={f.startTime} onChange={(e) => set({ startTime: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-[11px]">End time</Label><Input className="h-9" type="time" value={f.endTime} onChange={(e) => set({ endTime: e.target.value })} /></div>
        </div>
        <div className="space-y-1"><Label className="text-[11px]">Capacity (seats)</Label><Input className="h-9" type="number" min="1" step="1" value={f.capacity} onChange={(e) => set({ capacity: e.target.value })} data-testid="slot-capacity" /></div>
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer pt-1">
          <Checkbox checked={!!f.openForSelection} onCheckedChange={(v: any) => set({ openForSelection: !!v })} data-testid="slot-open" />
          Open for employee self-selection
        </label>
        <p className="text-[11px] text-muted-foreground">When open, unassigned Ops employees can pick this slot themselves until seats run out.</p>
      </div>
    </RequestDialog>
  );
}

export default function ShiftManagementPage() {
  const { toast } = useToast();
  const [date, setDate] = useState(todayStr());
  const [slotDialog, setSlotDialog] = useState<{ open: boolean; initial?: any }>({ open: false });
  const { data, isLoading } = useOpsShiftDay(date);
  const onErr = (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" });
  const assign = useAssignOpsShift({ onSuccess: () => toast({ title: "Assigned" }), onError: onErr });
  const unassign = useUnassignOpsShift({ onSuccess: () => toast({ title: "Removed" }), onError: onErr });
  const del = useDeleteOpsSlot({ onSuccess: () => toast({ title: "Slot deleted" }), onError: onErr });
  const auto = useAutoAssignOpsShifts({ onSuccess: () => toast({ title: "Auto-assigned" }), onError: onErr });
  const busy = assign.isPending || unassign.isPending || del.isPending || auto.isPending;

  const slots = data?.slots || [];
  const roster = data?.roster || [];
  const unassigned = roster.filter((r) => !r.assignment);
  const counts = roster.reduce((c: any, r: any) => { const t = r.assignment?.assignmentType; c[t || "unassigned"] = (c[t || "unassigned"] || 0) + 1; return c; }, { assigned: 0, self: 0, auto: 0, unassigned: 0 });

  return (
    <div className="p-6 space-y-6 max-w-[80rem] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-xl bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0"><Clock className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Shift Management</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Assign & manage Ops shifts</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-[190px]"><DateInput value={date} onChange={(v) => setDate(v || todayStr())} testId="ops-date" /></div>
          <Button variant="secondary" size="sm" className="h-9" disabled={busy || slots.length === 0} onClick={() => auto.mutate(date)} data-testid="ops-auto"><Sparkles className="h-4 w-4 mr-1.5" /> Auto-assign</Button>
          <Button size="sm" className="btn-primary-gradient h-9" onClick={() => setSlotDialog({ open: true })} data-testid="ops-new-slot"><Plus className="h-4 w-4 mr-1.5" /> New slot</Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[{ k: "assigned", label: "Assigned", cls: "text-[#206295]" }, { k: "self", label: "Self-selected", cls: "text-[#0E7C7B]" }, { k: "auto", label: "Auto-assigned", cls: "text-[#64748B]" }, { k: "unassigned", label: "Unassigned", cls: "text-[#C4402F]" }].map((s) => (
          <Card key={s.k} className="border-0"><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</p><p className={`text-2xl font-bold tabular-nums mt-1 ${s.cls}`}>{counts[s.k] || 0}</p></CardContent></Card>
        ))}
      </div>

      {/* Slots */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{fmtDay(date)}</h2>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
        : slots.length === 0 ? (
          <Card className="border-0"><CardContent className="py-12 text-center"><CalendarClock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No shift slots for this day. Create one to start assigning.</p></CardContent></Card>
        ) : slots.map((s: any) => {
          const full = s.taken >= s.capacity;
          return (
            <Card key={s.id} data-testid={`slot-${s.id}`} className="border-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="h-8 w-8 rounded-lg bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0"><Clock className="h-4 w-4" /></span>
                  <span className="text-sm font-semibold text-foreground">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.startTime}–{s.endTime}</span>
                  <Badge className={`text-[10px] ${full ? "bg-[#FF6F62]/20 text-[#C4402F]" : "bg-[#4BDCD9]/25 text-[#0E7C7B]"}`}>{s.taken}/{s.capacity} filled</Badge>
                  {s.openForSelection && <Badge className="text-[10px] bg-[#206295]/12 text-[#206295] gap-1"><Users className="h-3 w-3" /> Open to pick</Badge>}
                  <div className="ml-auto flex items-center gap-1">
                    {/* Assign employee */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="sm" variant="outline" className="h-8" disabled={busy} data-testid={`assign-${s.id}`}><UserPlus className="h-3.5 w-3.5 mr-1" /> Assign</Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 max-h-72 overflow-y-auto">
                        <DropdownMenuLabel>Assign an Ops employee</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {roster.filter((r: any) => r.assignment?.slotId !== s.id).length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Everyone's already here.</div>}
                        {roster.filter((r: any) => r.assignment?.slotId !== s.id).map((r: any) => (
                          <DropdownMenuItem key={r.employeeId} onClick={() => assign.mutate({ slotId: s.id, employeeId: r.employeeId })}>
                            <span className="truncate">{r.name}</span>
                            {r.assignment && <span className="ml-auto text-[10px] text-muted-foreground">in {r.assignment.slotName}</span>}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => setSlotDialog({ open: true, initial: s })} data-testid={`edit-${s.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-[#C4402F]" disabled={busy} onClick={() => { if (window.confirm("Delete this slot and its assignments?")) del.mutate(s.id); }} data-testid={`del-${s.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                {/* Assigned people */}
                {s.assignments.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {s.assignments.map((a: any) => { const tb = TYPE[a.assignmentType] || TYPE.assigned; return (
                      <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 pl-2.5 pr-1 py-1 text-xs">
                        <span className="font-medium text-foreground">{a.employeeName}</span>
                        <Badge className={`text-[9px] gap-0.5 ${tb.cls}`}><tb.Icon className="h-2.5 w-2.5" /> {tb.label}</Badge>
                        <button onClick={() => unassign.mutate(a.id)} disabled={busy} aria-label="Remove" className="h-5 w-5 rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-[#C4402F] hover:bg-muted flex-shrink-0"><X className="h-3 w-3" /></button>
                      </span>
                    ); })}
                  </div>
                ) : <p className="text-xs text-muted-foreground mt-3">No one assigned yet.</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Unassigned employees */}
      {unassigned.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#C4402F] inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Unassigned ({unassigned.length})</h2>
          <div className="card-surface rounded-2xl p-3 flex flex-wrap gap-1.5">
            {unassigned.map((r: any) => (
              <DropdownMenu key={r.employeeId}>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-foreground hover-elevate" disabled={busy || slots.length === 0} data-testid={`unassigned-${r.employeeId}`}>
                    {r.name} <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuLabel>Assign {r.name} to…</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {slots.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Create a slot first.</div>}
                  {slots.map((s: any) => (
                    <DropdownMenuItem key={s.id} disabled={s.taken >= s.capacity} onClick={() => assign.mutate({ slotId: s.id, employeeId: r.employeeId })}>
                      <span className="truncate">{s.name} <span className="text-muted-foreground">{s.startTime}–{s.endTime}</span></span>
                      <span className="ml-auto text-[10px] text-muted-foreground">{s.taken}/{s.capacity}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
          </div>
        </div>
      )}

      {roster.length === 0 && !isLoading && <p className="text-sm text-muted-foreground">No Ops employees found. Assign the "Ops Employee" role to Operations staff first.</p>}

      {slotDialog.open && <SlotDialog open onClose={() => setSlotDialog({ open: false })} date={date} initial={slotDialog.initial} />}
    </div>
  );
}
