import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, isHR, isAdmin } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm, Controller } from "react-hook-form";
import { DateInput } from "@/components/datetime-field";
import {
  ChevronLeft, Mail, Phone, MapPin, Calendar, Briefcase, Building2,
  Edit, Plus, DollarSign, FileText, Package, Clock, Shield,
  User, CreditCard, AlertCircle, CheckCircle2, Target, TrendingUp, History,
} from "lucide-react";
import { format } from "date-fns";
import { EmployeeFormDialog } from "./employees";

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  inactive: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  on_notice: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  exited: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground font-medium">{value}</p>
    </div>
  );
}

function AddSalaryDialog({ open, onOpenChange, employeeId }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employeeId: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const form = useForm({
    defaultValues: {
      effectiveFrom: new Date().toISOString().split("T")[0],
      basicSalary: "",
      hra: "",
      specialAllowance: "",
      conveyanceAllowance: "1600",
      medicalAllowance: "1250",
      ctc: "",
      reason: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/employees/${employeeId}/salary`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/salary`] });
      toast({ title: "Salary structure added" });
      onOpenChange(false);
      form.reset();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Salary Structure</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Effective From *</label>
            <div className="mt-1"><Controller control={form.control} name="effectiveFrom" render={({ field }) => <DateInput value={field.value || ""} onChange={field.onChange} />} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Basic Salary *</label>
              <Input {...form.register("basicSalary")} placeholder="e.g. 50000" className="mt-1" type="number" />
            </div>
            <div>
              <label className="text-sm font-medium">HRA</label>
              <Input {...form.register("hra")} placeholder="e.g. 20000" className="mt-1" type="number" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Special Allowance</label>
              <Input {...form.register("specialAllowance")} placeholder="e.g. 10000" className="mt-1" type="number" />
            </div>
            <div>
              <label className="text-sm font-medium">CTC (Annual) *</label>
              <Input {...form.register("ctc")} placeholder="e.g. 1200000" className="mt-1" type="number" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Reason for Change *</label>
            <Input {...form.register("reason")} placeholder="e.g. Annual appraisal 2025" className="mt-1" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save Salary Structure"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const GOAL_STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-600",
  on_track: "bg-green-100 text-green-700",
  at_risk: "bg-yellow-100 text-yellow-700",
  off_track: "bg-red-100 text-red-700",
  completed: "bg-blue-100 text-blue-700",
};

const REVIEW_STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-600",
  self_submitted: "bg-blue-100 text-blue-700",
  manager_submitted: "bg-purple-100 text-purple-700",
  hr_locked: "bg-orange-100 text-orange-700",
  finalized: "bg-green-100 text-green-700",
};

