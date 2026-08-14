import { useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, isHR } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { usePaged, PaginationBar } from "@/components/pagination";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  Search, Users, Briefcase, Building2, UserPlus, CheckCircle2, X, MapPin, Calendar,
  Download, Upload, BarChart3, LayoutGrid, Table as TableIcon, Pencil,
  Cake, Gift, ClipboardCheck, CheckSquare, MousePointerClick,
  HeartHandshake, Sparkles,
} from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { exportXlsx } from "@/lib/export-xlsx";
import { DateRangePicker, type DateRange } from "@/components/date-range-picker";

// ---- constants ----
const EMP_TYPES = [
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "intern", label: "Intern" },
  { value: "contract", label: "Contract" },
];
const EMP_STATUSES = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "on_notice", label: "On Notice" },
  { value: "exited", label: "Exited" },
];
const GENDERS = [{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }];
const SYSTEM_ROLES = [
  { value: "employee", label: "Employee" },
  { value: "manager", label: "Manager" },
  { value: "hr_executive", label: "HR Executive" },
  { value: "hr_admin", label: "HR Admin" },
  { value: "hr_ops", label: "HR Ops" },
  { value: "recruiter", label: "Recruiter" },
  { value: "interviewer", label: "Interviewer" },
  { value: "office_admin", label: "Office Admin" },
  { value: "finance", label: "Finance" },
  { value: "ceo_approver", label: "CEO Approver" },
  { value: "super_admin", label: "Super Admin" },
];
const MARITAL = [{ value: "single", label: "Single" }, { value: "married", label: "Married" }, { value: "divorced", label: "Divorced" }, { value: "widowed", label: "Widowed" }];
const typeLabel = (v: string) => EMP_TYPES.find((t) => t.value === v)?.label || v;
const INSIGHT_COLORS = ["#206295", "#4BDCD9", "#425B8D", "#FFA962", "#FF6F62", "#6A7366", "#94A3B8", "#2F80B8"];

// Active state for department tabs & view toggle (requested radial gradient)
const ACTIVE_TAB_STYLE = {
  background: "radial-gradient(182.45% 121.27% at 94.92% 136.33%, #36C 0%, #031887 57.08%, #000623 100%)",
  border: "1px solid rgba(0, 0, 0, 0.10)",
};

// Default-avatar shades — main brand colors only (stable per employee, picked deterministically)
const AVATAR_PALETTE = ["#206295", "#4BDCD9", "#FF6F62"];
function avatarColor(seed?: string) {
  const s = seed || "";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

// Brand-color status chips (teal / grey / orange / coral) — no green
const statusColors: Record<string, string> = {
  active: "bg-[#4BDCD9]/25 text-[#206295] dark:text-[#4BDCD9]",
  inactive: "bg-[#6A7366]/15 text-[#6A7366] dark:text-[#9aa39a]",
  on_notice: "bg-[#FFA962]/25 text-[#FFA962]",
  exited: "bg-[#FF6F62]/20 text-[#FF6F62]",
};

const LOCATIONS_KEY = "emo_custom_locations";
function loadLocations(): string[] {
  try { const r = localStorage.getItem(LOCATIONS_KEY); return r ? (JSON.parse(r) as string[]) : []; } catch { return []; }
}
function makeDeptCode(name: string, departments: any[]): string {
  const existing = new Set(departments.map((d) => (d.code || "").toUpperCase()));
  const base = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 4) || "DEPT";
  let code = base, i = 1;
  while (existing.has(code)) code = `${base}${i++}`;
  return code;
}
function initials(f?: string, l?: string) { return `${f?.[0] ?? ""}${l?.[0] ?? ""}`.toUpperCase() || "?"; }
function daysUntilAnnual(dateStr?: string) {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr); if (isNaN(+d)) return Infinity;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.round((+next - +today) / 86400000);
}
function daysUntilDate(dateStr?: string) {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr); if (isNaN(+d)) return Infinity;
  d.setHours(0, 0, 0, 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((+d - +t) / 86400000);
}

// A celebration happening *today* for this employee (birthday > anniversary > farewell).
type TodayEvent = { kind: "birthday" | "anniversary" | "farewell"; label: string; tint: string; icon: any };
function todayEvent(e: any): TodayEvent | null {
  if (e.dateOfBirth && daysUntilAnnual(e.dateOfBirth) === 0) return { kind: "birthday", label: "Birthday", tint: "#FF6F62", icon: Cake };
  if (e.joinDate && daysUntilAnnual(e.joinDate) === 0) {
    const yrs = new Date().getFullYear() - new Date(e.joinDate).getFullYear();
    if (yrs >= 1) return { kind: "anniversary", label: `${yrs}-Year Anniversary`, tint: "#FFA962", icon: Gift };
  }
  if (e.lastWorkingDate && daysUntilDate(e.lastWorkingDate) === 0) return { kind: "farewell", label: "Farewell", tint: "#6A7366", icon: HeartHandshake };
  return null;
}

const ADD_NEW = "__add_new__";
function SelectWithAddNew({ value, onChange, options, placeholder, onCreate, testId }: {
  value?: string; onChange: (v: string) => void; options: { value: string; label: string }[];
  placeholder?: string; onCreate: (name: string) => Promise<string> | string; testId?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function create() {
    const name = text.trim(); if (!name) return;
    setBusy(true);
    try { const v = await onCreate(name); onChange(v); setText(""); setAdding(false); } finally { setBusy(false); }
  }
  if (adding) {
    return (
      <div className="space-y-2">
        <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } }} placeholder="Type a new name…" data-testid={testId ? `${testId}-new-input` : undefined} />
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={create} disabled={busy}>{busy ? "Creating…" : "Create"}</Button>
          <Button type="button" size="icon" variant="outline" className="h-10 w-10 flex-shrink-0" onClick={() => { setAdding(false); setText(""); }} aria-label="Cancel"><X className="h-4 w-4" /></Button>
        </div>
      </div>
    );
  }
  return (
    <Select value={value} onValueChange={(v) => (v === ADD_NEW ? setAdding(true) : onChange(v))}>
      <SelectTrigger data-testid={testId}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        <SelectItem value={ADD_NEW} className="text-primary font-medium border-t border-border mt-1">+ Add New</SelectItem>
      </SelectContent>
    </Select>
  );
}

