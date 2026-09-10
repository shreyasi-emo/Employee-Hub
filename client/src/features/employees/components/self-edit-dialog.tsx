import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateInput } from "@/components/shared/datetime-field";
import { User, MapPin, AlertCircle, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GENDERS, MARITAL } from "../lib/employee-constants";

// Fields an employee may REQUEST to change on their own profile (HR approves before they apply).
const FIELDS = [
  "dateOfBirth", "gender", "maritalStatus", "bloodGroup", "phone",
  "currentAddress", "permanentAddress",
  "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation",
  "bankName", "bankAccountMasked", "ifscCode",
] as const;

const FIELD_LABELS: Record<string, string> = {
  dateOfBirth: "Date of Birth", gender: "Gender", maritalStatus: "Marital Status", bloodGroup: "Blood Group", phone: "Phone",
  currentAddress: "Current Address", permanentAddress: "Permanent Address",
  emergencyContactName: "Emergency Contact Name", emergencyContactPhone: "Emergency Contact Phone", emergencyContactRelation: "Emergency Contact Relation",
  bankName: "Bank Name", bankAccountMasked: "Bank Account", ifscCode: "IFSC Code",
};

function initFrom(e: any) {
  const o: any = {};
  for (const k of FIELDS) o[k] = e?.[k] ?? "";
  return o;
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="h-6 w-6 rounded-lg bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0"><Icon className="h-3.5 w-3.5" /></span>
        <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// Employees can no longer edit their record directly — this submits a change REQUEST that HR approves.
// (The profile photo stays self-serve and is handled separately, not here.)
export function SelfEditDialog({ open, onOpenChange, employee }: { open: boolean; onOpenChange: (v: boolean) => void; employee: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState<any>(() => initFrom(employee));
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) { setF(initFrom(employee)); setReason(""); } }, [open, employee]);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const mut = useMutation({
    mutationFn: (payload: any) => apiRequest("POST", "/api/profile-edit-requests", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/profile-edit-requests"] });
      toast({ title: "Change request submitted", description: "HR will review your requested changes." });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Couldn't submit", description: e.message, variant: "destructive" }),
  });

  // Only the fields the employee actually changed become the request (old → new, with a label for HR).
  const submit = () => {
    const changes: Record<string, { label: string; old: any; new: any }> = {};
    for (const k of FIELDS) {
      const oldV = employee?.[k] ?? "";
      const newV = f[k] ?? "";
      if (String(oldV) !== String(newV)) changes[k] = { label: FIELD_LABELS[k] || k, old: (oldV as any) || null, new: (newV as any) || null };
    }
    if (Object.keys(changes).length === 0) { toast({ title: "No changes to submit" }); return; }
    mut.mutate({ changes, reason: reason.trim() || undefined });
  };

  const L = ({ children }: { children: React.ReactNode }) => <Label className="text-[13px] mb-1.5 block">{children}</Label>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0 border-b border-border">
          <DialogTitle>Request Profile Changes</DialogTitle>
          <p className="text-sm text-muted-foreground pt-1">Edit the fields you'd like changed and submit. HR reviews and approves before your profile is updated.</p>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
          <Section icon={User} title="Personal">
            <div className="grid grid-cols-2 gap-3">
              <div><L>Date of Birth</L><DateInput value={f.dateOfBirth} onChange={(v: any) => set("dateOfBirth", v)} /></div>
              <div><L>Phone</L><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} type="tel" inputMode="tel" /></div>
              <div><L>Gender</L><Select value={f.gender || undefined} onValueChange={(v) => set("gender", v)}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{GENDERS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent></Select></div>
              <div><L>Marital Status</L><Select value={f.maritalStatus || undefined} onValueChange={(v) => set("maritalStatus", v)}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{MARITAL.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select></div>
              <div><L>Blood Group</L><Input value={f.bloodGroup} onChange={(e) => set("bloodGroup", e.target.value)} placeholder="e.g. O+" /></div>
            </div>
          </Section>

          <Section icon={MapPin} title="Address">
            <div className="grid grid-cols-1 gap-3">
              <div><L>Current Address</L><Textarea rows={2} value={f.currentAddress} onChange={(e) => set("currentAddress", e.target.value)} /></div>
              <div><L>Permanent Address</L><Textarea rows={2} value={f.permanentAddress} onChange={(e) => set("permanentAddress", e.target.value)} /></div>
            </div>
          </Section>

          <Section icon={AlertCircle} title="Emergency Contact">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><L>Name</L><Input value={f.emergencyContactName} onChange={(e) => set("emergencyContactName", e.target.value)} /></div>
              <div><L>Phone</L><Input value={f.emergencyContactPhone} onChange={(e) => set("emergencyContactPhone", e.target.value)} type="tel" inputMode="tel" /></div>
              <div><L>Relation</L><Input value={f.emergencyContactRelation} onChange={(e) => set("emergencyContactRelation", e.target.value)} /></div>
            </div>
          </Section>

          <Section icon={CreditCard} title="Bank Details">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><L>Bank Name</L><Input value={f.bankName} onChange={(e) => set("bankName", e.target.value)} /></div>
              <div><L>Account (Masked)</L><Input value={f.bankAccountMasked} onChange={(e) => set("bankAccountMasked", e.target.value)} inputMode="numeric" /></div>
              <div><L>IFSC</L><Input value={f.ifscCode} onChange={(e) => set("ifscCode", e.target.value.toUpperCase())} /></div>
            </div>
          </Section>

          <div><L>Reason <span className="text-muted-foreground font-normal">(optional)</span></L><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Add a note for HR about why these changes are needed" data-testid="self-edit-reason" /></div>

        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={mut.isPending} data-testid="button-save-self">{mut.isPending ? "Submitting…" : "Submit Request"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
