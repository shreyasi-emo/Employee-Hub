import { format } from "date-fns";
import { exportXlsx } from "@/lib/export-xlsx";
import { typeLabel } from "./employee-constants";

type Lookup = { departments: any[]; designations: any[] };

const nameFrom = (list: any[], id: string) => list.find((d) => d.id === id)?.name || "—";

/** The directory export — the columns shown on screen. */
export function exportEmployeeRows(rows: any[], { departments, designations }: Lookup) {
  const headers = ["Code", "Name", "Email", "Department", "Designation", "Location", "Type", "Join Date", "Status"];
  const data = rows.map((e) => [
    e.employeeCode, `${e.firstName} ${e.lastName}`, e.email,
    nameFrom(departments, e.departmentId), nameFrom(designations, e.designationId),
    e.workLocation || "—", typeLabel(e.employmentType),
    e.joinDate ? format(new Date(e.joinDate), "dd MMM yyyy") : "—", e.employmentStatus,
  ]);
  exportXlsx({ filename: `employees-${format(new Date(), "yyyy-MM-dd")}.xlsx`, sheet: "Employees", title: `Employees (${data.length})`, headers, rows: data });
}

/** Joiners report — every field on the record, for the selected join-date range. */
export function exportJoiners(joiners: any[], range: { from: Date; to?: Date }, { departments, designations }: Lookup, allEmployees: any[]) {
  const mgr = (id: string) => { const m = allEmployees.find((x) => x.id === id); return m ? `${m.firstName} ${m.lastName}` : "—"; };
  const fmtD = (d: any) => (d ? format(new Date(d), "dd MMM yyyy") : "");
  const yn = (b: any) => (b ? "Yes" : "No");
  const headers = ["Code", "First Name", "Last Name", "Email", "Phone", "Date of Birth", "Gender", "Marital Status", "Join Date", "Confirmation Date", "Last Working Date", "Notice Period (days)", "Probation (days)", "Type", "Status", "Department", "Designation", "Manager", "Work Location", "PAN", "Aadhaar", "UAN", "PF Eligible", "ESI Eligible", "Bank Name", "Bank A/C", "IFSC", "Current Address", "Permanent Address", "Emergency Contact", "Emergency Phone", "Emergency Relation"];
  const rows = joiners.map((e) => [e.employeeCode, e.firstName, e.lastName, e.email, e.phone || "", fmtD(e.dateOfBirth), e.gender || "", e.maritalStatus || "", fmtD(e.joinDate), fmtD(e.confirmationDate), fmtD(e.lastWorkingDate), e.noticePeriodDays ?? "", e.probationDays ?? "", typeLabel(e.employmentType), e.employmentStatus, nameFrom(departments, e.departmentId), nameFrom(designations, e.designationId), mgr(e.managerId), e.workLocation || "", e.panNumber || "", e.aadhaarMasked || "", e.uan || "", yn(e.pfEligible), yn(e.esiEligible), e.bankName || "", e.bankAccountMasked || "", e.ifscCode || "", e.currentAddress || "", e.permanentAddress || "", e.emergencyContactName || "", e.emergencyContactPhone || "", e.emergencyContactRelation || ""]);
  const f = format(range.from, "dd MMM yyyy"), t = format(range.to ?? range.from, "dd MMM yyyy");
  const span = f === t ? f : `${f} – ${t}`;
  exportXlsx({ filename: `joiners-${format(range.from, "yyyy-MM-dd")}.xlsx`, sheet: "Joiners", title: `Joiners · ${span} (${joiners.length})`, headers, rows });
}
