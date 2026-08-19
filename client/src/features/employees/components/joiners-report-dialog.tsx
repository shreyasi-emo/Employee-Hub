import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateRangePicker, type DateRange } from "@/components/shared/date-range-picker";
import { Download } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { exportJoiners } from "../lib/employee-export";

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

/** Everyone whose join date falls in the chosen range, exported with every field.
 *  Owns its own range state. */
export function JoinersReportDialog({ open, onOpenChange, allEmployees, departments, designations }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  allEmployees: any[]; departments: any[]; designations: any[];
}) {
  const now = new Date();
  const [range, setRange] = useState<DateRange>(() => ({ from: startOfMonth(now), to: endOfMonth(now) }));

  const joiners = useMemo(() => {
    if (!range.from) return [] as any[];
    const f = ymd(range.from), t = ymd(range.to ?? range.from);
    return allEmployees.filter((e) => e.joinDate && e.joinDate.slice(0, 10) >= f && e.joinDate.slice(0, 10) <= t)
      .sort((a, b) => a.joinDate.localeCompare(b.joinDate));
  }, [allEmployees, range]);

  const presets = [
    { label: "This week", from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) },
    { label: "This month", from: startOfMonth(now), to: endOfMonth(now) },
    { label: "Last month", from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) },
  ];
  const rangeActive = (p: { from: Date; to: Date }) => !!range.from && ymd(range.from) === ymd(p.from) && ymd(range.to ?? range.from) === ymd(p.to);
  const spanLabel = range.from
    ? (ymd(range.from) === ymd(range.to ?? range.from) ? format(range.from, "dd MMM yyyy") : `${format(range.from, "dd MMM yyyy")} – ${format(range.to!, "dd MMM yyyy")}`)
    : "Pick a date or range";

  const download = () => {
    exportJoiners(joiners, { from: range.from!, to: range.to }, { departments, designations }, allEmployees);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Joiners Report</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Button key={p.label} size="sm" variant={rangeActive(p) ? "default" : "secondary"} onClick={() => setRange({ from: p.from, to: p.to })} data-testid={`export-preset-${p.label.replace(/\s+/g, "-").toLowerCase()}`}>{p.label}</Button>
            ))}
            <DateRangePicker value={range} onChange={setRange} align="end" testId="export-range" />
          </div>
          <div className="rounded-xl bg-muted/40 px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{spanLabel}</p>
              <p className="text-xs text-muted-foreground">employees joined</p>
            </div>
            <span className="text-2xl font-bold text-[#206295] tabular-nums flex-shrink-0">{joiners.length}</span>
          </div>
          <Button className="w-full" disabled={!range.from || joiners.length === 0} onClick={download} data-testid="button-download-joiners">
            <Download className="h-4 w-4 mr-1.5" /> Download Excel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