// ===================== Employee form (Add + Edit, all DB fields) =====================
const emptyForm = {
  firstName: "", lastName: "", email: "", phone: "", dateOfBirth: "", gender: "", maritalStatus: "",
  joinDate: new Date().toISOString().split("T")[0], confirmationDate: "", employmentType: "full_time", employmentStatus: "active",
  departmentId: "", designationId: "", managerId: "", workLocation: "", noticePeriodDays: "", probationDays: "", systemRole: "employee",
  panNumber: "", aadhaarMasked: "", uan: "", pfEligible: true, esiEligible: false,
  bankName: "", bankAccountMasked: "", ifscCode: "", currentAddress: "", permanentAddress: "",
  emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelation: "",
};
const formSchema = z.object({
  firstName: z.string().min(1, "Required"), lastName: z.string().min(1, "Required"), email: z.string().email("Valid email required"),
  phone: z.string().optional(), dateOfBirth: z.string().optional(), gender: z.string().optional(), maritalStatus: z.string().optional(),
  joinDate: z.string().min(1, "Required"), confirmationDate: z.string().optional(), employmentType: z.string(), employmentStatus: z.string(),
  departmentId: z.string().optional(), designationId: z.string().optional(), managerId: z.string().optional(), workLocation: z.string().optional(), systemRole: z.string().optional(),
  noticePeriodDays: z.string().optional(), probationDays: z.string().optional(),
  panNumber: z.string().optional(), aadhaarMasked: z.string().optional(), uan: z.string().optional(),
  pfEligible: z.boolean(), esiEligible: z.boolean(),
  bankName: z.string().optional(), bankAccountMasked: z.string().optional(), ifscCode: z.string().optional(),
  currentAddress: z.string().optional(), permanentAddress: z.string().optional(),
  emergencyContactName: z.string().optional(), emergencyContactPhone: z.string().optional(), emergencyContactRelation: z.string().optional(),
});
type EmployeeFormValues = z.infer<typeof formSchema>;

function cleanPayload(data: EmployeeFormValues) {
  const p: any = {};
  Object.entries(data).forEach(([k, v]) => { if (v !== "" && v !== undefined && v !== null) p[k] = v; });
  if (p.noticePeriodDays) p.noticePeriodDays = Number(p.noticePeriodDays);
  if (p.probationDays) p.probationDays = Number(p.probationDays);
  return p;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      {children}
    </div>
  );
}

