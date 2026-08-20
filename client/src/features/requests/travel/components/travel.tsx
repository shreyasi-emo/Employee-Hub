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
import { Plane, Hotel, Moon, Bus, ChevronRight, ChevronLeft, Check, CircleCheck, X, MessageSquare, User, CalendarClock, MapPin, ArrowLeftRight, MoveRight, Repeat, Users as UsersIcon } from "lucide-react";
import { CommentThread } from "@/components/shared/comment-thread";
import { FileUpload, type UploadedFile } from "@/components/shared/file-upload";
import { EmployeePicker } from "@/components/shared/employee-picker";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/shared/datetime-field";

export const canTravelHr = (role?: string) => !!role && ["super_admin", "hr_admin", "hr_executive"].includes(role);
export const canTravelCeo = (role?: string) => !!role && ["super_admin", "ceo_approver"].includes(role);
const invalidateTravel = (qc: ReturnType<typeof useQueryClient>) => qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/travel") });
// A trip is "resubmitted" when the latest query/resubmit marker in its thread is a resubmit (HR answered the CEO's query).
const isResubmitted = (t: any) => { const m = ((t?.comments || []) as any[]).filter((c) => c.kind === "query" || c.kind === "resubmitted"); return m.length > 0 && m[m.length - 1].kind === "resubmitted"; };

// Chooser icons compose real lucide glyphs (accurate, crisp) with thin animated line
// elements layered around them. Motion is driven by the hover-gated tv-* classes in index.css.
function FlightIcon({ className }: { className?: string }) {
  return (
    <span className={`relative inline-block ${className ?? ""}`}>
      <span className="tv-streak absolute left-[3%] top-[46%] h-[2px] w-[34%] rounded-full bg-current" style={{ animationDelay: "0ms" }} />
      <span className="tv-streak absolute left-[9%] top-[62%] h-[2px] w-[30%] rounded-full bg-current" style={{ animationDelay: "110ms" }} />
      <span className="tv-streak absolute left-[15%] top-[78%] h-[2px] w-[26%] rounded-full bg-current" style={{ animationDelay: "220ms" }} />
      <Plane className="absolute right-[2%] top-1/2 -translate-y-1/2 h-[80%] w-[80%]" strokeWidth={2} />
    </span>
  );
}

function StayIcon({ className }: { className?: string }) {
  return (
    <span className={`relative inline-block ${className ?? ""}`}>
      <Hotel className="absolute inset-0 m-auto h-[78%] w-[78%]" strokeWidth={2} />
      <Moon className="tv-moonrise absolute right-[1%] top-[3%] h-[34%] w-[34%]" strokeWidth={2} />
    </span>
  );
}

