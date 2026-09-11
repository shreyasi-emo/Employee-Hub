import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUpload, type UploadedFile } from "@/components/shared/file-upload";
import { statusClass, statusLabel } from "@/lib/status";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useLogisticsRequest, useLogisticsRequestAction, useUpdateLogisticsRequest, useLogisticsDoc } from "../api/logistics.api";
import { Truck, MapPin, ArrowRight, Package, PackageCheck, PackageOpen, Boxes, User, FileText, Copy, Check, Play, X, CheckCircle2, CircleDot, CircleDashed, XCircle, Send, Navigation, ShieldCheck, Trash2, RefreshCw, Lock, Maximize2, Minimize2 } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

const Bar = () => <span className="w-px h-3 bg-border shrink-0" />;
const LABEL = "text-[10px] uppercase tracking-wide text-muted-foreground font-medium";

const fmtDate = (d: any) => {
  if (!d) return null;
  const s = String(d);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return format(m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s), "d MMM yyyy");
};
const fmtStamp = (d: any) => { if (!d) return null; const t = new Date(d); return isNaN(t.getTime()) ? null : format(t, "d MMM, h:mm a"); };
const flatLoc = (s: any) => String(s || "—").split(/\s*—\s*/).filter(Boolean).join(", ") || "—";

// Document type → human label. e-Way bill & delivery challan are finance-only (server-enforced).
const DOC_LABELS: Record<string, string> = {
  packList: "Pack ID list", pdir: "PDIR", invoice: "Invoice", logisticsReport: "Logistics report",
  dc: "Delivery challan (DC)", debitNote: "Debit note", ewayBill: "e-Way bill",
  deliveryChallan: "Delivery challan", customerDoc: "Customer document", other: "Document",
};
// Which doc types are offered depends on cargo + direction; keep it short and relevant.
function docOptions(r: any): string[] {
  const pack = r.cargoType === "pack";
  const base = pack ? ["packList", "pdir", "invoice", "logisticsReport"] : ["dc", "invoice", "debitNote"];
  return [...base, "ewayBill", "deliveryChallan", "customerDoc", "other"];
}

