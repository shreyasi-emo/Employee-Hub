import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DateInput } from "@/components/shared/datetime-field";
import { useToast } from "@/hooks/use-toast";
import { LOCATIONS } from "../lib/holidays";
import { useSaveHoliday } from "../api/holidays.api";

export function HolidayDialog({ open, onOpenChange, holiday, defaultYear }: { open: boolean; onOpenChange: (v: boolean) => void; holiday?: any; defaultYear: number; }) {
  const { toast } = useToast();
  const isEdit = !!holiday;
  const blank = { name: "", date: `${defaultYear}-01-01`, location: "all", type: "mandatory", description: "" };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!open) return;
    if (holiday) setForm({ name: holiday.name || "", date: holiday.date, location: holiday.location || "all", type: holiday.isOptional ? "optional" : "mandatory", description: holiday.description || "" });
    else setForm({ ...blank });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, holiday]);

  const mutation = useSaveHoliday(holiday?.id, {
    onSuccess: () => {
      toast({ title: isEdit ? "Holiday updated" : "Holiday added" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const submit = () => mutation.mutate({
    name: form.name, date: form.date, location: form.location,
    isOptional: form.type === "optional", isRestricted: form.type === "optional",
    year: new Date(form.date).getFullYear(), description: form.description || null,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? "Edit Holiday" : "Add Holiday"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Holiday Name *</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Independence Day" data-testid="input-holiday-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <DateInput value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} testId="input-holiday-date" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger data-testid="select-holiday-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mandatory">Mandatory</SelectItem>
                  <SelectItem value="optional">Optional / Restricted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Select value={form.location} onValueChange={(v) => setForm((f) => ({ ...f, location: v }))}>
              <SelectTrigger data-testid="select-holiday-location"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={mutation.isPending || !form.name || !form.date} data-testid="button-submit-holiday">
              {mutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Holiday"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
