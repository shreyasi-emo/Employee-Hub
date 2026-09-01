// The employee profile's tab bodies. Performance and Employment History are
// bigger and live in their own files; these six are simple read-only panels.

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, Shield, User, CreditCard, MapPin, Briefcase, Calendar, AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { InfoRow } from "./employee-ui";

// Title-case enum-ish values ("single" → "Single", "full time" → "Full Time").
const cap = (s?: string | null) => (s ? s.replace(/\b\w/g, (c) => c.toUpperCase()) : s);

// Card header with an icon-led title and an optional right-aligned Edit link (opens the edit dialog).
function CardHead({ icon: Icon, title, onEdit }: { icon: any; title: string; onEdit?: () => void }) {
  return (
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2"><Icon className="h-4 w-4 text-[#206295]" /> {title}</CardTitle>
        {onEdit && <button type="button" onClick={onEdit} className="text-xs font-medium text-[#206295] hover:underline">Edit</button>}
      </div>
    </CardHeader>
  );
}

export function PersonalTab({ employee, showBank, onEdit }: { employee: any; showBank: boolean; onEdit?: () => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHead icon={User} title="Personal Details" onEdit={onEdit} />
        <CardContent className="grid grid-cols-2 gap-4">
          <InfoRow label="Date of Birth" value={employee.dateOfBirth ? format(new Date(employee.dateOfBirth), "MMM d, yyyy") : null} />
          <InfoRow label="Gender" value={cap(employee.gender)} />
          <InfoRow label="Marital Status" value={cap(employee.maritalStatus)} />
          <InfoRow label="PAN Number" value={employee.panNumber} />
          <InfoRow label="Aadhaar (Masked)" value={employee.aadhaarMasked} />
          <InfoRow label="UAN" value={employee.uan} />
        </CardContent>
      </Card>
      <Card>
        <CardHead icon={MapPin} title="Address" onEdit={onEdit} />
        <CardContent className="space-y-4">
          <InfoRow label="Current Address" value={employee.currentAddress} />
          <InfoRow label="Permanent Address" value={employee.permanentAddress} />
        </CardContent>
      </Card>
      <Card>
        <CardHead icon={AlertCircle} title="Emergency Contact" onEdit={onEdit} />
        <CardContent className="grid grid-cols-2 gap-4">
          <InfoRow label="Name" value={employee.emergencyContactName} />
          <InfoRow label="Relation" value={employee.emergencyContactRelation} />
          <InfoRow label="Phone" value={employee.emergencyContactPhone} />
        </CardContent>
      </Card>
      {showBank && (
        <Card>
          <CardHead icon={CreditCard} title="Bank Details" onEdit={onEdit} />
          <CardContent className="grid grid-cols-2 gap-4">
            <InfoRow label="Bank Name" value={employee.bankName} />
            <InfoRow label="Account (Masked)" value={employee.bankAccountMasked} />
            <InfoRow label="IFSC Code" value={employee.ifscCode} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EligibilityRow({ label, eligible }: { label: string; eligible: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1">
        {eligible ? <CheckCircle2 className="h-4 w-4 text-[#0E7C7B]" /> : <AlertCircle className="h-4 w-4 text-muted-foreground" />}
        <span className="text-sm font-medium">{eligible ? "Yes" : "No"}</span>
      </div>
    </div>
  );
}

export function EmploymentTab({ employee, dept, desig, manager }: { employee: any; dept: any; desig: any; manager: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHead icon={Briefcase} title="Position" />
        <CardContent className="grid grid-cols-2 gap-4">
          <InfoRow label="Designation" value={desig?.name} />
          <InfoRow label="Department" value={dept?.name} />
          <InfoRow label="Work Location" value={employee.workLocation} />
          <InfoRow label="Manager" value={manager ? `${manager.firstName} ${manager.lastName}` : undefined} />
          <InfoRow label="Grade/Band" value={desig?.grade} />
        </CardContent>
      </Card>
      <Card>
        <CardHead icon={Calendar} title="Timeline" />
        <CardContent className="grid grid-cols-2 gap-4">
          <InfoRow label="Join Date" value={employee.joinDate ? format(new Date(employee.joinDate), "MMM d, yyyy") : null} />
          <InfoRow label="Confirmation Date" value={employee.confirmationDate ? format(new Date(employee.confirmationDate), "MMM d, yyyy") : null} />
          <InfoRow label="Probation (Days)" value={employee.probationDays?.toString()} />
          <InfoRow label="Notice Period (Days)" value={employee.noticePeriodDays?.toString()} />
          <InfoRow label="Employment Type" value={cap(employee.employmentType?.replace("_", " "))} />
          {employee.lastWorkingDate && (
            <InfoRow label="Last Working Day" value={format(new Date(employee.lastWorkingDate), "MMM d, yyyy")} />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHead icon={Shield} title="Statutory" />
        <CardContent className="grid grid-cols-2 gap-4">
          <EligibilityRow label="PF Eligible" eligible={!!employee.pfEligible} />
          <EligibilityRow label="ESI Eligible" eligible={!!employee.esiEligible} />
        </CardContent>
      </Card>
    </div>
  );
}

export function SalaryTab({ salaryStructures, canAdd, onAdd }: {
  salaryStructures: any[]; canAdd: boolean; onAdd: () => void;
}) {
  return (
    <div className="space-y-4">
      {canAdd && (
        <div className="flex justify-end">
          <Button size="sm" onClick={onAdd} data-testid="button-add-salary">
            <Plus className="h-4 w-4 mr-1.5" /> Add Salary Structure
          </Button>
        </div>
      )}
      {salaryStructures.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No salary structure defined</div>
      ) : (
        salaryStructures.map((s: any, i: number) => (
          <Card key={s.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-semibold">
                  Effective from {format(new Date(s.effectiveFrom), "MMM d, yyyy")}
                </CardTitle>
                {i === 0 && <Badge className="bg-[#0E7C7B]/15 text-[#0E7C7B]">Current</Badge>}
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
  );
}

export function PayslipsTab({ payslips }: { payslips: any[] }) {
  if (payslips.length === 0) return <div className="text-center py-8 text-muted-foreground">No payslips available</div>;
  return (
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
                  {slip.presentDays} days worked | LOP: {slip.lopDays} days
                </p>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Gross</p>
                  <p className="font-medium">₹{Math.round(parseFloat(slip.grossSalary || "0")).toLocaleString("en-IN")}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Deductions</p>
                  <p className="font-medium text-[#C4402F]">-₹{Math.round(parseFloat(slip.totalDeductions || "0")).toLocaleString("en-IN")}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Net Pay</p>
                  <p className="font-bold text-[#0E7C7B]">₹{Math.round(parseFloat(slip.netPay || "0")).toLocaleString("en-IN")}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function AssignedAssetsTab({ assets }: { assets: any[] }) {
  if (assets.length === 0) return <div className="text-center py-8 text-muted-foreground">No assets assigned</div>;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {assets.map((asset: any) => (
        <Card key={asset.id}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-foreground">{asset.name}</p>
              <p className="text-xs text-muted-foreground">{asset.assetCode} | {asset.category}</p>
              {asset.serialNumber && (
                <p className="text-xs text-muted-foreground">S/N: {asset.serialNumber}</p>
              )}
            </div>
            <Badge variant="outline" className="text-xs flex-shrink-0">{asset.condition}</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ProfileAuditTab({ auditLogs }: { auditLogs: any[] }) {
  if (auditLogs.length === 0) return <div className="text-center py-8 text-muted-foreground">No audit logs</div>;
  return (
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
  );
}