const NODE: Record<string, { Icon: ComponentType<any>; cls: string }> = {
  done: { Icon: CheckCircle2, cls: "text-[#0E7C7B]" },
  current: { Icon: CircleDot, cls: "text-[#206295]" },
  upcoming: { Icon: CircleDashed, cls: "text-muted-foreground/40" },
  rejected: { Icon: XCircle, cls: "text-[#FF6F62]" },
};
const ORDER = ["pending", "in_progress", "in_transit", "delivered", "completed"];
function buildSteps(r: any) {
  if (r.status === "cancelled") return [{ label: "Raised", state: "done", date: fmtDate(r.createdAt) }, { label: "Cancelled", state: "rejected", date: null }];
  const i = ORDER.indexOf(r.status);
  const at = (n: number): string => (i > n ? "done" : i === n ? "current" : "upcoming");
  return [
    { label: "Raised", state: "done", date: fmtDate(r.createdAt) },
    { label: "Processing", state: at(1), date: null },
    { label: "In transit", state: i > 2 ? "done" : at(2), date: fmtDate(r.dispatchedAt) },
    { label: "Delivered", state: i >= 3 ? "done" : "upcoming", date: fmtDate(r.deliveredAt || r.completedAt) },
  ];
}
function MiniTimeline({ steps }: { steps: any[] }) {
  return (
    <div className="flex items-start">
      {steps.map((s, i) => {
        const n = NODE[s.state] || NODE.upcoming;
        return (
          <div key={i} className="flex-1 flex flex-col items-center text-center min-w-0">
            <div className="flex items-center w-full">
              <span className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : s.state === "upcoming" ? "bg-border" : "bg-[#0E7C7B]"}`} />
              <n.Icon className={`h-[18px] w-[18px] flex-shrink-0 ${n.cls}`} />
              <span className={`h-0.5 flex-1 ${i === steps.length - 1 ? "opacity-0" : steps[i + 1].state === "upcoming" ? "bg-border" : "bg-[#0E7C7B]"}`} />
            </div>
            <p className={`text-[12px] font-medium mt-2 leading-tight ${s.state === "upcoming" ? "text-muted-foreground" : "text-foreground"}`}>{s.label}</p>
            {s.date && <p className="text-[10px] text-muted-foreground mt-0.5">{s.date}</p>}
          </div>
        );
      })}
    </div>
  );
}
function Endpoint({ pinColor, label, loc, date }: { pinColor: string; label: string; loc: string; date: ReactNode }) {
  return (
    <div className="min-w-0">
      <MapPin className="h-4 w-4" style={{ color: pinColor }} />
      <p className={`${LABEL} mt-1`}>{label}</p>
      <p className="text-[15px] font-bold text-foreground truncate mt-0.5">{loc}</p>
      <p className="text-xs font-semibold text-muted-foreground mt-0.5">{date || "—"}</p>
    </div>
  );
}
function FieldCell({ icon: I, color, label, value, className = "" }: { icon: ComponentType<any>; color: string; label: string; value: ReactNode; className?: string }) {
  return (
    <div className={`px-4 py-3 min-w-0 ${className}`}>
      <p className={`${LABEL} inline-flex items-center gap-1.5`}><I className="h-3.5 w-3.5 flex-shrink-0" style={{ color }} /> {label}</p>
      <div className="text-sm font-semibold text-foreground mt-1 break-words">{value || "—"}</div>
    </div>
  );
}
// A boxed section with a small header — used for the current-stage panels.
function Panel({ title, children, tint = "#206295" }: { title: ReactNode; children: ReactNode; tint?: string }) {
  return (
    <div className="rounded-[16px] border border-border p-3.5 space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: tint }}>{title}</p>
      {children}
    </div>
  );
}

export function LogisticsDetailDialog({ request, isHandler, isOwner, isFinance = false, processView = false, locName, onClose }: {
  request: any; isHandler: boolean; isOwner: boolean; isFinance?: boolean; processView?: boolean; locName: (id: string) => string | undefined; onClose: () => void;
}) {
  const { toast } = useToast();
  const { data: live } = useLogisticsRequest(request?.id);
  const r = live || request;

  const [expanded, setExpanded] = useState(false);
  const [proof, setProof] = useState<UploadedFile | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [note, setNote] = useState("");
  // Processing fields (logistics) — seeded from the record, PATCHed together on Save.
  const [edit, setEdit] = useState({
    carrier: request?.carrier || "", vehicleNo: request?.vehicleNo || "",
    docketNo: request?.docketNo || "", discrepancyNote: request?.discrepancyNote || "",
    qtyVerified: !!request?.qtyVerified,
  });
  const setE = (patch: any) => setEdit((p) => ({ ...p, ...patch }));
  const [docType, setDocType] = useState("");
  const [docFinanceOnly, setDocFinanceOnly] = useState(false);
  const [docFile, setDocFile] = useState<UploadedFile | null>(null);

  const onErr = (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" });
  const action = useLogisticsRequestAction({ onSuccess: () => toast({ title: "Updated" }), onError: onErr });
  const patch = useUpdateLogisticsRequest({ onSuccess: () => toast({ title: "Saved" }), onError: onErr });
  const docs = useLogisticsDoc({ onSuccess: () => toast({ title: "Document updated" }), onError: onErr });
  if (!r) return null;

  const isInboard = r.requestType === "inboard";
  const isPack = r.cargoType === "pack";
  const from = flatLoc(r.fromLocationText || locName(r.fromLocationId));
  const to = flatLoc(r.toLocationText || locName(r.toLocationId));
  const qty = Number(r.quantity) || 0;
  const busy = action.isPending || patch.isPending || docs.isPending;
  // Processing actions belong ONLY to the "To Process" tab — never from "My Requests", even for a
  // handler who happens to have raised the request (they act as requester there, not processor).
  const canManage = isHandler && processView;           // logistics / super_admin, in the process queue
  const canFinanceVerify = isFinance && processView;    // finance verifies from the monitoring queue only
  const active = ["pending", "in_progress", "in_transit", "delivered"].includes(r.status);
  const copyRef = () => { navigator.clipboard?.writeText(r.reference); toast({ title: "Reference copied" }); };

  // Stage flags drive the step-by-step reveal: each panel appears only when it's the relevant stage.
  const isProcessing = r.status === "in_progress";                                  // enter vehicle / docket / verify
  const isDispatched = ["in_transit", "delivered", "completed"].includes(r.status); // tracking + receipt exist
  const savedCarrier = r.carrier;
  const docketNo = r.docketNo || r.trackingId;                                       // single canonical docket ref

  const docList: any[] = Array.isArray(r.documents) ? r.documents : [];
  const canEditDocs = canManage && ["in_progress", "in_transit", "delivered"].includes(r.status);
  const editDirty =
    edit.carrier !== (r.carrier || "") ||
    edit.vehicleNo !== (r.vehicleNo || "") ||
    edit.docketNo !== (r.docketNo || "") ||
    edit.discrepancyNote !== (r.discrepancyNote || "") ||
    edit.qtyVerified !== !!r.qtyVerified;
  const saveEdit = () => patch.mutate({ id: r.id, data: {
    carrier: edit.carrier.trim() || null, vehicleNo: edit.vehicleNo.trim() || null,
    docketNo: edit.docketNo.trim() || null, discrepancyNote: edit.discrepancyNote.trim() || null,
    qtyVerified: edit.qtyVerified,
  } });
  const addDoc = () => { if (!docType || !docFile) return; docs.mutate({ id: r.id, add: { type: docType, financeOnly: docFinanceOnly, file: docFile } }, { onSuccess: () => { setDocType(""); setDocFile(null); setDocFinanceOnly(false); } }); };

  // Footer transitions — exactly one obvious next action per stage.
  const canStart = canManage && r.status === "pending";
  const canDispatch = canManage && r.status === "in_progress";
  // Delivery IS the close: upload POD, then "Mark delivered" completes the request (no separate step).
  const canFinish = canManage && ["in_transit", "delivered"].includes(r.status);
  const canCancel = (canManage && active) || (isOwner && r.status === "pending");
  const hasFooter = !cancelling ? (canStart || canDispatch || canFinish || canCancel) : true;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${expanded ? "sm:max-w-[1000px] max-h-[94vh]" : "sm:max-w-[615px] max-h-[88vh]"} p-0 gap-0 overflow-hidden flex flex-col rounded-[16px]`}>
        {/* Expand / shrink — sits left of the built-in close button */}
        <button type="button" onClick={() => setExpanded((e) => !e)} aria-label={expanded ? "Shrink" : "Expand"} className="absolute right-12 top-4 z-20 h-6 w-6 rounded-sm inline-flex items-center justify-center text-muted-foreground opacity-70 transition-opacity hover:opacity-100 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring" data-testid="logi-expand">
          {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>

        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-border space-y-0">
          <div className="flex gap-3 pr-16">
            <span className="h-10 w-10 rounded-xl bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0"><Truck className="h-5 w-5" /></span>
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 flex-wrap text-base">
                <span className="font-bold text-foreground">{r.requesterName || "Unassigned"}</span>
                <Badge className={`text-[11px] px-2 py-0 border-transparent ${statusClass(r.status)}`}>{statusLabel(r.status)}</Badge>
                {r.priority === "urgent" && <Badge className="text-[11px] px-2 py-0 border-transparent bg-[#FF6F62]/20 text-[#C4402F]">Urgent</Badge>}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                {r.requesterDept && <><span>{r.requesterDept}</span><Bar /></>}
                <span className="inline-flex items-center gap-1"><span className="font-medium">{r.reference}</span><button onClick={copyRef} aria-label="Copy reference" className="h-4 w-4 rounded inline-flex items-center justify-center hover:text-[#206295]"><Copy className="h-3 w-3" /></button></span>
                {fmtDate(r.createdAt) && <><Bar /><span>Raised {fmtDate(r.createdAt)}</span></>}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
          {/* Route */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="h-6 w-6 rounded-lg bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0">{isInboard ? <PackageCheck className="h-3.5 w-3.5" /> : <PackageOpen className="h-3.5 w-3.5" />}</span>
              <span className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">{isInboard ? "Inbound" : "Outbound"}</span>
              <Bar /><span className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">{isPack ? "Battery pack" : "Material"}</span>
              {r.customerName && <><Bar /><span className="text-[11.5px] text-muted-foreground">{r.customerName}</span></>}
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 mt-2.5">
              <Endpoint pinColor="#206295" label="From (Pickup)" loc={from} date={fmtDate(r.pickupDate)} />
              <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0 self-center" />
              <Endpoint pinColor="#0E7C7B" label="To (Drop)" loc={to} date={fmtDate(r.deliveryDate)} />
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 rounded-[16px] border border-border overflow-hidden">
            <FieldCell icon={Package} color="#206295" label="Goods / category" value={r.goodsCategory ? <span className="capitalize">{r.goodsCategory}</span> : null} className="border-b border-r border-border" />
            <FieldCell icon={Boxes} color="#0E7C7B" label="Quantity / weight" value={<span className="inline-flex items-center gap-2">{qty} unit{qty === 1 ? "" : "s"}{r.weightKg ? <><Bar />{Number(r.weightKg)} kg</> : null}</span>} className="border-b border-border" />
            <FieldCell icon={Truck} color="#206295" label="Vehicle / partner" value={r.carrier ? <span>{r.carrier}{r.vehicleNo ? <> · <span className="font-normal text-muted-foreground">{r.vehicleNo}</span></> : null}</span> : null} className="border-r border-border" />
            <FieldCell icon={User} color="#0E7C7B" label="Point of contact" value={r.pocName ? <span className="inline-flex items-center gap-2 flex-wrap">{r.pocName}{r.pocPhone && <><Bar /><span className="font-normal text-muted-foreground">{r.pocPhone}</span></>}</span> : null} />
          </div>

          {r.description && (
            <div className="rounded-[16px] bg-muted/40 border border-border p-3.5">
              <p className={`${LABEL} inline-flex items-center gap-1.5`}><FileText className="h-3.5 w-3.5 text-muted-foreground" /> Description</p>
              <p className="text-sm text-foreground mt-1.5 break-words">{r.description}</p>
            </div>
          )}

          {/* Timeline */}
          <Separator />
          <div><p className={`${LABEL} mb-3`}>Timeline</p><MiniTimeline steps={buildSteps(r)} /></div>

          {/* STAGE: Processing — logistics enters the vehicle, docket & verifies the load. */}
          {canManage && isProcessing && (
            <Panel title="Processing">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-[11px]">Vehicle / logistics partner <span className="text-[#FF6F62]">*</span></Label><Input className="h-9" value={edit.carrier} onChange={(e) => setE({ carrier: e.target.value })} placeholder="Transporter / company" data-testid="logi-carrier" /></div>
                <div className="space-y-1"><Label className="text-[11px]">Vehicle no.</Label><Input className="h-9" value={edit.vehicleNo} onChange={(e) => setE({ vehicleNo: e.target.value })} placeholder="KA01AB1234" /></div>
                <div className="space-y-1 sm:col-span-2"><Label className="text-[11px]">Docket no. <span className="normal-case font-normal text-muted-foreground">(optional)</span></Label><Input className="h-9" value={edit.docketNo} onChange={(e) => setE({ docketNo: e.target.value })} placeholder="LR / AWB / docket" data-testid="logi-docket" /></div>
              </div>
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <Checkbox checked={edit.qtyVerified} onCheckedChange={(v: any) => setE({ qtyVerified: !!v })} data-testid="logi-qty-verified" />
                Quantity &amp; condition verified
              </label>
              <div className="space-y-1"><Label className="text-[11px]">Discrepancy <span className="normal-case font-normal text-muted-foreground">(optional)</span></Label><Textarea rows={2} className="text-sm resize-none" value={edit.discrepancyNote} onChange={(e) => setE({ discrepancyNote: e.target.value })} placeholder="Damage or shortage, if any" /></div>
              <Button size="sm" variant="secondaryB" className="h-8" disabled={busy || !editDirty} onClick={saveEdit} data-testid="logi-save-details"><Check className="h-3.5 w-3.5 mr-1.5" /> Save</Button>
            </Panel>
          )}

          {/* Documents — added during processing / transit; accumulate across stages. */}
          {(docList.length > 0 || canEditDocs) && (
            <Panel title="Documents" tint="#0E7C7B">
              {docList.length > 0 ? (
                <div className="space-y-1.5">
                  {docList.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5">
                      <FileText className="h-4 w-4 text-[#206295] flex-shrink-0" />
                      <a href={d.fileData} target="_blank" rel="noreferrer" className="text-sm text-foreground hover:text-[#206295] hover:underline truncate flex-1 min-w-0">{DOC_LABELS[d.type] || "Document"}<span className="text-muted-foreground font-normal"> · {d.fileName}</span></a>
                      {d.financeOnly && <Badge className="text-[9px] px-1.5 py-0 flex-shrink-0 bg-[#64748B]/15 text-[#64748B] gap-1"><Lock className="h-2.5 w-2.5" /> Finance</Badge>}
                      {canEditDocs && <button onClick={() => docs.mutate({ id: r.id, removeIndex: i })} aria-label="Remove" className="h-6 w-6 rounded inline-flex items-center justify-center text-muted-foreground hover:text-[#FF6F62] flex-shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>}
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-muted-foreground">No documents yet.</p>}

              {canEditDocs && (
                <div className="space-y-2 pt-1">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Select value={docType} onValueChange={setDocType}>
                      <SelectTrigger className="h-9 flex-1" data-testid="logi-doc-type"><SelectValue placeholder="Document type" /></SelectTrigger>
                      <SelectContent>{docOptions(r).map((t) => <SelectItem key={t} value={t}>{DOC_LABELS[t]}</SelectItem>)}</SelectContent>
                    </Select>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer sm:px-1">
                      <Checkbox checked={docFinanceOnly || ["ewayBill", "deliveryChallan"].includes(docType)} disabled={["ewayBill", "deliveryChallan"].includes(docType)} onCheckedChange={(v: any) => setDocFinanceOnly(!!v)} /> Finance-only
                    </label>
                  </div>
                  <FileUpload value={docFile} onChange={setDocFile} label="Attach document" />
                  <Button size="sm" variant="secondaryB" className="h-8" disabled={busy || !docType || !docFile} onClick={addDoc} data-testid="logi-add-doc"><Check className="h-3.5 w-3.5 mr-1.5" /> Add document</Button>
                </div>
              )}
            </Panel>
          )}

          {/* STAGE: In transit — tracking appears once dispatched. */}
          {isDispatched && (docketNo || (r.trackingEvents?.length ?? 0) > 0) && (
            <Panel title={<span className="inline-flex items-center gap-1.5"><Navigation className="h-3.5 w-3.5" /> Tracking</span>}>
              <div className="flex items-center gap-2 text-xs flex-wrap">
                {docketNo && <span className="text-foreground font-medium">{docketNo}</span>}
                {r.carrier && <><Bar /><span className="text-muted-foreground">{r.carrier}</span></>}
                {canManage && ["in_transit", "delivered"].includes(r.status) && (
                  <button onClick={() => action.mutate({ id: r.id, op: "refresh-tracking" })} disabled={busy} className="ml-auto inline-flex items-center gap-1 text-[#206295] hover:underline" data-testid="logi-refresh-tracking"><RefreshCw className="h-3 w-3" /> Refresh</button>
                )}
              </div>
              {(r.trackingEvents?.length ?? 0) > 0 ? (
                <div className="space-y-2.5 pt-1">
                  {[...r.trackingEvents].reverse().map((ev: any, i: number) => (
                    <div key={i} className="flex gap-2.5">
                      <div className="flex flex-col items-center pt-0.5"><span className={`h-2 w-2 rounded-full ${i === 0 ? "bg-[#206295]" : "bg-border"}`} />{i < r.trackingEvents.length - 1 && <span className="w-px flex-1 bg-border mt-0.5" />}</div>
                      <div className="min-w-0 pb-0.5"><p className="text-[13px] text-foreground leading-tight">{ev.note}</p><p className="text-[10px] text-muted-foreground mt-0.5">{[ev.location, fmtStamp(ev.at)].filter(Boolean).join(" · ")}</p></div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-muted-foreground">Awaiting first tracking update.</p>}
            </Panel>
          )}

          {/* Inbound receipt verifications — plant OK (logistics records) + finance verify. */}
          {isInboard && isDispatched && (
            <Panel title="Receipt verification" tint="#0E7C7B">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-foreground inline-flex items-center gap-2"><PackageCheck className="h-4 w-4 text-[#0E7C7B]" /> Plant confirmed packs OK</span>
                {r.plantVerifiedAt ? <Badge className="text-[10px] bg-[#4BDCD9]/25 text-[#0E7C7B]">{fmtStamp(r.plantVerifiedAt)}</Badge>
                  : canManage ? <Button size="sm" variant="secondaryB" className="h-8" disabled={busy} onClick={() => action.mutate({ id: r.id, op: "plant-verify" })} data-testid="logi-plant-verify">Record</Button>
                  : <span className="text-xs text-muted-foreground">Pending</span>}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-foreground inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#206295]" /> Finance verified customer doc</span>
                {r.financeVerifiedAt ? <Badge className="text-[10px] bg-[#4BDCD9]/25 text-[#0E7C7B]">{fmtStamp(r.financeVerifiedAt)}</Badge>
                  : canFinanceVerify ? <Button size="sm" variant="secondaryB" className="h-8" disabled={busy} onClick={() => action.mutate({ id: r.id, op: "finance-verify" })} data-testid="logi-finance-verify">Verify</Button>
                  : <span className="text-xs text-muted-foreground">Pending finance</span>}
              </div>
            </Panel>
          )}

          {/* STAGE: Delivery — POD is the close. Shown only after dispatch; uploading it enables "Mark delivered". */}
          {r.proof?.fileData ? (
            <div className="rounded-[16px] border border-border bg-muted/30 p-3.5">
              <p className={`${LABEL} mb-1.5`}>Proof of delivery</p>
              <a href={r.proof.fileData} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-[#206295] hover:underline"><FileText className="h-4 w-4" /> {r.proof.fileName || "View document"}</a>
            </div>
          ) : canFinish ? (
            <div className="rounded-[16px] border border-border bg-muted/30 p-3.5">
              <p className={LABEL}>Proof of delivery <span className="text-[#FF6F62]">*</span></p>
              <div className="mt-2"><FileUpload value={proof} onChange={setProof} label="Upload POD / received copy" /></div>
            </div>
          ) : null}

          {cancelling && (
            <div className="space-y-1.5">
              <p className={LABEL}>Reason for cancellation <span className="normal-case font-normal">(optional)</span></p>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" className="text-sm" />
            </div>
          )}
        </div>

        {/* Footer — one clear next action per stage. */}
        {hasFooter && (
          <div className="flex-shrink-0 border-t border-border bg-background px-6 py-4 flex items-center justify-end gap-2 flex-wrap">
            {cancelling ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setCancelling(false)}>Back</Button>
                <Button size="sm" variant="outline" className="border-[#FF6F62]/60 text-[#FF6F62] hover:bg-[#FF6F62]/10 hover:text-[#FF6F62]" disabled={busy} onClick={() => action.mutate({ id: r.id, op: "cancel", body: { note } }, { onSuccess: onClose })}><X className="h-4 w-4 mr-1.5" /> Confirm cancel</Button>
              </>
            ) : (
              <>
                {canCancel && <Button variant="outline" size="sm" onClick={() => setCancelling(true)}><X className="h-4 w-4 mr-1.5" /> Cancel</Button>}
                {canStart && <Button size="sm" className="btn-primary-gradient" disabled={busy} onClick={() => action.mutate({ id: r.id, op: "start" })}><Play className="h-4 w-4 mr-1.5" /> Start processing</Button>}
                {canDispatch && <Button size="sm" className="btn-primary-gradient" disabled={busy || !savedCarrier} title={!savedCarrier ? "Add & save a vehicle first" : undefined} onClick={() => action.mutate({ id: r.id, op: "dispatch" })} data-testid="logi-dispatch"><Send className="h-4 w-4 mr-1.5" /> Dispatch</Button>}
                {canFinish && <Button size="sm" className="btn-primary-gradient" disabled={busy || !proof} title={!proof ? "Upload the POD to mark delivered" : undefined} onClick={() => action.mutate({ id: r.id, op: "complete", body: { proof } }, { onSuccess: onClose })} data-testid="logi-deliver"><PackageCheck className="h-4 w-4 mr-1.5" /> Mark delivered</Button>}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
