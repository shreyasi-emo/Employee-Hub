// The employee profile's Overview tab body — a read-only panel of the employee's
// personal, statutory, employment, and address details.

import { Shield, User, MapPin, Briefcase, AlertCircle, CheckCircle2 } from "lucide-react";
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
