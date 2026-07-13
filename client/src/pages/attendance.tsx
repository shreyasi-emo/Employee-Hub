import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, isHR } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as RangeCalendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { useNavigation } from "react-day-picker";
import { useToast } from "@/hooks/use-toast";
import {
  Users, UserCheck, Plane, Search, Download,
  CalendarDays, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  format, startOfDay, endOfDay, differenceInCalendarDays,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays,
} from "date-fns";
import { exportXlsx } from "@/lib/export-xlsx";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Attendance states — brand color harmony (blues / teals / corals / grey)
const STATES = [
  { key: "present", label: "Present", color: "#206295" },  // main blue
  { key: "wfh", label: "WFH", color: "#4BDCD9" },           // teal
  { key: "on_duty", label: "On Duty", color: "#425B8D" },   // blue
  { key: "half_day", label: "Half Day", color: "#FFA962" }, // warm orange
  { key: "absent", label: "Absent", color: "#FF6F62" },     // coral
  { key: "leave", label: "Leave", color: "#6A7366" },       // grey-green
] as const;
const STATE_KEYS = STATES.map((s) => s.key);
const STATE_COLOR: Record<string, string> = { attendancePct: "#206295" };
STATES.forEach((s) => { STATE_COLOR[s.key] = s.color; });

function initials(first?: string, last?: string) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
}

