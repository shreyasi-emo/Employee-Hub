import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateInput } from "@/components/shared/datetime-field";
import { clampEnd } from "@/lib/date-range";
import { RequestDialog } from "@/components/shared/request-dialog";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ChevronLeft, ChevronRight, PackageOpen, PackageCheck, MapPin, CalendarClock, Package, ChevronDown, Plus } from "lucide-react";
import { useCreateLogisticsRequest, useSaveLocation } from "../api/logistics.api";

// Roles allowed to curate common pickup/drop locations (mirrors the server guard).
const CAN_ADD_LOCATION = ["super_admin", "hr_admin", "hr_executive", "manager", "logistics"];

// Section header — mirrors the Travel/request forms so fields group cleanly instead of crowding.
function Section({ icon: Icon, title, children }: { icon: any; title: string; children: any }) {
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

const TYPES = [
  { v: "outboard", label: "Outboard", desc: "Sending something out / outward movement", Icon: PackageOpen },
  { v: "inboard", label: "Inboard", desc: "Receiving something in / inward movement", Icon: PackageCheck },
];

const BLANK = {
  requestType: "", fromLocationId: "", fromLocationText: "", toLocationId: "", toLocationText: "",
  pickupDate: "", deliveryDate: "", pocName: "", pocPhone: "", quantity: 1, weightKg: "",
  goodsCategory: "", description: "", priority: "regular",
};

const GOODS_OPTIONS = ["Battery", "Spare parts", "Documents", "Tools / equipment", "Customer shipment"];

// From/To: one combobox — type a free-text address, or hit the chevron to pick a common location.
// Authorised roles get an inline "Add … as common location" so the picklist stays curated.
function LocationField({ label, locations, idValue, textValue, onId, onText, canAdd, onAdd }: any) {
  const picked = idValue ? locations.find((l: any) => l.id === idValue) : null;
  const display = picked ? `${picked.name}${picked.city ? ` — ${picked.city}` : ""}` : (textValue || "");
  const typed = (textValue || "").trim();
  const exists = locations.some((l: any) => l.name.toLowerCase() === typed.toLowerCase());
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {label}</Label>
      <div className="relative">
        <Input
          className="h-9 pr-9"
          placeholder="Type an address, or pick a common one ▾"
          value={display}
          onChange={(e) => { onText(e.target.value); if (idValue) onId(""); }}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Pick a common location" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted">
              <ChevronDown className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[260px] max-h-64 overflow-y-auto">
            {locations.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No common locations yet.</div>}
            {locations.map((l: any) => (
              <DropdownMenuItem key={l.id} onClick={() => { onId(l.id); onText(""); }}>
                <MapPin className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" /> <span className="truncate">{l.name}{l.city ? ` — ${l.city}` : ""}</span>
              </DropdownMenuItem>
            ))}
            {canAdd && typed && !exists && (
              <>
                {locations.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem onClick={() => onAdd(typed)}><Plus className="h-3.5 w-3.5 mr-2 flex-shrink-0" /> Add “{typed}” as common location</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
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
  const saveLoc = useSaveLocation({
    onSuccess: () => toast({ title: "Common location added" }),
    onError: (e: any) => toast({ title: "Couldn't add location", description: e.message, variant: "destructive" }),
  });
  const canAddLocation = CAN_ADD_LOCATION.includes(auth?.user?.role || "");
  const addLocation = (name: string) => saveLoc.mutate({ data: { name } });

  const pick = (v: string) => { set({ requestType: v }); setStep(1); };
  const valid = !!f.requestType && (f.fromLocationId || f.fromLocationText.trim()) && (f.toLocationId || f.toLocationText.trim()) && Number(f.quantity) > 0;

  const submit = () => create.mutate({
    requestType: f.requestType,
    fromLocationId: f.fromLocationId || null, fromLocationText: f.fromLocationText.trim() || null,
    toLocationId: f.toLocationId || null, toLocationText: f.toLocationText.trim() || null,
    pickupDate: f.pickupDate || null, deliveryDate: f.deliveryDate || null,
    pocName: f.pocName.trim() || null, pocPhone: f.pocPhone.trim() || null,
    quantity: Math.max(1, Math.floor(Number(f.quantity) || 1)), weightKg: f.weightKg ? String(f.weightKg) : null,
    goodsCategory: f.goodsCategory.trim() || null, description: f.description.trim() || null,
    priority: f.priority,
  });

  return (
    <RequestDialog
      open={open}
      onClose={onClose}
      title="New Logistics Request"
      subtitle={step === 0 ? "Request an inward or outward movement." : `${f.requestType === "inboard" ? "Inboard" : "Outboard"} movement details`}
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
          <div className="space-y-5">
            <Section icon={MapPin} title="Route">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <LocationField label="From" locations={locations} idValue={f.fromLocationId} textValue={f.fromLocationText} onId={(v: string) => set({ fromLocationId: v })} onText={(v: string) => set({ fromLocationText: v })} canAdd={canAddLocation} onAdd={addLocation} />
                <LocationField label="To" locations={locations} idValue={f.toLocationId} textValue={f.toLocationText} onId={(v: string) => set({ toLocationId: v })} onText={(v: string) => set({ toLocationText: v })} canAdd={canAddLocation} onAdd={addLocation} />
              </div>
            </Section>

            <Separator />

            <Section icon={CalendarClock} title="Schedule & contact">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-[11px]">Preferred pickup date</Label><DateInput value={f.pickupDate} onChange={(v) => set({ pickupDate: v, deliveryDate: clampEnd(v, f.deliveryDate) })} testId="logistics-pickup" /></div>
                <div className="space-y-1"><Label className="text-[11px]">Expected delivery date</Label><DateInput value={f.deliveryDate} onChange={(v) => set({ deliveryDate: v })} minDate={f.pickupDate || undefined} testId="logistics-delivery" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-[11px]">Point of contact</Label><Input className="h-9" value={f.pocName} onChange={(e) => set({ pocName: e.target.value })} placeholder="Name" /></div>
                <div className="space-y-1"><Label className="text-[11px]">Contact phone</Label><Input className="h-9" type="tel" inputMode="tel" value={f.pocPhone} onChange={(e) => set({ pocPhone: e.target.value })} placeholder="Phone number" /></div>
              </div>
            </Section>

            <Separator />

            <Section icon={Package} title="Shipment details">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-[11px]">Quantity <span className="text-[#FF6F62]">*</span></Label><Input className="h-9" type="number" min="1" step="1" value={f.quantity} onChange={(e) => set({ quantity: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-[11px]">Weight (kg) <span className="text-muted-foreground">optional</span></Label><Input className="h-9" type="number" min="0" step="0.001" value={f.weightKg} onChange={(e) => set({ weightKg: e.target.value })} placeholder="—" /></div>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Type of goods / item category</Label>
                <div className="relative">
                  <Input className="h-9 pr-9" value={f.goodsCategory} onChange={(e) => set({ goodsCategory: e.target.value })} placeholder="e.g. Battery, Spare parts, Documents" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label="Pick a category" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted">
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[240px]">
                      {GOODS_OPTIONS.map((g) => (
                        <DropdownMenuItem key={g} onClick={() => set({ goodsCategory: g })}>{g}</DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
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
            </Section>
          </div>
        )}
      </div>
    </RequestDialog>
  );
}
