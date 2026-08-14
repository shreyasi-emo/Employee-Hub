import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, isHR, isManager, hasRole } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DateRangePicker } from "@/components/date-range-picker";
import { DateField, TimeField, DateInput } from "@/components/datetime-field";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Users, UserCheck, Plane, Search, Download,
  CalendarDays, MapPin, Clock, Plus, CircleCheck, ChevronLeft, ChevronRight, Route, Briefcase, CalendarRange, Home, TriangleAlert,
  ClipboardCheck, ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import {
  format, startOfDay, endOfDay, differenceInCalendarDays,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays,
  isSameDay, isSameMonth, eachDayOfInterval, addMonths, subMonths,
} from "date-fns";
import { exportXlsx } from "@/lib/export-xlsx";
import { DataTable, type DataTableColumn } from "@/components/data-table";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Attendance states — brand color harmony (blues / teals / corals / grey)
const STATES = [
  { key: "present", label: "Present", color: "#206295" },  // brand blue
  { key: "wfh", label: "WFH", color: "#0E7C7B" },           // dark teal
  { key: "on_duty", label: "On Duty", color: "#4A90C2" },   // lighter brand blue (distinct from Present)
  { key: "half_day", label: "Half Day", color: "#6A7366" }, // grey-green (swapped with leave)
  { key: "absent", label: "Absent", color: "#FF6F62" },     // coral
  { key: "leave", label: "Leave", color: "#953229" },       // brick red
] as const;
const STATE_KEYS = STATES.map((s) => s.key);
const STATE_COLOR: Record<string, string> = { attendancePct: "#206295" };
STATES.forEach((s) => { STATE_COLOR[s.key] = s.color; });
// Readable label text colors — darker variants for the statuses whose brand color is too light
// to read on a white/tinted cell; the rest keep their own (dark-enough) brand color.
const LABEL_COLOR: Record<string, string> = { wfh: "#0E7C7B", half_day: "#4F5A4B", leave: "#953229", absent: "#C43D30", holiday: "#5B6B7A" };
// Contrasting text color for a solid fill: white on dark colors, dark grey on light ones.
const textOn = (hex: string) => { const h = hex.replace("#", ""); const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.65 ? "#FFFFFF" : "#374151"; };
// Blend a hex color toward white by (1 - alpha) — the visual result of an alpha fill over a light card.
const blendWhite = (hex: string, alpha: number) => { const h = hex.replace("#", ""); const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16); const mix = (c: number) => Math.round(c * alpha + 255 * (1 - alpha)); const to = (c: number) => mix(c).toString(16).padStart(2, "0"); return `#${to((n >> 16) & 255)}${to((n >> 8) & 255)}${to(n & 255)}`; };
const TODAY_FILL_ALPHA = 0.5;

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

// Date-range picker (single date + "End date" toggle) now lives in a shared component:
//   @/components/date-range-picker → <DateRangePicker /> + CalCaption

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
              <DateInput value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} />
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

