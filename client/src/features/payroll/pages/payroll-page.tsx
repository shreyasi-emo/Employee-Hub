import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, isFinance, isAdmin } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign, Lock, Unlock, Play, Plus, TrendingUp, TrendingDown,
  Users, Calculator, FileText, Download, Check,
} from "lucide-react";
import { format } from "date-fns";

const months = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: "Draft", bg: "bg-gray-100 dark:bg-gray-700", text: "text-gray-800 dark:text-gray-300" },
  review: { label: "In Review", bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300" },
  approved: { label: "Approved", bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300" },
  locked: { label: "Locked", bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-800 dark:text-green-300" },
};

function fmt(val: any) {
  return `₹${Math.round(parseFloat(val || "0")).toLocaleString("en-IN")}`;
}

function PayslipView({ payslip, employees }: { payslip: any; employees: any[] }) {
  const emp = employees.find(e => e.id === payslip.employeeId);
  const monthName = months[payslip.month - 1];

  return (
    <div className="p-4 space-y-4 text-sm">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-foreground">{emp ? `${emp.firstName} ${emp.lastName}` : "Unknown"}</h3>
          <p className="text-xs text-muted-foreground">{emp?.employeeCode}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">{monthName} {payslip.year}</p>
          <p className="text-xs text-muted-foreground">{payslip.presentDays} / {payslip.totalWorkingDays} days</p>
          {parseFloat(payslip.lopDays) > 0 && (
            <p className="text-xs text-red-600">LOP: {payslip.lopDays} days</p>
          )}
        </div>
      </div>
      <Separator />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="font-semibold text-foreground mb-2">Earnings</p>
          <div className="space-y-1.5">
            {[
              { label: "Basic Salary", val: payslip.basicSalary },
              { label: "HRA", val: payslip.hra },
              { label: "Special Allowance", val: payslip.specialAllowance },
              { label: "Conveyance Allowance", val: payslip.conveyanceAllowance },
              { label: "Medical Allowance", val: payslip.medicalAllowance },
              { label: "Other Allowances", val: payslip.otherAllowances },
              { label: "Bonus", val: payslip.bonus },
            ].filter(e => parseFloat(e.val || "0") > 0).map(e => (
              <div key={e.label} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{e.label}</span>
                <span className="font-medium text-foreground">{fmt(e.val)}</span>
              </div>
            ))}
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between text-sm font-semibold">
            <span>Gross Salary</span>
            <span className="text-green-600">{fmt(payslip.grossSalary)}</span>
          </div>
        </div>
        <div>
          <p className="font-semibold text-foreground mb-2">Deductions</p>
          <div className="space-y-1.5">
            {[
              { label: "PF (Employee)", val: payslip.pfEmployee },
              { label: "PF (Employer)", val: payslip.pfEmployer },
              { label: "ESI (Employee)", val: payslip.esiEmployee },
              { label: "ESI (Employer)", val: payslip.esiEmployer },
              { label: "Professional Tax", val: payslip.professionalTax },
              { label: "TDS", val: payslip.tds },
              { label: "LOP Deduction", val: payslip.lopDeduction },
              { label: "Loan Recovery", val: payslip.loanRecovery },
              { label: "Other Deductions", val: payslip.otherDeductions },
            ].filter(e => parseFloat(e.val || "0") > 0).map(e => (
              <div key={e.label} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{e.label}</span>
                <span className="font-medium text-red-600">-{fmt(e.val)}</span>
              </div>
            ))}
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between text-sm font-semibold">
            <span>Total Deductions</span>
            <span className="text-red-600">-{fmt(payslip.totalDeductions)}</span>
          </div>
        </div>
      </div>
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex justify-between items-center">
        <span className="font-bold text-foreground">Net Pay</span>
        <span className="text-lg font-bold text-primary">{fmt(payslip.netPay)}</span>
      </div>
    </div>
  );
}

function CreatePayrollDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const today = new Date();
  const [form, setForm] = useState({
    month: today.getMonth() + 1,
    year: today.getFullYear(),
  });

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/payroll-runs", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
      toast({ title: "Payroll run created" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Payroll Run</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Month *</label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.month}
                onChange={e => setForm(f => ({ ...f, month: parseInt(e.target.value) }))}
                data-testid="select-payroll-month"
              >
                {months.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Year *</label>
              <Input
                type="number"
                value={form.year}
                onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) }))}
                className="mt-1"
                data-testid="input-payroll-year"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending} data-testid="button-create-payroll">
              {mutation.isPending ? "Creating..." : "Create Payroll Run"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UnlockDialog({ open, onOpenChange, runId }: { open: boolean; onOpenChange: (v: boolean) => void; runId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/payroll-runs/${runId}/unlock`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
      toast({ title: "Payroll unlocked", description: reason });
      onOpenChange(false);
      setReason("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unlock Payroll Run</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This action requires Super Admin authorization and will be audited.
          </p>
          <div>
            <label className="text-sm font-medium">Reason for Unlock *</label>
            <Input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Mandatory reason..."
              className="mt-1"
              data-testid="input-unlock-reason"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !reason}
              data-testid="button-confirm-unlock"
            >
              {mutation.isPending ? "Unlocking..." : "Unlock Payroll"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PayrollPage() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const emp = auth?.employee;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showUnlock, setShowUnlock] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<any | null>(null);
  const [viewPayslip, setViewPayslip] = useState<any | null>(null);

  const { data: payrollRuns = [], isLoading: runsLoading } = useQuery<any[]>({
    queryKey: ["/api/payroll-runs"],
    enabled: isFinance(user!),
  });

  const { data: myPayslips = [], isLoading: slipsLoading } = useQuery<any[]>({
    queryKey: ["/api/payslips/me"],
  });

  const { data: runPayslips = [], isLoading: runSlipsLoading } = useQuery<any[]>({
    queryKey: selectedRun ? [`/api/payroll-runs/${selectedRun.id}/payslips`] : [],
    enabled: !!selectedRun,
  });

  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });

  const computeRun = useMutation({
    mutationFn: (runId: string) => apiRequest("POST", `/api/payroll-runs/${runId}/compute`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
      if (selectedRun) qc.invalidateQueries({ queryKey: [`/api/payroll-runs/${selectedRun.id}/payslips`] });
      toast({ title: "Payroll computed successfully" });
    },
    onError: (e: any) => toast({ title: "Compute failed", description: e.message, variant: "destructive" }),
  });

  const lockRun = useMutation({
    mutationFn: (runId: string) => apiRequest("POST", `/api/payroll-runs/${runId}/lock`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
      toast({ title: "Payroll locked" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const downloadBankAdvice = (payslips: any[], runName: string) => {
    const rows = [
      ["Employee Code", "Name", "Bank", "IFSC", "Account (Masked)", "Net Pay"],
      ...payslips.map(ps => {
        const emp_ = employees.find(e => e.id === ps.employeeId);
        return [
          emp_?.employeeCode || "",
          emp_ ? `${emp_.firstName} ${emp_.lastName}` : "",
          emp_?.bankName || "",
          emp_?.ifscCode || "",
          emp_?.bankAccountMasked || "",
          Math.round(parseFloat(ps.netPay || "0")),
        ];
      }),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bank_advice_${runName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Bank advice downloaded" });
  };

  const downloadSalaryRegister = (payslips: any[], runName: string) => {
    const rows = [
      ["Emp Code", "Name", "Department", "Basic", "HRA", "Special Allowance", "Gross", "PF (Emp)", "ESI (Emp)", "PT", "LOP Deduction", "Total Deductions", "Net Pay"],
      ...payslips.map(ps => {
        const emp_ = employees.find(e => e.id === ps.employeeId);
        return [
          emp_?.employeeCode || "",
          emp_ ? `${emp_.firstName} ${emp_.lastName}` : "",
          "",
          Math.round(parseFloat(ps.basicSalary || "0")),
          Math.round(parseFloat(ps.hra || "0")),
          Math.round(parseFloat(ps.specialAllowance || "0")),
          Math.round(parseFloat(ps.grossSalary || "0")),
          Math.round(parseFloat(ps.pfEmployee || "0")),
          Math.round(parseFloat(ps.esiEmployee || "0")),
          Math.round(parseFloat(ps.professionalTax || "0")),
          Math.round(parseFloat(ps.lopDeduction || "0")),
          Math.round(parseFloat(ps.totalDeductions || "0")),
          Math.round(parseFloat(ps.netPay || "0")),
        ];
      }),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `salary_register_${runName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Salary register downloaded" });
  };

  const isSuperAdmin = user?.role === "super_admin";

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payroll</h1>
          <p className="text-sm text-muted-foreground">
            {isFinance(user!) ? "Manage payroll runs and payslips" : "View your payslips"}
          </p>
        </div>
        {isFinance(user!) && (
          <Button onClick={() => setShowCreate(true)} data-testid="button-create-payroll-run">
            <Plus className="h-4 w-4 mr-2" />
            New Payroll Run
          </Button>
        )}
      </div>

      <Tabs defaultValue={isFinance(user!) ? "runs" : "my-payslips"}>
        <TabsList>
          {isFinance(user!) && <TabsTrigger value="runs" data-testid="tab-payroll-runs">Payroll Runs</TabsTrigger>}
          <TabsTrigger value="my-payslips" data-testid="tab-my-payslips">My Payslips</TabsTrigger>
        </TabsList>

        {isFinance(user!) && (
          <TabsContent value="runs" className="mt-4 space-y-4">
            {runsLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : payrollRuns.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                <p className="text-muted-foreground">No payroll runs yet</p>
                <Button className="mt-4" onClick={() => setShowCreate(true)}>Create First Payroll Run</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {payrollRuns.map((run: any) => {
                  const sc = statusConfig[run.status] || statusConfig.draft;
                  const isSelected = selectedRun?.id === run.id;
                  return (
                    <Card key={run.id} className={`cursor-pointer hover-elevate ${isSelected ? "ring-2 ring-primary" : ""}`}
                      onClick={() => setSelectedRun(isSelected ? null : run)}
                      data-testid={`payroll-run-${run.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-foreground">
                                {months[run.month - 1]} {run.year}
                              </h3>
                              <Badge className={`text-xs ${sc.bg} ${sc.text}`}>{sc.label}</Badge>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" /> {run.totalEmployees} employees
                              </span>
                              <span className="flex items-center gap-1">
                                <TrendingUp className="h-3.5 w-3.5" /> Gross: {fmt(run.totalGross)}
                              </span>
                              <span className="flex items-center gap-1">
                                <TrendingDown className="h-3.5 w-3.5" /> Deductions: {fmt(run.totalDeductions)}
                              </span>
                              <span className="font-semibold text-foreground">Net: {fmt(run.totalNetPay)}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                            {run.status === "draft" && (
                              <Button size="sm" variant="outline"
                                onClick={() => computeRun.mutate(run.id)}
                                disabled={computeRun.isPending}
                                data-testid={`button-compute-${run.id}`}
                              >
                                <Calculator className="h-3.5 w-3.5 mr-1.5" />
                                {computeRun.isPending ? "Computing..." : "Compute"}
                              </Button>
                            )}
                            {run.status === "review" && (
                              <>
                                <Button size="sm" variant="outline"
                                  onClick={() => computeRun.mutate(run.id)}
                                  disabled={computeRun.isPending}
                                >
                                  <Calculator className="h-3.5 w-3.5 mr-1.5" /> Recompute
                                </Button>
                                {isAdmin(user!) && (
                                  <Button size="sm"
                                    onClick={() => lockRun.mutate(run.id)}
                                    disabled={lockRun.isPending}
                                    data-testid={`button-lock-${run.id}`}
                                  >
                                    <Lock className="h-3.5 w-3.5 mr-1.5" /> Lock Payroll
                                  </Button>
                                )}
                              </>
                            )}
                            {run.status === "locked" && isSuperAdmin && (
                              <Button size="sm" variant="outline" className="text-amber-600 border-amber-200"
                                onClick={() => setShowUnlock(run.id)}
                                data-testid={`button-unlock-${run.id}`}
                              >
                                <Unlock className="h-3.5 w-3.5 mr-1.5" /> Unlock
                              </Button>
                            )}
                            {runPayslips.length > 0 && isSelected && (
                              <>
                                <Button size="sm" variant="outline"
                                  onClick={() => downloadBankAdvice(runPayslips, `${months[run.month - 1]}_${run.year}`)}
                                  data-testid={`button-bank-advice-${run.id}`}
                                >
                                  <Download className="h-3.5 w-3.5 mr-1.5" /> Bank Advice
                                </Button>
                                <Button size="sm" variant="outline"
                                  onClick={() => downloadSalaryRegister(runPayslips, `${months[run.month - 1]}_${run.year}`)}
                                >
                                  <FileText className="h-3.5 w-3.5 mr-1.5" /> Salary Register
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Payslips */}
                        {isSelected && (
                          <div className="mt-4 pt-4 border-t border-border">
                            {runSlipsLoading ? (
                              <Skeleton className="h-32 w-full" />
                            ) : runPayslips.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No payslips yet. Click "Compute" to generate.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                  {runPayslips.length} payslips generated
                                </p>
                                {runPayslips.map((slip: any) => {
                                  const slipEmp = employees.find(e => e.id === slip.employeeId);
                                  return (
                                    <div key={slip.id}
                                      className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/50 cursor-pointer hover-elevate"
                                      onClick={() => setViewPayslip(viewPayslip?.id === slip.id ? null : slip)}
                                      data-testid={`payslip-${slip.id}`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-foreground">
                                          {slipEmp ? `${slipEmp.firstName} ${slipEmp.lastName}` : "Unknown"}
                                        </span>
                                        <span className="text-xs text-muted-foreground">({slipEmp?.employeeCode})</span>
                                        {parseFloat(slip.lopDays) > 0 && (
                                          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-xs">
                                            LOP: {slip.lopDays}d
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-4 text-sm">
                                        <span className="text-muted-foreground hidden sm:block">Gross: {fmt(slip.grossSalary)}</span>
                                        <span className="font-semibold text-foreground">Net: {fmt(slip.netPay)}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                                {viewPayslip && (
                                  <Card className="mt-2">
                                    <PayslipView payslip={viewPayslip} employees={employees} />
                                  </Card>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="my-payslips" className="mt-4">
          {slipsLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : myPayslips.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">No payslips available yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {myPayslips.map((slip: any) => (
                <Card key={slip.id} className="hover-elevate cursor-pointer"
                  onClick={() => setViewPayslip(viewPayslip?.id === slip.id ? null : slip)}
                  data-testid={`my-payslip-${slip.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-semibold text-foreground">{months[slip.month - 1]} {slip.year}</p>
                        <p className="text-xs text-muted-foreground">
                          {slip.presentDays} days · LOP: {slip.lopDays}d
                        </p>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Gross</p>
                          <p className="font-medium text-foreground">{fmt(slip.grossSalary)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Deductions</p>
                          <p className="font-medium text-red-600">-{fmt(slip.totalDeductions)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Net Pay</p>
                          <p className="text-lg font-bold text-green-600">{fmt(slip.netPay)}</p>
                        </div>
                      </div>
                    </div>
                    {viewPayslip?.id === slip.id && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <PayslipView payslip={slip} employees={[...(emp ? [emp] : [])]} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreatePayrollDialog open={showCreate} onOpenChange={setShowCreate} />
      {showUnlock && (
        <UnlockDialog open={!!showUnlock} onOpenChange={() => setShowUnlock(null)} runId={showUnlock} />
      )}
    </div>
  );
}
