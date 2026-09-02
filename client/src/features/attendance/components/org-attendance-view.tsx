import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth, isHR } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  format, startOfDay, endOfDay, differenceInCalendarDays,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays,
} from "date-fns";
import { MONTHS, STATES } from "../lib/attendance-states";
import {
  toAttMap, countsFromStatus, buildStatusForDay, workingDaysInMonth, monthlySeries,
} from "../lib/org-attendance-model";
import { downloadEmployeeReport } from "../lib/attendance-export";
import { useAttendanceRange, useAttendanceReport } from "../api/attendance.api";
import { OrgAttendanceHeader, OrgAttendanceStats } from "./org-attendance-sections";
import { WfhApprovalsCard } from "./wfh-approvals-card";
import { ApprovalsFeedCard } from "./approvals-feed-card";
import { HeadcountChartCard, TodayDonutCard } from "./attendance-charts";
import { AttendanceSummaryTable } from "./attendance-summary-table";
import { AttendanceReportDialog } from "./attendance-report-dialog";
import { AdminAttendanceDialog } from "./admin-attendance-dialog";

// Org-wide view (HR / manager / CEO): the full attendance dashboard. Mounted only under its tab.
export function OrgAttendanceView() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const { toast } = useToast();

  const today = new Date();
  const [preset, setPreset] = useState<"today" | "week" | "month" | "custom">("today");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({ from: today, to: today });
  const [showOverride, setShowOverride] = useState(false);
  const [chartView, setChartView] = useState<"monthly" | "weekly">("weekly");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [reportOpen, setReportOpen] = useState(false);

  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: leaveRequests = [] } = useQuery<any[]>({ queryKey: ["/api/leave-requests"] });
  const { data: departments = [] } = useQuery<any[]>({ queryKey: ["/api/departments"] });

  // ---- the window the whole screen reflects ----
  let rangeStart: Date, rangeEnd: Date;
  if (preset === "week") { rangeStart = startOfWeek(today, { weekStartsOn: 1 }); rangeEnd = endOfWeek(today, { weekStartsOn: 1 }); }
  else if (preset === "month") { rangeStart = startOfMonth(today); rangeEnd = endOfMonth(today); }
  else if (preset === "custom") {
    const f = customRange.from ?? today;
    const t = customRange.to ?? f;
    // Always keep From <= To, regardless of selection order
    const lo = f <= t ? f : t;
    const hi = f <= t ? t : f;
    rangeStart = startOfDay(lo); rangeEnd = endOfDay(hi);
  } else { rangeStart = startOfDay(today); rangeEnd = endOfDay(today); }
  const days = differenceInCalendarDays(rangeEnd, rangeStart) + 1;
  const rangeLabel = days === 1 ? format(rangeStart, "MMM d, yyyy") : `${format(rangeStart, "MMM d")} – ${format(rangeEnd, "MMM d, yyyy")}`;
  const chartYear = rangeStart.getFullYear();

  const activeEmployees = employees.filter((e) => e.employmentStatus === "active");
  const hiresIn = (s: Date, e: Date) => employees.filter((emp) => emp.joinDate && new Date(emp.joinDate) >= s && new Date(emp.joinDate) <= e).length;
  const periodWord = preset === "today" ? "today" : preset === "week" ? "this week" : preset === "month" ? "this month" : "this period";

  const { data: holidays = [] } = useQuery<any[]>({ queryKey: [`/api/holidays?year=${chartYear}`] });
  const holidaysThisMonth = holidays.filter((h: any) => h.date && new Date(h.date).getFullYear() === chartYear && new Date(h.date).getMonth() === rangeStart.getMonth()).length;
  const holidaySet = new Set(holidays.map((h: any) => h.date));
  const workingDays = workingDaysInMonth(rangeStart, holidaySet);

  // ---- single source of truth: per-employee status for a given day ----
  const nowM = today.getMonth(), nowY = today.getFullYear();
  const gFrom = chartView === "weekly" ? format(subDays(today, 6), "yyyy-MM-dd") : `${chartYear}-01-01`;
  const gTo = chartView === "weekly" ? format(today, "yyyy-MM-dd") : `${chartYear}-12-31`;
  // viewDay = the day the lists & stat cards reflect (latest day in range, capped at today)
  const viewDay = rangeEnd > today ? today : rangeEnd;
  const viewDayStr = format(viewDay, "yyyy-MM-dd");
  const { data: attRange = [] } = useAttendanceRange(gFrom, gTo);
  const { data: attView = [] } = useAttendanceRange(viewDayStr, viewDayStr);
  const attByEmpDate = useMemo(() => toAttMap(attRange), [attRange]);
  const attViewMap = useMemo(() => toAttMap(attView), [attView]);
  // Only APPROVED leaves affect attendance — a pending leave still means "expected in".
  const approvedLeaves = leaveRequests.filter((lr: any) => lr.status === "approved" && lr.startDate && lr.endDate);

  const statusForDay = buildStatusForDay({ activeEmployees, holidaySet, approvedLeaves });
  const countsForDay = (d: Date) => countsFromStatus(statusForDay(d, attByEmpDate));

  // ---- stat-card counts (as of viewDay) ----
  const viewStatus = statusForDay(viewDay, attViewMap);
  const vc = countsFromStatus(viewStatus);
  const presentCount = activeEmployees.filter((e) => ["present", "wfh", "on_duty"].includes(viewStatus.get(e.id)!)).length;
  const notPresentCount = activeEmployees.filter((e) => ["half_day", "leave", "absent"].includes(viewStatus.get(e.id)!)).length;

  // ---- chart series ----
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(today, 6 - i);
    return { label: format(d, "EEE"), isToday: i === 6, ...countsForDay(d) };
  });
  const monthlyData = monthlySeries({
    months: MONTHS, chartYear, today, holidaySet,
    activeEmployeeCount: activeEmployees.length, countsForDay,
  });
  const graphData = chartView === "weekly" ? weeklyData : monthlyData;
  const seriesStates = stateFilter === "all" ? STATES : STATES.filter((s) => s.key === stateFilter);
  const showPct = chartView === "monthly" && stateFilter === "all";

  const todayCounts = countsForDay(today);
  const pieData = STATES
    .map((s) => ({ key: s.key, name: s.label, value: (todayCounts as any)[s.key] || 0, color: s.color }))
    .filter((d) => d.value > 0);
  const pieTotal = pieData.reduce((a, d) => a + d.value, 0);

  // Highlight today's x-axis label (weekly → today's weekday; monthly → current month)
  const todayLabel = chartView === "weekly" ? format(today, "EEE") : (chartYear === nowY ? MONTHS[nowM] : null);
  const renderXTick = ({ x, y, payload }: any) => {
    const isToday = payload?.value === todayLabel;
    return (
      <text x={x} y={y} dy={12} textAnchor="middle" fontSize={11} fontWeight={isToday ? 700 : 400} fill={isToday ? "#206295" : "hsl(var(--muted-foreground))"}>
        {payload?.value}
      </text>
    );
  };

  // ---- summary table ----
  const tblFrom = format(rangeStart, "yyyy-MM-dd");
  const tblTo = format(rangeEnd, "yyyy-MM-dd");
  const { data: tableReport } = useAttendanceReport(tblFrom, tblTo);
  const exportOneEmployee = (empId: string, name: string, from: string, to: string) =>
    downloadEmployeeReport(empId, name, from, to).catch((e: any) =>
      toast({ title: "Couldn't generate report", description: e.message, variant: "destructive" }));

  return (
    <div className="p-6 space-y-6 max-w-[92rem] mx-auto">
      <OrgAttendanceHeader
        rangeLabel={rangeLabel}
        preset={preset} onPreset={setPreset}
        customRange={customRange} onCustomRange={setCustomRange}
        canOverride={isHR(user!)}
        onReport={() => setReportOpen(true)}
        onOverride={() => setShowOverride(true)}
      />

      <OrgAttendanceStats
        totalNow={activeEmployees.length}
        hiresNow={hiresIn(rangeStart, rangeEnd)}
        periodWord={periodWord}
        presentCount={presentCount} wfhCount={vc.wfh} onDutyCount={vc.on_duty}
        notPresentCount={notPresentCount} halfCount={vc.half_day} leaveCount={vc.leave} absentCount={vc.absent}
        workingDays={workingDays} holidaysThisMonth={holidaysThisMonth}
      />

      <WfhApprovalsCard />

      {/* Main row — a DEFINITE height so each h-full card gets a definite height and its inner
          ScrollArea can cap itself. Without this the tallest card (e.g. a long Approvals feed)
          would drag the chart/donut to a huge height via items-stretch. On mobile it stacks. */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:h-[24rem] lg:auto-rows-fr">
        <div className="lg:col-span-2 min-w-0">
          <HeadcountChartCard
            chartView={chartView} onChartView={setChartView}
            stateFilter={stateFilter} onStateFilter={setStateFilter}
            graphData={graphData} seriesStates={seriesStates} showPct={showPct} renderXTick={renderXTick}
          />
        </div>

        <div className="min-w-0">
          <TodayDonutCard pieData={pieData} pieTotal={pieTotal} todayCounts={todayCounts} />
        </div>

        <div className="min-w-0">
          <ApprovalsFeedCard />
        </div>
      </div>

      <AttendanceSummaryTable
        reportRows={tableReport?.rows || []}
        departments={departments}
        from={tblFrom}
        to={tblTo}
        onExportEmployee={exportOneEmployee}
      />

      <AdminAttendanceDialog open={showOverride} onOpenChange={setShowOverride} employees={employees} />
      <AttendanceReportDialog open={reportOpen} onOpenChange={setReportOpen} anchor={rangeStart} />
    </div>
  );
}