export function EmployeeFormDialog({ open, onOpenChange, employee, departments, designations, employees, knownLocations }: {
  open: boolean; onOpenChange: (v: boolean) => void; employee?: any;
  departments: any[]; designations: any[]; employees: any[]; knownLocations: string[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: auth } = useAuth();
  const viewerRole = auth?.user?.role;
  const canManageRoles = !!auth?.user && (viewerRole === "super_admin" || isHR(auth.user));
  const roleOptions = SYSTEM_ROLES.filter((r) => r.value !== "super_admin" || viewerRole === "super_admin");
  const isEdit = !!employee;
  const [created, setCreated] = useState<{ name: string; email: string } | null>(null);
  const [customLocations, setCustomLocations] = useState<string[]>(() => loadLocations());
  const locations = Array.from(new Set([...knownLocations, ...customLocations]));
  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(formSchema),
    values: employee ? {
      ...emptyForm,
      ...Object.fromEntries(Object.keys(emptyForm).map((k) => [k, (employee as any)[k] ?? (emptyForm as any)[k]])),
      noticePeriodDays: employee.noticePeriodDays != null ? String(employee.noticePeriodDays) : "",
      probationDays: employee.probationDays != null ? String(employee.probationDays) : "",
      pfEligible: employee.pfEligible ?? true, esiEligible: employee.esiEligible ?? false,
    } as EmployeeFormValues : emptyForm,
  });

  const mutation = useMutation({
    mutationFn: (data: EmployeeFormValues) => {
      const payload = cleanPayload(data);
      return isEdit ? apiRequest("PUT", `/api/employees/${employee.id}`, payload) : apiRequest("POST", "/api/employees", payload);
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/employees") });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      if (isEdit) { toast({ title: "Employee updated" }); onOpenChange(false); }
      else setCreated({ name: `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim() || "The employee", email: data.email });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (created) {
    return (
      <Dialog open={open} onOpenChange={() => { setCreated(null); form.reset(emptyForm); onOpenChange(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Employee Created</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">Employee account created successfully.</p>
                <p className="text-sm text-muted-foreground mt-1">They can now log in using their company Google account.</p>
                <p className="text-xs text-muted-foreground mt-2">{created.name} · {created.email}</p>
              </div>
            </div>
            <Button className="w-full" onClick={() => { setCreated(null); form.reset(emptyForm); onOpenChange(false); }}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const managerOptions = employees.filter((e) => e.id !== employee?.id).map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }));
  const T = (props: any) => <FormControl><Input {...props} /></FormControl>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Edit Employee" : "Add New Employee"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
            <Section title="Personal">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name *</FormLabel>{T({ ...field })}<FormMessage /></FormItem>)} />
                <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Last Name *</FormLabel>{T({ ...field })}<FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email *</FormLabel>{T({ ...field, type: "email" })}<FormMessage /></FormItem>)} />
                <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel>{T({ ...field })}<FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="dateOfBirth" render={({ field }) => (<FormItem><FormLabel>Date of Birth</FormLabel>{T({ ...field, type: "date" })}</FormItem>)} />
                <FormField control={form.control} name="gender" render={({ field }) => (<FormItem><FormLabel>Gender</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger></FormControl><SelectContent>{GENDERS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                <FormField control={form.control} name="maritalStatus" render={({ field }) => (<FormItem><FormLabel>Marital Status</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger></FormControl><SelectContent>{MARITAL.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select></FormItem>)} />
              </div>
            </Section>

            <Section title="Employment">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="joinDate" render={({ field }) => (<FormItem><FormLabel>Join Date *</FormLabel>{T({ ...field, type: "date" })}<FormMessage /></FormItem>)} />
                <FormField control={form.control} name="confirmationDate" render={({ field }) => (<FormItem><FormLabel>Confirmation Date</FormLabel>{T({ ...field, type: "date" })}</FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="departmentId" render={({ field }) => (<FormItem><FormLabel>Department</FormLabel><SelectWithAddNew value={field.value} onChange={field.onChange} placeholder="Select department" testId="select-department" options={departments.map((d) => ({ value: d.id, label: d.name }))} onCreate={async (name) => { const code = makeDeptCode(name, departments); const dept: any = await apiRequest("POST", "/api/departments", { name, code }); await qc.invalidateQueries({ queryKey: ["/api/departments"] }); return dept.id; }} /></FormItem>)} />
                <FormField control={form.control} name="designationId" render={({ field }) => (<FormItem><FormLabel>Designation</FormLabel><SelectWithAddNew value={field.value} onChange={field.onChange} placeholder="Select designation" testId="select-designation" options={designations.map((d) => ({ value: d.id, label: d.name }))} onCreate={async (name) => { const desig: any = await apiRequest("POST", "/api/designations", { name }); await qc.invalidateQueries({ queryKey: ["/api/designations"] }); return desig.id; }} /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="workLocation" render={({ field }) => (<FormItem><FormLabel>Location</FormLabel><SelectWithAddNew value={field.value} onChange={field.onChange} placeholder="Select location" testId="select-location" options={locations.map((l) => ({ value: l, label: l }))} onCreate={(name) => { if (!locations.includes(name)) { const next = [...customLocations, name]; setCustomLocations(next); try { localStorage.setItem(LOCATIONS_KEY, JSON.stringify(next)); } catch {} } return name; }} /></FormItem>)} />
                <FormField control={form.control} name="managerId" render={({ field }) => (<FormItem><FormLabel>Manager</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger></FormControl><SelectContent>{managerOptions.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select></FormItem>)} />
              </div>
              {canManageRoles && (
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="systemRole" render={({ field }) => (<FormItem><FormLabel>System Role</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger data-testid="select-system-role"><SelectValue placeholder="Employee" /></SelectTrigger></FormControl><SelectContent>{roleOptions.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent></Select><p className="text-[11px] text-muted-foreground mt-1">Controls what this person can access in the app.</p></FormItem>)} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="employmentType" render={({ field }) => (<FormItem><FormLabel>Employment Type</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{EMP_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                <FormField control={form.control} name="employmentStatus" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{EMP_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="noticePeriodDays" render={({ field }) => (<FormItem><FormLabel>Notice Period (days)</FormLabel>{T({ ...field, type: "number" })}</FormItem>)} />
                <FormField control={form.control} name="probationDays" render={({ field }) => (<FormItem><FormLabel>Probation (days)</FormLabel>{T({ ...field, type: "number" })}</FormItem>)} />
              </div>
            </Section>

            <Section title="Statutory & Bank">
              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="panNumber" render={({ field }) => (<FormItem><FormLabel>PAN</FormLabel>{T({ ...field })}</FormItem>)} />
                <FormField control={form.control} name="aadhaarMasked" render={({ field }) => (<FormItem><FormLabel>Aadhaar (masked)</FormLabel>{T({ ...field })}</FormItem>)} />
                <FormField control={form.control} name="uan" render={({ field }) => (<FormItem><FormLabel>UAN</FormLabel>{T({ ...field })}</FormItem>)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="bankName" render={({ field }) => (<FormItem><FormLabel>Bank Name</FormLabel>{T({ ...field })}</FormItem>)} />
                <FormField control={form.control} name="bankAccountMasked" render={({ field }) => (<FormItem><FormLabel>Account (masked)</FormLabel>{T({ ...field })}</FormItem>)} />
                <FormField control={form.control} name="ifscCode" render={({ field }) => (<FormItem><FormLabel>IFSC</FormLabel>{T({ ...field })}</FormItem>)} />
              </div>
              <div className="flex items-center gap-6">
                <FormField control={form.control} name="pfEligible" render={({ field }) => (<FormItem className="flex items-center gap-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">PF Eligible</FormLabel></FormItem>)} />
                <FormField control={form.control} name="esiEligible" render={({ field }) => (<FormItem className="flex items-center gap-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">ESI Eligible</FormLabel></FormItem>)} />
              </div>
            </Section>

            <Section title="Address & Emergency">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="currentAddress" render={({ field }) => (<FormItem><FormLabel>Current Address</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="permanentAddress" render={({ field }) => (<FormItem><FormLabel>Permanent Address</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="emergencyContactName" render={({ field }) => (<FormItem><FormLabel>Emergency Name</FormLabel>{T({ ...field })}</FormItem>)} />
                <FormField control={form.control} name="emergencyContactPhone" render={({ field }) => (<FormItem><FormLabel>Emergency Phone</FormLabel>{T({ ...field })}</FormItem>)} />
                <FormField control={form.control} name="emergencyContactRelation" render={({ field }) => (<FormItem><FormLabel>Relation</FormLabel>{T({ ...field })}</FormItem>)} />
              </div>
            </Section>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-employee">
                {mutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Employee"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ===================== Bulk update =====================
function BulkUpdateDialog({ open, onOpenChange, ids, departments, locations, onDone }: {
  open: boolean; onOpenChange: (v: boolean) => void; ids: string[]; departments: any[]; locations: string[]; onDone: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [field, setField] = useState("departmentId");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function apply() {
    if (!value) return;
    setBusy(true);
    try {
      for (const id of ids) await apiRequest("PUT", `/api/employees/${id}`, { [field]: value });
      await qc.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: `Updated ${ids.length} employee${ids.length !== 1 ? "s" : ""}` });
      onDone(); onOpenChange(false);
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Bulk Update · {ids.length} selected</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Field</p>
            <Select value={field} onValueChange={(v) => { setField(v); setValue(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="departmentId">Department</SelectItem>
                <SelectItem value="workLocation">Location</SelectItem>
                <SelectItem value="employmentType">Employment Type</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">New value</p>
            <Select value={value} onValueChange={setValue}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {field === "departmentId" && departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                {field === "workLocation" && locations.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                {field === "employmentType" && EMP_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={apply} disabled={busy || !value}>{busy ? "Updating…" : "Apply"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===================== Import (CSV) =====================
function ImportDialog({ open, onOpenChange, departments, designations }: {
  open: boolean; onOpenChange: (v: boolean) => void; departments: any[]; designations: any[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function parseCSV(text: string) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return [];
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const cells = line.split(",").map((c) => c.trim());
      const o: any = {}; headers.forEach((h, i) => (o[h] = cells[i] || "")); return o;
    });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setFileName(f.name);
    const text = await f.text();
    setRows(parseCSV(text));
  }

  async function doImport() {
    if (!rows.length) return;
    setBusy(true);
    const deptByName = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));
    const desigByName = new Map(designations.map((d) => [d.name.toLowerCase(), d.id]));
    let ok = 0, fail = 0;
    for (const r of rows) {
      const payload: any = {
        firstName: r.firstname || r["first name"], lastName: r.lastname || r["last name"], email: r.email,
        phone: r.phone || undefined, joinDate: r.joindate || r["join date"] || new Date().toISOString().split("T")[0],
        workLocation: r.location || undefined, employmentType: r.employmenttype || r.type || "full_time",
        departmentId: deptByName.get((r.department || "").toLowerCase()),
        designationId: desigByName.get((r.designation || "").toLowerCase()),
      };
      if (!payload.firstName || !payload.lastName || !payload.email) { fail++; continue; }
      try { await apiRequest("POST", "/api/employees", payload); ok++; } catch { fail++; }
    }
    await qc.invalidateQueries({ queryKey: ["/api/employees"] });
    setBusy(false); setRows([]); setFileName(""); if (fileRef.current) fileRef.current.value = "";
    toast({ title: `Imported ${ok} employee${ok !== 1 ? "s" : ""}${fail ? `, ${fail} skipped` : ""}` });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Import Employees</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Upload a <span className="font-medium text-[#206295]">.csv</span> file with columns:
            <span className="font-mono text-xs"> firstName, lastName, email, phone, joinDate, department, designation, location, employmentType</span>.
          </p>
          <label className="flex items-center gap-3 rounded-[16px] border border-border bg-background/60 p-2 cursor-pointer hover-elevate transition-colors">
            <span className="inline-flex items-center rounded-[12px] border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover-elevate transition-colors flex-shrink-0">Choose File</span>
            <span className="text-sm text-muted-foreground truncate">{fileName || "No file chosen"}</span>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" data-testid="input-import-file" />
          </label>
          {rows.length > 0 && <p className="text-sm text-foreground"><span className="font-semibold text-[#206295]">{rows.length}</span> rows detected.</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={doImport} disabled={busy || !rows.length}>{busy ? "Importing…" : `Import ${rows.length || ""}`}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===================== Insights side panel =====================
function InsightsPanel({ open, onOpenChange, employees, departments }: {
  open: boolean; onOpenChange: (v: boolean) => void; employees: any[]; departments: any[];
}) {
  const deptData = departments.map((d) => ({ name: d.name, value: employees.filter((e) => e.departmentId === d.id).length })).filter((d) => d.value > 0);
  const locMap = new Map<string, number>();
  employees.forEach((e) => { if (e.workLocation) locMap.set(e.workLocation, (locMap.get(e.workLocation) || 0) + 1); });
  const locData = Array.from(locMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const maxLoc = Math.max(1, ...locData.map((l) => l.value));
  // Tenure / years-of-service buckets (from join date)
  const tenureNow = Date.now();
  const yearsOfService = (joinDate: string) => (tenureNow - +new Date(joinDate)) / (365.25 * 86400000);
  const tenureBuckets = [
    { name: "<1y", min: 0, max: 1 },
    { name: "1–2y", min: 1, max: 2 },
    { name: "2–3y", min: 2, max: 3 },
    { name: "3–5y", min: 3, max: 5 },
    { name: "5y+", min: 5, max: Infinity },
  ];
  const tenureData = tenureBuckets.map((b) => ({
    name: b.name,
    value: employees.filter((e) => { if (!e.joinDate) return false; const y = yearsOfService(e.joinDate); return y >= b.min && y < b.max; }).length,
  }));
  const hasTenure = tenureData.some((t) => t.value > 0);
  const birthdays = employees.filter((e) => e.dateOfBirth).map((e) => ({ e, d: daysUntilAnnual(e.dateOfBirth) })).filter((x) => x.d <= 45).sort((a, b) => a.d - b.d).slice(0, 8);
  const annivs = employees.filter((e) => e.joinDate).map((e) => ({ e, d: daysUntilAnnual(e.joinDate), yrs: new Date().getFullYear() - new Date(e.joinDate).getFullYear() })).filter((x) => x.d <= 45 && x.yrs >= 1).sort((a, b) => a.d - b.d).slice(0, 8);
  const farewells = employees.filter((e) => e.lastWorkingDate).map((e) => ({ e, d: daysUntilDate(e.lastWorkingDate) })).filter((x) => x.d >= 0 && x.d <= 60).sort((a, b) => a.d - b.d).slice(0, 8);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col gap-0">
        <SheetHeader className="px-6 pt-6 pb-3 flex-shrink-0"><SheetTitle>Workforce Insights</SheetTitle></SheetHeader>
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-4 px-6 pt-2 pb-8">
            <Card className="border-0"><CardContent className="p-4">
              <p className="text-sm font-semibold mb-1 flex items-center gap-2"><Cake className="h-4 w-4 text-muted-foreground" /> Upcoming Birthdays</p>
              {birthdays.length === 0 ? <p className="text-xs text-muted-foreground pt-1">None in the next 45 days</p> : (
                <div className="list-divider">
                  {birthdays.map(({ e, d }) => (
                    <div key={e.id} className="flex items-center gap-2.5 py-2">
                      <Avatar className="h-8 w-8 flex-shrink-0"><AvatarFallback className="text-xs" style={{ backgroundColor: `${avatarColor(e.id)}26`, color: avatarColor(e.id) }}>{initials(e.firstName, e.lastName)}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground truncate">{e.firstName} {e.lastName}</p><p className="text-xs text-[#6A7366]">{format(new Date(e.dateOfBirth), "MMM d")}</p></div>
                      <Badge className="text-[10px] flex-shrink-0 bg-[#FF6F62]/15 text-[#FF6F62]">{d === 0 ? "Today" : `${d}d`}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent></Card>

            <Card className="border-0"><CardContent className="p-4">
              <p className="text-sm font-semibold mb-1 flex items-center gap-2"><Gift className="h-4 w-4 text-muted-foreground" /> Work Anniversaries</p>
              {annivs.length === 0 ? <p className="text-xs text-muted-foreground pt-1">None in the next 45 days</p> : (
                <div className="list-divider">
                  {annivs.map(({ e, d, yrs }) => (
                    <div key={e.id} className="flex items-center gap-2.5 py-2">
                      <Avatar className="h-8 w-8 flex-shrink-0"><AvatarFallback className="text-xs" style={{ backgroundColor: `${avatarColor(e.id)}26`, color: avatarColor(e.id) }}>{initials(e.firstName, e.lastName)}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground truncate">{e.firstName} {e.lastName}</p><p className="text-xs text-[#6A7366]">{yrs} year{yrs !== 1 ? "s" : ""} · {format(new Date(e.joinDate), "MMM d")}</p></div>
                      <Badge className="text-[10px] flex-shrink-0 bg-[#FFA962]/20 text-[#FFA962]">{d === 0 ? "Today" : `${d}d`}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent></Card>

            {farewells.length > 0 && (
              <Card className="border-0"><CardContent className="p-4">
                <p className="text-sm font-semibold mb-1 flex items-center gap-2"><HeartHandshake className="h-4 w-4 text-muted-foreground" /> Farewells</p>
                <div className="list-divider">
                  {farewells.map(({ e, d }) => (
                    <div key={e.id} className="flex items-center gap-2.5 py-2">
                      <Avatar className="h-8 w-8 flex-shrink-0"><AvatarFallback className="text-xs" style={{ backgroundColor: `${avatarColor(e.id)}26`, color: avatarColor(e.id) }}>{initials(e.firstName, e.lastName)}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground truncate">{e.firstName} {e.lastName}</p><p className="text-xs text-[#6A7366]">Last day · {format(new Date(e.lastWorkingDate), "MMM d")}</p></div>
                      <Badge className="text-[10px] flex-shrink-0 bg-[#6A7366]/15 text-[#6A7366]">{d === 0 ? "Today" : `${d}d`}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent></Card>
            )}

            <Card className="border-0"><CardContent className="p-4">
              <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" /> Department Distribution</p>
              {deptData.length === 0 ? <p className="text-xs text-muted-foreground">No data</p> : (
                <div className="flex items-center gap-4">
                  <div className="h-36 w-36 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={deptData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={64} innerRadius={36} paddingAngle={3} cornerRadius={5}>
                          {deptData.map((_, i) => <Cell key={i} fill={INSIGHT_COLORS[i % INSIGHT_COLORS.length]} fillOpacity={0.85} stroke="rgba(255,255,255,0.75)" strokeWidth={2} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {deptData.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style={{ background: INSIGHT_COLORS[i % INSIGHT_COLORS.length] }} />
                        <span className="text-foreground/80 truncate flex-1">{d.name}</span>
                        <span className="font-semibold text-[#206295] flex-shrink-0">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent></Card>

            <Card className="border-0"><CardContent className="p-4">
              <p className="text-sm font-semibold mb-3 flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> Location Distribution</p>
              {locData.length === 0 ? <p className="text-xs text-muted-foreground">No data</p> : (
                <div className="space-y-2.5">
                  {locData.map((l) => (
                    <div key={l.name}>
                      <div className="flex justify-between text-xs mb-1"><span className="text-foreground/80">{l.name}</span><span className="font-semibold text-[#206295]">{l.value}</span></div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(l.value / maxLoc) * 100}%`, background: "#206295" }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent></Card>

            <Card className="border-0"><CardContent className="p-4">
              <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> Tenure Distribution</p>
              {!hasTenure ? <p className="text-xs text-muted-foreground">No data</p> : (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tenureData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: "rgba(32,98,149,0.06)" }} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} formatter={(v: any) => [`${v} employee${v === 1 ? "" : "s"}`, "Tenure"]} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40}>
                        {tenureData.map((_, i) => <Cell key={i} fill={INSIGHT_COLORS[i % INSIGHT_COLORS.length]} fillOpacity={0.9} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent></Card>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ===================== Stat card =====================
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

// ===================== Employee card =====================
function EmployeeCard({ employee, departments, designations, selectionMode, selected, onToggle, event }: {
  employee: any; departments: any[]; designations: any[]; selectionMode: boolean; selected: boolean; onToggle: () => void;
  event?: { label: string; tint: string; icon: any } | null;
}) {
  const [, navigate] = useLocation();
  const desig = designations.find((d) => d.id === employee.designationId);
  const detail = "text-xs text-muted-foreground flex items-center gap-1.5";
  const c = avatarColor(employee.id);
  const onCardClick = () => (selectionMode ? onToggle() : navigate(`/employees/${employee.id}`));
  return (
    <Card
      className={`border-0 card-hover cursor-pointer overflow-hidden ${selected ? "ring-2 ring-primary" : ""}`}
      style={event ? { boxShadow: `0 0 0 1.5px ${event.tint}66` } : undefined}
      onClick={onCardClick}
      data-testid={`employee-card-${employee.id}`}
    >
      {event && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 text-white text-[11px] font-bold uppercase tracking-wide" style={{ background: event.tint }}>
          <event.icon className="h-3.5 w-3.5 celebrate-pop flex-shrink-0" /> {event.label}
        </div>
      )}
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {selectionMode && (
            <Checkbox checked={selected} onClick={(e) => e.stopPropagation()} onCheckedChange={onToggle} className="mt-1" data-testid={`select-${employee.id}`} />
          )}
          <Avatar className="h-10 w-10 flex-shrink-0"><AvatarFallback className="text-sm font-semibold" style={{ backgroundColor: `${c}26`, color: c }}>{initials(employee.firstName, employee.lastName)}</AvatarFallback></Avatar>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{employee.firstName} {employee.lastName}</p>
                <p className="text-xs text-muted-foreground">{employee.employeeCode}</p>
              </div>
              <Badge className={`text-xs flex-shrink-0 ${statusColors[employee.employmentStatus] || statusColors.inactive}`}>{employee.employmentStatus.replace("_", " ")}</Badge>
            </div>
            <p className={detail}>
              <Briefcase className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{desig?.name || "—"}</span>
            </p>
            {employee.workLocation && <p className={detail}><MapPin className="h-3 w-3 flex-shrink-0" /><span className="truncate">{employee.workLocation}</span></p>}
            {employee.joinDate && <p className={detail}><Calendar className="h-3 w-3 flex-shrink-0" /><span className="truncate">{format(new Date(employee.joinDate), "MMM d, yyyy")}</span></p>}
            <div className="pt-1.5">
              <Badge variant="secondary" className="text-[10px]">{typeLabel(employee.employmentType)}</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ===================== Main page =====================
export default function EmployeesPage() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const [, navigate] = useLocation();
  const canManage = isHR(user!);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [deptFilter, setDeptFilter] = useState("all");
  const [locFilter, setLocFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportRange, setExportRange] = useState<DateRange>(() => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }));

  // Department is filtered client-side so the full set stays available for the tab counts
  const empQuery = useQuery<any[]>({
    queryKey: [`/api/employees?status=${statusFilter !== "all" ? statusFilter : ""}&search=${search}&departmentId=`],
  });
  const employees = empQuery.data ?? [];
  const isLoading = empQuery.isLoading;
  const { data: allEmployees = [] } = useQuery<any[]>({ queryKey: ["/api/employees?status=&search=&departmentId="] });
  const { data: departments = [] } = useQuery<any[]>({ queryKey: ["/api/departments"] });
  const { data: designations = [] } = useQuery<any[]>({ queryKey: ["/api/designations"] });

  const allLocations = Array.from(new Set(allEmployees.map((e) => e.workLocation).filter(Boolean))) as string[];
  // client-side Department + Location + Type filtering
  const filtered = employees.filter((e) =>
    (deptFilter === "all" || e.departmentId === deptFilter) &&
    (locFilter === "all" || e.workLocation === locFilter) &&
    (typeFilter === "all" || e.employmentType === typeFilter)
  );
  const displayed = filtered;
  const cardPaged = usePaged(displayed);
  const deptCounts = departments.map((d) => ({ ...d, count: employees.filter((e) => e.departmentId === d.id).length }));

  // overview cards
  const now = new Date();
  const newJoiners = allEmployees.filter((e) => e.joinDate && new Date(e.joinDate).getMonth() === now.getMonth() && new Date(e.joinDate).getFullYear() === now.getFullYear()).length;
  const lastUpdated = empQuery.dataUpdatedAt ? format(new Date(empQuery.dataUpdatedAt), "MMM d, h:mm a") : "—";

  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSel = () => setSelected(new Set());
  const allSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id));
  const toggleAll = () => setSelected((s) => { const n = new Set(s); if (allSelected) filtered.forEach((e) => n.delete(e.id)); else filtered.forEach((e) => n.add(e.id)); return n; });

  function exportRows(rows: any[]) {
    const deptName = (id: string) => departments.find((d) => d.id === id)?.name || "—";
    const desigName = (id: string) => designations.find((d) => d.id === id)?.name || "—";
    const headers = ["Code", "Name", "Email", "Department", "Designation", "Location", "Type", "Join Date", "Status"];
    const data = rows.map((e) => [e.employeeCode, `${e.firstName} ${e.lastName}`, e.email, deptName(e.departmentId), desigName(e.designationId), e.workLocation || "—", typeLabel(e.employmentType), e.joinDate ? format(new Date(e.joinDate), "dd MMM yyyy") : "—", e.employmentStatus]);
    exportXlsx({ filename: `employees-${format(now, "yyyy-MM-dd")}.xlsx`, sheet: "Employees", title: `Employees (${data.length})`, headers, rows: data });
  }

  // Date-wise joiners: everyone whose join date falls in the selected range, exported with every detail.
  const joiners = useMemo(() => {
    if (!exportRange.from) return [] as any[];
    const f = format(exportRange.from, "yyyy-MM-dd"), t = format(exportRange.to ?? exportRange.from, "yyyy-MM-dd");
    return allEmployees.filter((e) => e.joinDate && e.joinDate.slice(0, 10) >= f && e.joinDate.slice(0, 10) <= t)
      .sort((a, b) => a.joinDate.localeCompare(b.joinDate));
  }, [allEmployees, exportRange]);

  function exportJoiners() {
    const deptName = (id: string) => departments.find((d) => d.id === id)?.name || "—";
    const desigName = (id: string) => designations.find((d) => d.id === id)?.name || "—";
    const mgr = (id: string) => { const m = allEmployees.find((x) => x.id === id); return m ? `${m.firstName} ${m.lastName}` : "—"; };
    const fmtD = (d: any) => (d ? format(new Date(d), "dd MMM yyyy") : "");
    const yn = (b: any) => (b ? "Yes" : "No");
    const headers = ["Code", "First Name", "Last Name", "Email", "Phone", "Date of Birth", "Gender", "Marital Status", "Join Date", "Confirmation Date", "Last Working Date", "Notice Period (days)", "Probation (days)", "Type", "Status", "Department", "Designation", "Manager", "Work Location", "PAN", "Aadhaar", "UAN", "PF Eligible", "ESI Eligible", "Bank Name", "Bank A/C", "IFSC", "Current Address", "Permanent Address", "Emergency Contact", "Emergency Phone", "Emergency Relation"];
    const rows = joiners.map((e) => [e.employeeCode, e.firstName, e.lastName, e.email, e.phone || "", fmtD(e.dateOfBirth), e.gender || "", e.maritalStatus || "", fmtD(e.joinDate), fmtD(e.confirmationDate), fmtD(e.lastWorkingDate), e.noticePeriodDays ?? "", e.probationDays ?? "", typeLabel(e.employmentType), e.employmentStatus, deptName(e.departmentId), desigName(e.designationId), mgr(e.managerId), e.workLocation || "", e.panNumber || "", e.aadhaarMasked || "", e.uan || "", yn(e.pfEligible), yn(e.esiEligible), e.bankName || "", e.bankAccountMasked || "", e.ifscCode || "", e.currentAddress || "", e.permanentAddress || "", e.emergencyContactName || "", e.emergencyContactPhone || "", e.emergencyContactRelation || ""]);
    const f = format(exportRange.from!, "dd MMM yyyy"), t = format(exportRange.to ?? exportRange.from!, "dd MMM yyyy");
    const span = f === t ? f : `${f} – ${t}`;
    exportXlsx({ filename: `joiners-${format(exportRange.from!, "yyyy-MM-dd")}.xlsx`, sheet: "Joiners", title: `Joiners · ${span} (${joiners.length})`, headers, rows });
    setShowExport(false);
  }
  const joinPresets = [
    { label: "This week", from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) },
    { label: "This month", from: startOfMonth(now), to: endOfMonth(now) },
    { label: "Last month", from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) },
  ];
  const rangeActive = (p: { from: Date; to: Date }) => !!exportRange.from && format(exportRange.from, "yyyy-MM-dd") === format(p.from, "yyyy-MM-dd") && format(exportRange.to ?? exportRange.from, "yyyy-MM-dd") === format(p.to, "yyyy-MM-dd");
  const spanLabel = exportRange.from
    ? (format(exportRange.from, "yyyy-MM-dd") === format(exportRange.to ?? exportRange.from, "yyyy-MM-dd") ? format(exportRange.from, "dd MMM yyyy") : `${format(exportRange.from, "dd MMM yyyy")} – ${format(exportRange.to!, "dd MMM yyyy")}`)
    : "Pick a date or range";

  const viewButtons: { v: typeof viewMode; icon: any; label: string }[] = [
    { v: "card", icon: LayoutGrid, label: "Card" }, { v: "table", icon: TableIcon, label: "Table" },
  ];
  const exitSelection = () => { setSelectionMode(false); clearSel(); };

  return (
    <div className="p-6 space-y-6 max-w-[92rem] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground">{employees.length} {statusFilter !== "all" ? statusFilter : ""} employee{employees.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground">Last updated: <span className="font-medium text-[#206295]">{lastUpdated}</span></span>
          {canManage && (
            <div className="flex items-center gap-2">
              <div className="h-8 w-px bg-border mx-1" />
              <Button variant="secondary" size="sm" onClick={() => setShowInsights(true)} data-testid="button-insights"><BarChart3 className="h-4 w-4 mr-1" /> View Insights</Button>
              <Button variant="secondary" size="sm" onClick={() => setShowImport(true)} data-testid="button-import"><Upload className="h-4 w-4 mr-1" /> Import</Button>
              <Button variant="secondary" size="sm" onClick={() => setShowExport(true)} data-testid="button-joiners-report"><Download className="h-4 w-4 mr-1" /> Joiners Report</Button>
              <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-employee"><UserPlus className="h-4 w-4 mr-1" /> Add Employee</Button>
            </div>
          )}
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Employees" value={allEmployees.length} subtitle="All records" icon={Users} color="bg-[#206295]/15 text-[#206295]" />
        <StatCard title="Departments" value={departments.length} subtitle="Across the org" icon={Building2} color="bg-[#4BDCD9]/25 text-[#206295]" />
        <StatCard title="Locations" value={allLocations.length} subtitle="Work locations" icon={MapPin} color="bg-[#206295]/15 text-[#206295]" />
        <StatCard title="New Joiners" value={newJoiners} subtitle={format(now, "MMMM yyyy")} icon={ClipboardCheck} color="bg-[#4BDCD9]/25 text-[#206295]" />
      </div>

      {/* Search + filters + view toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, or code..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-employees" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32" data-testid="select-status-filter"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="on_notice">On Notice</SelectItem><SelectItem value="exited">Exited</SelectItem><SelectItem value="all">All Status</SelectItem></SelectContent>
        </Select>
        <Select value={locFilter} onValueChange={setLocFilter}>
          <SelectTrigger className="w-36" data-testid="select-loc-filter"><SelectValue placeholder="Location" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Locations</SelectItem>{allLocations.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36" data-testid="select-type-filter"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Types</SelectItem>{EMP_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex items-center gap-1 segmented-toggle p-1">
          {viewButtons.map((b) => {
            const active = viewMode === b.v;
            return (
              <button key={b.v} onClick={() => setViewMode(b.v)} title={`${b.label} View`} data-testid={`view-mode-${b.v}`}
                className={`flex items-center justify-center h-8 w-10 rounded-[8px] transition-colors ${active ? "text-white" : "text-muted-foreground hover-elevate"}`}
                style={active ? ACTIVE_TAB_STYLE : undefined}>
                <b.icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Department tabs + Select entry */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-2 flex-wrap flex-1">
          <button onClick={() => setDeptFilter("all")} data-testid="filter-dept-all"
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${deptFilter === "all" ? "btn-primary-gradient text-white" : "bg-muted text-muted-foreground border border-border hover-elevate"}`}>
            All Departments ({employees.length})
          </button>
          {deptCounts.filter((d) => d.count > 0).map((d) => (
            <button key={d.id} onClick={() => setDeptFilter(d.id)} data-testid={`filter-dept-${d.id}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${deptFilter === d.id ? "btn-primary-gradient text-white" : "bg-muted text-muted-foreground border border-border hover-elevate"}`}>
              {d.name} ({d.count})
            </button>
          ))}
        </div>
        {!selectionMode && (
          <Button variant="secondary" size="sm" className="flex-shrink-0" onClick={() => setSelectionMode(true)} data-testid="button-select">
            <MousePointerClick className="h-4 w-4 mr-1" /> Select
          </Button>
        )}
      </div>

      {/* Selection bar */}
      {selectionMode && (
        <Card className="border-0"><CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={toggleAll} data-testid="button-select-all"><CheckSquare className="h-4 w-4 mr-1" /> Select All</Button>
            <span className="text-sm font-medium">{selected.size} selected</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={selected.size === 0} onClick={() => exportRows(filtered.filter((e) => selected.has(e.id)))}><Download className="h-4 w-4 mr-1" /> Bulk Export</Button>
            {canManage && <Button variant="secondary" size="sm" disabled={selected.size === 0} onClick={() => setShowBulk(true)}><Pencil className="h-4 w-4 mr-1" /> Bulk Update</Button>}
            <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={exitSelection} aria-label="Exit selection" data-testid="button-exit-selection"><X className="h-4 w-4" /></Button>
          </div>
        </CardContent></Card>
      )}

      {/* Body */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16"><Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" /><h3 className="text-lg font-semibold text-foreground">No employees found</h3><p className="text-sm text-muted-foreground mt-1">Try adjusting your filters</p></div>
      ) : viewMode === "card" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {cardPaged.pageItems.map((emp) => <EmployeeCard key={emp.id} employee={emp} departments={departments} designations={designations} selectionMode={selectionMode} selected={selected.has(emp.id)} onToggle={() => toggleSel(emp.id)} />)}
          </div>
          <PaginationBar page={cardPaged.page} totalPages={cardPaged.totalPages} count={cardPaged.count} size={cardPaged.size} onPage={cardPaged.setPage} />
        </div>
      ) : (
        <Card className="border-0"><CardContent className="p-0">
          <DataTable
            columns={[
              ...(selectionMode ? [{ key: "__sel", header: <Checkbox checked={allSelected} onCheckedChange={toggleAll} />, render: (e: any) => <Checkbox checked={selected.has(e.id)} onClick={(ev: any) => ev.stopPropagation()} onCheckedChange={() => toggleSel(e.id)} /> }] as DataTableColumn<any>[] : []),
              { key: "name", header: "Name", render: (e: any) => <div className="flex items-center gap-2"><Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]" style={{ backgroundColor: `${avatarColor(e.id)}26`, color: avatarColor(e.id) }}>{initials(e.firstName, e.lastName)}</AvatarFallback></Avatar><div><p className="font-medium text-foreground">{e.firstName} {e.lastName}</p><p className="text-xs text-muted-foreground">{e.employeeCode}</p></div></div> },
              { key: "dept", header: "Dept", cellClassName: "text-muted-foreground", render: (e: any) => departments.find((d) => d.id === e.departmentId)?.name || "—" },
              { key: "designation", header: "Designation", cellClassName: "text-muted-foreground", render: (e: any) => designations.find((d) => d.id === e.designationId)?.name || "—" },
              { key: "location", header: "Location", cellClassName: "text-muted-foreground", render: (e: any) => e.workLocation || "—" },
              { key: "type", header: "Type", cellClassName: "text-muted-foreground", render: (e: any) => typeLabel(e.employmentType) },
              { key: "joinDate", header: "Join Date", cellClassName: "text-muted-foreground", render: (e: any) => e.joinDate ? format(new Date(e.joinDate), "dd MMM yyyy") : "—" },
              { key: "status", header: "Status", render: (e: any) => <Badge className={`text-xs ${statusColors[e.employmentStatus] || statusColors.inactive}`}>{e.employmentStatus.replace("_", " ")}</Badge> },
            ]}
            rows={displayed}
            getRowKey={(e: any) => e.id}
            onRowClick={(e: any) => (selectionMode ? toggleSel(e.id) : navigate(`/employees/${e.id}`))}
            testIdPrefix="employee-row"
          />
        </CardContent></Card>
      )}

      <EmployeeFormDialog open={showAdd} onOpenChange={setShowAdd} departments={departments} designations={designations} employees={allEmployees} knownLocations={allLocations} />
      <ImportDialog open={showImport} onOpenChange={setShowImport} departments={departments} designations={designations} />
      <InsightsPanel open={showInsights} onOpenChange={setShowInsights} employees={allEmployees} departments={departments} />
      <BulkUpdateDialog open={showBulk} onOpenChange={setShowBulk} ids={[...selected]} departments={departments} locations={allLocations} onDone={clearSel} />

      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Joiners Report</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {joinPresets.map((p) => (
                <Button key={p.label} size="sm" variant={rangeActive(p) ? "default" : "secondary"} onClick={() => setExportRange({ from: p.from, to: p.to })} data-testid={`export-preset-${p.label.replace(/\s+/g, "-").toLowerCase()}`}>{p.label}</Button>
              ))}
              <DateRangePicker value={exportRange} onChange={setExportRange} align="end" testId="export-range" />
            </div>
            <div className="rounded-xl bg-muted/40 px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{spanLabel}</p>
                <p className="text-xs text-muted-foreground">employees joined</p>
              </div>
              <span className="text-2xl font-bold text-[#206295] tabular-nums flex-shrink-0">{joiners.length}</span>
            </div>
            <Button className="w-full" disabled={!exportRange.from || joiners.length === 0} onClick={exportJoiners} data-testid="button-download-joiners">
              <Download className="h-4 w-4 mr-1.5" /> Download Excel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
