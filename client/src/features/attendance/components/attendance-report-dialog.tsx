import { useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { useToast } from "@/hooks/use-toast";
import { downloadAllEmployeesReport } from "../lib/attendance-export";

/** Downloadable attendance report — monthly or custom range, all employees.
 *  Owns its own mode/range/busy state; `anchor` supplies the default month. */
export function AttendanceReportDialog({ open, onOpenChange, anchor }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  anchor: Date;
}) {
  const { toast } = useToast();
  const [reportMode, setReportMode] = useState<"month" | "custom">("month");
  const [reportRange, setReportRange] = useState<{ from?: Date; to?: Date }>({});
  const [reportBusy, setReportBusy] = useState(false);

  const reportBounds = () => {
    if (reportMode === "custom" && reportRange.from && reportRange.to) {
      return { from: format(reportRange.from, "yyyy-MM-dd"), to: format(reportRange.to, "yyyy-MM-dd") };
    }
    return { from: format(startOfMonth(anchor), "yyyy-MM-dd"), to: format(endOfMonth(anchor), "yyyy-MM-dd") };
  };

  const download = async () => {
    if (reportMode === "custom" && (!reportRange.from || !reportRange.to)) {
      toast({ title: "Pick a date range first", variant: "destructive" }); return;
    }
    setReportBusy(true);
    try {
      const { from, to } = reportBounds();
      await downloadAllEmployeesReport(from, to);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Couldn't generate report", description: e.message, variant: "destructive" });
    } finally { setReportBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Download Attendance Report</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          <div className="segmented-toggle inline-flex p-0.5 h-9 w-full">
            <button type="button" onClick={() => setReportMode("month")} className={`flex-1 h-full rounded-[10px] text-xs font-medium ${reportMode === "month" ? "btn-primary-gradient text-white" : "text-foreground/70"}`} data-testid="report-mode-month">This Month</button>
            <button type="button" onClick={() => setReportMode("custom")} className={`flex-1 h-full rounded-[10px] text-xs font-medium ${reportMode === "custom" ? "btn-primary-gradient text-white" : "text-foreground/70"}`} data-testid="report-mode-custom">Custom Range</button>
          </div>
          {reportMode === "month" ? (
            <p className="text-sm text-muted-foreground">Report for <span className="font-medium text-foreground">{format(anchor, "MMMM yyyy")}</span>.</p>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground shrink-0">Range:</span>
              <DateRangePicker value={reportRange} onChange={setReportRange} align="start" testId="report-range" />
            </div>
          )}
          <p className="text-xs text-muted-foreground">A per-employee summary — present, WFH, on duty, half days, absences, leave, working days and attendance %. Weekends, holidays and future days are excluded.</p>
          <Button className="w-full" onClick={download} disabled={reportBusy} data-testid="button-download-report">
            <Download className="h-4 w-4 mr-1" /> {reportBusy ? "Preparing…" : "Download .xlsx"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