// Pending WFH requests a manager/HR can approve or reject. Hidden when there are none.
function WfhApprovalsCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: pending = [] } = useQuery<any[]>({ queryKey: ["/api/attendance/wfh-pending"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const empName = (id: string) => { const e = (employees as any[]).find((x) => x.id === id); return e ? `${e.firstName || ""} ${e.lastName || ""}`.trim() : "Employee"; };
  const decide = useMutation({
    mutationFn: (p: any) => apiRequest("PATCH", "/api/attendance/wfh", p),
    onSuccess: () => {
      qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/attendance") });
      toast({ title: "WFH request updated" });
    },
    onError: (e: any) => toast({ title: "Couldn't update request", description: e.message, variant: "destructive" }),
  });
  if (!(pending as any[]).length) return null;
  return (
    <div className="card-surface rounded-2xl p-4">
      <p className="text-base font-semibold text-foreground mb-3 inline-flex items-center gap-2"><Home className="h-4 w-4 text-[#0E7C7B]" /> Pending WFH Requests <span className="text-xs font-normal text-muted-foreground">({(pending as any[]).length})</span></p>
      <div className="space-y-2">
        {(pending as any[]).map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">{empName(r.employeeId)}</p>
              <p className="text-[11px] text-muted-foreground truncate">{format(new Date(r.date), "EEE, d MMM yyyy")}{r.meta?.reason ? ` · ${r.meta.reason}` : ""}</p>
            </div>
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={decide.isPending} onClick={() => decide.mutate({ employeeId: r.employeeId, date: r.date, decision: "rejected" })} data-testid={`wfh-reject-${r.employeeId}-${r.date}`}>Reject</Button>
            <Button size="sm" className="btn-primary-gradient h-8 text-xs" disabled={decide.isPending} onClick={() => decide.mutate({ employeeId: r.employeeId, date: r.date, decision: "approved" })} data-testid={`wfh-approve-${r.employeeId}-${r.date}`}>Approve</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Approvals feed for the Employee-Attendance screen: Leave + WFH requests as one list per request
// (pending on top, then decisions), manager-scoped server-side. Filter Pending/All; expand -> /leave.
function ApprovalsFeedCard() {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<"all" | "pending">("all");
  const { data: feed = [] } = useQuery<any[]>({ queryKey: ["/api/approvals/feed"] });

  const parseYmd = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const periodLabel = (it: any) => {
    const s = parseYmd(it.startDate), e = parseYmd(it.endDate);
    const base = it.startDate === it.endDate ? format(s, "EEE, d MMM") : `${format(s, "d MMM")} – ${format(e, "d MMM")}`;
    return it.isHalfDay ? `${base} · Half day` : base;
  };
  const stamp = (iso: string | null) => iso ? format(new Date(iso), "d MMM, h:mm a") : "";

  const pending = (feed as any[]).filter((f) => f.status === "pending").sort((a, b) => (a.requestedAt || "") < (b.requestedAt || "") ? -1 : 1);
  const decided = (feed as any[]).filter((f) => f.status !== "pending").sort((a, b) => (a.decidedAt || "") < (b.decidedAt || "") ? 1 : -1);
  const rows = filter === "pending" ? pending : [...pending, ...decided];

  const STATUS: Record<string, { label: string; bg: string; color: string }> = {
    pending: { label: "Pending", bg: "rgba(245,158,11,0.15)", color: "#B5611A" },
    approved: { label: "Approved", bg: "rgba(14,124,123,0.15)", color: "#0E7C7B" },
    rejected: { label: "Rejected", bg: "rgba(255,111,98,0.15)", color: "#C24A3E" },
  };

  return (
    <Card className="border-0 h-full min-h-[20rem] flex flex-col">
      <CardHeader className="pt-4 pb-2 px-4">
        <div className="flex flex-row items-center justify-between gap-2 h-9">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" /> Approvals
            {pending.length > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(245,158,11,0.15)", color: "#B5611A" }}>{pending.length} pending</span>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="h-8 w-[88px] text-[11px] rounded-[10px] opacity-100 border no-default-hover-elevate" style={{ background: "transparent", borderColor: "rgba(29, 31, 32, 0.75)", boxShadow: "none" }} data-testid="select-approvals-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All</SelectItem>
                <SelectItem value="pending" className="text-xs">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="secondary" size="icon" className="h-8 w-8 rounded-[10px] flex-shrink-0" title="Open leave approvals" onClick={() => navigate("/leave")} data-testid="approvals-expand"><ArrowUpRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 flex-1 min-h-0">
        {rows.length === 0 ? (
          <div className="h-full flex items-center justify-center"><p className="text-sm text-muted-foreground">{filter === "pending" ? "No pending requests" : "No requests yet"}</p></div>
        ) : (
          <ScrollArea className="h-full">
            <div className="list-divider pr-2">
              {rows.map((it) => {
                const st = STATUS[it.status] || STATUS.pending;
                return (
                  <div key={it.id} className="py-2.5" data-testid={`approval-${it.id}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate flex-1">{it.employeeName}</span>
                      <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0">{it.kind === "wfh" ? "WFH" : "Leave"}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{periodLabel(it)}{it.reason ? ` · ${it.reason}` : ""}</p>
                    <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                      {it.status === "pending"
                        ? `Requested ${stamp(it.requestedAt)}`
                        : `${st.label}${it.decidedByName ? ` by ${it.decidedByName}` : ""}${it.decidedAt ? ` · ${stamp(it.decidedAt)}` : ""}`}
                    </p>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// Org-wide view (HR / manager / CEO): the full attendance dashboard. Mounted only under its tab.
function EmployeeAttendanceView() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const today = new Date();
  const [preset, setPreset] = useState<"today" | "week" | "month" | "custom">("today");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({ from: today, to: today });
  const [showOverride, setShowOverride] = useState(false);
  const [chartView, setChartView] = useState<"monthly" | "weekly">("weekly");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [presentFilter, setPresentFilter] = useState<"all" | "wfo" | "wfh" | "on_duty">("all");
  const [notPresentFilter, setNotPresentFilter] = useState<"all" | "half_day" | "leave" | "absent">("all");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMode, setReportMode] = useState<"month" | "custom">("month");
  const [reportRange, setReportRange] = useState<{ from?: Date; to?: Date }>({});
  const [reportBusy, setReportBusy] = useState(false);
  const [tblSearch, setTblSearch] = useState("");
  const [tblDept, setTblDept] = useState("all");
  const [tblLoc, setTblLoc] = useState("all");
  const [tblSort, setTblSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });

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
  // Only APPROVED leaves affect attendance — a pending leave still means "expected in".
  const approvedLeaves = leaveRequests.filter((lr: any) => lr.status === "approved" && lr.startDate && lr.endDate);
  // An employee only counts on days inside their employment window (no Present before joining / after exit).
  const inEmployment = (e: any, ds: string) => {
    const j = e.joinDate ? String(e.joinDate).slice(0, 10) : null;
    const x = e.lastWorkingDate ? String(e.lastWorkingDate).slice(0, 10) : null;
    return !((j && ds < j) || (x && ds > x));
  };

  // Status priority: on leave → holiday → recorded status → default Present. Mirrors My-Attendance's
  // effectiveStatus so the two views agree. Callers must not pass a future day.
  const statusForDay = (d: Date, attMap: Map<string, string>) => {
    const ds = format(d, "yyyy-MM-dd");
    const sod = startOfDay(d);
    const isHol = holidaySet.has(ds);
    const onLeave = new Set(approvedLeaves.filter((lr: any) => new Date(lr.startDate) <= sod && new Date(lr.endDate) >= sod).map((lr: any) => lr.employeeId));
    const m = new Map<string, string>();
    for (const e of activeEmployees) {
      if (!inEmployment(e, ds)) continue;
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
      if (dDate > today) break; // don't count future days of the current month as Present
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

  // Today: pie breakdown of the whole active workforce by current status.
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

  // ---- per-employee monthly attendance for the side panel ----
  const { data: monthAttendance = [] } = useQuery<any[]>({
    queryKey: [`/api/attendance/month?month=${rangeStart.getMonth() + 1}&year=${chartYear}`],
  });
  // Present-by-default per employee over the month's elapsed working days — same model as the
  // stat cards, chart, and My-Attendance (not a raw record tally).
  const attStats = useMemo(() => {
    const map: Record<string, { present: number; half: number; absent: number; leave: number }> = {};
    const monthMap = new Map<string, string>();
    for (const r of monthAttendance) monthMap.set(`${r.employeeId}|${r.date}`, r.status);
    const mStart = startOfMonth(rangeStart), mEnd = endOfMonth(rangeStart);
    for (let cur = new Date(mStart); cur <= mEnd; cur.setDate(cur.getDate() + 1)) {
      if (cur > today) break;
      const dow = cur.getDay(); if (dow === 0 || dow === 6) continue;
      if (holidaySet.has(format(cur, "yyyy-MM-dd"))) continue;
      statusForDay(cur, monthMap).forEach((st, empId) => {
        const s = (map[empId] ||= { present: 0, half: 0, absent: 0, leave: 0 });
        if (["present", "wfh", "on_duty"].includes(st)) s.present++;
        else if (st === "half_day") s.half++;
        else if (st === "absent") s.absent++;
        else if (st === "leave") s.leave++;
      });
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthAttendance, activeEmployees, holidays, approvedLeaves, rangeStart]);

  // ---- Employee attendance summary table (3rd row) — same present-by-default model as the report ----
  const tblFrom = format(rangeStart, "yyyy-MM-dd");
  const tblTo = format(rangeEnd, "yyyy-MM-dd");
  const { data: tableReport } = useQuery<any>({ queryKey: [`/api/attendance/report?from=${tblFrom}&to=${tblTo}`] });
  const toggleSort = (key: string) => setTblSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" || key === "department" ? "asc" : "desc" });
  const tblLocations = useMemo(() => Array.from(new Set(((tableReport?.rows || []) as any[]).map((r) => r.location).filter(Boolean))).sort(), [tableReport]);
  const tableRows = useMemo(() => {
    let rows = ((tableReport?.rows || []) as any[]).slice();
    const q = tblSearch.trim().toLowerCase();
    if (q) rows = rows.filter((r) => `${r.name} ${r.code}`.toLowerCase().includes(q));
    if (tblDept !== "all") rows = rows.filter((r) => r.departmentId === tblDept);
    if (tblLoc !== "all") rows = rows.filter((r) => r.location === tblLoc);
    const { key, dir } = tblSort;
    rows.sort((a, b) => { const av = a[key], bv = b[key]; const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv)); return dir === "asc" ? cmp : -cmp; });
    return rows;
  }, [tableReport, tblSearch, tblDept, tblLoc, tblSort]);
  const pctColor = (p: number) => p >= 90 ? "#0E7C7B" : p >= 75 ? "#B5611A" : "#C24A3E";
  const tableColumns: DataTableColumn<any>[] = [
    { key: "code", header: "Employee ID", sortable: true, cellClassName: "text-muted-foreground tabular-nums" },
    { key: "name", header: "Employee", sortable: true, cellClassName: "font-medium text-foreground" },
    { key: "department", header: "Department", sortable: true, cellClassName: "text-muted-foreground" },
    { key: "present", header: "WFO", align: "right", sortable: true },
    { key: "wfh", header: "WFH", align: "right", sortable: true },
    { key: "onDuty", header: "On Duty", align: "right", sortable: true },
    { key: "halfDay", header: "Half", align: "right", sortable: true },
    { key: "absent", header: "Absent", align: "right", sortable: true },
    { key: "leave", header: "Leave", align: "right", sortable: true },
    { key: "workingDays", header: "Working Days", align: "right", sortable: true, cellClassName: "text-muted-foreground" },
    { key: "attendancePct", header: "Attendance %", align: "right", sortable: true, render: (r) => <span className="font-semibold" style={{ color: pctColor(r.attendancePct) }}>{r.attendancePct}%</span> },
    { key: "export", header: "Export", align: "center", render: (r) => (
      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-[10px] text-muted-foreground" title={`Export ${r.name}'s report`} onClick={() => downloadEmployeeReport(r.employeeId, r.name, tblFrom, tblTo)} data-testid={`export-emp-${r.employeeId}`}>
        <Download className="h-3.5 w-3.5" />
      </Button>
    ) },
  ];

  // Labels for the list status badges
  const PRESENT_LABEL: Record<string, string> = { present: "WFO", wfh: "WFH", on_duty: "On Duty" };
  const NOTPRESENT_LABEL: Record<string, string> = { half_day: "Half Day", leave: "On Leave", absent: "Absent" };
  const presentFiltered = presentList.filter((e) => {
    if (presentFilter === "all") return true;
    const st = viewStatus.get(e.id);
    return presentFilter === "wfo" ? st === "present" : st === presentFilter;
  });
  const notPresentFiltered = notPresentList.filter((e) => notPresentFilter === "all" || viewStatus.get(e.id) === notPresentFilter);

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

  // ---- Downloadable reports (monthly or custom range), computed server-side ----
  const reportBounds = () => {
    if (reportMode === "custom" && reportRange.from && reportRange.to) {
      return { from: format(reportRange.from, "yyyy-MM-dd"), to: format(reportRange.to, "yyyy-MM-dd") };
    }
    return { from: format(startOfMonth(rangeStart), "yyyy-MM-dd"), to: format(endOfMonth(rangeStart), "yyyy-MM-dd") };
  };
  const downloadAllReport = async () => {
    if (reportMode === "custom" && (!reportRange.from || !reportRange.to)) {
      toast({ title: "Pick a date range first", variant: "destructive" }); return;
    }
    setReportBusy(true);
    try {
      const { from, to } = reportBounds();
      const data: any = await apiRequest("GET", `/api/attendance/report?from=${from}&to=${to}`);
      const headers = ["Employee Code", "Name", "Department", "Present (WFO)", "WFH", "On Duty", "Half Day", "Absent", "On Leave", "Working Days", "Attendance %"];
      const rows = (data.rows || []).map((r: any) => [r.code, r.name, r.department, r.present, r.wfh, r.onDuty, r.halfDay, r.absent, r.leave, r.workingDays, `${r.attendancePct}%`]);
      exportXlsx({ filename: `attendance-report-${from}_to_${to}.xlsx`, sheet: "Report", title: `Attendance Report — ${from} to ${to}`, headers, rows });
      setReportOpen(false);
    } catch (e: any) {
      toast({ title: "Couldn't generate report", description: e.message, variant: "destructive" });
    } finally { setReportBusy(false); }
  };
  const downloadEmployeeReport = async (empId: string, name: string, from: string, to: string) => {
    try {
      const data: any = await apiRequest("GET", `/api/attendance/report?from=${from}&to=${to}&employeeId=${empId}`);
      const days: any[] = data.days || [];
      const headers = ["Date", "Day", "Status"];
      const rows: (string | number)[][] = days.map((d: any) => {
        const dt = new Date(`${d.date}T00:00:00`);
        return [format(dt, "dd MMM yyyy"), format(dt, "EEE"), STATUS_DISPLAY[d.status] || "Present (WFO)"];
      });
      // Summary totals at the bottom of the sheet.
      const workingDays = days.length;
      const presentCount = days.filter((d) => ["present", "wfh", "on_duty"].includes(d.status)).length;
      const halfCount = days.filter((d) => d.status === "half_day").length;
      const absentCount = days.filter((d) => d.status === "absent").length;
      const leaveCount = days.filter((d) => d.status === "leave").length;
      const pct = workingDays ? Math.round(((presentCount + 0.5 * halfCount) / workingDays) * 100) : 0;
      rows.push(["", "", ""]);
      rows.push(["Summary", "", ""]);
      rows.push(["Attendance %", `${pct}%`]);
      rows.push(["Present / Working Days", `${presentCount} / ${workingDays}`]);
      rows.push(["Total Present", presentCount]);
      rows.push(["Total Not Present (Leave / Absent)", leaveCount + absentCount]);
      rows.push(["Half Days", halfCount]);
      const label = from === to
        ? format(new Date(`${from}T00:00:00`), "dd MMM yyyy")
        : `${format(new Date(`${from}T00:00:00`), "dd MMM")} – ${format(new Date(`${to}T00:00:00`), "dd MMM yyyy")}`;
      exportXlsx({ filename: `attendance-${name.replace(/\s+/g, "-")}-${from}_to_${to}.xlsx`, sheet: "Attendance", title: `${name} — ${label}`, headers, rows });
    } catch (e: any) {
      toast({ title: "Couldn't generate report", description: e.message, variant: "destructive" });
    }
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
            <DateRangePicker value={customRange} onChange={setCustomRange} align="end" testId="button-custom-range" />
          )}

          {/* Separator between the date filter and the action buttons */}
          <div className="h-10 w-px bg-border mx-1" />
          <Button variant="secondary" size="sm" onClick={() => setReportOpen(true)} data-testid="button-report-attendance">
            <Download className="h-4 w-4 mr-1" /> Report
          </Button>
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

      <WfhApprovalsCard />

      {/* Main row — the Today's Attendance card hugs its content and drives the row height; the
          Headcount and Approvals cards are absolutely positioned so they match that height exactly. */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:items-stretch">
        {/* Headcount trend (fills the reference height) */}
        <div className="lg:col-span-2 lg:relative">
        <div className="lg:absolute lg:inset-0">
        <Card className="border-0 h-full min-h-[20rem] flex flex-col">
          <CardHeader className="pt-4 pb-2 space-y-2">
            <div className="flex items-center justify-between gap-2 h-9">
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
        </div>
        </div>

        {/* Today's Attendance — donut breakdown (hugs its content; drives the row height) */}
        <Card className="border-0 flex flex-col">
          <CardHeader className="pt-4 pb-2">
            <div className="flex items-center h-9">
              <CardTitle className="text-base font-semibold flex items-center gap-2"><UserCheck className="h-4 w-4 text-muted-foreground" /> Today's Attendance</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {pieTotal === 0 ? (
              <div className="py-10 flex items-center justify-center"><p className="text-sm text-muted-foreground">No one active today</p></div>
            ) : (
              <>
                <div className="relative h-36 w-36 mx-auto" style={{ pointerEvents: "none" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={64} innerRadius={36} paddingAngle={3} cornerRadius={5} stroke="none">
                        {pieData.map((d) => <Cell key={d.key} fill={d.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-bold text-foreground leading-none tabular-nums">{pieTotal}</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">Employees</span>
                  </div>
                </div>
                <div className="space-y-1.5 mt-4">
                  {STATES.map((s) => {
                    const val = (todayCounts as any)[s.key] || 0;
                    const pct = pieTotal ? Math.round((val / pieTotal) * 100) : 0;
                    return (
                      <div key={s.key} className="flex items-center gap-2 text-xs" data-testid={`today-pie-legend-${s.key}`}>
                        <span className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style={{ background: s.color }} />
                        <span className="text-foreground/80 truncate flex-1">{s.label}</span>
                        <span className="text-muted-foreground tabular-nums">{pct}%</span>
                        <span className="font-semibold text-[#206295] flex-shrink-0 w-6 text-right tabular-nums">{val}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Approvals feed (fills the reference height) */}
        <div className="lg:relative">
          <div className="lg:absolute lg:inset-0">
            <ApprovalsFeedCard />
          </div>
        </div>
      </div>

      {/* Third row — full employee attendance summary table for the selected period */}
      <div className="space-y-4">
        {/* One-line toolbar: title · separator · search · dept · location */}
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-bold text-foreground shrink-0">Attendance Summary</h2>
          <div className="h-10 w-px bg-foreground/30 shrink-0 mx-[7px]" />
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={tblSearch} onChange={(e) => setTblSearch(e.target.value)} placeholder="Search by name or code..." className="pl-9" data-testid="input-table-search" />
          </div>
          <Select value={tblDept} onValueChange={setTblDept}>
            <SelectTrigger className="w-44" data-testid="select-table-dept"><SelectValue placeholder="All Departments" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tblLoc} onValueChange={setTblLoc}>
            <SelectTrigger className="w-40" data-testid="select-table-loc"><SelectValue placeholder="All Locations" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {tblLocations.map((l: any) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Card className="border-0">
          <CardContent className="p-0">
            <DataTable
              columns={tableColumns}
              rows={tableRows}
              getRowKey={(r: any) => r.employeeId}
              sort={tblSort}
              onSortChange={toggleSort}
              emptyText="No employees match."
              testIdPrefix="table-row"
            />
          </CardContent>
        </Card>
      </div>

      <AdminAttendanceDialog open={showOverride} onOpenChange={setShowOverride} employees={employees} />

      {/* Downloadable attendance report — monthly or custom range, all employees */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Download Attendance Report</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="segmented-toggle inline-flex p-0.5 h-9 w-full">
              <button type="button" onClick={() => setReportMode("month")} className={`flex-1 h-full rounded-[10px] text-xs font-medium ${reportMode === "month" ? "btn-primary-gradient text-white" : "text-foreground/70"}`} data-testid="report-mode-month">This Month</button>
              <button type="button" onClick={() => setReportMode("custom")} className={`flex-1 h-full rounded-[10px] text-xs font-medium ${reportMode === "custom" ? "btn-primary-gradient text-white" : "text-foreground/70"}`} data-testid="report-mode-custom">Custom Range</button>
            </div>
            {reportMode === "month" ? (
              <p className="text-sm text-muted-foreground">Report for <span className="font-medium text-foreground">{format(rangeStart, "MMMM yyyy")}</span>.</p>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground shrink-0">Range:</span>
                <DateRangePicker value={reportRange} onChange={setReportRange} align="start" testId="report-range" />
              </div>
            )}
            <p className="text-xs text-muted-foreground">A per-employee summary — present, WFH, on duty, half days, absences, leave, working days and attendance %. Weekends, holidays and future days are excluded.</p>
            <Button className="w-full" onClick={downloadAllReport} disabled={reportBusy} data-testid="button-download-report">
              <Download className="h-4 w-4 mr-1" /> {reportBusy ? "Preparing…" : "Download .xlsx"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================ My Attendance (self view — everyone) ============================
const ON_DUTY_PURPOSES = ["Factory Visit", "Vendor Visit", "Client Meeting", "Site Visit", "Field Work", "Training", "Others"];
const statusLabelOf = (s?: string) => STATES.find((x) => x.key === s)?.label || (s === "holiday" ? "Holiday" : s === "weekend" ? "Weekend" : "Not marked");

// Self-declaration modal — "leaving the office for official work".
function MarkOnDutyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [purpose, setPurpose] = useState("");
  const [other, setOther] = useState("");
  const [location, setLocation] = useState("");
  const [retDate, setRetDate] = useState<Date | undefined>(undefined);
  const [retTime, setRetTime] = useState("");
  const [remarks, setRemarks] = useState("");

  const start = useMutation({
    mutationFn: (payload: any) => apiRequest("POST", "/api/attendance/on-duty", payload),
    onSuccess: () => {
      qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/attendance") });
      toast({ title: "You're marked On Duty", description: "Your manager has been notified." });
      onClose();
    },
    onError: (e: any) => toast({ title: "Couldn't mark on duty", description: e.message, variant: "destructive" }),
  });

  const submit = () => {
    const p = (purpose === "Others" ? other : purpose).trim();
    if (!p) return toast({ title: "Choose a purpose", variant: "destructive" });
    const expectedReturn = retDate ? `${format(retDate, "yyyy-MM-dd")}T${retTime || "18:00"}` : null;
    start.mutate({ purpose: p, location: location.trim() || null, expectedReturn, remarks: remarks.trim() || null });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden gap-0 flex flex-col max-h-[90vh]">
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-[#4A90C2]/10 text-[#4A90C2] flex items-center justify-center"><Route className="h-5 w-5" /></span>
            Mark On Duty
          </DialogTitle>
          <p className="text-sm text-muted-foreground pt-1.5">Notify your team that you're leaving the office for official work.</p>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 space-y-3">
          <div className="space-y-1.5"><Label>Purpose</Label>
            <Select value={purpose} onValueChange={setPurpose}>
              <SelectTrigger data-testid="duty-purpose"><SelectValue placeholder="Select purpose" /></SelectTrigger>
              <SelectContent>{ON_DUTY_PURPOSES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {purpose === "Others" && <div className="space-y-1.5"><Label>Specify purpose</Label><Input value={other} onChange={(e) => setOther(e.target.value)} placeholder="e.g. Government office" data-testid="duty-other" /></div>}
          <div className="space-y-1.5"><Label>Destination / Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where are you headed?" data-testid="duty-location" /></div>
          <div className="space-y-1.5"><Label>Expected Return <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <div className="grid grid-cols-2 gap-2">
              <DateField value={retDate} onChange={setRetDate} disabled={[{ before: startOfDay(new Date()) }, { after: (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 14); return d; })() }]} placeholder="Return date" testId="duty-return-date" />
              <TimeField value={retTime} onChange={setRetTime} placeholder="Return time" testId="duty-return-time" />
            </div>
          </div>
          <div className="space-y-1.5"><Label>Remarks <span className="text-muted-foreground font-normal">(optional)</span></Label><Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Anything your team should know…" data-testid="duty-remarks" /></div>
        </div>
        <div className="flex-shrink-0 border-t border-border bg-background px-6 py-4 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="btn-primary-gradient" disabled={start.isPending} onClick={submit} data-testid="duty-start"><Route className="h-4 w-4 mr-1.5" /> {start.isPending ? "Starting…" : "Start On Duty"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Work-From-Home request modal — date (today .. 5 working days) + duration + optional reason.
// Warns and blocks submission on a holiday / approved-leave conflict. Needs manager approval,
// auto-approving 24h before the date if not actioned.
function ApplyWfhDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: auth } = useAuth();
  const myEmpId = auth?.user?.employeeId || "";
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [rangeMode, setRangeMode] = useState(false);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [duration, setDuration] = useState("full");
  const [reason, setReason] = useState("");

  // Max selectable = the 5th working day ahead of today (weekends disabled in the picker).
  const allowedMax = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); let c = 0; while (c < 5) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w !== 0 && w !== 6) c++; } return d; })();
  const yr = (date ?? new Date()).getFullYear();
  const { data: holidays = [] } = useQuery<any[]>({ queryKey: [`/api/holidays?year=${yr}`] });
  const { data: myLeaves = [] } = useQuery<any[]>({ queryKey: [myEmpId ? `/api/leave-requests?employeeId=${myEmpId}` : "/api/leave-requests"] });

  // Conflict check across the selected day(s) — a holiday or approved leave on any day blocks it.
  const conflict = (() => {
    if (!date) return null;
    if (rangeMode && endDate && endDate < date) return "End date can't be before the start date.";
    const end = rangeMode && endDate ? endDate : date;
    for (let d = new Date(date); d <= end; d.setDate(d.getDate() + 1)) {
      const w = d.getDay(); if (w === 0 || w === 6) continue;
      const dstr = format(d, "yyyy-MM-dd");
      const h = (holidays as any[]).find((x) => x.date === dstr);
      if (h) return `${dstr} is a public holiday (${h.name}).`;
      const lv = (myLeaves as any[]).find((l) => l.status === "approved" && l.startDate <= dstr && l.endDate >= dstr && l.employeeId === myEmpId);
      if (lv) return `You already have approved leave on ${dstr}.`;
    }
    return null;
  })();

  const submit = useMutation({
    mutationFn: (payload: any) => apiRequest("POST", "/api/attendance/wfh", payload),
    onSuccess: () => {
      qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/attendance") });
      toast({ title: "WFH request submitted", description: "Sent to your reporting manager. It auto-approves 24h before the date if not actioned." });
      onClose();
    },
    onError: (e: any) => toast({ title: "Couldn't submit WFH", description: e.message, variant: "destructive" }),
  });

  const onSubmit = () => {
    if (!date) return toast({ title: "Pick a date", variant: "destructive" });
    if (rangeMode && !endDate) return toast({ title: "Pick an end date", variant: "destructive" });
    if (conflict) return;
    submit.mutate({
      date: format(date, "yyyy-MM-dd"),
      endDate: rangeMode && endDate ? format(endDate, "yyyy-MM-dd") : null,
      duration: rangeMode ? "full" : duration,
      reason: reason.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden gap-0 flex flex-col max-h-[90vh]">
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-[#0E7C7B]/10 text-[#0E7C7B] flex items-center justify-center"><Home className="h-5 w-5" /></span>
            Apply Work from Home
          </DialogTitle>
          <p className="text-sm text-muted-foreground pt-1.5">Request to work from home for today or up to 5 working days in advance.</p>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>{rangeMode ? "Start date" : "Date"}</Label>
              <DateField value={date} onChange={setDate} disabled={[{ before: startOfDay(new Date()) }, { after: allowedMax }, { dayOfWeek: [0, 6] }]} placeholder="Select a date" testId="wfh-date" />
            </div>
            {rangeMode ? (
              <div className="space-y-1.5"><Label>End date</Label>
                <DateField value={endDate} onChange={setEndDate} disabled={[{ before: date ? startOfDay(date) : startOfDay(new Date()) }, { after: allowedMax }, { dayOfWeek: [0, 6] }]} placeholder="End date" testId="wfh-end-date" />
              </div>
            ) : (
              <div className="space-y-1.5"><Label>Duration</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger data-testid="wfh-duration"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Day</SelectItem>
                    <SelectItem value="first_half">First Half</SelectItem>
                    <SelectItem value="second_half">Second Half</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={rangeMode} onCheckedChange={(v) => { setRangeMode(v); if (!v) setEndDate(undefined); }} data-testid="wfh-range-toggle" />
            <Label className="font-normal text-muted-foreground text-xs">Request for multiple days (range)</Label>
          </div>
          {conflict && (
            <div className="rounded-lg border border-[#FF6F62]/40 bg-[#FF6F62]/10 px-3 py-2 text-xs text-[#C43D30] flex items-start gap-2" data-testid="wfh-conflict">
              <TriangleAlert className="h-4 w-4 flex-shrink-0 mt-0.5" /> <span>{conflict} Please pick another date.</span>
            </div>
          )}
          <div className="space-y-1.5"><Label>Reason <span className="text-muted-foreground font-normal">(optional)</span></Label><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you working from home?" data-testid="wfh-reason" /></div>
          <p className="text-[11px] text-muted-foreground pt-1">This request will be sent to your reporting manager.</p>
        </div>
        <div className="flex-shrink-0 border-t border-border bg-background px-6 py-4 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="btn-primary-gradient" disabled={submit.isPending || !date || !!conflict} onClick={onSubmit} data-testid="wfh-submit"><Home className="h-4 w-4 mr-1.5" /> {submit.isPending ? "Submitting…" : "Submit Request"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MyAttendanceView() {
  const now = new Date();
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<Date>(new Date());
  const [view, setView] = useState<"calendar" | "timeline">("calendar");
  const [calFilter, setCalFilter] = useState<string>("all");
  const [dutyOpen, setDutyOpen] = useState(false);
  const [wfhOpen, setWfhOpen] = useState(false);
  // Deep-link support: /attendance?action=on-duty | wfh (used by the dashboard's header buttons) opens the dialog.
  useEffect(() => {
    const action = new URLSearchParams(window.location.search).get("action");
    if (action === "on-duty") setDutyOpen(true);
    else if (action === "wfh") setWfhOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [todaySearch, setTodaySearch] = useState("");
  const [todayFilter, setTodayFilter] = useState<string>("all");
  const [streakMap, setStreakMap] = useState<Record<string, { status: string; days: number }>>({});
  const [hoveredEmp, setHoveredEmp] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidateAttendance = () => qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && ((q.queryKey[0] as string).startsWith("/api/attendance") || (q.queryKey[0] as string).startsWith("/api/leave")) });
  const endOnDuty = useMutation({
    mutationFn: () => apiRequest("POST", "/api/attendance/on-duty/end", {}),
    onSuccess: () => { invalidateAttendance(); toast({ title: "On Duty ended" }); },
    onError: (e: any) => toast({ title: "Couldn't end On Duty", description: e.message, variant: "destructive" }),
  });
  const endOnLeave = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/leave-requests/${id}/end`, {}),
    onSuccess: () => { invalidateAttendance(); toast({ title: "Leave ended", description: "Un-taken days were returned to your balance." }); },
    onError: (e: any) => toast({ title: "Couldn't end leave", description: e.message, variant: "destructive" }),
  });

  const m = cursor.getMonth() + 1, y = cursor.getFullYear();
  const { data: records = [] } = useQuery<any[]>({ queryKey: [`/api/attendance?month=${m}&year=${y}`] });
  const { data: holidays = [] } = useQuery<any[]>({ queryKey: [`/api/holidays?year=${y}`] });
  const { data: myEmp } = useQuery<any>({ queryKey: ["/api/employees/me"] });
  const { data: todayList = [] } = useQuery<any[]>({ queryKey: ["/api/attendance/today-list"] });
  const { data: myTrips = [] } = useQuery<any[]>({ queryKey: ["/api/travel?mine=true"] });

  const dstr = (d: Date) => format(d, "yyyy-MM-dd");
  const byDate = useMemo(() => { const map: Record<string, any> = {}; (records as any[]).forEach((r) => { map[r.date] = r; }); return map; }, [records]);
  // Booked trips overlay the calendar (read-time, like leave): each covered day gets a travel marker.
  const travelDays = useMemo(() => {
    const map: Record<string, string> = {};
    (myTrips as any[]).filter((t) => t.status === "booked" && t.startDate).forEach((t) => {
      const end = new Date(`${t.endDate || t.startDate}T00:00:00`);
      for (let d = new Date(`${t.startDate}T00:00:00`); d <= end; d.setDate(d.getDate() + 1)) map[format(d, "yyyy-MM-dd")] = t.category;
    });
    return map;
  }, [myTrips]);
  const holidaySet = useMemo(() => new Set((holidays as any[]).map((h) => h.date)), [holidays]);
  const todayStr = dstr(now);
  // Employment window — nothing is "Present" before joining or after the last working day.
  const joinStr = myEmp?.joinDate ? String(myEmp.joinDate).slice(0, 10) : null;
  const exitStr = myEmp?.lastWorkingDate ? String(myEmp.lastWorkingDate).slice(0, 10) : null;
  const parseMeta = (r: any) => { try { return JSON.parse(r?.notes || "null"); } catch { return null; } };
  // Effective WFH approval for a record: "approved" | "pending" | "rejected" | null (not a WFH request).
  // Pending auto-resolves to approved once we're within 24h of the WFH date.
  const wfhApproval = (r: any): "approved" | "pending" | "rejected" | null => {
    const meta = parseMeta(r);
    if (!meta || meta.kind !== "wfh") return null;
    if (meta.approval === "rejected") return "rejected";
    if (meta.approval === "approved") return "approved";
    if (meta.autoApproveAt && +now >= +new Date(meta.autoApproveAt)) return "approved";
    return "pending";
  };
  // Single source of truth for a day's status — the calendar, the overview stats, and the
  // Activity Details panel all read from this, so they can never disagree. A working day with
  // no explicit record (and not in the future) defaults to Present; any exception
  // (absent / leave / WFH / on-duty / half-day) comes from a stored record. A REJECTED WFH request
  // is ignored (the day reverts to its default), so it never shows as WFH.
  const effectiveStatus = (d: Date): string | null => {
    const key = dstr(d);
    // Outside the employment window → neutral (never assume Present before joining or after exit).
    if ((joinStr && key < joinStr) || (exitStr && key > exitStr)) return null;
    const isFuture = key > todayStr;
    const r = byDate[key];
    if (r && !(r.status === "wfh" && wfhApproval(r) === "rejected")) {
      // Future days only surface *planned* statuses (WFH / leave). A plain present/absent/half-day
      // record on a future date is ignored, so tomorrow never shows as "Present".
      if (!isFuture || r.status === "wfh" || r.status === "leave" || r.status === "on_duty") return r.status;
    }
    if (holidaySet.has(key)) return "holiday";
    const wd = d.getDay();
    if (wd === 0 || wd === 6) return "weekend";
    if (isFuture) return null;          // future working day — neutral until a status is applied
    return "present";                   // elapsed working day, no exception → present
  };

  const monthDays = useMemo(() => eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor)), end: endOfWeek(endOfMonth(cursor)) }), [cursor]);

  // Counts derived from effectiveStatus over the elapsed working days, so they match the calendar.
  const stats = useMemo(() => {
    let present = 0, absent = 0, leave = 0, half = 0, office = 0, wfh = 0, onDuty = 0, working = 0;
    const mStart = startOfMonth(cursor), mEnd = endOfMonth(cursor);
    if (now >= mStart) {
      const upto = now > mEnd ? mEnd : now;
      for (const d of eachDayOfInterval({ start: mStart, end: upto })) {
        const s = effectiveStatus(d);
        if (!s || s === "weekend" || s === "holiday") continue;
        working++;
        if (s === "present") { office++; present++; }
        else if (s === "wfh") { wfh++; present++; }
        else if (s === "on_duty") { onDuty++; present++; }
        else if (s === "absent") absent++;
        else if (s === "leave") leave++;
        else if (s === "half_day") half++;
      }
    }
    const pct = working ? Math.min(100, Math.round((present / working) * 100)) : 0;
    return { present, absent, leave, half, office, wfh, onDuty, notPresent: absent + leave, pct, working };
  }, [records, cursor, holidaySet, now]);

  const selRec = byDate[dstr(selected)];
  const selMeta = useMemo(() => { const j = parseMeta(selRec); return j && j.kind === "on_duty" ? j : null; }, [selRec]);
  const selWfhAp = selRec?.status === "wfh" ? wfhApproval(selRec) : null;
  const selWfhMeta = selWfhAp ? parseMeta(selRec) : null;
  const selStatus = effectiveStatus(selected);
  const selHoliday = (holidays as any[]).find((h) => h.date === dstr(selected));
  const todayOnDuty = byDate[todayStr]?.status === "on_duty";
  // ---- Today's Attendance list (teammates first, searchable, filterable, hover-streak) ----
  const teamRank = (e: any) => {
    if (!myEmp) return 2;
    if (e.id === myEmp.id) return 0;
    const isPeer = myEmp.managerId && e.managerId === myEmp.managerId;
    const isMgr = myEmp.managerId && e.id === myEmp.managerId;
    const isReport = e.managerId === myEmp.id;
    return (isPeer || isMgr || isReport) ? 1 : 2;
  };
  const todayRows = useMemo(() => {
    const q = todaySearch.trim().toLowerCase();
    return (todayList as any[])
      .filter((e) => todayFilter === "all" || e.status === todayFilter)
      .filter((e) => !q || `${e.firstName} ${e.lastName} ${e.employeeCode || ""}`.toLowerCase().includes(q))
      .sort((a, b) => { const r = teamRank(a) - teamRank(b); return r !== 0 ? r : `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayList, todaySearch, todayFilter, myEmp]);
  const dayStatusMeta = (s: string) => {
    const found = STATES.find((x) => x.key === s);
    if (found) return { color: found.color, label: found.key === "present" ? "In Office" : found.label };
    if (s === "holiday") return { color: "#94A3B8", label: "Holiday" };
    if (s === "weekend") return { color: "#CBD5E1", label: "Weekend" };
    return { color: "#94A3B8", label: "—" };
  };
  const STREAK_VERB: Record<string, string> = { leave: "on leave", wfh: "on WFH", on_duty: "on duty", half_day: "on half-days", absent: "absent", present: "in office" };
  const streakLabel = (s: { status: string; days: number }) => `${s.days} day${s.days > 1 ? "s" : ""}${STREAK_VERB[s.status] ? ` ${STREAK_VERB[s.status]}` : ""}`;
  const loadStreak = async (id: string) => {
    setHoveredEmp(id);
    if (streakMap[id]) return;
    try { const s: any = await apiRequest("GET", `/api/attendance/streak?employeeId=${id}`); setStreakMap((m) => ({ ...m, [id]: s })); } catch { /* ignore */ }
  };
  const [, navigate] = useLocation();
  const timeline = useMemo(() => [...(records as any[])].sort((a, b) => (a.date < b.date ? 1 : -1)), [records]);

  const StatusChip = ({ s }: { s?: string }) => {
    const c = (s && STATE_COLOR[s]) || "#64748B";
    return <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: `${c}22`, color: c }}><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} />{statusLabelOf(s)}</span>;
  };

  return (
    <div className="p-6 space-y-5 max-w-[92rem] mx-auto">
      {/* Header + primary CTA */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-xl bg-[#206295]/10 text-[#206295] flex items-center justify-center"><UserCheck className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Attendance</h1>
            <p className="text-sm text-muted-foreground">View your attendance history and update your work status.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" className="h-10 text-[12px]" onClick={() => setWfhOpen(true)} data-testid="apply-wfh"><Home className="h-4 w-4 mr-1.5" /> Apply Work from Home</Button>
          <Button className="btn-primary-gradient h-10 text-[12px]" onClick={() => todayOnDuty ? toast({ title: "On Duty already marked for today" }) : setDutyOpen(true)} data-testid="mark-on-duty"><Route className="h-4 w-4 mr-1.5" /> Mark On Duty</Button>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 card-hover">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Present This Month</p>
                <p className="text-[33px] leading-tight font-bold text-foreground tabular-nums">{stats.present}<span className="text-[16px] font-normal text-muted-foreground align-baseline">/{stats.working}</span></p>
                <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{stats.pct}%</span> attendance rate</p>
              </div>
              <div className="p-2.5 rounded-xl flex-shrink-0 bg-[#4BDCD9]/25 text-[#0E7C7B]"><CircleCheck className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 card-hover">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Work Mode This Month</p>
                <div className="mt-2 grid grid-cols-3 divide-x divide-foreground/25">
                  {[{ label: "Office", n: stats.office, c: "#206295" }, { label: "WFH", n: stats.wfh, c: "#0E7C7B" }, { label: "On Duty", n: stats.onDuty, c: "#4A90C2" }].map((x) => (
                    <div key={x.label} className="px-3 first:pl-0 last:pr-0">
                      <p className="text-[26px] leading-tight font-bold text-foreground tabular-nums">{x.n}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: x.c }} />{x.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-2.5 rounded-xl flex-shrink-0 bg-[#425B8D]/15 text-[#425B8D]"><Briefcase className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
        <StatCard title="Not Present This Month" value={`${stats.notPresent}`} icon={CalendarDays} color="bg-[#FF6F62]/20 text-[#FF6F62]" subtitle={<p className="text-xs text-muted-foreground">Absent: <span className="font-semibold text-foreground">{stats.absent}</span> | Leave: <span className="font-semibold text-foreground">{stats.leave}</span></p>} />
      </div>

      {/* Bottom row — aligned to the 3-col overview above (calendar = 2 cols, bento = 1 col, same gap).
          Columns stretch to equal height so the right column's last card bottom-aligns with the calendar. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:items-stretch">
        {/* Calendar / timeline — spans the first two overview columns */}
        <div className="lg:col-span-2 card-surface rounded-2xl p-4">
          {/* Controls: view toggle · status filter (matches the booking calendar) */}
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <div className="segmented-toggle inline-flex p-0.5 h-9">
              <button onClick={() => setView("calendar")} className={`px-3 h-full rounded-[10px] text-xs font-medium inline-flex items-center gap-1.5 ${view === "calendar" ? "btn-primary-gradient text-white" : "text-foreground/70"}`} data-testid="myatt-calendar"><CalendarDays className="h-3.5 w-3.5" /> Calendar</button>
              <button onClick={() => setView("timeline")} className={`px-3 h-full rounded-[10px] text-xs font-medium inline-flex items-center gap-1.5 ${view === "timeline" ? "btn-primary-gradient text-white" : "text-foreground/70"}`} data-testid="myatt-timeline"><CalendarRange className="h-3.5 w-3.5" /> Timeline</button>
            </div>
            <Select value={calFilter} onValueChange={setCalFilter}>
              <SelectTrigger className="h-9 w-[170px] text-xs" data-testid="myatt-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="wfh">WFH</SelectItem>
                <SelectItem value="on_duty">On Duty</SelectItem>
                <SelectItem value="half_day">Half Day</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="leave">Leave</SelectItem>
                <SelectItem value="holiday">Holiday</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {view === "calendar" ? (
            <>
              {/* Month nav — < label > (centered, matches booking calendar) */}
              <div className="flex items-center justify-center gap-4 mb-3">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCursor(subMonths(cursor, 1))} data-testid="myatt-prev"><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm font-semibold min-w-[12rem] text-center">{format(cursor, "MMMM yyyy")}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCursor(addMonths(cursor, 1))} data-testid="myatt-next"><ChevronRight className="h-4 w-4" /></Button>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap mb-3 text-[11px] text-muted-foreground">
                {STATES.map((s) => <span key={s.key} className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ backgroundColor: s.color }} />{s.label}</span>)}
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ backgroundColor: "#94A3B8" }} />Holiday</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-border" style={{ backgroundColor: "#CBD5E1" }} />Weekend</span>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground text-center py-1.5">{d}</div>
                ))}
                {monthDays.map((day) => {
                  const key = dstr(day);
                  const st = effectiveStatus(day);
                  const inM = isSameMonth(day, cursor);
                  const isToday = isSameDay(day, now);
                  const isSel = isSameDay(day, selected);
                  const isFut = key > todayStr;
                  const isWeekend = st === "weekend";
                  const pendingWfh = st === "wfh" && wfhApproval(byDate[key]) === "pending";
                  const color = st && !isWeekend ? (st === "holiday" ? "#94A3B8" : STATE_COLOR[st]) : null;
                  const filterMatch = calFilter === "all" || st === calFilter;
                  const showLabel = !!color && filterMatch && inM;   // a status label to show
                  const showFill = showLabel && !isFut;              // future planned days = label only, no fill
                  const todaySolid = isToday && !!color && !pendingWfh; // today is a solid filled box
                  const solidText = todaySolid ? textOn(blendWhite(color!, TODAY_FILL_ALPHA)) : undefined;
                  const label = pendingWfh ? "WFH · Pending" : statusLabelOf(st || undefined);
                  const trip = inM ? travelDays[key] : undefined;
                  return (
                    <button key={day.toISOString()} onClick={() => setSelected(day)}
                      className={`min-h-[72px] rounded-lg border p-1.5 text-left flex flex-col transition-colors hover-elevate ${isSel ? "ring-2 ring-[#206295] ring-offset-2 ring-offset-background" : (isToday && !todaySolid) ? "ring-2 ring-[#206295]" : ""} ${inM ? (isWeekend ? "bg-muted/30 border-border/60" : "bg-background border-border/80") : "bg-muted/30 border-transparent text-muted-foreground/50"}`}
                      style={todaySolid ? { backgroundColor: `${color}80`, borderColor: color! } : (showFill ? { backgroundColor: `${color}33` } : undefined)}
                      data-testid={`myatt-day-${format(day, "yyyy-MM-dd")}`}>
                      <span className="self-start w-full flex items-center justify-between text-sm font-semibold" style={solidText ? { color: solidText } : undefined}>{format(day, "d")}{trip && <Plane className="h-3 w-3 text-[#206295]" aria-label="Travel booked" />}</span>
                      {showLabel && (showFill
                        ? <span className="mt-auto max-w-full truncate text-[11px] font-medium" style={{ color: solidText ?? (LABEL_COLOR[st || ""] || color!) }} title={label}>{label}</span>
                        : <span className="mt-auto self-start inline-flex max-w-full truncate rounded-md border px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: LABEL_COLOR[st || ""] || color!, borderColor: `${color}80` }} title={label}>{label}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <ScrollArea className="h-[420px]">
              <div className="space-y-2 pr-2">
                {(() => { const rows = timeline.filter((r) => calFilter === "all" || r.status === calFilter); return rows.length === 0 ? (
                  <div className="text-center py-16"><CalendarDays className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">{calFilter === "all" ? "No attendance recorded this month." : "No matching days this month."}</p></div>
                ) : rows.map((r) => (
                  <button key={r.id} onClick={() => setSelected(new Date(r.date))} className="w-full text-left rounded-xl border border-border/60 p-3 flex items-center gap-3 hover-elevate" data-testid={`myatt-row-${r.date}`}>
                    <div className="w-12 flex-shrink-0 text-center">
                      <p className="text-[10px] uppercase text-muted-foreground">{format(new Date(r.date), "MMM")}</p>
                      <p className="text-lg font-bold leading-none text-foreground tabular-nums">{format(new Date(r.date), "d")}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <StatusChip s={r.status} />
                      <p className="text-[11px] text-muted-foreground mt-1 truncate">{format(new Date(r.date), "EEEE")}</p>
                    </div>
                  </button>
                )); })()}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Right — activity details + upcoming holidays. The inner stack is absolutely positioned on
            lg so it fills the calendar's height WITHOUT its own content dictating the row height
            (that's what kept stretching the calendar). The holidays list just scrolls within. */}
        <div className="lg:col-span-1 relative min-h-0">
          <div className="flex flex-col gap-4 lg:absolute lg:inset-0">
          <div className="card-surface rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-base font-semibold text-foreground">Activity Details</p>
                <p className="text-[13px] text-muted-foreground mt-0.5">{format(selected, "EEE, d MMM yyyy")}{isSameDay(selected, now) ? " · Today" : ""}</p>
              </div>
              <StatusChip s={selStatus || undefined} />
            </div>
            <div className="mt-3 border-t border-foreground/20" />

            {(() => {
              const c = (selStatus && STATE_COLOR[selStatus]) || "#64748B";
              const MODE: Record<string, string> = { present: "In office", wfh: "Work from home", on_duty: "On duty · field", half_day: "Half day", absent: "Not present", leave: "On leave", holiday: "Holiday", weekend: "Weekend" };
              const dayType = selStatus === "holiday" ? (selHoliday?.name || "Holiday") : selStatus === "weekend" ? "Weekend" : "Working day";
              const Row = ({ icon: Icon, label, value, tint }: { icon: any; label: string; value: React.ReactNode; tint: string }) => (
                <div className="flex items-center gap-3">
                  <span className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${tint}1A`, color: tint }}><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none">{label}</p>
                    <p className="text-sm text-foreground mt-1 truncate">{value}</p>
                  </div>
                </div>
              );
              return (
                <div className="mt-4 space-y-3">
                  <Row icon={Briefcase} label="Work mode" value={MODE[selStatus || ""] || "—"} tint={c} />
                  <Row icon={CalendarDays} label="Day" value={`${format(selected, "EEEE")} · ${dayType}`} tint="#425B8D" />
                  {selMeta && (
                    <div className="rounded-xl p-3 space-y-1.5" style={{ border: `1px solid ${STATE_COLOR.on_duty}4D`, backgroundColor: `${STATE_COLOR.on_duty}0F` }}>
                      {selMeta.location && <p className="text-xs text-foreground flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" /> <span>{selMeta.location}</span></p>}
                      {selMeta.expectedReturn && <p className="text-xs text-foreground flex items-center gap-1.5"><Route className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" /> <span>Expected return {format(new Date(selMeta.expectedReturn), "d MMM, h:mm a")}</span></p>}
                      {selRec?.checkIn && <p className="text-xs text-foreground flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" /> <span>Marked at {format(new Date(selRec.checkIn), "h:mm a")}</span></p>}
                      {selMeta.remarks && <p className="text-xs text-muted-foreground">{selMeta.remarks}</p>}
                    </div>
                  )}
                  {selWfhMeta && (
                    <div className="rounded-xl p-3 space-y-1.5" style={{ border: `1px solid ${STATE_COLOR.wfh}4D`, backgroundColor: `${STATE_COLOR.wfh}0F` }}>
                      <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: STATE_COLOR.wfh }}><Home className="h-3.5 w-3.5 flex-shrink-0" /> <span>Work From Home · {selWfhAp === "approved" ? "Approved" : selWfhAp === "rejected" ? "Rejected" : "Pending approval"}{selWfhMeta.duration && selWfhMeta.duration !== "full" ? ` · ${selWfhMeta.duration === "first_half" ? "First Half" : "Second Half"}` : ""}</span></p>
                      {selWfhMeta.reason && <p className="text-xs text-muted-foreground">{selWfhMeta.reason}</p>}
                      {selWfhAp === "pending" && selWfhMeta.autoApproveAt && <p className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 flex-shrink-0" /> <span>Auto-approves {format(new Date(selWfhMeta.autoApproveAt), "d MMM, h:mm a")} if not actioned.</span></p>}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Secondary actions — end an active On-Duty trip or an ongoing/upcoming leave */}
            {selStatus === "on_duty" && !selMeta?.endedAt && (
              <Button variant="outline" size="sm" className="w-full mt-4 text-xs" disabled={endOnDuty.isPending} onClick={() => endOnDuty.mutate()} data-testid="end-on-duty"><Route className="h-3.5 w-3.5 mr-1.5" /> {endOnDuty.isPending ? "Ending…" : "End On Duty"}</Button>
            )}
            {(selStatus === "leave" || selStatus === "half_day") && selRec?.leaveRequestId && dstr(selected) >= todayStr && (
              <Button variant="outline" size="sm" className="w-full mt-4 text-xs" disabled={endOnLeave.isPending} onClick={() => endOnLeave.mutate(selRec.leaveRequestId)} data-testid="end-on-leave"><CalendarDays className="h-3.5 w-3.5 mr-1.5" /> {endOnLeave.isPending ? "Ending…" : "End Leave"}</Button>
            )}
          </div>

          {/* Today's Attendance — who's in / out today (teammates first). flex-1 so its bottom lines up with the calendar */}
          <div className="card-surface rounded-2xl p-4 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3 gap-2">
              <p className="text-base font-semibold text-foreground">Today's Attendance</p>
              <Select value={todayFilter} onValueChange={setTodayFilter}>
                <SelectTrigger className="h-7 w-[116px] text-[11px] rounded-[10px]" data-testid="select-today-filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All States</SelectItem>
                  {STATES.map((s) => <SelectItem key={s.key} value={s.key} className="text-xs">{s.key === "present" ? "In Office" : s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={todaySearch} onChange={(e) => setTodaySearch(e.target.value)} placeholder="Search teammates…" className="pl-9 h-9" data-testid="input-today-search" />
            </div>
            {todayRows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No one matches.</p>
            ) : (
              <ScrollArea className="flex-1 min-h-0 -mr-2">
                <div className="list-divider pr-2">
                  {todayRows.map((e: any) => {
                    const meta = dayStatusMeta(e.status);
                    const st = streakMap[e.id];
                    const isYou = myEmp && e.id === myEmp.id;
                    return (
                      <div
                        key={e.id}
                        className="flex items-center gap-3 py-2"
                        onMouseEnter={() => loadStreak(e.id)}
                        onMouseLeave={() => setHoveredEmp(null)}
                        data-testid={`today-emp-${e.id}`}
                      >
                        <EmpAvatar emp={e} className="h-8 w-8" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{e.firstName} {e.lastName}{isYou ? " (You)" : ""}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{e.department || e.employeeCode || ""}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: `${meta.color}22`, color: meta.color }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />{meta.label}
                          </span>
                          {hoveredEmp === e.id && st && st.days > 0 && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">{streakLabel(st)}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
          </div>
        </div>
      </div>

      <MarkOnDutyDialog open={dutyOpen} onClose={() => setDutyOpen(false)} />
      <ApplyWfhDialog open={wfhOpen} onClose={() => setWfhOpen(false)} />
    </div>
  );
}

// Container — role-gated: privileged roles get tabs (My Attendance default + Employee Attendance);
// everyone else sees only My Attendance.
export default function AttendancePage() {
  const { data: auth } = useAuth();
  const user = auth?.user || null;
  const canSeeAll = isManager(user) || hasRole(user, "ceo_approver");
  if (!canSeeAll) return <MyAttendanceView />;
  return (
    <Tabs defaultValue="mine" className="w-full">
      <div className="px-6 pt-6 max-w-[92rem] mx-auto">
        {/* One pill split 50/50 down the middle — no gap, outer corners rounded, active half fills its side. */}
        <TabsList className="w-full grid grid-cols-2 gap-0 p-0 h-12 overflow-hidden rounded-[20px] border border-white/70 shadow-[0_4px_16px_rgba(44,62,98,0.18)]">
          <TabsTrigger value="mine" style={{ borderRadius: 0, borderColor: "transparent" }} className="w-full h-full text-sm" data-testid="tab-my-attendance">My Attendance</TabsTrigger>
          <TabsTrigger value="all" style={{ borderRadius: 0, borderColor: "transparent" }} className="w-full h-full text-sm" data-testid="tab-employee-attendance">Employee Attendance</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="mine" className="mt-0"><MyAttendanceView /></TabsContent>
      <TabsContent value="all" className="mt-0"><EmployeeAttendanceView /></TabsContent>
    </Tabs>
  );
}
