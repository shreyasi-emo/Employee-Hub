import { canTravelHr, canTravelCeo } from "../../shared/permissions";
import { useState, useEffect, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { statusClass, statusLabel } from "@/lib/status";
import { money } from "@/lib/format";
import { format } from "date-fns";
import { Plane, Hotel, Bus, Train, Car, ChevronRight, ChevronLeft, Check, CircleCheck, X, MessageSquare, User, CalendarClock, MapPin, ArrowLeftRight, MoveRight, Repeat, Users as UsersIcon, Clock, Eye, CheckSquare, MousePointerClick, ArrowDownUp } from "lucide-react";
import { ApprovalCard } from "@/features/company-workspace/components/approval-card";
import { ApprovalToolbar } from "@/features/company-workspace/components/approval-toolbar";
import { ApprovalModal, ApprovalFooter } from "@/features/company-workspace/components/approval-modal";
import { ViewToggle } from "@/features/company-workspace/components/approval-ui";
import { DataTable } from "@/components/shared/data-table";
import { Checkbox } from "@/components/ui/checkbox";
import { CommentThread } from "@/components/shared/comment-thread";
import { FileUpload, type UploadedFile } from "@/components/shared/file-upload";
import { EmployeePicker } from "@/components/shared/employee-picker";
import { Textarea } from "@/components/ui/textarea";
import { DateInput, TimeField } from "@/components/shared/datetime-field";
import { RequestDialog } from "@/components/shared/request-dialog";
import { clampEnd } from "@/lib/date-range";

const invalidateTravel = (qc: ReturnType<typeof useQueryClient>) => qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/travel") });
// A trip is "resubmitted" when the latest query/resubmit marker in its thread is a resubmit (HR answered the CEO's query).
const isResubmitted = (t: any) => { const m = ((t?.comments || []) as any[]).filter((c) => c.kind === "query" || c.kind === "resubmitted"); return m.length > 0 && m[m.length - 1].kind === "resubmitted"; };

// Chooser icons compose real lucide glyphs (accurate, crisp) with thin animated line
// elements layered around them. Motion is driven by the hover-gated tv-* classes in index.css.
function FlightIcon({ className }: { className?: string }) {
  return (
    <span className={`relative inline-block ${className ?? ""}`}>
      <span className="tv-streak absolute left-[1%] top-[52%] h-[1.5px] w-[20%] rounded-full bg-current" style={{ animationDelay: "0ms" }} />
      <span className="tv-streak absolute left-[4%] top-[68%] h-[1.5px] w-[17%] rounded-full bg-current" style={{ animationDelay: "120ms" }} />
      <span className="tv-streak absolute left-[7%] top-[84%] h-[1.5px] w-[14%] rounded-full bg-current" style={{ animationDelay: "240ms" }} />
      <Plane className="absolute right-[0%] top-[47%] -translate-y-1/2 h-[76%] w-[76%]" strokeWidth={2} />
    </span>
  );
}

function StayIcon({ className }: { className?: string }) {
  return (
    <span className={`relative inline-block ${className ?? ""}`}>
      <Hotel className="absolute left-[4%] bottom-[4%] h-[74%] w-[74%]" strokeWidth={2} />
      <span className="tv-zzz absolute right-[10%] top-[30%] text-[9px] font-bold leading-none" style={{ animationDelay: "0ms" }}>z</span>
      <span className="tv-zzz absolute right-[10%] top-[30%] text-[8px] font-bold leading-none" style={{ animationDelay: "650ms" }}>z</span>
      <span className="tv-zzz absolute right-[10%] top-[30%] text-[7px] font-bold leading-none" style={{ animationDelay: "1300ms" }}>z</span>
    </span>
  );
}

function TransportIcon({ className }: { className?: string }) {
  return (
    <span className={`relative inline-block ${className ?? ""}`}>
      <Bus className="absolute left-1/2 bottom-[8%] -translate-x-1/2 h-[74%] w-[74%]" strokeWidth={2} />
      <span className="absolute bottom-[7%] left-[3%] right-[3%] h-[2px] rounded-full bg-current opacity-25" />
      <span className="tv-road absolute bottom-[7%] left-0 h-[2px] w-full rounded-full" />
    </span>
  );
}

export const TRAVEL_CATS: Record<string, { label: string; icon: any; tint: string; desc: string }> = {
  flight: { label: "Flight", icon: FlightIcon, tint: "#206295", desc: "Book air travel — one-way or round trip" },
  stay: { label: "Stay", icon: StayIcon, tint: "#0E7C7B", desc: "Hotel or accommodation booking" },
  transport: { label: "Transport", icon: TransportIcon, tint: "#D98324", desc: "Train, bus or cab" },
};

// Field configs drive both the employee form and the read-only summary.
type F = { key: string; label: string; type?: "text" | "date" | "datetime-local" | "number" | "select"; options?: string[]; when?: (d: any) => boolean; min?: (d: any) => string | undefined; clears?: string[] };
const EMP_FIELDS: Record<string, F[]> = {
  flight: [
    { key: "tripType", label: "Trip type", type: "select", options: ["one-way", "round"] },
    { key: "fromCity", label: "From city" }, { key: "toCity", label: "To city" },
    { key: "departDate", label: "Departure", type: "date", clears: ["returnDate"] },
    { key: "returnDate", label: "Return", type: "date", when: (d) => d.tripType === "round", min: (d) => d.departDate || undefined },
  ],
  stay: [
    { key: "city", label: "City" },
    { key: "checkIn", label: "Check-in", type: "date", clears: ["checkOut"] },
    { key: "checkOut", label: "Check-out", type: "date", min: (d) => d.checkIn || undefined },
    { key: "guests", label: "Guests", type: "number" }, { key: "rooms", label: "Rooms", type: "number" },
  ],
  transport: [
    { key: "mode", label: "Mode", type: "select", options: ["train", "bus", "cab"] },
    { key: "from", label: "From" }, { key: "to", label: "To" },
    { key: "dateTime", label: "Date & time", type: "datetime-local" },
  ],
};
const HR_FIELDS: Record<string, F[]> = {
  flight: [{ key: "airline", label: "Airline" }, { key: "flightNo", label: "Flight no." }, { key: "class", label: "Class", type: "select", options: ["Economy", "Premium", "Business"] }, { key: "departTime", label: "Departs" }, { key: "arrivalTime", label: "Arrives" }],
  stay: [{ key: "hotel", label: "Hotel" }, { key: "bookingRef", label: "Booking ref" }, { key: "ratePerNight", label: "Rate / night", type: "number" }, { key: "nights", label: "Nights", type: "number" }],
  transport: [{ key: "operator", label: "Operator" }, { key: "pnr", label: "PNR / ticket" }, { key: "timing", label: "Timing" }],
};

function FieldRow({ f, value, min, onChange }: { f: F; value: any; min?: string; onChange: (v: any) => void }) {
  return (
    <div className="space-y-1 min-w-0">
      <Label className="text-[11px]">{f.label}</Label>
      {f.type === "select" ? (
        <Select value={value || ""} onValueChange={onChange}><SelectTrigger className="h-9 capitalize"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{(f.options || []).map((o) => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}</SelectContent></Select>
      ) : f.type === "date" ? (
        <DateInput value={value || ""} onChange={onChange} minDate={min} />
      ) : f.type === "datetime-local" ? (
        (() => {
          const [d, t] = String(value || "").split("T");
          return (
            <div className="grid grid-cols-2 gap-2">
              <DateInput value={d || ""} onChange={(nd) => onChange(nd ? `${nd}T${t || "09:00"}` : "")} />
              <TimeField value={t || ""} onChange={(nt) => onChange(`${d || ""}T${nt}`)} />
            </div>
          );
        })()
      ) : (
        <Input type={f.type === "number" ? "number" : "text"} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="h-9" />
      )}
    </div>
  );
}

// Read-only summary grid of a details/hrDetails object using its field config.
function SummaryGrid({ fields, data }: { fields: F[]; data: any }) {
  const shown = fields.filter((f) => data?.[f.key] !== undefined && data?.[f.key] !== "" && data?.[f.key] !== null && (!f.when || f.when(data)));
  if (!shown.length) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {shown.map((f) => (
        <div key={f.key} className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{f.label}</p>
          <p className="text-sm font-semibold text-foreground mt-1 break-words capitalize">{f.type === "date" ? format(new Date(data[f.key]), "MMM d, yyyy") : String(data[f.key])}</p>
        </div>
      ))}
    </div>
  );
}

function TravelSection({ icon: Icon, title, children }: { icon: any; title: string; children: ReactNode }) {
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

// ============================ New Travel request ============================
export function NewTravelDialog({ open, onClose, initialCategory, onSaveDraft, initialData, onSubmitted }: {
  open: boolean; onClose: () => void; initialCategory?: string; onSaveDraft?: (data: any) => void; initialData?: any; onSubmitted?: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState("flight");
  const [details, setDetails] = useState<any>({});
  const [purpose, setPurpose] = useState("");
  const [coIds, setCoIds] = useState<string[]>([]);
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"], enabled: open });

  useEffect(() => {
    if (!open) return;
    if (initialData) { setCategory(initialData.category || "flight"); setDetails(initialData.details || {}); setPurpose(initialData.purpose || ""); setCoIds(initialData.coIds || []); setStep(1); }
    else if (initialCategory) { setCategory(initialCategory); setDetails(initialCategory === "flight" ? { tripType: "one-way" } : {}); setPurpose(""); setCoIds([]); setStep(1); }
  }, [open]);
  const pick = (c: string) => { setCategory(c); setDetails(c === "flight" ? { tripType: "one-way" } : {}); setPurpose(""); setCoIds([]); setStep(1); };
  const close = () => { setStep(0); setCategory("flight"); setDetails({}); setPurpose(""); setCoIds([]); onClose(); };

  const fields = EMP_FIELDS[category] || [];
  const valid = fields.filter((f) => !f.when || f.when(details)).every((f) => f.key === "returnDate" ? true : String(details[f.key] ?? "").trim());
  const attendeesFromCo = () => employees.filter((e) => coIds.includes(e.id) && e.userId).map((e) => ({ userId: e.userId, name: `${e.firstName} ${e.lastName}`.trim() }));

  const submit = useMutation({
    mutationFn: () => apiRequest("POST", "/api/travel", { category, details, purpose: purpose.trim() || null, attendees: attendeesFromCo() }),
    onSuccess: () => { invalidateTravel(qc); toast({ title: "Awaiting HR" }); onSubmitted?.(); close(); },
    onError: (e: any) => toast({ title: "Couldn't submit", description: e.message, variant: "destructive" }),
  });

  return (
    <RequestDialog
      open={open}
      onClose={close}
      title="New Travel Request"
      subtitle="Request travel for business purposes."
      minHeight="520px"
      back={step === 1 ? <Button variant="ghost" onClick={() => setStep(0)}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button> : undefined}
      footer={<>
        <Button variant="outline" onClick={close}>Cancel</Button>
        {step === 1 && onSaveDraft && <Button variant="secondary" className="btn-glass text-[#206295]" onClick={() => { onSaveDraft({ category, details, purpose, coIds }); close(); }}>Save as Draft</Button>}
        {step === 1 && <Button className="btn-primary-gradient" disabled={!valid || submit.isPending} onClick={() => submit.mutate()} data-testid="travel-submit">{submit.isPending ? "Submitting…" : "Submit Request"}</Button>}
      </>}
    >
      <div className="px-6 pb-4">
        {step === 0 ? (
          <div className="flex flex-col justify-center h-full min-h-[360px] space-y-4">
            <p className="text-[15px] font-bold text-foreground text-center animate-in fade-in slide-in-from-top-1 duration-300">What do you need to book?</p>
            {Object.entries(TRAVEL_CATS).map(([key, c], i) => (
              <button key={key} type="button" onClick={() => pick(key)} style={{ animationDelay: `${i * 90}ms`, animationFillMode: "both" }} className="group w-full text-left card-surface rounded-2xl p-5 hover-elevate flex items-center gap-4 animate-in fade-in slide-in-from-bottom-3 duration-500" data-testid={`choose-${key}`}>
                <div className="tv-choice h-16 w-16 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ backgroundColor: `${c.tint}1f`, color: c.tint }}><c.icon className="h-9 w-9" /></div>
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground">{c.label}</p><p className="text-xs text-muted-foreground mt-1">{c.desc}</p></div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform group-hover:translate-x-1" />
              </button>
            ))}
          </div>
        ) : category === "flight" ? (
          <div className="space-y-5">
            <TravelSection icon={Plane} title="Trip Type">
              <div className="grid grid-cols-2 gap-3">
                {[{ v: "one-way", label: "One way", desc: "Single journey", Icon: MoveRight }, { v: "round", label: "Round trip", desc: "Return included", Icon: Repeat }].map(({ v, label, desc, Icon }) => {
                  const active = (details.tripType || "one-way") === v;
                  return (
                    <button key={v} type="button" onClick={() => setDetails((d: any) => ({ ...d, tripType: v }))} className={`rounded-2xl border p-4 flex flex-col items-start gap-2.5 text-left transition ${active ? "border-[#206295] bg-[#206295]/[0.06] ring-1 ring-[#206295]/40" : "border-border hover-elevate"}`} data-testid={`trip-type-${v}`}>
                      <span className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${active ? "bg-[#206295] text-white" : "bg-muted text-muted-foreground"}`}><Icon className="h-4 w-4" /></span>
                      <div><p className="text-sm font-semibold text-foreground">{label}</p><p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p></div>
                    </button>
                  );
                })}
              </div>
            </TravelSection>
            <Separator />
            <TravelSection icon={MapPin} title="Trip Details">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1 min-w-0">
                  <Label className="text-[11px]">From city</Label>
                  <div className="relative"><MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" /><Input value={details.fromCity ?? ""} onChange={(e) => setDetails((d: any) => ({ ...d, fromCity: e.target.value }))} placeholder="e.g. Bengaluru" className="h-9 pl-8" data-testid="flight-from" /></div>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 mb-0.5 flex-shrink-0 text-[#206295]" onClick={() => setDetails((d: any) => ({ ...d, fromCity: d.toCity || "", toCity: d.fromCity || "" }))} aria-label="Swap cities" data-testid="flight-swap"><ArrowLeftRight className="h-4 w-4" /></Button>
                <div className="flex-1 space-y-1 min-w-0">
                  <Label className="text-[11px]">To city</Label>
                  <div className="relative"><MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" /><Input value={details.toCity ?? ""} onChange={(e) => setDetails((d: any) => ({ ...d, toCity: e.target.value }))} placeholder="e.g. Mumbai" className="h-9 pl-8" data-testid="flight-to" /></div>
                </div>
              </div>
              <div className={`grid gap-3 ${details.tripType === "round" ? "grid-cols-2" : "grid-cols-1"}`}>
                <div className="space-y-1"><Label className="text-[11px]">Departure date</Label><DateInput value={details.departDate || ""} onChange={(v) => setDetails((d: any) => ({ ...d, departDate: v, returnDate: clampEnd(v, d.returnDate) }))} testId="flight-depart" /></div>
                {details.tripType === "round" && <div className="space-y-1"><Label className="text-[11px]">Return date</Label><DateInput value={details.returnDate || ""} onChange={(v) => setDetails((d: any) => ({ ...d, returnDate: v }))} minDate={details.departDate || undefined} testId="flight-return" /></div>}
              </div>
            </TravelSection>
            <Separator />
            <TravelSection icon={UsersIcon} title="Purpose & People">
              <div className="space-y-1"><Label className="text-[11px]">Purpose of travel</Label><Textarea rows={3} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Business reason for this trip…" className="resize-none" data-testid="flight-purpose" /></div>
              <div className="space-y-1.5">
                <Label className="text-[11px] flex items-center gap-1.5"><UsersIcon className="h-3.5 w-3.5" /> Co-travellers</Label>
                <EmployeePicker employees={employees} selectedIds={coIds} onChange={setCoIds} buttonLabel="Add co-travellers" modal />
                <p className="text-[11px] text-muted-foreground">{coIds.length === 0 ? "Just you so far — add colleagues travelling with you." : `${coIds.length + 1} passengers (including you)`}</p>
              </div>
            </TravelSection>
          </div>
        ) : category === "stay" ? (
          <div className="space-y-5">
            <TravelSection icon={Hotel} title="Stay Details">
              <div className="space-y-1">
                <Label className="text-[11px]">City</Label>
                <div className="relative"><MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" /><Input value={details.city ?? ""} onChange={(e) => setDetails((d: any) => ({ ...d, city: e.target.value }))} placeholder="e.g. Mumbai" className="h-9 pl-8" data-testid="stay-city" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-[11px]">Check-in date</Label><DateInput value={details.checkIn || ""} onChange={(v) => setDetails((d: any) => ({ ...d, checkIn: v, checkOut: clampEnd(v, d.checkOut) }))} testId="stay-checkin" /></div>
                <div className="space-y-1"><Label className="text-[11px]">Check-out date</Label><DateInput value={details.checkOut || ""} onChange={(v) => setDetails((d: any) => ({ ...d, checkOut: v }))} minDate={details.checkIn || undefined} testId="stay-checkout" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-[11px]">Guests</Label><Input type="number" min="1" value={details.guests ?? ""} onChange={(e) => setDetails((d: any) => ({ ...d, guests: e.target.value }))} placeholder="1" className="h-9" data-testid="stay-guests" /></div>
                <div className="space-y-1"><Label className="text-[11px]">Rooms</Label><Input type="number" min="1" value={details.rooms ?? ""} onChange={(e) => setDetails((d: any) => ({ ...d, rooms: e.target.value }))} placeholder="1" className="h-9" data-testid="stay-rooms" /></div>
              </div>
            </TravelSection>
            <Separator />
            <TravelSection icon={UsersIcon} title="Purpose & People">
              <div className="space-y-1"><Label className="text-[11px]">Purpose of travel</Label><Textarea rows={3} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Business reason for this stay…" className="resize-none" data-testid="stay-purpose" /></div>
              <div className="space-y-1.5">
                <Label className="text-[11px] flex items-center gap-1.5"><UsersIcon className="h-3.5 w-3.5" /> Co-travellers</Label>
                <EmployeePicker employees={employees} selectedIds={coIds} onChange={setCoIds} buttonLabel="Add co-travellers" modal />
                <p className="text-[11px] text-muted-foreground">{coIds.length === 0 ? "Just you so far — add colleagues staying with you." : `${coIds.length + 1} guests (including you)`}</p>
              </div>
            </TravelSection>
          </div>
        ) : category === "transport" ? (
          <div className="space-y-5">
            <TravelSection icon={Bus} title="Mode">
              <div className="grid grid-cols-3 gap-3">
                {[{ v: "train", label: "Train", Icon: Train }, { v: "bus", label: "Bus", Icon: Bus }, { v: "cab", label: "Cab", Icon: Car }].map(({ v, label, Icon }) => {
                  const active = details.mode === v;
                  return (
                    <button key={v} type="button" onClick={() => setDetails((d: any) => ({ ...d, mode: v }))} className={`rounded-2xl border p-4 flex flex-col items-center gap-2 text-center transition ${active ? "border-[#206295] bg-[#206295]/[0.06] ring-1 ring-[#206295]/40" : "border-border hover-elevate"}`} data-testid={`transport-mode-${v}`}>
                      <span className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${active ? "bg-[#206295] text-white" : "bg-muted text-muted-foreground"}`}><Icon className="h-4 w-4" /></span>
                      <p className="text-sm font-semibold text-foreground">{label}</p>
                    </button>
                  );
                })}
              </div>
            </TravelSection>
            <Separator />
            <TravelSection icon={MapPin} title="Route & Time">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1 min-w-0">
                  <Label className="text-[11px]">From</Label>
                  <div className="relative"><MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" /><Input value={details.from ?? ""} onChange={(e) => setDetails((d: any) => ({ ...d, from: e.target.value }))} placeholder="e.g. Bengaluru" className="h-9 pl-8" data-testid="transport-from" /></div>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 mb-0.5 flex-shrink-0 text-[#206295]" onClick={() => setDetails((d: any) => ({ ...d, from: d.to || "", to: d.from || "" }))} aria-label="Swap" data-testid="transport-swap"><ArrowLeftRight className="h-4 w-4" /></Button>
                <div className="flex-1 space-y-1 min-w-0">
                  <Label className="text-[11px]">To</Label>
                  <div className="relative"><MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" /><Input value={details.to ?? ""} onChange={(e) => setDetails((d: any) => ({ ...d, to: e.target.value }))} placeholder="e.g. Mysuru" className="h-9 pl-8" data-testid="transport-to" /></div>
                </div>
              </div>
              <div className="space-y-1"><Label className="text-[11px]">Date &amp; time</Label>
                {(() => {
                  const [dt, tm] = String(details.dateTime || "").split("T");
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      <DateInput value={dt || ""} onChange={(nd) => setDetails((x: any) => ({ ...x, dateTime: nd ? `${nd}T${tm || "09:00"}` : "" }))} testId="transport-date" />
                      <TimeField value={tm || ""} onChange={(nt) => setDetails((x: any) => ({ ...x, dateTime: `${dt || ""}T${nt}` }))} testId="transport-time" />
                    </div>
                  );
                })()}
              </div>
            </TravelSection>
            <Separator />
            <TravelSection icon={UsersIcon} title="Purpose & People">
              <div className="space-y-1"><Label className="text-[11px]">Purpose of travel</Label><Textarea rows={3} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Business reason for this trip…" className="resize-none" data-testid="transport-purpose" /></div>
              <div className="space-y-1.5">
                <Label className="text-[11px] flex items-center gap-1.5"><UsersIcon className="h-3.5 w-3.5" /> Co-travellers</Label>
                <EmployeePicker employees={employees} selectedIds={coIds} onChange={setCoIds} buttonLabel="Add co-travellers" modal />
                <p className="text-[11px] text-muted-foreground">{coIds.length === 0 ? "Just you so far — add colleagues travelling with you." : `${coIds.length + 1} travellers (including you)`}</p>
              </div>
            </TravelSection>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ backgroundColor: `${TRAVEL_CATS[category].tint}0f` }}>
              <span className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${TRAVEL_CATS[category].tint}1a`, color: TRAVEL_CATS[category].tint }}>{(() => { const I = TRAVEL_CATS[category].icon; return <I className="h-4 w-4" />; })()}</span>
              <span className="text-sm font-semibold text-foreground">{TRAVEL_CATS[category].label}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {fields.filter((f) => !f.when || f.when(details)).map((f) => <FieldRow key={f.key} f={f} value={details[f.key]} min={f.min?.(details)} onChange={(v) => setDetails((d: any) => { const next = { ...d, [f.key]: v }; for (const c of f.clears ?? []) next[c] = clampEnd(v, d[c]); return next; })} />)}
            </div>
            <div className="space-y-1"><Label className="text-[11px]">Purpose</Label><Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Business reason for travel" className="h-9" /></div>
            <div className="space-y-1">
              <Label className="text-[11px] flex items-center gap-1.5"><UsersIcon className="h-3.5 w-3.5" /> Co-travellers (optional)</Label>
              <EmployeePicker employees={employees} selectedIds={coIds} onChange={setCoIds} buttonLabel="Add co-travellers" modal />
            </div>
          </div>
        )}
      </div>
    </RequestDialog>
  );
}

// ============================ Travel detail (all roles) ============================
export function TravelDetailDialog({ id, open, onClose, context = "owner", scope = "hr" }: { id: string | null; open: boolean; onClose: () => void; context?: "owner" | "approver"; scope?: "ceo" | "hr" }) {
  const { data: auth } = useAuth();
  const role = auth?.user?.role;
  const meId = auth?.user?.id;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [hr, setHr] = useState<any>({});
  const [doc, setDoc] = useState<UploadedFile | null>(null);
  const { data: t } = useQuery<any>({ queryKey: [`/api/travel/${id}`], enabled: !!id && open });

  useEffect(() => { if (t) { setAmount(t.amount && Number(t.amount) > 0 ? String(t.amount) : ""); setHr(t.hrDetails || {}); setDoc(t.document || null); } }, [t?.id]);

  const act = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: any }) => apiRequest("POST", `/api/travel/${id}/${path}`, body || {}),
    onSuccess: (_d, v) => { invalidateTravel(qc); qc.invalidateQueries({ queryKey: [`/api/travel/${id}`] }); toast({ title: ({ price: "Sent for approval", approve: "Approved", reject: "Rejected", query: "Query raised", book: "Booked", cancel: "Cancelled" } as any)[v.path] || "Done" }); setNote(""); },
    onError: (e: any) => toast({ title: "Action failed", description: e.message, variant: "destructive" }),
  });

  if (!t) return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Loading…</DialogTitle></DialogHeader><div className="py-12 flex justify-center"><div className="h-6 w-6 rounded-full border-2 border-[#206295]/30 border-t-[#206295] animate-spin" /></div></DialogContent>
    </Dialog>
  );

  const cat = TRAVEL_CATS[t.category] || TRAVEL_CATS.flight;
  const isOwner = t.requesterId === meId;
  const canAct = context === "approver";
  const hrScope = canAct && scope !== "ceo" && canTravelHr(role);   // HR prices + books
  const ceoScope = canAct && scope !== "hr" && canTravelCeo(role);  // CEO approves/rejects/queries
  const isHrPrice = hrScope && ["pending_hr", "pending_approval", "under_review"].includes(t.status);
  const isHrBook = hrScope && t.status === "approved";
  const isCeoDecision = ceoScope && ["pending_approval", "under_review"].includes(t.status);
  const amt = Number(t.amount) || 0;
  const route = t.category === "flight" ? `${t.details?.fromCity || "?"} → ${t.details?.toCity || "?"}` : t.category === "stay" ? (t.details?.city || "") : `${t.details?.from || "?"} → ${t.details?.to || "?"}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl w-[calc(100vw-2rem)] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-border">
          <DialogTitle className="flex items-center gap-2 min-w-0">
            <span className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${cat.tint}1a`, color: cat.tint }}><cat.icon className="h-5 w-5" /></span>
            <span className="truncate">{t.reference}</span>
            <Badge className={`text-[10px] flex-shrink-0 ${statusClass(t.status)}`}>{statusLabel(t.status)}</Badge>
            {isResubmitted(t) && <Badge className="text-[10px] flex-shrink-0 bg-[#206295]/15 text-[#206295]">Resubmitted</Badge>}
            {t.autoApproved && <Badge className="text-[10px] flex-shrink-0 bg-[#4BDCD9]/25 text-[#0E7C7B]">Auto</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><User className="h-3 w-3" /> Requester</p><p className="text-sm font-semibold text-foreground mt-1 break-words">{t.employeeName || "Employee"}</p></div>
            <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {t.category === "stay" ? "Location" : "Route"}</p><p className="text-sm font-semibold text-foreground mt-1 break-words">{route}</p></div>
            <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><CalendarClock className="h-3 w-3" /> Dates</p><p className="text-sm font-semibold text-foreground mt-1 break-words">{t.startDate ? format(new Date(t.startDate), "MMM d") : "—"}{t.endDate && t.endDate !== t.startDate ? ` – ${format(new Date(t.endDate), "MMM d")}` : ""}</p></div>
          </div>
          {t.purpose && <div className="rounded-xl bg-muted/40 px-3 py-2.5"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Purpose</p><p className="text-sm text-foreground/90 mt-0.5 break-words">{t.purpose}</p></div>}

          <div><p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Trip details</p><SummaryGrid fields={EMP_FIELDS[t.category] || []} data={t.details} /></div>

          {((t.hrDetails && Object.keys(t.hrDetails).length > 0) || amt > 0) && (
            <div><p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Booking details</p>
              <SummaryGrid fields={HR_FIELDS[t.category] || []} data={t.hrDetails} />
              {t.document?.fileData && <a href={t.document.fileData} download={t.document.fileName} className="text-xs text-[#206295] hover:underline inline-flex items-center gap-1 mt-2"><Check className="h-3.5 w-3.5" /> {t.document.fileName}</a>}
            </div>
          )}

          {(t.comments || []).length > 0 && (
            <div className="rounded-xl border border-border p-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Discussion</p>
              <CommentThread basePath="/api/travel" id={t.id} comments={t.comments || []} invalidateKey="/api/travel" meId={meId} />
            </div>
          )}

          {/* HR: price + add booking details */}
          {isHrPrice && (
            <div className="rounded-xl border border-[#206295]/30 bg-[#206295]/[0.05] p-3 space-y-3">
              <div className="space-y-1"><Label className="text-[11px]">Amount (₹)</Label><Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9" placeholder="0" /></div>
              <div className="grid grid-cols-2 gap-2">{(HR_FIELDS[t.category] || []).map((f) => <FieldRow key={f.key} f={f} value={hr[f.key]} onChange={(v) => setHr((h: any) => ({ ...h, [f.key]: v }))} />)}</div>
              <p className="text-[11px] text-muted-foreground">Trips within 24h are auto-approved; otherwise this goes to the CEO.</p>
            </div>
          )}
          {/* HR: book */}
          {isHrBook && (
            <div className="rounded-xl border border-[#206295]/30 bg-[#206295]/[0.05] p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">{(HR_FIELDS[t.category] || []).map((f) => <FieldRow key={f.key} f={f} value={hr[f.key]} onChange={(v) => setHr((h: any) => ({ ...h, [f.key]: v }))} />)}</div>
              <div className="space-y-1"><Label className="text-[11px]">Ticket / voucher (sent to the traveller)</Label><FileUpload value={doc} onChange={setDoc} label="Upload document" /></div>
            </div>
          )}
          {/* CEO: decision note */}
          {isCeoDecision && <div className="space-y-1"><Label className="text-[11px]">Decision note (optional)</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the requester / HR" className="h-9" /></div>}
        </div>

        {(isHrPrice || isHrBook || isCeoDecision || amt > 0 || (isOwner && !["booked", "rejected", "cancelled"].includes(t.status))) && (
          <div className="flex-shrink-0 border-t border-border px-6 py-3 flex items-center gap-2 justify-end bg-background">
            {amt > 0 && <div className="mr-auto flex items-baseline gap-2"><span className="text-xl font-bold text-[#206295] tabular-nums">{money(amt)}</span><span className="text-xs text-muted-foreground">amount</span></div>}
            {isOwner && !["booked", "rejected", "cancelled"].includes(t.status) && <Button variant="outline" className="text-[#FF6F62] border-[#FF6F62]/40" disabled={act.isPending} onClick={() => { if (window.confirm("Cancel this request?")) act.mutate({ path: "cancel" }); }}>Cancel request</Button>}
            {isHrPrice && <Button className="btn-primary-gradient" disabled={act.isPending || !(Number(amount) > 0)} onClick={() => act.mutate({ path: "price", body: { amount: Number(amount) || 0, hrDetails: hr } })}>Send for approval</Button>}
            {isCeoDecision && <>
              <Button variant="outline" className="text-[#C4402F] border-[#FF6F62]/40" disabled={act.isPending} onClick={() => act.mutate({ path: "reject", body: { note } })}>Reject</Button>
              <Button variant="outline" className="text-[#C4402F] border-[#FF6F62]/40" disabled={act.isPending || !note.trim()} onClick={() => act.mutate({ path: "query", body: { body: note } })}><MessageSquare className="h-4 w-4 mr-1.5" /> Raise Query</Button>
              <Button className="btn-primary-gradient" disabled={act.isPending} onClick={() => act.mutate({ path: "approve", body: { note } })}><CircleCheck className="h-4 w-4 mr-1.5" /> Approve</Button>
            </>}
            {isHrBook && <Button className="btn-primary-gradient" disabled={act.isPending} onClick={() => act.mutate({ path: "book", body: { hrDetails: hr, document: doc } })}><Check className="h-4 w-4 mr-1.5" /> Mark booked</Button>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================ Travel approvals (HR price/book + CEO decide) ============================
export function TravelApprovals({ scope = "hr", open = true, onClose }: { scope?: "ceo" | "hr"; open?: boolean; onClose?: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [phase, setPhase] = useState<"pending" | "booked" | "completed">("pending");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [catFilter, setCatFilter] = useState<"all" | "flight" | "stay" | "transport">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "amount">("newest");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"card" | "table">("card");
  const { data: all = [] } = useQuery<any[]>({ queryKey: ["/api/travel"] });
  // CEO surface reviews (approve/reject/query); HR surface prices + books. Scope keeps them separate for super_admin.
  const pendingStatuses = scope === "ceo" ? ["pending_approval", "under_review"] : ["pending_hr", "approved", "under_review"];
  const list = (all as any[])
    .filter((t) => {
      if (phase === "booked") return t.status === "booked";
      if (phase === "completed") return ["rejected", "cancelled"].includes(t.status);
      return pendingStatuses.includes(t.status);
    })
    .filter((t) => catFilter === "all" || t.category === catFilter)
    .filter((t) => { const qq = search.trim().toLowerCase(); return !qq || `${t.reference || ""} ${t.employeeName || ""} ${t.employeeCode || ""} ${t.category || ""} ${t.details?.city || ""} ${t.details?.toCity || ""} ${t.details?.fromCity || ""} ${t.details?.to || ""} ${t.details?.from || ""}`.toLowerCase().includes(qq); })
    .sort((a, b) => {
      if (sortBy === "amount") return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      const da = +new Date(a.createdAt || 0), db = +new Date(b.createdAt || 0);
      return sortBy === "oldest" ? da - db : db - da;
    });
  const PAGE_SIZE = 8;
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const paged = list.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  // CEO bulk decision — the travel API decides one trip at a time, so bulk loops the per-trip endpoints.
  const bulkApprove = useMutation({
    mutationFn: async (ids: string[]) => { for (const id of ids) await apiRequest("POST", `/api/travel/${id}/approve`, {}); },
    onSuccess: (_d, ids: string[]) => { invalidateTravel(qc); toast({ title: `Approved ${ids.length}` }); setSel(new Set()); setSelectionMode(false); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const bulkReject = useMutation({
    mutationFn: async ({ ids, note }: { ids: string[]; note: string }) => { for (const id of ids) await apiRequest("POST", `/api/travel/${id}/reject`, { note }); },
    onSuccess: (_d, v: any) => { invalidateTravel(qc); toast({ title: `Rejected ${v.ids.length}` }); setSel(new Set()); setSelectionMode(false); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const busy = bulkApprove.isPending || bulkReject.isPending;
  const allSelected = list.length > 0 && list.every((t) => sel.has(t.id));
  const toggleSel = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(list.map((t) => t.id)));
  const exitSelection = () => { setSelectionMode(false); setSel(new Set()); };
  const changeView = (v: "card" | "table") => { setView(v); setPage(1); };
  const listTotal = list.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const allFilteredIds = list.map((t) => t.id);

  const renderCard = (t: any) => {
    const cat = TRAVEL_CATS[t.category] || TRAVEL_CATS.flight;
    const amt = Number(t.amount) || 0;
    const route = t.category === "flight" ? `${t.details?.fromCity || "?"} → ${t.details?.toCity || "?"}` : t.category === "stay" ? (t.details?.city || "") : `${t.details?.from || "?"} → ${t.details?.to || "?"}`;
    return (
      <ApprovalCard
        key={t.id}
        testId={`travel-appr-${t.id}`}
        icon={cat.icon}
        reference={t.reference}
        badge={<Badge className="text-[10px] px-2 py-0.5 capitalize" style={{ backgroundColor: `${cat.tint}1a`, color: cat.tint }}>{cat.label}</Badge>}
        resubmitted={isResubmitted(t)}
        amount={amt}
        amountFallback="Not priced yet"
        requesterName={t.employeeName || "Employee"}
        requesterCode={t.employeeCode}
        facts={t.purpose ? [{ label: "Purpose", value: t.purpose, muted: true, truncate: true }] : []}
        meta={[
          { icon: CalendarClock, label: "Submitted", value: t.createdAt ? format(new Date(t.createdAt), "dd MMM yyyy") : "—", width: "w-[120px]" },
          { icon: MapPin, label: t.category === "stay" ? "Location" : "Route", value: route || "—", width: "w-[150px]" },
          { icon: Clock, label: "Status", badge: <Badge className={`text-[10px] ${statusClass(t.status)}`}>{statusLabel(t.status)}</Badge>, width: "w-[130px]" },
        ]}
        selectable={scope === "ceo"}
        selectionMode={selectionMode}
        selected={sel.has(t.id)}
        onToggleSelect={() => toggleSel(t.id)}
        onView={() => setDetailId(t.id)}
        viewLabel="Review"
        menu={[{ label: "View details", icon: Eye, onClick: () => setDetailId(t.id) }]}
      />
    );
  };

  const travelCols = [
    ...(scope === "ceo" && selectionMode ? [{ key: "__sel", header: "", render: (t: any) => <div onClick={(e) => e.stopPropagation()}><Checkbox checked={sel.has(t.id)} onCheckedChange={() => toggleSel(t.id)} /></div> }] : []),
    { key: "reference", header: "Reference", cellClassName: "font-medium text-foreground", render: (t: any) => t.reference },
    { key: "requester", header: "Requester", render: (t: any) => <span className="text-foreground">{t.employeeName || "—"}<span className="text-muted-foreground"> ({t.employeeCode || "—"})</span></span> },
    { key: "category", header: "Category", cellClassName: "capitalize text-muted-foreground", render: (t: any) => (TRAVEL_CATS[t.category] || TRAVEL_CATS.flight).label },
    { key: "route", header: "Route", cellClassName: "text-muted-foreground", render: (t: any) => t.category === "flight" ? `${t.details?.fromCity || "?"} → ${t.details?.toCity || "?"}` : t.category === "stay" ? (t.details?.city || "—") : `${t.details?.from || "?"} → ${t.details?.to || "?"}` },
    { key: "date", header: "Submitted", cellClassName: "text-muted-foreground", render: (t: any) => t.createdAt ? format(new Date(t.createdAt), "dd MMM yyyy") : "—" },
    { key: "amount", header: "Amount", align: "right" as const, cellClassName: "font-semibold text-foreground", render: (t: any) => { const a = Number(t.amount) || 0; return a > 0 ? money(a) : "—"; } },
    { key: "status", header: "Status", render: (t: any) => <Badge className={`text-xs ${statusClass(t.status)}`}>{statusLabel(t.status)}</Badge> },
  ];

  const toolbar = (
    <ApprovalToolbar
      search={search}
      onSearch={(v) => { setSearch(v); setPage(1); }}
      viewToggle={<ViewToggle view={view} onChange={changeView} />}
      filters={<>
        {scope === "hr" && (
          <div className="segmented-toggle inline-flex p-0.5 h-9 flex-shrink-0">
            {(["pending", "booked", "completed"] as const).map((p) => (
              <button key={p} onClick={() => { setPhase(p); setPage(1); }} className={`px-3 h-full rounded-[9px] text-xs font-medium capitalize ${phase === p ? "btn-primary-gradient text-white" : "text-muted-foreground"}`} data-testid={`travel-phase-${p}`}>{p}</button>
            ))}
          </div>
        )}
        <Select value={catFilter} onValueChange={(v) => { setCatFilter(v as any); setPage(1); }}>
          <SelectTrigger className="h-9 w-[150px] text-xs flex-shrink-0" data-testid="travel-cat"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="flight">Flight</SelectItem>
            <SelectItem value="stay">Stay</SelectItem>
            <SelectItem value="transport">Transport</SelectItem>
          </SelectContent>
        </Select>
      </>}
      sort={
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger className="h-9 w-[160px] text-xs flex-shrink-0" data-testid="travel-sort"><ArrowDownUp className="h-3.5 w-3.5 mr-1 text-muted-foreground" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="amount">Amount: High → Low</SelectItem>
          </SelectContent>
        </Select>
      }
      selectable={scope === "ceo"} selectionMode={selectionMode}
      onSelect={() => setSelectionMode(true)} onExitSelect={exitSelection}
      allSelected={allSelected} onToggleAll={toggleAll}
      page={curPage} totalPages={totalPages} onPage={setPage} total={list.length} pageSize={PAGE_SIZE}
    />
  );

  const body = view === "table" ? (
    <div className="card-surface rounded-2xl overflow-hidden">
      <DataTable columns={travelCols} rows={paged} getRowKey={(t: any) => t.id} paginate={false} emptyText="Nothing here." onRowClick={(t: any) => { if (scope === "ceo" && selectionMode) toggleSel(t.id); else setDetailId(t.id); }} testIdPrefix="travel" />
    </div>
  ) : paged.length === 0 ? (
    <div className="card-surface rounded-2xl py-10 text-center"><Check className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">Nothing here.</p></div>
  ) : (
    <div className="space-y-3">{paged.map(renderCard)}</div>
  );

  const detail = <TravelDetailDialog id={detailId} open={!!detailId} onClose={() => setDetailId(null)} context="approver" scope={scope} />;

  if (scope === "ceo") {
    return (
      <>
        <ApprovalModal
          open={open}
          onClose={() => onClose?.()}
          icon={Plane}
          title="Travel approvals"
          count={list.length}
          toolbar={toolbar}
          footer={
            <ApprovalFooter
              total={listTotal}
              itemCount={list.length}
              selectedCount={sel.size}
              busy={busy}
              onApprove={(s) => bulkApprove.mutate(s === "selected" ? Array.from(sel) : allFilteredIds)}
              onReject={(s, note) => bulkReject.mutate({ ids: s === "selected" ? Array.from(sel) : allFilteredIds, note })}
            />
          }
        >
          {body}
        </ApprovalModal>
        {detail}
      </>
    );
  }

  return (
    <div className="space-y-3">
      {toolbar}
      {body}
      {detail}
    </div>
  );
}