function TransportIcon({ className }: { className?: string }) {
  return (
    <span className={`relative inline-block ${className ?? ""}`}>
      <Bus className="absolute left-1/2 top-[2%] -translate-x-1/2 h-[74%] w-[74%]" strokeWidth={2} />
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
type F = { key: string; label: string; type?: "text" | "date" | "datetime-local" | "number" | "select"; options?: string[]; when?: (d: any) => boolean };
const EMP_FIELDS: Record<string, F[]> = {
  flight: [
    { key: "tripType", label: "Trip type", type: "select", options: ["one-way", "round"] },
    { key: "fromCity", label: "From city" }, { key: "toCity", label: "To city" },
    { key: "departDate", label: "Departure", type: "date" },
    { key: "returnDate", label: "Return", type: "date", when: (d) => d.tripType === "round" },
  ],
  stay: [
    { key: "city", label: "City" },
    { key: "checkIn", label: "Check-in", type: "date" }, { key: "checkOut", label: "Check-out", type: "date" },
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

function FieldRow({ f, value, onChange }: { f: F; value: any; onChange: (v: any) => void }) {
  return (
    <div className="space-y-1 min-w-0">
      <Label className="text-[11px]">{f.label}</Label>
      {f.type === "select"
        ? <Select value={value || ""} onValueChange={onChange}><SelectTrigger className="h-9 capitalize"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{(f.options || []).map((o) => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}</SelectContent></Select>
        : <Input type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "datetime-local" ? "datetime-local" : "text"} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="h-9" />}
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
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-lg min-h-[520px] max-h-[86vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0"><DialogTitle>New Travel Request</DialogTitle><p className="text-sm text-muted-foreground mt-0.5">Request travel for business purposes.</p></DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-4">
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
                  <div className="space-y-1"><Label className="text-[11px]">Departure date</Label><DateInput value={details.departDate || ""} onChange={(v) => setDetails((d: any) => ({ ...d, departDate: v }))} testId="flight-depart" /></div>
                  {details.tripType === "round" && <div className="space-y-1"><Label className="text-[11px]">Return date</Label><DateInput value={details.returnDate || ""} onChange={(v) => setDetails((d: any) => ({ ...d, returnDate: v }))} testId="flight-return" /></div>}
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
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ backgroundColor: `${TRAVEL_CATS[category].tint}0f` }}>
                <span className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${TRAVEL_CATS[category].tint}1a`, color: TRAVEL_CATS[category].tint }}>{(() => { const I = TRAVEL_CATS[category].icon; return <I className="h-4 w-4" />; })()}</span>
                <span className="text-sm font-semibold text-foreground">{TRAVEL_CATS[category].label}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {fields.filter((f) => !f.when || f.when(details)).map((f) => <FieldRow key={f.key} f={f} value={details[f.key]} onChange={(v) => setDetails((d: any) => ({ ...d, [f.key]: v }))} />)}
              </div>
              <div className="space-y-1"><Label className="text-[11px]">Purpose</Label><Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Business reason for travel" className="h-9" /></div>
              <div className="space-y-1">
                <Label className="text-[11px] flex items-center gap-1.5"><UsersIcon className="h-3.5 w-3.5" /> Co-travellers (optional)</Label>
                <EmployeePicker employees={employees} selectedIds={coIds} onChange={setCoIds} buttonLabel="Add co-travellers" modal />
              </div>
            </div>
          )}
        </div>
        <div className="flex-shrink-0 border-t border-border bg-background px-6 py-4 flex items-center justify-between gap-3">
          {step === 1 ? <Button variant="ghost" onClick={() => setStep(0)}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={close}>Cancel</Button>
            {step === 1 && onSaveDraft && <Button variant="secondary" className="btn-glass text-[#206295]" onClick={() => { onSaveDraft({ category, details, purpose, coIds }); close(); }}>Save as Draft</Button>}
            {step === 1 && <Button className="btn-primary-gradient" disabled={!valid || submit.isPending} onClick={() => submit.mutate()} data-testid="travel-submit">{submit.isPending ? "Submitting…" : "Submit Request"}</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0">
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
export function TravelApprovals({ scope = "hr" }: { scope?: "ceo" | "hr" }) {
  const [phase, setPhase] = useState<"pending" | "booked" | "completed">("pending");
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data: all = [] } = useQuery<any[]>({ queryKey: ["/api/travel"] });
  // CEO surface reviews (approve/reject/query); HR surface prices + books. Scope keeps them separate for super_admin.
  const pendingStatuses = scope === "ceo" ? ["pending_approval", "under_review"] : ["pending_hr", "approved", "under_review"];
  const list = (all as any[]).filter((t) => {
    if (phase === "booked") return t.status === "booked";
    if (phase === "completed") return ["rejected", "cancelled"].includes(t.status);
    return pendingStatuses.includes(t.status);
  }).sort((a, b) => +new Date(b.createdAt || 0) - +new Date(a.createdAt || 0));
  return (
    <div className="space-y-3">
      {scope === "hr" && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground flex items-center gap-2"><Plane className="h-4 w-4 text-[#206295]" /> Travel</span>
          <div className="segmented-toggle inline-flex p-0.5 h-8 ml-1">
            {(["pending", "booked", "completed"] as const).map((p) => (
              <button key={p} onClick={() => setPhase(p)} className={`px-3 h-full rounded-[9px] text-xs font-medium capitalize ${phase === p ? "btn-primary-gradient text-white" : "text-muted-foreground"}`} data-testid={`travel-phase-${p}`}>{p}</button>
            ))}
          </div>
        </div>
      )}
      {list.length === 0 ? (
        <div className="card-surface rounded-2xl py-10 text-center"><Check className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">Nothing here.</p></div>
      ) : (
        <div className="space-y-2.5">
          {list.map((t) => {
            const cat = TRAVEL_CATS[t.category] || TRAVEL_CATS.flight;
            const amt = Number(t.amount) || 0;
            const route = t.category === "flight" ? `${t.details?.fromCity || "?"} → ${t.details?.toCity || "?"}` : t.category === "stay" ? (t.details?.city || "") : `${t.details?.from || "?"} → ${t.details?.to || "?"}`;
            return (
              <div key={t.id} className="card-surface card-hover p-4 flex items-center gap-4 cursor-pointer" onClick={() => setDetailId(t.id)} data-testid={`travel-appr-${t.id}`}>
                <span className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${cat.tint}1a`, color: cat.tint }}><cat.icon className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap"><span className="text-[13px] font-semibold text-foreground truncate">{t.reference}</span><Badge className={`text-[10px] ${statusClass(t.status)}`}>{statusLabel(t.status)}</Badge>{isResubmitted(t) && <Badge className="text-[10px] bg-[#206295]/15 text-[#206295]">Resubmitted</Badge>}</div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{cat.label} | {t.employeeName || "Employee"} | {route}{t.startDate ? ` | ${format(new Date(t.startDate), "MMM d")}` : ""}</p>
                </div>
                {amt > 0 && <span className="text-base font-bold text-[#206295] tabular-nums flex-shrink-0">{money(amt)}</span>}
                <Button size="sm" variant="ghost" className="h-9 btn-glass text-[#206295] hover:text-[#206295] flex-shrink-0" onClick={(e) => { e.stopPropagation(); setDetailId(t.id); }}><CircleCheck className="h-4 w-4 mr-1.5" /> Review</Button>
              </div>
            );
          })}
        </div>
      )}
      <TravelDetailDialog id={detailId} open={!!detailId} onClose={() => setDetailId(null)} context="approver" scope={scope} />
    </div>
  );
}
