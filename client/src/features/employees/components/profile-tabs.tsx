// The employee profile's tab bodies. Performance and Employment History are
// bigger and live in their own files; these six are simple read-only panels.

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, Shield, User, MapPin, Briefcase, AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

// Title-case enum-ish values ("single" → "Single", "full time" → "Full Time").
const cap = (s?: string | null) => (s ? s.replace(/\b\w/g, (c) => c.toUpperCase()) : s);
const fmtDate = (d: any) => (d ? format(new Date(d), "MMM d, yyyy") : null);

// One label/value cell in a uniform field grid. Empty shows "—" so the grid stays even.
function Field({ label, value, wide }: { label: string; value?: string | null; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 lg:col-span-3" : ""}>
      <p className="text-[12.65px] text-muted-foreground leading-tight">{label}</p>
      <p className="text-sm font-medium text-foreground mt-1 break-words leading-snug">{value || "—"}</p>
    </div>
  );
}

const Divider = () => <div className="h-px bg-border" />;

// A titled section inside the profile card: icon-led heading + a uniform 2/3-column field grid.
function FieldSection({ icon: Icon, title, onEdit, children }: { icon: any; title: string; onEdit?: () => void; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Icon className="h-4 w-4 text-[#206295]" /> {title}</h3>
        {onEdit && <button type="button" onClick={onEdit} className="text-xs font-medium text-[#206295] hover:underline">Edit</button>}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">{children}</div>
    </section>
  );
}

function Eligibility({ label, eligible }: { label: string; eligible: boolean }) {
  return (
    <div>
      <p className="text-[12.65px] text-muted-foreground leading-tight">{label}</p>
      <div className="flex items-center gap-1.5 mt-1">
        {eligible ? <CheckCircle2 className="h-4 w-4 text-[#0E7C7B]" /> : <AlertCircle className="h-4 w-4 text-muted-foreground" />}
        <span className="text-sm font-medium text-foreground">{eligible ? "Yes" : "No"}</span>
      </div>
    </div>
  );
}

// The profile overview — ONE container with four sections separated by dividers (Personal
// Details, Statutory & Bank, Employment, Address & Emergency). Job coordinates (designation,
// department, work location, manager) live in the LEFT rail, so Employment never repeats them.
export function ProfileOverview({ employee, desig, showBank }: { employee: any; desig: any; showBank: boolean }) {
  return (
      <div className="space-y-6">
        <FieldSection icon={User} title="Personal Details">
          <Field label="Date of Birth" value={fmtDate(employee.dateOfBirth)} />
          <Field label="Gender" value={cap(employee.gender)} />
          <Field label="Marital Status" value={cap(employee.maritalStatus)} />
          <Field label="Blood Group" value={employee.bloodGroup} />
        </FieldSection>
        <Divider />
        <FieldSection icon={Shield} title="Statutory & Bank">
          <Field label="PAN Number" value={employee.panNumber} />
          <Field label="Aadhaar (Masked)" value={employee.aadhaarMasked} />
          <Field label="UAN" value={employee.uan} />
          <Eligibility label="PF Eligible" eligible={!!employee.pfEligible} />
          <Eligibility label="ESI Eligible" eligible={!!employee.esiEligible} />
          {showBank && <Field label="Bank Name" value={employee.bankName} />}
          {showBank && <Field label="Account (Masked)" value={employee.bankAccountMasked} />}
          {showBank && <Field label="IFSC Code" value={employee.ifscCode} />}
        </FieldSection>
        <Divider />
        <FieldSection icon={Briefcase} title="Employment">
          <Field label="Employment Type" value={cap(employee.employmentType?.replace("_", " "))} />
          <Field label="Grade/Band" value={desig?.grade} />
          <Field label="Join Date" value={fmtDate(employee.joinDate)} />
          <Field label="Confirmation Date" value={fmtDate(employee.confirmationDate)} />
          <Field label="Probation (Days)" value={employee.probationDays?.toString()} />
          <Field label="Notice Period (Days)" value={employee.noticePeriodDays?.toString()} />
          {employee.lastWorkingDate && <Field label="Last Working Day" value={fmtDate(employee.lastWorkingDate)} />}
        </FieldSection>
        <Divider />
        <FieldSection icon={MapPin} title="Address & Emergency">
          <Field label="Current Address" value={employee.currentAddress} wide />
          <Field label="Permanent Address" value={employee.permanentAddress} wide />
          <Field label="Emergency Contact" value={employee.emergencyContactName} />
          <Field label="Relation" value={employee.emergencyContactRelation} />
          <Field label="Emergency Phone" value={employee.emergencyContactPhone} />
        </FieldSection>
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
