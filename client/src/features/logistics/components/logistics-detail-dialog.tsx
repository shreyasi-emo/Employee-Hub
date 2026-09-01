import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload, type UploadedFile } from "@/components/shared/file-upload";
import { statusClass, statusLabel } from "@/lib/status";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useLogisticsRequestAction } from "../api/logistics.api";
import { Truck, MapPin, ArrowRight, Package, PackageCheck, PackageOpen, Boxes, User, FileText, Copy, Check, Play, X, CheckCircle2, CircleDot, CircleDashed, XCircle } from "lucide-react";

const Bar = () => <span className="w-px h-3 bg-border shrink-0" />;
import type { ComponentType, ReactNode } from "react";

const LABEL = "text-[10px] uppercase tracking-wide text-muted-foreground font-medium"; // one label size everywhere
const fmtDate = (d: any) => {
  if (!d) return null;
  const s = String(d);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); // date-only columns: parse local, not UTC
  return format(m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s), "d MMM yyyy");
};
const flatLoc = (s: any) => String(s || "—").split(/\s*—\s*/).filter(Boolean).join(", ") || "—";

const NODE: Record<string, { Icon: ComponentType<any>; cls: string }> = {
  done: { Icon: CheckCircle2, cls: "text-[#0E7C7B]" },
  current: { Icon: CircleDot, cls: "text-[#206295]" },
  upcoming: { Icon: CircleDashed, cls: "text-muted-foreground/40" },
  rejected: { Icon: XCircle, cls: "text-[#FF6F62]" },
};

