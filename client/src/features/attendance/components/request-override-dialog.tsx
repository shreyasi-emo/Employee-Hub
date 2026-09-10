import { useState } from "react";
import { format, startOfDay } from "date-fns";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateField } from "@/components/shared/datetime-field";
import { useToast } from "@/hooks/use-toast";
import { useRequestOverride } from "../api/attendance.api";

// The status the employee is requesting the past day be corrected to.
const OVERRIDE_STATUSES = [
  { value: "present", label: "Present" },
  { value: "half_day", label: "Half Day" },
  { value: "wfh", label: "Work From Home" },
  { value: "on_duty", label: "On Duty" },
  { value: "absent", label: "Absent" },
];

// Request Attendance Override — correct a PAST attendance day. Mandatory reason; goes to HR/manager for
// approval (employees can't change past attendance directly). Mirrors the WFH request dialog.
export function RequestOverrideDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [requestedStatus, setRequestedStatus] = useState("present");
  const [reason, setReason] = useState("");

  // Only past dates — today and the future can't be "corrected".
  const yesterday = (() => { const d = startOfDay(new Date()); d.setDate(d.getDate() - 1); return d; })();

  const submit = useRequestOverride({
    onSuccess: () => { toast({ title: "Override request submitted", description: "Sent to HR for review. You can track its status here." }); reset(); onClose(); },
    onError: (e: any) => toast({ title: "Couldn't submit request", description: e.message, variant: "destructive" }),
  });

  const reset = () => { setDate(undefined); setRequestedStatus("present"); setReason(""); };

  const onSubmit = () => {
    if (!date) return toast({ title: "Pick a past date", variant: "destructive" });
    if (!reason.trim()) return toast({ title: "A reason is required", variant: "destructive" });
    submit.mutate({ attendanceDate: format(date, "yyyy-MM-dd"), requestedStatus, reason: reason.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden gap-0 flex flex-col max-h-[90vh]">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-border">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-[#206295]/10 text-[#206295] flex items-center justify-center"><CalendarClock className="h-5 w-5" /></span>
            Request Attendance Override
          </DialogTitle>
          <p className="text-sm text-muted-foreground pt-1.5">Ask HR to correct a past day's attendance. HR reviews and applies the change.</p>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Date</Label>
              <DateField value={date} onChange={setDate} disabled={[{ after: yesterday }]} placeholder="Past date" testId="override-date" />
            </div>
            <div className="space-y-1.5"><Label>Correct to</Label>
              <Select value={requestedStatus} onValueChange={setRequestedStatus}>
                <SelectTrigger data-testid="override-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OVERRIDE_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Reason <span className="text-[#C4402F] font-normal">*</span></Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why does this day need correcting? (required)" data-testid="override-reason" />
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">This request will be sent to HR for review.</p>
        </div>
        <div className="flex-shrink-0 border-t border-border bg-background px-6 py-4 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="btn-primary-gradient" disabled={submit.isPending || !date || !reason.trim()} onClick={onSubmit} data-testid="override-submit"><CalendarClock className="h-4 w-4 mr-1.5" /> {submit.isPending ? "Submitting…" : "Submit Request"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
