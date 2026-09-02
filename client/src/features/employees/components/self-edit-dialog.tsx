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

// Fields an employee may edit on their own profile (server enforces the same whitelist on /me).
const FIELDS = [
  "dateOfBirth", "gender", "maritalStatus", "bloodGroup", "phone",
  "currentAddress", "permanentAddress",
  "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation",
  "bankName", "bankAccountMasked", "ifscCode",
] as const;

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

// Self-service profile edit — personal details + bank only. Saves via PUT /api/employees/me.
export function SelfEditDialog({ open, onOpenChange, employee }: { open: boolean; onOpenChange: (v: boolean) => void; employee: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState<any>(() => initFrom(employee));
  useEffect(() => { if (open) setF(initFrom(employee)); }, [open, employee]);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const mut = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/employees/me", f),
    onSuccess: () => {
      qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && ((q.queryKey[0] as string).startsWith("/api/employees") || q.queryKey[0] === "/api/auth/me") });
      toast({ title: "Details updated" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Couldn't save", description: e.message, variant: "destructive" }),
  });

  const L = ({ children }: { children: React.ReactNode }) => <Label className="text-[13px] mb-1.5 block">{children}</Label>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0 border-b border-border"><DialogTitle>Edit My Details</DialogTitle></DialogHeader>
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
            <div className="grid grid-cols-3 gap-3">
              <div><L>Name</L><Input value={f.emergencyContactName} onChange={(e) => set("emergencyContactName", e.target.value)} /></div>
              <div><L>Phone</L><Input value={f.emergencyContactPhone} onChange={(e) => set("emergencyContactPhone", e.target.value)} type="tel" inputMode="tel" /></div>
              <div><L>Relation</L><Input value={f.emergencyContactRelation} onChange={(e) => set("emergencyContactRelation", e.target.value)} /></div>
            </div>
          </Section>

          <Section icon={CreditCard} title="Bank Details">
            <div className="grid grid-cols-3 gap-3">
              <div><L>Bank Name</L><Input value={f.bankName} onChange={(e) => set("bankName", e.target.value)} /></div>
              <div><L>Account (Masked)</L><Input value={f.bankAccountMasked} onChange={(e) => set("bankAccountMasked", e.target.value)} inputMode="numeric" /></div>
              <div><L>IFSC</L><Input value={f.ifscCode} onChange={(e) => set("ifscCode", e.target.value.toUpperCase())} /></div>
            </div>
          </Section>

        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} data-testid="button-save-self">{mut.isPending ? "Saving…" : "Save Changes"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
