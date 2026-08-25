import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateInput } from "@/components/shared/datetime-field";
import { RequestDialog } from "@/components/shared/request-dialog";
import { ChevronLeft, ChevronRight, PackageOpen, PackageCheck, MapPin } from "lucide-react";
import { useCreateLogisticsRequest } from "../api/logistics.api";

const TYPES = [
  { v: "outboard", label: "Outboard", desc: "Sending something out / outward movement", Icon: PackageOpen },
  { v: "inboard", label: "Inboard", desc: "Receiving something in / inward movement", Icon: PackageCheck },
];

const BLANK = {
  requestType: "", fromLocationId: "", fromLocationText: "", toLocationId: "", toLocationText: "",
  pickupDate: "", deliveryDate: "", pocName: "", pocPhone: "", quantity: 1, weightKg: "",
  goodsCategory: "", description: "", priority: "regular",
};

// From/To: pick a common location OR type a free-text address.
function LocationField({ label, locations, idValue, textValue, onId, onText }: any) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {label}</Label>
      <Select value={idValue || ""} onValueChange={onId}>
        <SelectTrigger className="h-9"><SelectValue placeholder="Pick a common location" /></SelectTrigger>
        <SelectContent>
          {locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}{l.city ? ` — ${l.city}` : ""}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input className="h-9" placeholder="…or type an address / location" value={textValue || ""} onChange={(e) => onText(e.target.value)} />
    </div>
  );
}

export function RaiseLogisticsDialog({ open, onClose, locations = [] }: { open: boolean; onClose: () => void; locations?: any[] }) {
  const { data: auth } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<any>({ ...BLANK });
  const set = (patch: any) => setF((p: any) => ({ ...p, ...patch }));

  useEffect(() => {
    if (open) {
      const name = auth?.employee ? `${auth.employee.firstName} ${auth.employee.lastName}`.trim() : (auth?.user?.username || "");
      setStep(0); setF({ ...BLANK, pocName: name });
    }
  }, [open]);

  const create = useCreateLogisticsRequest({
    onSuccess: () => { toast({ title: "Awaiting logistics" }); onClose(); },
    onError: (e: any) => toast({ title: "Couldn't submit", description: e.message, variant: "destructive" }),
  });

  const pick = (v: string) => { set({ requestType: v }); setStep(1); };
  const valid = !!f.requestType && (f.fromLocationId || f.fromLocationText.trim()) && (f.toLocationId || f.toLocationText.trim()) && Number(f.quantity) > 0;

  const submit = () => create.mutate({
    requestType: f.requestType,
    fromLocationId: f.fromLocationId || null, fromLocationText: f.fromLocationText.trim() || null,
    toLocationId: f.toLocationId || null, toLocationText: f.toLocationText.trim() || null,
    pickupDate: f.pickupDate || null, deliveryDate: f.deliveryDate || null,
    pocName: f.pocName.trim() || null, pocPhone: f.pocPhone.trim() || null,
    quantity: Number(f.quantity) || 1, weightKg: f.weightKg ? String(f.weightKg) : null,
    goodsCategory: f.goodsCategory.trim() || null, description: f.description.trim() || null,
    priority: f.priority,
  });

  return (
    <RequestDialog
      open={open}
      onClose={onClose}
      title="New Logistics Request"
      subtitle="Request an inward or outward movement."
      steps={["Type", "Details"]}
      step={step}
      minHeight="480px"
      back={step === 1 ? <Button variant="ghost" onClick={() => setStep(0)}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button> : undefined}
      footer={step === 1 ? (
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="btn-primary-gradient" disabled={!valid || create.isPending} onClick={submit} data-testid="logistics-submit">
            {create.isPending ? "Submitting…" : "Submit Request"}
          </Button>
        </>
      ) : undefined}
    >
      <div className="px-6 pb-4">
        {step === 0 ? (
          <div className="flex flex-col justify-center min-h-[320px] space-y-4">
            <p className="text-[15px] font-bold text-foreground text-center">What kind of movement?</p>
            {TYPES.map((t) => (
              <button key={t.v} type="button" onClick={() => pick(t.v)} className="group w-full text-left card-surface rounded-2xl p-5 hover-elevate flex items-center gap-4" data-testid={`logistics-type-${t.v}`}>
                <div className="h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0 bg-[#206295]/10 text-[#206295]"><t.Icon className="h-7 w-7" /></div>
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground">{t.label}</p><p className="text-xs text-muted-foreground mt-1">{t.desc}</p></div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform group-hover:translate-x-1" />
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <LocationField label="From" locations={locations} idValue={f.fromLocationId} textValue={f.fromLocationText} onId={(v: string) => set({ fromLocationId: v })} onText={(v: string) => set({ fromLocationText: v })} />
              <LocationField label="To" locations={locations} idValue={f.toLocationId} textValue={f.toLocationText} onId={(v: string) => set({ toLocationId: v })} onText={(v: string) => set({ toLocationText: v })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-[11px]">Preferred pickup date</Label><DateInput value={f.pickupDate} onChange={(v) => set({ pickupDate: v })} testId="logistics-pickup" /></div>
              <div className="space-y-1"><Label className="text-[11px]">Expected delivery date</Label><DateInput value={f.deliveryDate} onChange={(v) => set({ deliveryDate: v })} minDate={f.pickupDate || undefined} testId="logistics-delivery" /></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-[11px]">Point of contact</Label><Input className="h-9" value={f.pocName} onChange={(e) => set({ pocName: e.target.value })} placeholder="Name" /></div>
              <div className="space-y-1"><Label className="text-[11px]">Contact phone</Label><Input className="h-9" value={f.pocPhone} onChange={(e) => set({ pocPhone: e.target.value })} placeholder="Phone number" /></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-[11px]">Quantity <span className="text-[#FF6F62]">*</span></Label><Input className="h-9" type="number" min="1" value={f.quantity} onChange={(e) => set({ quantity: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-[11px]">Weight (kg) <span className="text-muted-foreground">optional</span></Label><Input className="h-9" type="number" min="0" step="0.001" value={f.weightKg} onChange={(e) => set({ weightKg: e.target.value })} placeholder="—" /></div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px]">Type of goods / item category</Label>
              <Input className="h-9" list="logistics-goods" value={f.goodsCategory} onChange={(e) => set({ goodsCategory: e.target.value })} placeholder="e.g. Battery, Spare parts, Documents, Tools" />
              <datalist id="logistics-goods"><option value="Battery" /><option value="Spare parts" /><option value="Documents" /><option value="Tools / equipment" /><option value="Customer shipment" /></datalist>
            </div>

            <div className="space-y-1"><Label className="text-[11px]">Description / special instructions</Label><Textarea rows={2} className="resize-none" value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="Anything the logistics team should know…" /></div>

            <div className="space-y-1.5">
              <Label className="text-[11px]">Priority</Label>
              <div className="segmented-toggle inline-flex p-0.5 h-9">
                {["regular", "urgent"].map((p) => (
                  <button key={p} type="button" onClick={() => set({ priority: p })} className={`px-4 h-full rounded-[10px] text-xs font-medium capitalize ${f.priority === p ? "btn-primary-gradient text-white" : "text-muted-foreground"}`}>{p}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </RequestDialog>
  );
}