function EmployeePerformanceHistory({ empId }: { empId: string }) {
  const { data: cycles = [], isLoading: cyclesLoading } = useQuery<any[]>({ queryKey: ["/api/performance/cycles"] });
  const { data: allGoals = [] } = useQuery<any[]>({
    queryKey: [`/api/performance/goals?employeeId=${empId}`],
    enabled: !!empId,
  });

  if (cyclesLoading) return <Skeleton className="h-48 w-full" />;

  if (cycles.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Target className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No performance cycles configured yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {cycles.map((cycle: any) => {
        const cycleGoals = allGoals.filter(g => g.cycleId === cycle.id);
        const totalWeight = cycleGoals.reduce((s, g) => s + (g.weight || 0), 0);
        const completed = cycleGoals.filter(g => g.status === "completed").length;
        const onTrack = cycleGoals.filter(g => g.status === "on_track").length;

        return (
          <Card key={cycle.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  {cycle.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    cycle.status === "active" ? "bg-green-100 text-green-700" :
                    cycle.status === "locked" ? "bg-orange-100 text-orange-700" :
                    cycle.status === "archived" ? "bg-red-100 text-red-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>{cycle.status}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(cycle.startDate), "MMM yyyy")} – {format(new Date(cycle.endDate), "MMM yyyy")}
              </p>
            </CardHeader>
            <CardContent>
              {cycleGoals.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No goals set for this cycle.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <span>{cycleGoals.length} goals</span>
                    <span className={totalWeight === 100 ? "text-green-600" : "text-yellow-600"}>
                      Total weight: {totalWeight}%
                    </span>
                    <span className="text-green-600">{completed} completed</span>
                    <span className="text-blue-600">{onTrack} on track</span>
                  </div>
                  <div className="space-y-1.5">
                    {cycleGoals.map(g => (
                      <div key={g.id} className="flex items-center justify-between gap-3 p-2 rounded-md bg-muted/40">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs truncate">{g.title}</span>
                          <Badge variant="outline" className="text-xs flex-shrink-0">{g.category}</Badge>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-muted-foreground">{g.weight}%</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${GOAL_STATUS_COLORS[g.status] || ""}`}>
                            {g.status?.replace(/_/g, " ")}
                          </span>
                          {g.isApproved && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

const HISTORY_FIELD_LABELS: Record<string, string> = {
  designation: "Designation",
  department: "Department",
  managerId: "Manager",
  location: "Location",
  employmentStatus: "Status",
};

function EmploymentHistoryTab({ empId }: { empId: string }) {
  const { data: history = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/employees/${empId}/history`],
    enabled: !!empId,
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  if (history.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <History className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No employment history recorded yet.</p>
        <p className="text-xs mt-1">Changes to designation, department, manager, and status are tracked automatically.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((h: any, idx: number) => (
        <Card key={h.id} data-testid={`history-entry-${h.id}`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <History className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground capitalize">
                    {HISTORY_FIELD_LABELS[h.changedField] || h.changedField} Changed
                  </span>
                  <Badge variant="outline" className="text-xs">{format(new Date(h.effectiveDate), "MMM d, yyyy")}</Badge>
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-sm flex-wrap">
                  {h.oldValue && (
                    <span className="px-2 py-0.5 rounded bg-destructive/10 text-destructive text-xs font-mono">{h.oldValue}</span>
                  )}
                  {h.oldValue && <span className="text-muted-foreground text-xs">→</span>}
                  {h.newValue && (
                    <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 text-xs font-mono">{h.newValue}</span>
                  )}
                </div>
                {h.reason && <p className="text-xs text-muted-foreground mt-1">Reason: {h.reason}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(h.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function EmployeeProfilePage() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { data: auth } = useAuth();
  const user = auth?.user;
  const [activeTab, setActiveTab] = useState("personal");
  const [showAddSalary, setShowAddSalary] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const empId = params.id === "me" ? auth?.employee?.id : params.id;

  const { data: employee, isLoading } = useQuery<any>({
    queryKey: [`/api/employees/${empId}`],
    enabled: !!empId,
  });
  const { data: departments = [] } = useQuery<any[]>({ queryKey: ["/api/departments"] });
  const { data: designations = [] } = useQuery<any[]>({ queryKey: ["/api/designations"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: salaryStructures = [] } = useQuery<any[]>({
    queryKey: [`/api/employees/${empId}/salary`],
    enabled: !!empId && (isAdmin(user!) || user?.employeeId === empId),
  });
  const { data: payslips = [] } = useQuery<any[]>({
    queryKey: [`/api/payslips/employee/${empId}`],
    enabled: !!empId,
  });
  const { data: assets = [] } = useQuery<any[]>({
    queryKey: [`/api/assets?employeeId=${empId}`],
    enabled: !!empId,
  });
  const { data: auditLogs = [] } = useQuery<any[]>({
    queryKey: [`/api/audit-logs?entityType=employee&entityId=${empId}`],
    enabled: !!empId && isAdmin(user!),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => apiRequest("PUT", `/api/employees/${empId}`, { employmentStatus: status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/employees/${empId}`] });
      qc.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Status updated" });
    },
  });

  if (isLoading || !empId) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold">Employee not found</h2>
        <Button className="mt-4" onClick={() => navigate("/employees")}>Back to Employees</Button>
      </div>
    );
  }

  const dept = departments.find((d: any) => d.id === employee.departmentId);
  const desig = designations.find((d: any) => d.id === employee.designationId);
  const manager = employees.find((e: any) => e.id === employee.managerId);
  const initials = `${employee.firstName[0]}${employee.lastName[0]}`;

  // Default-avatar shade — main brand colors only
  const AVATAR_BRAND = ["#206295", "#4BDCD9", "#FF6F62"];
  const avColor = AVATAR_BRAND[(employee.firstName.charCodeAt(0) + employee.lastName.charCodeAt(0)) % AVATAR_BRAND.length];

  const currentSalary = salaryStructures[0];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="icon" className="h-10 w-10 flex-shrink-0" onClick={() => navigate("/employees")} aria-label="Back" data-testid="button-back">
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Profile Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-5 flex-wrap">
            <Avatar className="h-16 w-16 flex-shrink-0">
              <AvatarFallback className="text-xl font-bold" style={{ backgroundColor: `${avColor}26`, color: avColor }}>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h1 className="text-xl font-bold text-foreground">
                    {employee.firstName} {employee.lastName}
                  </h1>
                  <p className="text-sm text-muted-foreground">{employee.employeeCode}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {desig && <Badge variant="secondary">{desig.name}</Badge>}
                    {dept && <Badge variant="outline">{dept.name}</Badge>}
                    <Badge className={`${statusColors[employee.employmentStatus] || ""}`}>
                      {employee.employmentStatus?.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
                {isHR(user!) && (
                  <div className="flex gap-2 flex-wrap">
                    <Select
                      value={employee.employmentStatus}
                      onValueChange={v => updateStatus.mutate(v)}
                    >
                      <SelectTrigger className="w-36 h-8 text-xs" data-testid="select-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["active", "inactive", "on_notice", "exited"].map(s => (
                          <SelectItem key={s} value={s} className="text-xs">
                            {s.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1"
                      onClick={() => setShowEdit(true)}
                      data-testid="button-edit-profile"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Edit Profile
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 mt-3 flex-wrap text-sm text-muted-foreground">
                {employee.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> {employee.email}
                  </span>
                )}
                {employee.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> {employee.phone}
                  </span>
                )}
                {employee.workLocation && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {employee.workLocation}
                  </span>
                )}
                {employee.joinDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> Joined {format(new Date(employee.joinDate), "MMM d, yyyy")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="personal" data-testid="tab-personal">Personal</TabsTrigger>
          <TabsTrigger value="employment" data-testid="tab-employment">Employment</TabsTrigger>
          {(isAdmin(user!) || user?.employeeId === empId) && (
            <TabsTrigger value="salary" data-testid="tab-salary">Salary</TabsTrigger>
          )}
          <TabsTrigger value="payslips" data-testid="tab-payslips">Payslips</TabsTrigger>
          <TabsTrigger value="assets" data-testid="tab-assets">Assets</TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
          {isAdmin(user!) && <TabsTrigger value="audit" data-testid="tab-audit">Audit</TabsTrigger>}
        </TabsList>

        {/* Personal Tab */}
        <TabsContent value="personal" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" /> Personal Details
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <InfoRow label="Date of Birth" value={employee.dateOfBirth ? format(new Date(employee.dateOfBirth), "MMM d, yyyy") : null} />
                <InfoRow label="Gender" value={employee.gender} />
                <InfoRow label="Marital Status" value={employee.maritalStatus} />
                <InfoRow label="PAN Number" value={employee.panNumber} />
                <InfoRow label="Aadhaar (Masked)" value={employee.aadhaarMasked} />
                <InfoRow label="UAN" value={employee.uan} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoRow label="Current Address" value={employee.currentAddress} />
                <InfoRow label="Permanent Address" value={employee.permanentAddress} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> Emergency Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <InfoRow label="Name" value={employee.emergencyContactName} />
                <InfoRow label="Relation" value={employee.emergencyContactRelation} />
                <InfoRow label="Phone" value={employee.emergencyContactPhone} />
              </CardContent>
            </Card>
            {isHR(user!) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <CreditCard className="h-4 w-4" /> Bank Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <InfoRow label="Bank Name" value={employee.bankName} />
                  <InfoRow label="Account (Masked)" value={employee.bankAccountMasked} />
                  <InfoRow label="IFSC Code" value={employee.ifscCode} />
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Employment Tab */}
        <TabsContent value="employment" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Briefcase className="h-4 w-4" /> Position
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <InfoRow label="Designation" value={desig?.name} />
                <InfoRow label="Department" value={dept?.name} />
                <InfoRow label="Work Location" value={employee.workLocation} />
                <InfoRow label="Manager" value={manager ? `${manager.firstName} ${manager.lastName}` : undefined} />
                <InfoRow label="Grade/Band" value={desig?.grade} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <InfoRow label="Join Date" value={employee.joinDate ? format(new Date(employee.joinDate), "MMM d, yyyy") : null} />
                <InfoRow label="Confirmation Date" value={employee.confirmationDate ? format(new Date(employee.confirmationDate), "MMM d, yyyy") : null} />
                <InfoRow label="Probation (Days)" value={employee.probationDays?.toString()} />
                <InfoRow label="Notice Period (Days)" value={employee.noticePeriodDays?.toString()} />
                <InfoRow label="Employment Type" value={employee.employmentType?.replace("_", " ")} />
                {employee.lastWorkingDate && (
                  <InfoRow label="Last Working Day" value={format(new Date(employee.lastWorkingDate), "MMM d, yyyy")} />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Statutory</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs text-muted-foreground">PF Eligible</p>
                  <div className="flex items-center gap-1">
                    {employee.pfEligible ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">{employee.pfEligible ? "Yes" : "No"}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs text-muted-foreground">ESI Eligible</p>
                  <div className="flex items-center gap-1">
                    {employee.esiEligible ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">{employee.esiEligible ? "Yes" : "No"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Salary Tab */}
        {(isAdmin(user!) || user?.employeeId === empId) && (
          <TabsContent value="salary" className="mt-4">
            <div className="space-y-4">
              {isAdmin(user!) && (
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setShowAddSalary(true)} data-testid="button-add-salary">
                    <Plus className="h-4 w-4 mr-1.5" /> Add Salary Structure
                  </Button>
                </div>
              )}
              {salaryStructures.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No salary structure defined
                </div>
              ) : (
                salaryStructures.map((s: any, i: number) => (
                  <Card key={s.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-sm font-semibold">
                          Effective from {format(new Date(s.effectiveFrom), "MMM d, yyyy")}
                        </CardTitle>
                        {i === 0 && <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Current</Badge>}
                        {s.effectiveTo && (
                          <span className="text-xs text-muted-foreground">Until {format(new Date(s.effectiveTo), "MMM d, yyyy")}</span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Basic Salary</p>
                          <p className="text-sm font-semibold text-foreground">₹{parseFloat(s.basicSalary).toLocaleString("en-IN")}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">HRA</p>
                          <p className="text-sm font-semibold text-foreground">₹{parseFloat(s.hra || "0").toLocaleString("en-IN")}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Special Allowance</p>
                          <p className="text-sm font-semibold text-foreground">₹{parseFloat(s.specialAllowance || "0").toLocaleString("en-IN")}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Annual CTC</p>
                          <p className="text-sm font-bold text-primary">₹{parseFloat(s.ctc).toLocaleString("en-IN")}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
            <AddSalaryDialog
              open={showAddSalary}
              onOpenChange={setShowAddSalary}
              employeeId={empId!}
            />
          </TabsContent>
        )}

        {/* Payslips Tab */}
        <TabsContent value="payslips" className="mt-4">
          {payslips.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No payslips available</div>
          ) : (
            <div className="space-y-3">
              {payslips.map((slip: any) => (
                <Card key={slip.id} className="hover-elevate">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <p className="font-semibold text-foreground">
                          {new Date(slip.year, slip.month - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {slip.presentDays} days worked · LOP: {slip.lopDays} days
                        </p>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Gross</p>
                          <p className="font-medium">₹{Math.round(parseFloat(slip.grossSalary || "0")).toLocaleString("en-IN")}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Deductions</p>
                          <p className="font-medium text-red-600">-₹{Math.round(parseFloat(slip.totalDeductions || "0")).toLocaleString("en-IN")}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Net Pay</p>
                          <p className="font-bold text-green-600">₹{Math.round(parseFloat(slip.netPay || "0")).toLocaleString("en-IN")}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Assets Tab */}
        <TabsContent value="assets" className="mt-4">
          {assets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No assets assigned</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assets.map((asset: any) => (
                <Card key={asset.id}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground">{asset.name}</p>
                      <p className="text-xs text-muted-foreground">{asset.assetCode} · {asset.category}</p>
                      {asset.serialNumber && (
                        <p className="text-xs text-muted-foreground">S/N: {asset.serialNumber}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs flex-shrink-0">{asset.condition}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="mt-4">
          <EmployeePerformanceHistory empId={empId!} />
        </TabsContent>

        {/* Employment History Tab */}
        <TabsContent value="history" className="mt-4">
          <EmploymentHistoryTab empId={empId!} />
        </TabsContent>

        {/* Audit Tab */}
        {isAdmin(user!) && (
          <TabsContent value="audit" className="mt-4">
            {auditLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No audit logs</div>
            ) : (
              <div className="space-y-2">
                {auditLogs.map((log: any) => (
                  <Card key={log.id}>
                    <CardContent className="p-3 flex items-start gap-3">
                      <Shield className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{log.action.replace(/_/g, " ")}</p>
                        {log.reason && <p className="text-xs text-muted-foreground">Reason: {log.reason}</p>}
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {isHR(user!) && (
        <EmployeeFormDialog
          open={showEdit}
          onOpenChange={setShowEdit}
          employee={employee}
          departments={departments}
          designations={designations}
          employees={employees}
          knownLocations={Array.from(new Set(employees.map((e: any) => e.workLocation).filter(Boolean))) as string[]}
        />
      )}
    </div>
  );
}
