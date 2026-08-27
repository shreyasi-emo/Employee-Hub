import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ExpandToggle } from "./expandable-approval-dialog";
import { money } from "../shared/approval-format";
import { Check, X, MessageSquare } from "lucide-react";

// ONE shell for every CEO-approval surface (reimbursement / office / procurement / travel). It owns the
// chrome — dialog, maximisable header (icon · title · count), the toolbar row, the scrolling body and the
// footer — so the four modals are literally the same component; only the `toolbar`, `footer` and body
// (`children`) content differ per category.
export function ApprovalModal({ open, onClose, icon: Icon, title, count, toolbar, footer, children }: {
  open: boolean; onClose: () => void; icon?: any; title: string; count?: number;
  toolbar?: ReactNode; footer?: ReactNode; children: ReactNode;
}) {
  const [maximized, setMaximized] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setMaximized(false); onClose(); } }}>
      <DialogContent className={`${maximized ? "max-w-[98vw] w-[98vw] h-[96vh] max-h-[96vh]" : "max-w-6xl w-[calc(100vw-2rem)] max-h-[92vh]"} p-0 gap-0 overflow-hidden flex flex-col`}>
        <div className="flex-shrink-0 border-b border-border px-6 pt-6 pb-4">
          <DialogHeader className="space-y-0">
            <DialogTitle className="flex items-center gap-2 pr-16">{Icon && <Icon className="h-5 w-5 text-[#206295]" />} {title}{typeof count === "number" ? ` (${count})` : ""}</DialogTitle>
          </DialogHeader>
          {toolbar && <div className="mt-3">{toolbar}</div>}
        </div>
        <ExpandToggle expanded={maximized} onToggle={() => setMaximized((v) => !v)} />
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex-shrink-0 border-t border-border bg-background px-6 py-4">{footer}</div>}
      </DialogContent>
    </Dialog>
  );
}

// The shared footer: total + item count on the left; Approve-all / Reject-all on the right, always
// visible. Ticking rows (selection) flips the buttons to act on the subset and, where the surface
// supports it, adds Raise-Query. Reject/Query open an inline note field. Handlers do the actual work
// (bulk endpoints for office/procurement, per-item loops for reimbursement/travel).
export function ApprovalFooter({ total, itemCount, selectedCount = 0, busy, onApprove, onReject, onQuery, rejectPlaceholder = "Reason for rejection" }: {
  total: number; itemCount: number; selectedCount?: number; busy?: boolean;
  onApprove: (scope: "all" | "selected") => void;
  onReject: (scope: "all" | "selected", note: string) => void;
  onQuery?: (note: string) => void;
  rejectPlaceholder?: string;
}) {
  const [mode, setMode] = useState<null | "reject" | "query">(null);
  const [note, setNote] = useState("");
  const scope: "all" | "selected" = selectedCount > 0 ? "selected" : "all";
  const rejectBtn = "border-[#FF6F62]/40 text-[#FF6F62] hover:bg-[#FF6F62]/10 hover:text-[#FF6F62]";
  const queryBtn = "border-[#D98324]/40 text-[#D98324] hover:bg-[#FFA962]/15 hover:text-[#D98324]";
  const reset = () => { setMode(null); setNote(""); };
  return (
    <div className="space-y-3">
      {mode && <Textarea autoFocus rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === "reject" ? `${rejectPlaceholder}${selectedCount > 0 ? ` (${selectedCount})` : ""}` : `Message about ${selectedCount} selected`} />}
      {!mode && selectedCount > 0 && onQuery && (
        <div className="flex items-center justify-between rounded-lg bg-[#FFA962]/10 px-3 py-2">
          <span className="text-xs font-medium text-[#D98324]">{selectedCount} selected</span>
          <Button size="sm" variant="outline" className={queryBtn} disabled={busy} onClick={() => setMode("query")}><MessageSquare className="h-4 w-4 mr-1.5" /> Raise Query on {selectedCount}</Button>
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="mr-auto flex items-center gap-2.5">
          <span className="text-xl font-bold text-foreground tabular-nums">{money(total)}</span>
          <span className="h-4 w-px bg-border" /><span className="text-xs text-muted-foreground">{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
        </div>
        {mode ? (
          <>
            <Button variant="secondary" size="sm" disabled={busy} onClick={reset}>Cancel</Button>
            {mode === "reject"
              ? <Button size="sm" variant="outline" className={rejectBtn} disabled={busy || !note.trim() || !itemCount} onClick={() => { onReject(scope, note); reset(); }}><X className="h-4 w-4 mr-1.5" /> {selectedCount > 0 ? `Reject ${selectedCount}` : "Reject all"}</Button>
              : <Button size="sm" variant="outline" className={queryBtn} disabled={busy || !note.trim() || !selectedCount} onClick={() => { onQuery?.(note); reset(); }}><MessageSquare className="h-4 w-4 mr-1.5" /> Send query</Button>}
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" className={rejectBtn} disabled={busy || !itemCount} onClick={() => setMode("reject")}><X className="h-4 w-4 mr-1.5" /> {selectedCount > 0 ? `Reject selected (${selectedCount})` : "Reject all"}</Button>
            <Button size="sm" className="btn-primary-gradient text-white" disabled={busy || !itemCount} onClick={() => onApprove(scope)}><Check className="h-4 w-4 mr-1.5" /> {selectedCount > 0 ? `Approve selected (${selectedCount})` : "Approve all"}</Button>
          </>
        )}
      </div>
    </div>
  );
}
