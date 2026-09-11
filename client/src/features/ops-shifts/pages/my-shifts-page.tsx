import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Clock, Lock, CalendarClock, Check, Users, Sparkles, Hand } from "lucide-react";
import { useMyOpsShifts, useSelectOpsSlot, useReleaseOpsSlot } from "../api/ops-shifts.api";

const fmtDay = (d: string) => { const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? format(new Date(+m[1], +m[2] - 1, +m[3]), "EEE, d MMM") : d; };
const typeBadge = (t: string) =>
  t === "assigned" ? { label: "Assigned by incharge", cls: "bg-[#206295]/15 text-[#206295]", Icon: Lock }
  : t === "self" ? { label: "You picked this", cls: "bg-[#4BDCD9]/25 text-[#0E7C7B]", Icon: Hand }
  : { label: "Auto-assigned", cls: "bg-[#64748B]/15 text-[#64748B]", Icon: Sparkles };

export default function MyShiftsPage() {
  const { toast } = useToast();
  const { data, isLoading } = useMyOpsShifts();
  const select = useSelectOpsSlot({ onSuccess: () => toast({ title: "Shift selected" }), onError: (e: any) => toast({ title: "Couldn't select", description: e.message, variant: "destructive" }) });
  const release = useReleaseOpsSlot({ onSuccess: () => toast({ title: "Shift released" }), onError: (e: any) => toast({ title: "Couldn't release", description: e.message, variant: "destructive" }) });
  const busy = select.isPending || release.isPending;

  const assignments = data?.assignments || [];
  const openSlots = data?.openSlots || [];

  // Group the pickable open slots by date.
  const openByDate = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const s of openSlots) { const a = m.get(s.date) || []; a.push(s); m.set(s.date, a); }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [openSlots]);

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <span className="h-10 w-10 rounded-xl bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0"><Clock className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Shifts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your assigned shifts, and open slots you can pick.</p>
        </div>
      </div>

      {/* Your shifts */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your shifts</h2>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
        : assignments.length === 0 ? (
          <Card className="border-0"><CardContent className="py-10 text-center"><CalendarClock className="h-9 w-9 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No upcoming shifts yet.</p></CardContent></Card>
        ) : assignments.map((a: any) => {
          const tb = typeBadge(a.assignmentType);
          return (
            <Card key={a.id} data-testid={`myshift-${a.id}`} className="border-0">
              <CardContent className="p-4 flex items-center gap-3 flex-wrap">
                <div className="h-10 w-10 rounded-lg bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0"><Clock className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{a.name} <span className="font-normal text-muted-foreground">| {a.startTime}–{a.endTime}</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmtDay(a.date)}</p>
                </div>
                <Badge className={`text-[10px] gap-1 ${tb.cls}`}><tb.Icon className="h-3 w-3" /> {tb.label}</Badge>
                {!a.locked && <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => release.mutate(a.id)} data-testid={`release-${a.id}`}>Release</Button>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Open slots to pick */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Open slots you can pick</h2>
        {openByDate.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open slots to pick right now. If your incharge assigned your shift, it's shown above.</p>
        ) : openByDate.map(([date, slots]) => (
          <div key={date} className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{fmtDay(date)}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {slots.map((s: any) => (
                <div key={s.id} data-testid={`openslot-${s.id}`} className="card-surface rounded-xl p-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{s.name} <span className="font-normal text-muted-foreground">| {s.startTime}–{s.endTime}</span></p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{s.remaining} of {s.capacity} seat{s.capacity === 1 ? "" : "s"} left</p>
                  </div>
                  <Button size="sm" className="btn-primary-gradient h-8 flex-shrink-0" disabled={busy} onClick={() => select.mutate(s.id)} data-testid={`select-${s.id}`}><Check className="h-3.5 w-3.5 mr-1" /> Select</Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