// Glass tooltip — matches the app's card hover-card style (background, shadow, padding, type)
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p: any) => p.value != null && p.value !== 0);
  if (!rows.length) return null;
  return (
    <div className="card-surface px-3 py-2 text-xs" style={{ borderRadius: 12, minWidth: 140 }}>
      <p className="font-bold text-foreground mb-1">{label}</p>
      <div className="space-y-0.5">
        {rows.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: STATE_COLOR[p.dataKey] || "#9AA6B2" }} />
              {p.name}
            </span>
            <span className="font-semibold text-foreground">{p.dataKey === "attendancePct" ? `${p.value}%` : p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmpAvatar({ emp, className = "h-8 w-8" }: { emp: any; className?: string }) {
  return (
    <Avatar className={`${className} flex-shrink-0`}>
      {emp?.avatarUrl && <AvatarImage src={emp.avatarUrl} />}
      <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials(emp?.firstName, emp?.lastName)}</AvatarFallback>
    </Avatar>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color }: {
  title: string; value: number | string; subtitle?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>; color: string;
}) {
  return (
    <Card className="border-0 card-hover">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-[33px] leading-tight font-bold text-foreground">{value}</p>
            {subtitle}
          </div>
          <div className={`p-2.5 rounded-xl flex-shrink-0 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// "‹ June 2026 ›" caption (same as the dashboard calendar)
function CalCaption({ displayMonth }: { displayMonth: Date }) {
  const { goToMonth, nextMonth, previousMonth } = useNavigation();
  return (
    <div className="flex items-center justify-center gap-3 pt-1 pb-2">
      <button type="button" disabled={!previousMonth} onClick={() => previousMonth && goToMonth(previousMonth)} className="p-1 rounded-md hover-elevate disabled:opacity-30" aria-label="Previous month">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm font-semibold min-w-[8.5rem] text-center">{format(displayMonth, "MMMM yyyy")}</span>
      <button type="button" disabled={!nextMonth} onClick={() => nextMonth && goToMonth(nextMonth)} className="p-1 rounded-md hover-elevate disabled:opacity-30" aria-label="Next month">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// Notion-style date picker: single date by default, with an "End date" toggle for a range
function CustomRangePopover({ value, onChange }: { value: { from?: Date; to?: Date }; onChange: (v: { from?: Date; to?: Date }) => void }) {
  const [endDate, setEndDate] = useState(!!(value.from && value.to && +value.from !== +value.to));
  const hasRange = endDate && value.to && value.from && +value.to !== +value.from;
  const label = value.from
    ? hasRange ? `${format(value.from!, "MMM d")} – ${format(value.to!, "MMM d, yyyy")}` : format(value.from, "MMM d, yyyy")
    : "Pick date";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" data-testid="button-custom-range">
          <CalendarDays className="h-4 w-4 mr-1" /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-3">
        {/* Selected start / end summary */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 text-sm font-medium px-3 py-1.5 rounded-[12px] border border-border text-center">
            {value.from ? format(value.from, "MMM d, yyyy") : "Start date"}
          </div>
          {endDate && (
            <>
              <span className="text-muted-foreground text-xs">→</span>
              <div className="flex-1 text-sm font-medium px-3 py-1.5 rounded-[12px] border border-border text-center">
                {hasRange ? format(value.to!, "MMM d, yyyy") : "End date"}
              </div>
            </>
          )}
        </div>

        {endDate ? (
          <RangeCalendar
            mode="range"
            selected={value as any}
            onSelect={(r: any) => onChange(r ?? {})}
            defaultMonth={value.from}
            components={{ Caption: CalCaption }}
          />
        ) : (
          <RangeCalendar
            mode="single"
            selected={value.from}
            onSelect={(d: any) => d && onChange({ from: d, to: d })}
            defaultMonth={value.from}
            components={{ Caption: CalCaption }}
          />
        )}

        {/* End date toggle */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
          <span className="text-sm font-medium">End date</span>
          <Switch
            checked={endDate}
            onCheckedChange={(c) => {
              setEndDate(c);
              if (!c && value.from) onChange({ from: value.from, to: value.from });
              else if (c && value.from) onChange({ from: value.from, to: undefined });
            }}
            data-testid="switch-end-date"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AdminAttendanceDialog({ open, onOpenChange, employees }: { open: boolean; onOpenChange: (v: boolean) => void; employees: any[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ employeeId: "", date: new Date().toISOString().split("T")[0], status: "present", reason: "" });
  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/attendance", data),
    onSuccess: () => {
      // Refresh every attendance query (range/month) + leave so graph, cards and lists stay in sync
      qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/attendance") });
      qc.invalidateQueries({ queryKey: ["/api/leave-requests"] });
      toast({ title: "Attendance updated" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Override Attendance</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Employee</label>
            <Select value={form.employeeId} onValueChange={(v) => setForm((f) => ({ ...f, employeeId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Date</label>
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["present", "absent", "half_day", "wfh", "on_duty", "leave"].map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Reason *</label>
            <Textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Mandatory reason for override…" rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => mutation.mutate({ employeeId: form.employeeId, date: form.date, status: form.status, source: "admin_override", reason: form.reason })} disabled={mutation.isPending || !form.reason || !form.employeeId}>
              {mutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AttendancePage() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const [, navigate] = useLocation();

  const today = new Date();
  const [preset, setPreset] = useState<"today" | "week" | "month" | "custom">("today");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({ from: today, to: today });
  const [showOverride, setShowOverride] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [deptFilter, setDeptFilter] = useState("all");
  const [empSearch, setEmpSearch] = useState("");
  const [chartView, setChartView] = useState<"monthly" | "weekly">("weekly");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [presentFilter, setPresentFilter] = useState<"all" | "wfo" | "wfh" | "on_duty">("all");
  const [notPresentFilter, setNotPresentFilter] = useState<"all" | "half_day" | "leave" | "absent">("all");

  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: leaveRequests = [] } = useQuery<any[]>({ queryKey: ["/api/leave-requests"] });
  const { data: leaveTypes = [] } = useQuery<any[]>({ queryKey: ["/api/leave-types"] });
  const { data: departments = [] } = useQuery<any[]>({ queryKey: ["/api/departments"] });

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
  const deptName = (id?: string) => departments.find((d: any) => d.id === id)?.name || "—";
  const hiresIn = (s: Date, e: Date) => employees.filter((emp) => emp.joinDate && new Date(emp.joinDate) >= s && new Date(emp.joinDate) <= e).length;

  const totalNow = activeEmployees.length;
  const hiresNow = hiresIn(rangeStart, rangeEnd);
  const periodWord = preset === "today" ? "today" : preset === "week" ? "this week" : preset === "month" ? "this month" : "this period";

  // Holidays for the period's year + working days in the window
  const { data: holidays = [] } = useQuery<any[]>({ queryKey: [`/api/holidays?year=${chartYear}`] });
  const holidaysThisMonth = holidays.filter((h: any) => h.date && new Date(h.date).getFullYear() === chartYear && new Date(h.date).getMonth() === rangeStart.getMonth()).length;
  // Working days = days in the month minus Saturdays, Sundays, and holidays
  const holidaySet = new Set(holidays.map((h: any) => h.date));
  const monthStart = startOfMonth(rangeStart), monthEndDate = endOfMonth(rangeStart);
  let workingDays = 0;
  for (let cur = new Date(monthStart); cur <= monthEndDate; cur.setDate(cur.getDate() + 1)) {
    const dow = cur.getDay();
    if (dow === 0 || dow === 6) continue;
    if (holidaySet.has(format(cur, "yyyy-MM-dd"))) continue;
    workingDays++;
  }

  // ---- single source of truth: per-employee status for a given day ----
  const nowM = today.getMonth(), nowY = today.getFullYear();
  const gFrom = chartView === "weekly" ? format(subDays(today, 6), "yyyy-MM-dd") : `${chartYear}-01-01`;
  const gTo = chartView === "weekly" ? format(today, "yyyy-MM-dd") : `${chartYear}-12-31`;
  // viewDay = the day the lists & stat cards reflect (latest day in range, capped at today)
  const viewDay = rangeEnd > today ? today : rangeEnd;
  const viewDayStr = format(viewDay, "yyyy-MM-dd");
  const { data: attRange = [] } = useQuery<any[]>({ queryKey: [`/api/attendance/range?from=${gFrom}&to=${gTo}`] });
  const { data: attView = [] } = useQuery<any[]>({ queryKey: [`/api/attendance/range?from=${viewDayStr}&to=${viewDayStr}`] });
  const toAttMap = (rows: any[]) => { const m = new Map<string, string>(); for (const r of rows) m.set(`${r.employeeId}|${r.date}`, r.status); return m; };
  const attByEmpDate = useMemo(() => toAttMap(attRange), [attRange]);
  const attViewMap = useMemo(() => toAttMap(attView), [attView]);
  const approvedLeaves = leaveRequests.filter((lr: any) => ["approved", "pending"].includes(lr.status) && lr.startDate && lr.endDate);

  // Status priority: on leave → holiday → recorded status → default Present
  const statusForDay = (d: Date, attMap: Map<string, string>) => {
    const ds = format(d, "yyyy-MM-dd");
    const sod = startOfDay(d);
    const isHol = holidaySet.has(ds);
    const onLeave = new Set(approvedLeaves.filter((lr: any) => new Date(lr.startDate) <= sod && new Date(lr.endDate) >= sod).map((lr: any) => lr.employeeId));
    const m = new Map<string, string>();
    for (const e of activeEmployees) {
      let st: string;
      if (onLeave.has(e.id)) st = "leave";
      else if (isHol) st = "holiday";
      else { const rec = attMap.get(`${e.id}|${ds}`); st = rec && (STATE_KEYS as readonly string[]).includes(rec) ? rec : "present"; }
      m.set(e.id, st);
    }
    return m;
  };
  const countsFromStatus = (m: Map<string, string>) => {
    const c: Record<string, number> = { present: 0, wfh: 0, on_duty: 0, half_day: 0, absent: 0, leave: 0, holiday: 0 };
    m.forEach((st) => { c[st]++; });
    return c;
  };
  const countsForDay = (d: Date) => countsFromStatus(statusForDay(d, attByEmpDate));

  // ---- lists & stat-card counts (as of viewDay) ----
  const viewStatus = statusForDay(viewDay, attViewMap);
  const vc = countsFromStatus(viewStatus);
  const presentList = activeEmployees.filter((e) => ["present", "wfh", "on_duty"].includes(viewStatus.get(e.id)!));
  const notPresentList = activeEmployees.filter((e) => ["half_day", "leave", "absent"].includes(viewStatus.get(e.id)!));
  const presentCount = presentList.length;
  const notPresentCount = notPresentList.length;
  const wfhCount = vc.wfh, onDutyCount = vc.on_duty, halfCount = vc.half_day, leaveCount = vc.leave, absentCount = vc.absent;

  // Weekly: last 7 days, stacked state breakdown (today flagged for emphasis)
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(today, 6 - i);
    return { label: format(d, "EEE"), isToday: i === 6, ...countsForDay(d) };
  });
  // Monthly: all 12 months; future left empty. State totals + average attendance %.
  const monthlyData = MONTHS.map((label, m) => {
    const isFuture = chartYear > nowY || (chartYear === nowY && m > nowM);
    if (isFuture) return { label, attendancePct: null, ...Object.fromEntries(STATE_KEYS.map((k) => [k, null])) };
    const totals: Record<string, number> = { present: 0, wfh: 0, on_duty: 0, half_day: 0, absent: 0, leave: 0, holiday: 0 };
    let pctSum = 0, wd = 0;
    const dim = new Date(chartYear, m + 1, 0).getDate();
    for (let day = 1; day <= dim; day++) {
      const dDate = new Date(chartYear, m, day);
      const c = countsForDay(dDate);
      for (const k of STATE_KEYS) totals[k] += c[k];
      const dow = dDate.getDay();
      if (dow !== 0 && dow !== 6 && !holidaySet.has(format(dDate, "yyyy-MM-dd"))) {
        const denom = activeEmployees.length || 1;
        pctSum += ((c.present + c.wfh + c.on_duty + 0.5 * c.half_day) / denom) * 100;
        wd++;
      }
    }
    return { label, ...totals, attendancePct: wd > 0 ? Math.round(pctSum / wd) : 0 };
  });
  const graphData = chartView === "weekly" ? weeklyData : monthlyData;
  const seriesStates = stateFilter === "all" ? STATES : STATES.filter((s) => s.key === stateFilter);
  const showPct = chartView === "monthly" && stateFilter === "all";

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

  // ---- per-employee monthly attendance for the side panel ----
  const { data: monthAttendance = [] } = useQuery<any[]>({
    queryKey: [`/api/attendance/month?month=${rangeStart.getMonth() + 1}&year=${chartYear}`],
  });
  const attStats = useMemo(() => {
    const map: Record<string, { present: number; half: number; absent: number; leave: number }> = {};
    for (const r of monthAttendance) {
      const s = (map[r.employeeId] ||= { present: 0, half: 0, absent: 0, leave: 0 });
      if (["present", "wfh", "on_duty"].includes(r.status)) s.present++;
      else if (r.status === "half_day") s.half++;
      else if (r.status === "absent") s.absent++;
      else if (r.status === "leave") s.leave++;
    }
    return map;
  }, [monthAttendance]);

  // Labels for the list status badges
  const PRESENT_LABEL: Record<string, string> = { present: "WFO", wfh: "WFH", on_duty: "On Duty" };
  const NOTPRESENT_LABEL: Record<string, string> = { half_day: "Half Day", leave: "On Leave", absent: "Absent" };
  const presentFiltered = presentList.filter((e) => {
    if (presentFilter === "all") return true;
    const st = viewStatus.get(e.id);
    return presentFilter === "wfo" ? st === "present" : st === presentFilter;
  });
  const notPresentFiltered = notPresentList.filter((e) => notPresentFilter === "all" || viewStatus.get(e.id) === notPresentFilter);

  const panelEmployees = employees.filter((e) => {
    if (deptFilter !== "all" && e.departmentId !== deptFilter) return false;
    const q = empSearch.trim().toLowerCase();
    return !q || `${e.firstName} ${e.lastName} ${e.employeeCode}`.toLowerCase().includes(q);
  });

  // Export the current attendance snapshot (as of the selected date/filter) to Excel
  const STATUS_DISPLAY: Record<string, string> = {
    present: "Present (WFO)", wfh: "WFH", on_duty: "On Duty",
    half_day: "Half Day", absent: "Absent", leave: "On Leave", holiday: "Holiday",
  };
  const exportAttendance = () => {
    const headers = ["Employee Code", "Name", "Department", "Status", "Date"];
    const rows = [...activeEmployees]
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
      .map((e) => [
        e.employeeCode || "—",
        `${e.firstName} ${e.lastName}`,
        deptName(e.departmentId),
        STATUS_DISPLAY[viewStatus.get(e.id)!] || "Present (WFO)",
        format(viewDay, "dd MMM yyyy"),
      ]);
    exportXlsx({ filename: `attendance-${viewDayStr}.xlsx`, sheet: "Attendance", title: `Attendance Report — ${rangeLabel}`, headers, rows });
  };

  return (
    <div className="p-6 space-y-6 max-w-[92rem] mx-auto">
      {/* Header + actions (date selector lives here, top-right) */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
          <p className="text-sm text-muted-foreground">Headcount trends and attendance for {rangeLabel}</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={preset} onValueChange={(v) => setPreset(v as any)}>
            <SelectTrigger className="w-40" data-testid="select-date-preset"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          {preset === "custom" && (
            <CustomRangePopover value={customRange} onChange={setCustomRange} />
          )}

          {/* Separator between the date filter and the action buttons */}
          <div className="h-10 w-px bg-border mx-1" />
          <Button variant="secondary" size="sm" onClick={exportAttendance} data-testid="button-export-attendance">
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
            <SheetTrigger asChild>
              <Button variant="secondary" size="sm" data-testid="button-browse-employees">
                <Users className="h-4 w-4 mr-1" /> Browse Employees
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md flex flex-col">
              <SheetHeader><SheetTitle>Employees · {format(rangeStart, "MMM yyyy")}</SheetTitle></SheetHeader>
              <div className="flex items-center gap-2 mt-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={empSearch} onChange={(e) => setEmpSearch(e.target.value)} placeholder="Search…" className="pl-9" data-testid="input-panel-search" />
                </div>
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Dept" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Depts</SelectItem>
                    {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <ScrollArea className="flex-1 mt-3 -mx-2 px-2">
                <div className="list-divider">
                  {panelEmployees.map((e: any) => {
                    const st = attStats[e.id] || { present: 0, half: 0, absent: 0, leave: 0 };
                    return (
                      <button
                        key={e.id}
                        onClick={() => { setPanelOpen(false); navigate(`/employees/${e.id}`); }}
                        className="w-full flex items-center gap-3 py-3 px-1 text-left hover-elevate"
                        data-testid={`panel-emp-${e.id}`}
                      >
                        <EmpAvatar emp={e} className="h-9 w-9" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{e.firstName} {e.lastName}</p>
                          <p className="text-xs text-muted-foreground truncate">{e.employeeCode} · {deptName(e.departmentId)}</p>
                          <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap mt-1.5 text-[11px] text-muted-foreground">
                            <span className="whitespace-nowrap">Present: <span className="font-semibold" style={{ color: "#206295" }}>{st.present}</span></span>
                            <span className="whitespace-nowrap">Half Days: <span className="font-semibold" style={{ color: "#566069" }}>{st.half}</span></span>
                            <span className="whitespace-nowrap">Absent: <span className="font-semibold" style={{ color: "#C24A3E" }}>{st.absent}</span></span>
                            <span className="whitespace-nowrap">On Leave: <span className="font-semibold" style={{ color: "#1F8F8C" }}>{st.leave}</span></span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {panelEmployees.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No employees</p>}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
          {isHR(user!) && <Button size="sm" onClick={() => setShowOverride(true)} data-testid="button-override">Override Attendance</Button>}
        </div>
      </div>

      {/* Stat cards with trend subtitles */}
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

      {/* Main row: graph (left 2/4) + Present + On Leave (under last two cards), uniform height */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Headcount trend */}
        <Card className="border-0 lg:col-span-2 lg:h-[26rem] flex flex-col">
          <CardHeader className="pb-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base font-semibold whitespace-nowrap shrink-0">Employee Headcount</CardTitle>
              <div className="flex items-center gap-2 shrink-0">
                <Select value={chartView} onValueChange={(v) => setChartView(v as any)}>
                  <SelectTrigger className="h-7 w-[92px] text-[11px] rounded-[10px] opacity-100 border no-default-hover-elevate" style={{ background: "transparent", borderColor: "rgba(29, 31, 32, 0.75)", boxShadow: "none" }} data-testid="select-chart-view">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly" className="text-xs">Weekly</SelectItem>
                    <SelectItem value="monthly" className="text-xs">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={stateFilter} onValueChange={setStateFilter}>
                  <SelectTrigger className="h-7 w-[108px] text-[11px] rounded-[10px] opacity-100 border no-default-hover-elevate" style={{ background: "transparent", borderColor: "rgba(29, 31, 32, 0.75)", boxShadow: "none" }} data-testid="select-state-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All</SelectItem>
                    {STATES.map((s) => <SelectItem key={s.key} value={s.key} className="text-xs">{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Legend — all attendance states */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
              {STATES.map((s) => (
                <span key={s.key} className="flex items-center gap-1 whitespace-nowrap text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} /> {s.label}
                </span>
              ))}
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={graphData} barCategoryGap="14%">
                <defs>
                  {STATES.map((s) => (
                    <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={s.color} stopOpacity={0.55} />
                    </linearGradient>
                  ))}
                  <linearGradient id="grad-pct" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={STATE_COLOR.attendancePct} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={STATE_COLOR.attendancePct} stopOpacity={0.55} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={renderXTick} />
                <YAxis
                  tickLine={false} axisLine={false} allowDecimals={false}
                  width={showPct ? 36 : 26}
                  domain={showPct ? [0, 100] : undefined}
                  tickFormatter={showPct ? (v: number) => `${v}%` : undefined}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.4)" }} content={<ChartTooltip />} />
                {showPct ? (
                  <Bar dataKey="attendancePct" name="Avg Attendance %" fill="url(#grad-pct)" stroke="rgba(255,255,255,0.5)" strokeWidth={1} radius={[12, 12, 12, 12]} maxBarSize={48} />
                ) : (
                  seriesStates.map((s) => (
                    <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={`url(#grad-${s.key})`} stroke="rgba(255,255,255,0.5)" strokeWidth={1} radius={[12, 12, 12, 12]} maxBarSize={48} />
                  ))
                )}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Present */}
        <Card className="border-0 lg:h-[26rem] flex flex-col">
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2"><UserCheck className="h-4 w-4 text-muted-foreground" /> Present</CardTitle>
            <Select value={presentFilter} onValueChange={(v) => setPresentFilter(v as any)}>
              <SelectTrigger className="h-7 w-[96px] text-[11px] rounded-[10px] opacity-100 border no-default-hover-elevate" style={{ background: "transparent", borderColor: "rgba(29, 31, 32, 0.75)", boxShadow: "none" }} data-testid="select-present-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All</SelectItem>
                <SelectItem value="wfo" className="text-xs">WFO</SelectItem>
                <SelectItem value="wfh" className="text-xs">WFH</SelectItem>
                <SelectItem value="on_duty" className="text-xs">On duty</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="px-3 pb-3 flex-1 min-h-0">
            {presentFiltered.length === 0 ? (
              <div className="h-full flex items-center justify-center"><p className="text-sm text-muted-foreground">No one present</p></div>
            ) : (
              <ScrollArea className="h-full">
                <div className="list-divider pr-2">
                  {presentFiltered.map((e: any) => {
                    const status = viewStatus.get(e.id)!;
                    const badgeStyle = {
                      present: { backgroundColor: "rgba(32,98,149,0.12)", color: "#206295" },
                      wfh: { backgroundColor: "rgba(75,220,217,0.18)", color: "#1F8F8C" },
                      on_duty: { backgroundColor: "rgba(66,91,141,0.15)", color: "#425B8D" },
                    }[status] || { backgroundColor: "rgba(32,98,149,0.12)", color: "#206295" };
                    return (
                      <div key={e.id} className="flex items-center gap-3 py-3" data-testid={`present-${e.id}`}>
                        <EmpAvatar emp={e} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{e.firstName} {e.lastName}</p>
                          <p className="text-xs text-muted-foreground truncate">{deptName(e.departmentId)}</p>
                        </div>
                        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={badgeStyle} data-testid={`status-${e.id}`}>
                          {PRESENT_LABEL[status]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Not Present */}
        <Card className="border-0 lg:h-[26rem] flex flex-col">
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2"><Plane className="h-4 w-4 text-muted-foreground" /> Not Present</CardTitle>
            <Select value={notPresentFilter} onValueChange={(v) => setNotPresentFilter(v as any)}>
              <SelectTrigger className="h-7 w-[104px] text-[11px] rounded-[10px] opacity-100 border no-default-hover-elevate" style={{ background: "transparent", borderColor: "rgba(29, 31, 32, 0.75)", boxShadow: "none" }} data-testid="select-notpresent-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All</SelectItem>
                <SelectItem value="half_day" className="text-xs">Half Day</SelectItem>
                <SelectItem value="leave" className="text-xs">On Leave</SelectItem>
                <SelectItem value="absent" className="text-xs">Absent</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="px-3 pb-3 flex-1 min-h-0">
            {notPresentFiltered.length === 0 ? (
              <div className="h-full flex items-center justify-center"><p className="text-sm text-muted-foreground">Everyone is present</p></div>
            ) : (
              <ScrollArea className="h-full">
                <div className="list-divider pr-2">
                  {notPresentFiltered.map((e: any) => {
                    const status = viewStatus.get(e.id)!;
                    const badgeStyle = {
                      half_day: { backgroundColor: "rgba(255,169,98,0.18)", color: "#B5611A" },
                      leave: { backgroundColor: "rgba(106,115,102,0.18)", color: "#4F5A4B" },
                      absent: { backgroundColor: "rgba(255,111,98,0.15)", color: "#C24A3E" },
                    }[status] || { backgroundColor: "rgba(148,163,184,0.18)", color: "#64748B" };
                    return (
                      <div key={e.id} className="flex items-center gap-3 py-3" data-testid={`notpresent-${e.id}`}>
                        <EmpAvatar emp={e} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{e.firstName} {e.lastName}</p>
                          <p className="text-xs text-muted-foreground truncate">{deptName(e.departmentId)}</p>
                        </div>
                        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={badgeStyle}>
                          {NOTPRESENT_LABEL[status]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <AdminAttendanceDialog open={showOverride} onOpenChange={setShowOverride} employees={employees} />
    </div>
  );
}
