import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateField } from "@/components/shared/datetime-field";
import { Calendar, Info } from "lucide-react";
import { format, startOfDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { parseYmd, requestedDays } from "../lib/leave-model";
import { clampEnd, ymd } from "@/lib/date-range";
import { useApplyLeave } from "../api/leave.api";

export function ApplyLeaveDialog({ open, onOpenChange, employeeId, leaveTypes, leaveBalances }: {
  open: boolean; onOpenChange: (v: boolean) => void; employeeId?: string; leaveTypes: any[]; leaveBalances: any[];
}) {
  const { toast } = useToast();
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ leaveTypeId: "", startDate: today, endDate: today, isHalfDay: false, reason: "" });

  const selectedLT = leaveTypes.find((lt) => lt.id === form.leaveTypeId);
  const balance = leaveBalances.find((b) => b.leaveTypeId === form.leaveTypeId);
  const availableDays = parseFloat(balance?.closingBalance || "0");
  const days = requestedDays(form.startDate, form.endDate, form.isHalfDay);

  const mutation = useApplyLeave({
    onSuccess: () => {
      toast({ title: "Leave request submitted" });
      onOpenChange(false);
      setForm({ leaveTypeId: "", startDate: today, endDate: today, isHalfDay: false, reason: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Apply for Leave</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Leave Type *</label>
            <Select value={form.leaveTypeId} onValueChange={(v) => setForm((f) => ({ ...f, leaveTypeId: v }))}>
              <SelectTrigger className="mt-1" data-testid="select-leave-type"><SelectValue placeholder="Select leave type" /></SelectTrigger>
              <SelectContent>
                {leaveTypes.map((lt) => {
                  const bal = leaveBalances.find((b) => b.leaveTypeId === lt.id);
                  const avail = parseFloat(bal?.closingBalance || "0");
                  return (
                    <SelectItem key={lt.id} value={lt.id}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: lt.color }} />
                        <span>{lt.name}</span>
                        {avail > 0 && <span className="text-xs text-muted-foreground">({avail}d avail.)</span>}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {selectedLT && balance && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Info className="h-3 w-3" /> Available: {availableDays} days</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Start Date *</label>
              <div className="mt-1">
                <DateField value={parseYmd(form.startDate)} onChange={(d) => setForm((f) => { const startDate = ymd(d); return { ...f, startDate, endDate: clampEnd(startDate, f.endDate) }; })} disabled={{ before: startOfDay(new Date()) }} testId="input-start-date" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">End Date *</label>
              <div className="mt-1">
                {form.isHalfDay ? (
                  <Button type="button" variant="outline" disabled className="w-full justify-start font-normal">
                    <Calendar className="h-4 w-4 mr-2 text-muted-foreground" /> {form.startDate ? format(parseYmd(form.startDate)!, "EEE, d MMM yyyy") : "Same day"}
                  </Button>
                ) : (
                  <DateField value={parseYmd(form.endDate)} onChange={(d) => setForm((f) => ({ ...f, endDate: ymd(d) }))} disabled={{ before: startOfDay(new Date()) }} minDate={parseYmd(form.startDate)} testId="input-end-date" />
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="half-day" checked={form.isHalfDay} onChange={(e) => setForm((f) => ({ ...f, isHalfDay: e.target.checked }))} className="rounded" data-testid="checkbox-half-day" />
            <label htmlFor="half-day" className="text-sm">Half Day</label>
          </div>

          {days > 0 && (
            <div className="p-3 rounded-lg bg-muted text-sm">
              <span className="font-medium">Duration: </span>
              {days} {days === 1 ? "day" : "days"}
              {selectedLT?.isPaid && days > availableDays && (
                <p className="text-[#FF6F62] text-xs mt-1">Insufficient balance! Available: {availableDays}d, Requested: {days}d</p>
              )}
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Reason</label>
            <Textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Optional: provide reason for leave..." className="mt-1" data-testid="textarea-leave-reason" />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={() => mutation.mutate({
                employeeId, leaveTypeId: form.leaveTypeId, startDate: form.startDate,
                endDate: form.isHalfDay ? form.startDate : form.endDate, totalDays: days.toString(),
                isHalfDay: form.isHalfDay, reason: form.reason, year: new Date(form.startDate).getFullYear(),
              })}
              disabled={mutation.isPending || !form.leaveTypeId || days === 0}
              data-testid="button-submit-leave"
            >
              {mutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
