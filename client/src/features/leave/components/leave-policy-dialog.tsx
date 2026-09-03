import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { leaveTypeColor } from "../lib/leave-model";

/** Read-only company leave policy — one card per leave type. Leave types are
 *  managed in Admin Settings › Leave Types; this dialog is the employee view. */
function PolicyCard({ lt }: { lt: any }) {
  return (
    <Card className="border-0"><CardContent className="p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: leaveTypeColor(lt) }} />
          <span className="text-sm font-medium text-foreground truncate">{lt.name}</span>
          <Badge className={`text-[10px] ${lt.isPaid ? "bg-[#206295]/12 text-[#206295]" : "bg-muted text-muted-foreground"}`}>{lt.isPaid ? "Paid" : "Unpaid"}</Badge>
        </div>
        <span className="text-xs text-muted-foreground flex-shrink-0">{lt.code}</span>
      </div>
      {lt.description && <p className="text-xs text-muted-foreground mt-1.5">{lt.description}</p>}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
        <span>Max/year: <span className="text-[#206295] font-medium">{lt.maxDaysPerYear || "—"}</span></span>
        <span>Max/request: <span className="text-[#206295] font-medium">{lt.maxDaysPerRequest || "—"}</span></span>
        <span>Carry forward: <span className="text-foreground/80 font-medium">{lt.isCarryForward ? `${lt.maxCarryForwardDays}d` : "No"}</span></span>
        <span>Encashable: <span className="text-foreground/80 font-medium">{lt.isEncashable ? "Yes" : "No"}</span></span>
      </div>
    </CardContent></Card>
  );
}

export function LeavePolicyDialog({ open, onOpenChange, leaveTypes }: { open: boolean; onOpenChange: (v: boolean) => void; leaveTypes: any[]; }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Leave Policy</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          {leaveTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leave types configured.</p>
          ) : leaveTypes.map((lt) => <PolicyCard key={lt.id} lt={lt} />)}
        </div>
      </DialogContent>
    </Dialog>
  );
}
