import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay } from "date-fns";
import { Home, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateField } from "@/components/shared/datetime-field";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useApplyWfh } from "../api/attendance.api";

// Work-From-Home request modal — date (today .. 5 working days) + duration + optional reason.
// Warns and blocks submission on a holiday / approved-leave conflict. Needs manager approval,
// auto-approving 24h before the date if not actioned.
export function ApplyWfhDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const { data: auth } = useAuth();
  const myEmpId = auth?.user?.employeeId || "";
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [rangeMode, setRangeMode] = useState(false);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [duration, setDuration] = useState("full");
  const [reason, setReason] = useState("");

  // Max selectable = the 5th working day ahead of today (weekends disabled in the picker).
  const allowedMax = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); let c = 0; while (c < 5) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w !== 0 && w !== 6) c++; } return d; })();
  const yr = (date ?? new Date()).getFullYear();
  const { data: holidays = [] } = useQuery<any[]>({ queryKey: [`/api/holidays?year=${yr}`] });
  const { data: myLeaves = [] } = useQuery<any[]>({ queryKey: [myEmpId ? `/api/leave-requests?employeeId=${myEmpId}` : "/api/leave-requests"] });

  // Conflict check across the selected day(s) — a holiday or approved leave on any day blocks it.
  const conflict = (() => {
    if (!date) return null;
    if (rangeMode && endDate && endDate < date) return "End date can't be before the start date.";
    const end = rangeMode && endDate ? endDate : date;
    for (let d = new Date(date); d <= end; d.setDate(d.getDate() + 1)) {
      const w = d.getDay(); if (w === 0 || w === 6) continue;
      const dstr = format(d, "yyyy-MM-dd");
      const h = (holidays as any[]).find((x) => x.date === dstr);
      if (h) return `${dstr} is a public holiday (${h.name}).`;
      const lv = (myLeaves as any[]).find((l) => l.status === "approved" && l.startDate <= dstr && l.endDate >= dstr && l.employeeId === myEmpId);
      if (lv) return `You already have approved leave on ${dstr}.`;
    }
    return null;
  })();

  const submit = useApplyWfh({
    onSuccess: () => {
      toast({ title: "WFH request submitted", description: "Sent to your reporting manager. It auto-approves 24h before the date if not actioned." });
      onClose();
    },
    onError: (e: any) => toast({ title: "Couldn't submit WFH", description: e.message, variant: "destructive" }),
  });

  const onSubmit = () => {
    if (!date) return toast({ title: "Pick a date", variant: "destructive" });
    if (rangeMode && !endDate) return toast({ title: "Pick an end date", variant: "destructive" });
    if (conflict) return;
    submit.mutate({
      date: format(date, "yyyy-MM-dd"),
      endDate: rangeMode && endDate ? format(endDate, "yyyy-MM-dd") : null,
      duration: rangeMode ? "full" : duration,
      reason: reason.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden gap-0 flex flex-col max-h-[90vh]">
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-[#0E7C7B]/10 text-[#0E7C7B] flex items-center justify-center"><Home className="h-5 w-5" /></span>
            Apply Work from Home
          </DialogTitle>
          <p className="text-sm text-muted-foreground pt-1.5">Request to work from home for today or up to 5 working days in advance.</p>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>{rangeMode ? "Start date" : "Date"}</Label>
              <DateField value={date} onChange={setDate} disabled={[{ before: startOfDay(new Date()) }, { after: allowedMax }, { dayOfWeek: [0, 6] }]} placeholder="Select a date" testId="wfh-date" />
            </div>
            {rangeMode ? (
              <div className="space-y-1.5"><Label>End date</Label>
                <DateField value={endDate} onChange={setEndDate} disabled={[{ before: date ? startOfDay(date) : startOfDay(new Date()) }, { after: allowedMax }, { dayOfWeek: [0, 6] }]} placeholder="End date" testId="wfh-end-date" />
              </div>
            ) : (
              <div className="space-y-1.5"><Label>Duration</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger data-testid="wfh-duration"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Day</SelectItem>
                    <SelectItem value="first_half">First Half</SelectItem>
                    <SelectItem value="second_half">Second Half</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={rangeMode} onCheckedChange={(v) => { setRangeMode(v); if (!v) setEndDate(undefined); }} data-testid="wfh-range-toggle" />
            <Label className="font-normal text-muted-foreground text-xs">Request for multiple days (range)</Label>
          </div>
          {conflict && (
            <div className="rounded-lg border border-[#FF6F62]/40 bg-[#FF6F62]/10 px-3 py-2 text-xs text-[#C43D30] flex items-start gap-2" data-testid="wfh-conflict">
              <TriangleAlert className="h-4 w-4 flex-shrink-0 mt-0.5" /> <span>{conflict} Please pick another date.</span>
            </div>
          )}
          <div className="space-y-1.5"><Label>Reason <span className="text-muted-foreground font-normal">(optional)</span></Label><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you working from home?" data-testid="wfh-reason" /></div>
          <p className="text-[11px] text-muted-foreground pt-1">This request will be sent to your reporting manager.</p>
        </div>
        <div className="flex-shrink-0 border-t border-border bg-background px-6 py-4 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="btn-primary-gradient" disabled={submit.isPending || !date || !!conflict} onClick={onSubmit} data-testid="wfh-submit"><Home className="h-4 w-4 mr-1.5" /> {submit.isPending ? "Submitting…" : "Submit Request"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
