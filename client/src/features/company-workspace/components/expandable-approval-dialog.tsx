import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Maximize2, Minimize2 } from "lucide-react";

// Expand/restore toggle that sits just left of the dialog's built-in close (the X at right-4).
export function ExpandToggle({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={expanded ? "Restore size" : "Expand to full screen"}
      data-testid="approval-modal-expand"
      className="absolute right-10 top-4 h-6 w-6 inline-flex items-center justify-center rounded-sm text-muted-foreground opacity-70 transition hover:opacity-100 hover:text-[#206295] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
    </button>
  );
}

// Wide, expandable dialog for the CEO Inbox approval surfaces. The default is wide enough to hold the
// full approval card without horizontal scroll; the expand toggle blows it up to near-full-screen.
export function ExpandableApprovalDialog({ open, onClose, title, icon: Icon, children, count, size = "lg" }: {
  open: boolean; onClose: () => void; title: string; icon?: any; children: ReactNode; count?: number; size?: "lg" | "md";
}) {
  const [expanded, setExpanded] = useState(false);
  const collapsed = size === "md"
    ? "max-w-3xl w-[calc(100vw-2rem)] max-h-[92vh] overflow-y-auto content-start"
    : "max-w-7xl w-[calc(100vw-2rem)] max-h-[88vh] overflow-y-auto content-start";
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setExpanded(false); onClose(); } }}>
      <DialogContent
        className={expanded
          ? "max-w-[98vw] w-[98vw] h-[96vh] max-h-[96vh] overflow-y-auto content-start"
          : collapsed}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{Icon && <Icon className="h-5 w-5 text-[#206295]" />} {title}{typeof count === "number" ? ` (${count})` : ""}</DialogTitle>
        </DialogHeader>
        <ExpandToggle expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
        {children}
      </DialogContent>
    </Dialog>
  );
}
