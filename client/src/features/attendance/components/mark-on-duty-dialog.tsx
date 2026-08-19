import { useState } from "react";
import { format, startOfDay } from "date-fns";
import { Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateField, TimeField } from "@/components/shared/datetime-field";
import { useToast } from "@/hooks/use-toast";
import { ON_DUTY_PURPOSES } from "../lib/attendance-states";
import { useStartOnDuty } from "../api/attendance.api";

// Self-declaration modal — "leaving the office for official work".
export function MarkOnDutyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [purpose, setPurpose] = useState("");
  const [other, setOther] = useState("");
  const [location, setLocation] = useState("");
  const [retDate, setRetDate] = useState<Date | undefined>(undefined);
  const [retTime, setRetTime] = useState("");
  const [remarks, setRemarks] = useState("");

  const start = useStartOnDuty({
    onSuccess: () => {
      toast({ title: "You're marked On Duty", description: "Your manager has been notified." });
      onClose();
    },
    onError: (e: any) => toast({ title: "Couldn't mark on duty", description: e.message, variant: "destructive" }),
  });

  const submit = () => {
    const p = (purpose === "Others" ? other : purpose).trim();
    if (!p) return toast({ title: "Choose a purpose", variant: "destructive" });
    const expectedReturn = retDate ? `${format(retDate, "yyyy-MM-dd")}T${retTime || "18:00"}` : null;
    start.mutate({ purpose: p, location: location.trim() || null, expectedReturn, remarks: remarks.trim() || null });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden gap-0 flex flex-col max-h-[90vh]">
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-[#4A90C2]/10 text-[#4A90C2] flex items-center justify-center"><Route className="h-5 w-5" /></span>
            Mark On Duty
          </DialogTitle>
          <p className="text-sm text-muted-foreground pt-1.5">Notify your team that you're leaving the office for official work.</p>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 space-y-3">
          <div className="space-y-1.5"><Label>Purpose</Label>
            <Select value={purpose} onValueChange={setPurpose}>
              <SelectTrigger data-testid="duty-purpose"><SelectValue placeholder="Select purpose" /></SelectTrigger>
              <SelectContent>{ON_DUTY_PURPOSES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {purpose === "Others" && <div className="space-y-1.5"><Label>Specify purpose</Label><Input value={other} onChange={(e) => setOther(e.target.value)} placeholder="e.g. Government office" data-testid="duty-other" /></div>}
          <div className="space-y-1.5"><Label>Destination / Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where are you headed?" data-testid="duty-location" /></div>
          <div className="space-y-1.5"><Label>Expected Return <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <div className="grid grid-cols-2 gap-2">
              <DateField value={retDate} onChange={setRetDate} disabled={[{ before: startOfDay(new Date()) }, { after: (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 14); return d; })() }]} placeholder="Return date" testId="duty-return-date" />
              <TimeField value={retTime} onChange={setRetTime} placeholder="Return time" testId="duty-return-time" />
            </div>
          </div>
          <div className="space-y-1.5"><Label>Remarks <span className="text-muted-foreground font-normal">(optional)</span></Label><Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Anything your team should know…" data-testid="duty-remarks" /></div>
        </div>
        <div className="flex-shrink-0 border-t border-border bg-background px-6 py-4 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="btn-primary-gradient" disabled={start.isPending} onClick={submit} data-testid="duty-start"><Route className="h-4 w-4 mr-1.5" /> {start.isPending ? "Starting…" : "Start On Duty"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