// Raised → In Transit → Delivered (or Raised → Cancelled). No "in progress" text — status lives in the header.
function buildSteps(r: any) {
  if (r.status === "cancelled") {
    return [
      { label: "Raised", state: "done", date: fmtDate(r.createdAt) },
      { label: "Cancelled", state: "rejected", date: null },
    ];
  }
  const started = r.status === "in_progress" || r.status === "completed";
  const done = r.status === "completed";
  return [
    { label: "Raised", state: "done", date: fmtDate(r.createdAt) },
    { label: "In Transit", state: done ? "done" : started ? "current" : "upcoming", date: null },
    { label: "Delivered", state: done ? "done" : "upcoming", date: done ? fmtDate(r.completedAt) : null },
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
            <p className={`text-[13px] font-medium mt-2 leading-tight ${s.state === "upcoming" ? "text-muted-foreground" : "text-foreground"}`}>{s.label}</p>
            {s.date && <p className="text-[11px] text-muted-foreground mt-0.5">{s.date}</p>}
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

export function LogisticsDetailDialog({ request: r, isHandler, isOwner, locName, onClose }: {
  request: any; isHandler: boolean; isOwner: boolean; locName: (id: string) => string | undefined; onClose: () => void;
}) {
  const { toast } = useToast();
  const [proof, setProof] = useState<UploadedFile | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [note, setNote] = useState("");
  const action = useLogisticsRequestAction({
    onSuccess: () => { toast({ title: "Updated" }); onClose(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  if (!r) return null;

  const isInboard = r.requestType === "inboard";
  const from = flatLoc(r.fromLocationText || locName(r.fromLocationId));
  const to = flatLoc(r.toLocationText || locName(r.toLocationId));
  const qty = Number(r.quantity) || 0;
  const busy = action.isPending;
  const canCancel = (isHandler && (r.status === "pending" || r.status === "in_progress")) || (isOwner && r.status === "pending");
  const canStart = isHandler && r.status === "pending";
  const canComplete = isHandler && r.status === "in_progress";
  const hasFooter = canCancel || canStart || canComplete;
  const copyRef = () => { navigator.clipboard?.writeText(r.reference); toast({ title: "Reference copied" }); };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[88vh] p-0 gap-0 overflow-hidden flex flex-col rounded-[16px]">
        {/* Header — requester is the hero; the reference is a small, copyable line */}
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-border space-y-0">
          <div className="flex gap-3 pr-8">
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

        {/* Body — only this scrolls */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
          {/* Route — pickup/delivery dates sit with their endpoints */}
          <div>
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0">{isInboard ? <PackageCheck className="h-3.5 w-3.5" /> : <PackageOpen className="h-3.5 w-3.5" />}</span>
              <span className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">{isInboard ? "Inboard" : "Outboard"} movement</span>
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
            <FieldCell icon={User} color="#206295" label="Point of contact" className="col-span-2"
              value={r.pocName ? <span className="inline-flex items-center gap-2 flex-wrap">{r.pocName}{r.pocPhone && <><Bar /><span className="font-normal text-muted-foreground">{r.pocPhone}</span></>}</span> : null} />
          </div>

          {/* Description */}
          {r.description && (
            <div className="rounded-[16px] bg-muted/40 border border-border p-3.5">
              <p className={`${LABEL} inline-flex items-center gap-1.5`}><FileText className="h-3.5 w-3.5 text-muted-foreground" /> Description / instructions</p>
              <p className="text-sm text-foreground mt-1.5 break-words">{r.description}</p>
            </div>
          )}

          {/* Timeline */}
          <Separator />
          <div>
            <p className={`${LABEL} mb-3`}>Timeline</p>
            <MiniTimeline steps={buildSteps(r)} />
          </div>

          {/* Proof — existing doc, or the action zone for completing */}
          {r.proof?.fileData ? (
            <div className="rounded-[16px] border border-border bg-muted/30 p-3.5">
              <p className={`${LABEL} mb-1.5`}>Proof of delivery / document</p>
              <a href={r.proof.fileData} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-[#206295] hover:underline"><FileText className="h-4 w-4" /> {r.proof.fileName || "View document"}</a>
            </div>
          ) : canComplete ? (
            <div className="rounded-[16px] border border-border bg-muted/30 p-3.5">
              <p className={LABEL}>Proof of delivery / document <span className="text-[#FF6F62]">*</span></p>
              <div className="mt-2"><FileUpload value={proof} onChange={setProof} label="Upload POD / delivery doc / invoice" /></div>
              <p className="text-[11px] text-muted-foreground mt-2">{proof ? "Attached — ready to complete." : "Required to mark this request complete. PDF, JPG, PNG up to 10 MB."}</p>
            </div>
          ) : null}

          {/* Cancel reason */}
          {cancelling && (
            <div className="space-y-1.5">
              <p className={LABEL}>Reason for cancellation <span className="normal-case font-normal">(optional)</span></p>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" className="text-sm" />
            </div>
          )}
        </div>

        {/* Footer */}
        {hasFooter && (
          <div className="flex-shrink-0 border-t border-border bg-background px-6 py-4 flex items-center justify-end gap-2">
            {cancelling ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setCancelling(false)}>Back</Button>
                <Button size="sm" variant="outline" className="border-[#FF6F62]/60 text-[#FF6F62] hover:bg-[#FF6F62]/10 hover:text-[#FF6F62]" disabled={busy} onClick={() => action.mutate({ id: r.id, op: "cancel", body: { note } })}><X className="h-4 w-4 mr-1.5" /> Confirm cancel</Button>
              </>
            ) : (
              <>
                {canCancel && <Button variant="outline" size="sm" onClick={() => setCancelling(true)}><X className="h-4 w-4 mr-1.5" /> Cancel</Button>}
                {canStart && <Button size="sm" className="btn-primary-gradient" disabled={busy} onClick={() => action.mutate({ id: r.id, op: "start" })}><Play className="h-4 w-4 mr-1.5" /> Start processing</Button>}
                {canComplete && <Button size="sm" className="btn-primary-gradient" disabled={busy || !proof} onClick={() => action.mutate({ id: r.id, op: "complete", body: { proof } })}><Check className="h-4 w-4 mr-1.5" /> Complete</Button>}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
