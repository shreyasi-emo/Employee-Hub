import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, isHR, isManager } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Plane, Plus, Calendar, Clock, Info, Search, FileText, CheckCircle2, XCircle, Pencil,
} from "lucide-react";
import { format, parseISO, startOfDay } from "date-fns";
import { DateField } from "@/components/datetime-field";

// "yyyy-MM-dd" string → local Date (avoids the UTC shift of new Date("yyyy-MM-dd")).
const parseYmd = (s?: string): Date | undefined => { if (!s) return undefined; const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: "Pending", bg: "bg-[#FFA962]/20", text: "text-[#FFA962]" },
  approved: { label: "Approved", bg: "bg-[#4BDCD9]/25", text: "text-[#206295]" },
  rejected: { label: "Rejected", bg: "bg-[#FF6F62]/20", text: "text-[#FF6F62]" },
  cancelled: { label: "Cancelled", bg: "bg-[#6A7366]/15", text: "text-[#6A7366]" },
};

const AVATAR_PALETTE = ["#206295", "#4BDCD9", "#FF6F62"];
function avatarColor(seed?: string) {
  const s = seed || "";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function StatCard({ title, value, subtitle, icon: Icon, color }: { title: string; value: number | string; subtitle?: string; icon: any; color: string; }) {
  return (
    <Card className="border-0 card-hover"><CardContent className="p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-[33px] leading-tight font-bold text-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-xl flex-shrink-0 ${color}`}><Icon className="h-5 w-5" /></div>
      </div>
    </CardContent></Card>
  );
}

// ===================== Apply Leave =====================
function ApplyLeaveDialog({ open, onOpenChange, employeeId, leaveTypes, leaveBalances }: {
  open: boolean; onOpenChange: (v: boolean) => void; employeeId?: string; leaveTypes: any[]; leaveBalances: any[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ leaveTypeId: "", startDate: today, endDate: today, isHalfDay: false, reason: "" });

  const selectedLT = leaveTypes.find((lt) => lt.id === form.leaveTypeId);
  const balance = leaveBalances.find((b) => b.leaveTypeId === form.leaveTypeId);
  const availableDays = parseFloat(balance?.closingBalance || "0");

  const calcDays = () => {
    if (!form.startDate || !form.endDate) return 0;
    if (form.isHalfDay) return 0.5;
    const start = parseISO(form.startDate);
    const end = parseISO(form.endDate);
    let days = 0;
    const d = new Date(start);
    while (d <= end) { const dow = d.getDay(); if (dow !== 0 && dow !== 6) days++; d.setDate(d.getDate() + 1); }
    return days;
  };
  const requestedDays = calcDays();

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/leave-requests", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/leave-requests"] });
      qc.invalidateQueries({ queryKey: ["/api/leave-balances"] });
      toast({ title: "Leave request submitted" });
      onOpenChange(false);
      setForm({ leaveTypeId: "", startDate: today, endDate: today, isHalfDay: false, reason: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Apply for Leave</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Leave Type *</label>
            <Select value={form.leaveTypeId} onValueChange={(v) => setForm((f) => ({ ...f, leaveTypeId: v }))}>
              <SelectTrigger className="mt-1" data-testid="select-leave-type"><SelectValue placeholder="Select leave type" /></SelectTrigger>
              <SelectContent>
                {leaveTypes.map((lt) => {
                  const bal = leaveBalances.find((b) => b.leaveTypeId === lt.id);
                  const avail = parseFloat(bal?.closingBalance || "0");
                  return (
                    <SelectItem key={lt.id} value={lt.id}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: lt.color }} />
                        <span>{lt.name}</span>
                        {avail > 0 && <span className="text-xs text-muted-foreground">({avail}d avail.)</span>}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {selectedLT && balance && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Info className="h-3 w-3" /> Available: {availableDays} days</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Start Date *</label>
              <div className="mt-1">
                <DateField value={parseYmd(form.startDate)} onChange={(d) => setForm((f) => ({ ...f, startDate: format(d, "yyyy-MM-dd"), endDate: f.endDate && f.endDate < format(d, "yyyy-MM-dd") ? format(d, "yyyy-MM-dd") : f.endDate }))} disabled={{ before: startOfDay(new Date()) }} testId="input-start-date" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">End Date *</label>
              <div className="mt-1">
                {form.isHalfDay ? (
                  <Button type="button" variant="outline" disabled className="w-full justify-start font-normal">
                    <Calendar className="h-4 w-4 mr-2 text-muted-foreground" /> {form.startDate ? format(parseYmd(form.startDate)!, "EEE, d MMM yyyy") : "Same day"}
                  </Button>
                ) : (
                  <DateField value={parseYmd(form.endDate)} onChange={(d) => setForm((f) => ({ ...f, endDate: format(d, "yyyy-MM-dd") }))} disabled={{ before: startOfDay(parseYmd(form.startDate) || new Date()) }} testId="input-end-date" />
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="half-day" checked={form.isHalfDay} onChange={(e) => setForm((f) => ({ ...f, isHalfDay: e.target.checked }))} className="rounded" data-testid="checkbox-half-day" />
            <label htmlFor="half-day" className="text-sm">Half Day</label>
          </div>

          {requestedDays > 0 && (
            <div className="p-3 rounded-lg bg-muted text-sm">
              <span className="font-medium">Duration: </span>
              {requestedDays} {requestedDays === 1 ? "day" : "days"}
              {selectedLT?.isPaid && requestedDays > availableDays && (
                <p className="text-[#FF6F62] text-xs mt-1">Insufficient balance! Available: {availableDays}d, Requested: {requestedDays}d</p>
              )}
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Reason</label>
            <Textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Optional: provide reason for leave..." className="mt-1" data-testid="textarea-leave-reason" />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={() => mutation.mutate({
                employeeId, leaveTypeId: form.leaveTypeId, startDate: form.startDate,
                endDate: form.isHalfDay ? form.startDate : form.endDate, totalDays: requestedDays.toString(),
                isHalfDay: form.isHalfDay, reason: form.reason, year: new Date(form.startDate).getFullYear(),
              })}
              disabled={mutation.isPending || !form.leaveTypeId || requestedDays === 0}
              data-testid="button-submit-leave"
            >
              {mutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===================== Leave Policy (view + super-admin edit) =====================
function PolicyCard({ lt, editing }: { lt: any; editing: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [draft, setDraft] = useState({
    name: lt.name ?? "",
    isPaid: !!lt.isPaid,
    maxDaysPerYear: String(lt.maxDaysPerYear ?? 0),
    maxDaysPerRequest: String(lt.maxDaysPerRequest ?? 0),
    isCarryForward: !!lt.isCarryForward,
    maxCarryForwardDays: String(lt.maxCarryForwardDays ?? 0),
    isEncashable: !!lt.isEncashable,
    description: lt.description ?? "",
  });

  const save = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/leave-types/${lt.id}`, {
      name: draft.name,
      isPaid: draft.isPaid,
      maxDaysPerYear: Number(draft.maxDaysPerYear) || 0,
      maxDaysPerRequest: Number(draft.maxDaysPerRequest) || 0,
      isCarryForward: draft.isCarryForward,
      maxCarryForwardDays: Number(draft.maxCarryForwardDays) || 0,
      isEncashable: draft.isEncashable,
      description: draft.description,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/leave-types"] });
      toast({ title: "Leave policy updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!editing) {
    return (
      <Card className="border-0"><CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: lt.color }} />
            <span className="text-sm font-medium text-foreground truncate">{lt.name}</span>
            <Badge className={`text-[10px] ${lt.isPaid ? "bg-[#4BDCD9]/25 text-[#206295]" : "bg-[#6A7366]/15 text-[#6A7366]"}`}>{lt.isPaid ? "Paid" : "Unpaid"}</Badge>
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

  return (
    <Card className="border-0"><CardContent className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: lt.color }} />
        <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="h-9 flex-1" />
        <span className="text-xs text-muted-foreground flex-shrink-0">{lt.code}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-muted-foreground">Max days / year</label><Input type="number" value={draft.maxDaysPerYear} onChange={(e) => setDraft((d) => ({ ...d, maxDaysPerYear: e.target.value }))} className="h-9 mt-1" /></div>
        <div><label className="text-xs text-muted-foreground">Max days / request</label><Input type="number" value={draft.maxDaysPerRequest} onChange={(e) => setDraft((d) => ({ ...d, maxDaysPerRequest: e.target.value }))} className="h-9 mt-1" /></div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <label className="flex items-center gap-2 text-sm"><Switch checked={draft.isPaid} onCheckedChange={(c) => setDraft((d) => ({ ...d, isPaid: c }))} /> Paid</label>
        <label className="flex items-center gap-2 text-sm"><Switch checked={draft.isCarryForward} onCheckedChange={(c) => setDraft((d) => ({ ...d, isCarryForward: c }))} /> Carry forward</label>
        {draft.isCarryForward && (
          <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">Max CF days</span><Input type="number" value={draft.maxCarryForwardDays} onChange={(e) => setDraft((d) => ({ ...d, maxCarryForwardDays: e.target.value }))} className="h-9 w-20" /></div>
        )}
        <label className="flex items-center gap-2 text-sm"><Switch checked={draft.isEncashable} onCheckedChange={(c) => setDraft((d) => ({ ...d, isEncashable: c }))} /> Encashable</label>
      </div>
      <div><label className="text-xs text-muted-foreground">Description</label><Textarea rows={2} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} className="mt-1" /></div>
      <div className="flex justify-end">
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending} data-testid={`button-save-policy-${lt.id}`}>{save.isPending ? "Saving…" : "Save"}</Button>
      </div>
    </CardContent></Card>
  );
}

function LeavePolicyDialog({ open, onOpenChange, leaveTypes, canEdit }: { open: boolean; onOpenChange: (v: boolean) => void; leaveTypes: any[]; canEdit: boolean; }) {
  const [editing, setEditing] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setEditing(false); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle>Leave Policy</DialogTitle>
            {canEdit && (
              <Button variant="secondary" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => setEditing((e) => !e)} aria-label={editing ? "Done editing" : "Edit policy"} data-testid="button-edit-policy">
                {editing ? <CheckCircle2 className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </DialogHeader>
        {canEdit && editing && <p className="text-xs text-muted-foreground -mt-1">Editing applies company-wide for all employees.</p>}
        <div className="space-y-3">
          {leaveTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leave types configured.</p>
          ) : leaveTypes.map((lt) => <PolicyCard key={lt.id} lt={lt} editing={canEdit && editing} />)}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===================== Request row (team / all / ledger tabs) =====================
function LeaveRequestRow({ request, leaveTypes, employees, onApprove, onReject, onCancel, canApprove, isMine }: any) {
  const lt = leaveTypes.find((l: any) => l.id === request.leaveTypeId);
  const emp = employees.find((e: any) => e.id === request.employeeId);
  const sc = statusConfig[request.status] || statusConfig.pending;
  const c = avatarColor(request.employeeId);
  return (
    <div className="flex items-start gap-3 py-3" data-testid={`leave-request-${request.id}`}>
      <Avatar className="h-8 w-8 flex-shrink-0"><AvatarFallback className="text-xs" style={{ backgroundColor: `${c}26`, color: c }}>{emp ? `${emp.firstName[0]}${emp.lastName[0]}` : "?"}</AvatarFallback></Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className="text-sm font-medium text-foreground">{emp ? `${emp.firstName} ${emp.lastName}` : "You"}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {lt && <span className="text-xs flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: lt.color }} />{lt.name}</span>}
              <span className="text-xs text-muted-foreground">
                {format(new Date(request.startDate), "MMM d")}
                {request.startDate !== request.endDate && ` - ${format(new Date(request.endDate), "MMM d, yyyy")}`}
                {request.startDate === request.endDate && `, ${format(new Date(request.startDate), "yyyy")}`}
              </span>
              <span className="text-xs text-muted-foreground">· {request.totalDays}d</span>
            </div>
            {request.reason && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">"{request.reason}"</p>}
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${sc.bg} ${sc.text}`}>{sc.label}</Badge>
            {canApprove && request.status === "pending" && (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 text-[#FF6F62] border-[#FF6F62]/30 text-xs px-2" onClick={() => onReject(request.id)} data-testid={`button-reject-leave-${request.id}`}>Reject</Button>
                <Button size="sm" className="h-7 text-xs px-2" onClick={() => onApprove(request.id)} data-testid={`button-approve-leave-${request.id}`}>Approve</Button>
              </div>
            )}
            {isMine && request.status === "pending" && (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => onCancel(request.id)}>Cancel</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LeavePage() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const emp = auth?.employee;
  const { toast } = useToast();
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();

  const [showApply, setShowApply] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  // Deep-link support: /leave?action=apply (used by the dashboard's Apply Leave button) opens the form.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("action") === "apply") setShowApply(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [activeTab, setActiveTab] = useState("my-leaves");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: leaveRequests = [], isLoading: lrLoading } = useQuery<any[]>({ queryKey: ["/api/leave-requests"] });
  const { data: leaveTypes = [] } = useQuery<any[]>({ queryKey: ["/api/leave-types"] });
  const { data: leaveBalances = [] } = useQuery<any[]>({
    queryKey: emp ? [`/api/leave-balances?employeeId=${emp.id}&year=${selectedYear}`] : [],
    enabled: !!emp,
  });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: ledger = [] } = useQuery<any[]>({
    queryKey: emp ? [`/api/leave-ledger?employeeId=${emp.id}`] : [],
    enabled: !!emp,
  });

  const myLeaveRequests = leaveRequests.filter((r: any) => r.employeeId === emp?.id);
  const teamRequests = leaveRequests.filter((r: any) => r.employeeId !== emp?.id && r.status === "pending");

  const reqYear = (r: any) => r.year ?? new Date(r.startDate).getFullYear();
  const myYear = myLeaveRequests.filter((r: any) => reqYear(r) === selectedYear);
  const filteredMy = myYear.filter((r: any) => {
    const lt = leaveTypes.find((l: any) => l.id === r.leaveTypeId);
    const matchSearch = !search || (lt?.name || "").toLowerCase().includes(search.toLowerCase()) || (r.reason || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    const matchType = typeFilter === "all" || r.leaveTypeId === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  // overview metrics
  const clType = leaveTypes.find((l: any) => /casual/i.test(l.name || "") || (l.code || "").toUpperCase() === "CL");
  const clBalance = parseFloat(leaveBalances.find((b: any) => b.leaveTypeId === clType?.id)?.closingBalance || "0");
  const pendingCount = myYear.filter((r: any) => r.status === "pending").length;
  const approvedDays = myYear.filter((r: any) => r.status === "approved").reduce((sum: number, r: any) => sum + parseFloat(r.totalDays || "0"), 0);
  const rejectedCount = myYear.filter((r: any) => r.status === "rejected").length;

  const canCancel = (r: any) => r.status === "pending" || (r.status === "approved" && new Date(r.startDate) > new Date());

  const updateLeave = useMutation({
    mutationFn: ({ id, status }: any) => apiRequest("PUT", `/api/leave-requests/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/leave-requests"] });
      qc.invalidateQueries({ queryKey: ["/api/leave-balances"] });
      // Approved/cancelled leave changes the attendance calendar — refresh it too.
      qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/attendance") });
      toast({ title: "Leave request updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];
  const tabs = [
    { key: "my-leaves", label: "My Requests" },
    ...((isHR(user!) || isManager(user!)) ? [{ key: "team-leaves", label: "Team Requests", badge: teamRequests.length }] : []),
    { key: "ledger", label: "Leave Ledger" },
    ...(isHR(user!) ? [{ key: "all-requests", label: "All Requests" }] : []),
  ] as { key: string; label: string; badge?: number }[];

  return (
    <div className="p-6 space-y-6 max-w-[92rem] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leave Management</h1>
          <p className="text-sm text-muted-foreground">Manage leave requests, balances, approvals &amp; team availability</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-32" data-testid="select-leave-year"><Calendar className="h-4 w-4 mr-1 text-muted-foreground" /><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <div className="h-10 w-px bg-border mx-1" />
          <Button variant="secondary" size="sm" onClick={() => setShowPolicy(true)} data-testid="button-leave-policy"><FileText className="h-4 w-4 mr-1" /> Leave Policy</Button>
          <Button size="sm" onClick={() => setShowApply(true)} data-testid="button-apply-leave"><Plus className="h-4 w-4 mr-1" /> Apply Leave</Button>
        </div>
      </div>

      {!emp && <p className="text-sm text-muted-foreground italic" data-testid="text-no-emp-profile">No employee profile linked to your account.</p>}

      {/* Tab buttons */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <Button key={t.key} size="sm" variant={activeTab === t.key ? "default" : "secondary"} onClick={() => setActiveTab(t.key)} data-testid={`tab-${t.key}`}>
            {t.label}
            {t.badge ? <Badge className="ml-1.5 bg-[#FFA962]/20 text-[#FFA962] text-xs">{t.badge}</Badge> : null}
          </Button>
        ))}
      </div>

      {/* ===== My Requests ===== */}
      {activeTab === "my-leaves" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Leave Balance" value={clBalance} subtitle="casual leave available" icon={Plane} color="bg-[#4BDCD9]/25 text-[#206295]" />
            <StatCard title="Pending Requests" value={pendingCount} subtitle="awaiting approval" icon={Clock} color="bg-[#206295]/15 text-[#206295]" />
            <StatCard title="Approved This Year" value={approvedDays} subtitle={`days taken in ${selectedYear}`} icon={CheckCircle2} color="bg-[#4BDCD9]/25 text-[#206295]" />
            <StatCard title="Rejected Requests" value={rejectedCount} subtitle={`in ${selectedYear}`} icon={XCircle} color="bg-[#FF6F62]/20 text-[#FF6F62]" />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by leave type or reason..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-leave" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36" data-testid="select-status-filter"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40" data-testid="select-type-filter"><SelectValue placeholder="Leave Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {leaveTypes.map((lt: any) => <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Card className="border-0"><CardContent className="p-0">
            {lrLoading ? (
              <div className="p-4"><Skeleton className="h-32 w-full" /></div>
            ) : filteredMy.length === 0 ? (
              <div className="text-center py-12">
                <Plane className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">{myYear.length === 0 ? "No leave requests yet" : "No requests match your filters"}</p>
                {myYear.length === 0 && <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowApply(true)}>Apply for Leave</Button>}
              </div>
            ) : (
              <DataTable
                columns={[
                  { key: "type", header: "Leave Type", render: (r: any) => { const lt = leaveTypes.find((l: any) => l.id === r.leaveTypeId); return <span className="flex items-center gap-1.5 text-foreground"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: lt?.color || "#206295" }} />{lt?.name || "—"}</span>; } },
                  { key: "dates", header: "Dates", cellClassName: "text-muted-foreground", render: (r: any) => <>{format(new Date(r.startDate), "MMM d")}{r.startDate !== r.endDate ? ` – ${format(new Date(r.endDate), "MMM d, yyyy")}` : `, ${format(new Date(r.startDate), "yyyy")}`}</> },
                  { key: "days", header: "Days", cellClassName: "text-muted-foreground", render: (r: any) => `${r.totalDays}d` },
                  { key: "reason", header: "Reason", cellClassName: "text-muted-foreground max-w-[16rem] truncate", render: (r: any) => r.reason || "—" },
                  { key: "status", header: "Status", render: (r: any) => { const sc = statusConfig[r.status] || statusConfig.pending; return <Badge className={`text-xs ${sc.bg} ${sc.text}`}>{sc.label}</Badge>; } },
                  { key: "action", header: "Action", align: "right", render: (r: any) => canCancel(r) ? <Button size="sm" variant="outline" className="h-7 text-xs text-[#FF6F62] border-[#FF6F62]/30" onClick={() => updateLeave.mutate({ id: r.id, status: "cancelled" })} data-testid={`button-cancel-leave-${r.id}`}>Cancel</Button> : <span className="text-xs text-muted-foreground">—</span> },
                ]}
                rows={filteredMy}
                getRowKey={(r: any) => r.id}
                testIdPrefix="leave-row"
              />
            )}
          </CardContent></Card>
        </div>
      )}

      {/* ===== Team Requests ===== */}
      {activeTab === "team-leaves" && (isHR(user!) || isManager(user!)) && (
        <Card className="border-0">
          <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Team Leave Requests</CardTitle></CardHeader>
          <CardContent>
            {teamRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No pending team leave requests</div>
            ) : (
              <div className="list-divider">
                {teamRequests.map((req: any) => (
                  <LeaveRequestRow key={req.id} request={req} leaveTypes={leaveTypes} employees={employees} canApprove={user?.role === "super_admin" || user?.role === "manager"}
                    onApprove={(id: string) => updateLeave.mutate({ id, status: "approved" })}
                    onReject={(id: string) => updateLeave.mutate({ id, status: "rejected" })} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===== Leave Ledger ===== */}
      {activeTab === "ledger" && (
        <Card className="border-0">
          <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Leave Ledger</CardTitle></CardHeader>
          <CardContent>
            {ledger.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No ledger entries</div>
            ) : (
              <div className="list-divider">
                {ledger.map((entry: any) => {
                  const lt = leaveTypes.find((l: any) => l.id === entry.leaveTypeId);
                  const isPositive = entry.transactionType !== "debit";
                  const accent = isPositive ? "#206295" : "#FF6F62";
                  return (
                    <div key={entry.id} className="flex items-center gap-3 py-2.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-foreground capitalize">{entry.transactionType}</span>
                          {lt && <span className="text-xs text-muted-foreground">· {lt.name}</span>}
                        </div>
                        {entry.notes && <p className="text-xs text-muted-foreground">{entry.notes}</p>}
                        <p className="text-xs text-muted-foreground">{format(new Date(entry.createdAt), "MMM d, yyyy")}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold" style={{ color: accent }}>{isPositive ? "+" : "-"}{Math.abs(parseFloat(entry.days))}d</p>
                        <p className="text-xs text-muted-foreground">Bal: {parseFloat(entry.balanceAfter)}d</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===== All Requests ===== */}
      {activeTab === "all-requests" && isHR(user!) && (
        <Card className="border-0">
          <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">All Leave Requests</CardTitle></CardHeader>
          <CardContent>
            {leaveRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No leave requests</div>
            ) : (
              <div className="list-divider">
                {leaveRequests.map((req: any) => (
                  <LeaveRequestRow key={req.id} request={req} leaveTypes={leaveTypes} employees={employees} canApprove={(user?.role === "super_admin" || user?.role === "manager") && req.status === "pending"}
                    onApprove={(id: string) => updateLeave.mutate({ id, status: "approved" })}
                    onReject={(id: string) => updateLeave.mutate({ id, status: "rejected" })} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ApplyLeaveDialog open={showApply} onOpenChange={setShowApply} employeeId={emp?.id} leaveTypes={leaveTypes} leaveBalances={leaveBalances} />
      <LeavePolicyDialog open={showPolicy} onOpenChange={setShowPolicy} leaveTypes={leaveTypes} canEdit={user?.role === "super_admin"} />
    </div>
  );
}
