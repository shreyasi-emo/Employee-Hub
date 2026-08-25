import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload, type UploadedFile } from "@/components/shared/file-upload";
import { statusClass, statusLabel } from "@/lib/status";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useLogisticsRequestAction } from "../api/logistics.api";
import { X, Check, Play, MapPin, ArrowRight, FileText } from "lucide-react";

function Field({ label, value }: { label: string; value: any }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground mt-0.5 break-words capitalize">{value}</p>
    </div>
  );
}

export function LogisticsDetailDialog({ request: r, isHandler, isOwner, locName, onClose }: {
  request: any; isHandler: boolean; isOwner: boolean; locName: (id: string) => string | undefined; onClose: () => void;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<null | "complete" | "cancel">(null);
  const [proof, setProof] = useState<UploadedFile | null>(null);
  const [note, setNote] = useState("");
  const action = useLogisticsRequestAction({
    onSuccess: () => { toast({ title: "Updated" }); onClose(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  if (!r) return null;

  const from = r.fromLocationText || locName(r.fromLocationId) || "—";
  const to = r.toLocationText || locName(r.toLocationId) || "—";
  const isOpen = r.status === "pending" || r.status === "in_progress";
  const busy = action.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-8">
            <span className="text-sm font-semibold">{r.reference}</span>
            <Badge variant="secondary" className="text-[10px] capitalize">{r.requestType === "inboard" ? "Inboard" : "Outboard"}</Badge>
            <Badge className={`text-xs ${statusClass(r.status)}`}>{statusLabel(r.status)}</Badge>
            {r.priority === "urgent" && <Badge className="text-[10px] bg-[#FF6F62]/15 text-[#C4402F]">Urgent</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-foreground"><MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" /><span className="break-words">{from}</span><ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" /><span className="break-words">{to}</span></div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Quantity" value={`${r.quantity}${r.weightKg ? ` · ${r.weightKg} kg` : ""}`} />
            <Field label="Goods / category" value={r.goodsCategory} />
            <Field label="Point of contact" value={r.pocName ? `${r.pocName}${r.pocPhone ? ` · ${r.pocPhone}` : ""}` : null} />
            <Field label="Priority" value={r.priority} />
            <Field label="Preferred pickup" value={r.pickupDate ? format(new Date(r.pickupDate), "d MMM yyyy") : null} />
            <Field label="Expected delivery" value={r.deliveryDate ? format(new Date(r.deliveryDate), "d MMM yyyy") : null} />
          </div>

          {r.description && <Field label="Description / instructions" value={r.description} />}

          {r.proof?.fileData && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Proof of delivery / document</p>
              <a href={r.proof.fileData} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-[#206295] hover:underline"><FileText className="h-4 w-4" /> {r.proof.fileName || "View document"}</a>
            </div>
          )}

          {mode === "complete" ? (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-sm font-medium text-foreground">Attach proof to complete</p>
              <FileUpload value={proof} onChange={setProof} label="Upload POD / delivery doc / invoice" />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setMode(null); setProof(null); }}>Back</Button>
                <Button size="sm" className="btn-primary-gradient" disabled={busy || !proof} onClick={() => action.mutate({ id: r.id, op: "complete", body: { proof } })}><Check className="h-4 w-4 mr-1.5" /> Mark completed</Button>
              </div>
            </div>
          ) : mode === "cancel" ? (
            <div className="space-y-2 border-t border-border pt-3">
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional)…" className="text-sm" />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setMode(null)}>Back</Button>
                <Button size="sm" variant="outline" className="border-[#FF6F62]/40 text-[#FF6F62] hover:bg-[#FF6F62]/10 hover:text-[#FF6F62]" disabled={busy} onClick={() => action.mutate({ id: r.id, op: "cancel", body: { note } })}><X className="h-4 w-4 mr-1.5" /> Confirm cancel</Button>
              </div>
            </div>
          ) : isOpen && (isHandler || (isOwner && r.status === "pending")) ? (
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
              <Button size="sm" variant="outline" className="border-[#FF6F62]/40 text-[#FF6F62] hover:bg-[#FF6F62]/10 hover:text-[#FF6F62]" onClick={() => setMode("cancel")}><X className="h-4 w-4 mr-1.5" /> Cancel</Button>
              {isHandler && r.status === "pending" && <Button size="sm" variant="secondary" disabled={busy} onClick={() => action.mutate({ id: r.id, op: "start" })}><Play className="h-4 w-4 mr-1.5" /> Start processing</Button>}
              {isHandler && <Button size="sm" className="btn-primary-gradient" onClick={() => setMode("complete")}><Check className="h-4 w-4 mr-1.5" /> Complete</Button>}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
