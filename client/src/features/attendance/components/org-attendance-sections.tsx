// Chrome for the org-wide (HR / manager) view: the title bar with its date
// preset + actions, and the four headline cards.

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { Users, UserCheck, Plane, Download, CalendarDays } from "lucide-react";
import { StatCard } from "./attendance-ui";

export function OrgAttendanceHeader({
  rangeLabel, preset, onPreset, customRange, onCustomRange, canOverride, onReport, onOverride,
}: {
  rangeLabel: string;
  preset: string;
  onPreset: (v: any) => void;
  customRange: { from?: Date; to?: Date };
  onCustomRange: (v: { from?: Date; to?: Date }) => void;
  canOverride: boolean;
  onReport: () => void;
  onOverride: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
        <p className="text-sm text-muted-foreground">Headcount trends and attendance for {rangeLabel}</p>
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <Select value={preset} onValueChange={onPreset}>
          <SelectTrigger className="w-40" data-testid="select-date-preset"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>
        {preset === "custom" && (
          <DateRangePicker value={customRange} onChange={onCustomRange} align="end" testId="button-custom-range" />
        )}

        {/* Separator between the date filter and the action buttons */}
        <div className="w-px self-stretch bg-border mx-1" />
        <Button variant="secondary" size="sm" onClick={onReport} data-testid="button-report-attendance">
          <Download className="h-4 w-4 mr-1" /> Report
        </Button>
        {canOverride && <Button size="sm" onClick={onOverride} data-testid="button-override">Override Attendance</Button>}
      </div>
    </div>
  );
}

export function OrgAttendanceStats({
  totalNow, hiresNow, periodWord, presentCount, wfhCount, onDutyCount,
  notPresentCount, halfCount, leaveCount, absentCount, workingDays, holidaysThisMonth,
}: Record<string, any>) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total Employees" value={totalNow} icon={Users}
        color="bg-[#206295]/15 text-[#206295]"
        subtitle={<p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{hiresNow}</span> new hire{hiresNow !== 1 ? "s" : ""} {periodWord}</p>}
      />
      <StatCard
        title="Present" value={presentCount} icon={UserCheck}
        color="bg-[#4BDCD9]/25 text-[#206295]"
        subtitle={<p className="text-xs text-muted-foreground">WFH: <span className="font-semibold text-foreground">{wfhCount}</span> | On duty: <span className="font-semibold text-foreground">{onDutyCount}</span></p>}
      />
      <StatCard
        title="Not Present" value={notPresentCount} icon={Plane}
        color="bg-[#FF6F62]/20 text-[#FF6F62]"
        subtitle={<p className="text-xs text-muted-foreground">Half: <span className="font-semibold text-foreground">{halfCount}</span> | Leave: <span className="font-semibold text-foreground">{leaveCount}</span> | Absent: <span className="font-semibold text-foreground">{absentCount}</span></p>}
      />
      <StatCard
        title="Working Days" value={workingDays} icon={CalendarDays}
        color="bg-[#4BDCD9]/25 text-[#206295]"
        subtitle={<p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{holidaysThisMonth}</span> holiday{holidaysThisMonth !== 1 ? "s" : ""} this month</p>}
      />
    </div>
  );
}
