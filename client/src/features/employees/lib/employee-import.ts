// Excel-based employee import: the downloadable template, the .xlsx/.csv parser, and per-row
// validation + mapping onto the SAME payload shape the manual "Add Employee" form submits.
// SheetJS (xlsx) is already a dependency (see lib/export-xlsx.ts) — reused here for reading too.
import { exportXlsx } from "@/lib/export-xlsx";
import { EMP_TYPES, EMP_STATUSES, GENDERS, MARITAL, SYSTEM_ROLES } from "./employee-constants";

// One column per Add-Employee field. `header` is what HR sees in the sheet; `field` is the payload key.
// `example` seeds the sample row in the template so the expected format is obvious.
type Col = { header: string; field: string; required?: boolean; example?: string };
export const IMPORT_COLUMNS: Col[] = [
  { header: "First Name", field: "firstName", required: true, example: "Asha" },
  { header: "Last Name", field: "lastName", required: true, example: "Rao" },
  { header: "Email", field: "email", required: true, example: "asha.rao@company.com" },
  { header: "Phone", field: "phone", example: "9876543210" },
  { header: "Date of Birth", field: "dateOfBirth", example: "1996-04-12" },
  { header: "Gender", field: "gender", example: "Female" },
  { header: "Marital Status", field: "maritalStatus", example: "Single" },
  { header: "Blood Group", field: "bloodGroup", example: "O+" },
  { header: "Join Date", field: "joinDate", required: true, example: "2024-06-01" },
  { header: "Confirmation Date", field: "confirmationDate", example: "" },
  { header: "Department", field: "department", example: "Engineering" },
  { header: "Designation", field: "designation", example: "Software Engineer" },
  { header: "Work Location", field: "workLocation", example: "Bangalore HQ" },
  { header: "Manager Email", field: "managerEmail", example: "" },
  { header: "System Role", field: "systemRole", example: "Employee" },
  { header: "Employment Type", field: "employmentType", example: "Full Time" },
  { header: "Employment Status", field: "employmentStatus", example: "Active" },
  { header: "Notice Period Days", field: "noticePeriodDays", example: "30" },
  { header: "Probation Days", field: "probationDays", example: "90" },
  { header: "PAN", field: "panNumber", example: "" },
  { header: "Aadhaar", field: "aadhaarMasked", example: "" },
  { header: "UAN", field: "uan", example: "" },
  { header: "PF Eligible", field: "pfEligible", example: "Yes" },
  { header: "ESI Eligible", field: "esiEligible", example: "No" },
  { header: "Bank Name", field: "bankName", example: "" },
  { header: "Bank Account", field: "bankAccountMasked", example: "" },
  { header: "IFSC", field: "ifscCode", example: "" },
  { header: "Current Address", field: "currentAddress", example: "" },
  { header: "Permanent Address", field: "permanentAddress", example: "" },
  { header: "Emergency Contact Name", field: "emergencyContactName", example: "" },
  { header: "Emergency Contact Phone", field: "emergencyContactPhone", example: "" },
  { header: "Emergency Contact Relation", field: "emergencyContactRelation", example: "" },
];

const norm = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
// normalized header → payload field, incl. aliases so the legacy CSV headers still import.
const HEADER_TO_FIELD: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const c of IMPORT_COLUMNS) m[norm(c.header)] = c.field;
  Object.assign(m, {
    location: "workLocation", type: "employmentType", status: "employmentStatus",
    manager: "managerEmail", dob: "dateOfBirth", role: "systemRole", pan: "panNumber",
    aadhaar: "aadhaarMasked", ifsc: "ifscCode",
  });
  return m;
})();

// value/label list → resolve a cell to the stored enum value (case-insensitive, accepts either form).
const resolver = (opts: { value: string; label: string }[]) => (raw: string): string | null => {
  const n = norm(raw);
  const hit = opts.find((o) => norm(o.value) === n || norm(o.label) === n);
  return hit ? hit.value : null;
};
const resolveType = resolver(EMP_TYPES);
const resolveStatus = resolver(EMP_STATUSES);
const resolveGender = resolver(GENDERS);
const resolveMarital = resolver(MARITAL);
const resolveRole = resolver(SYSTEM_ROLES);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const asBool = (raw: string): boolean | null => {
  const n = norm(raw); if (!n) return null;
  if (["yes", "true", "y", "1"].includes(n)) return true;
  if (["no", "false", "n", "0"].includes(n)) return false;
  return null;
};
const asDate = (raw: any): string | null => {
  if (!raw && raw !== 0) return null;
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw.toISOString().slice(0, 10);
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

/** Build + download the .xlsx template: a header row (row 1) plus one sample row. */
export async function downloadEmployeeTemplate() {
  await exportXlsx({
    filename: `employee-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`,
    sheet: "Employees",
    headers: IMPORT_COLUMNS.map((c) => c.header),
    rows: [IMPORT_COLUMNS.map((c) => c.example || "")],
  });
}

/** Read an .xlsx / .xls / .csv file into an array of {field: value} row objects keyed by our payload fields. */
export async function parseEmployeeFile(file: File): Promise<Record<string, any>[]> {
  const mod: any = await import("xlsx");
  const XLSX = mod.utils ? mod : mod.default; // CJS/ESM interop (same guard as export-xlsx.ts)
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" });
  if (!aoa.length) return [];
  const headerFields = (aoa[0] || []).map((h: any) => HEADER_TO_FIELD[norm(h)] || null);
  return aoa.slice(1)
    .filter((cells) => cells.some((c) => String(c ?? "").trim() !== ""))
    .map((cells) => {
      const o: Record<string, any> = {};
      headerFields.forEach((f, i) => { if (f) o[f] = cells[i]; });
      return o;
    });
}

export type ImportRow = {
  rowNum: number;      // 1-based data row (matches the spreadsheet minus the header)
  name: string;        // for display in the problem list
  payload?: Record<string, any>;
  errors: string[];    // block import
  warnings: string[];  // imported, but HR should know (e.g. a name that didn't match)
};

const str = (v: any) => String(v ?? "").trim();

/** Validate + map parsed rows against existing departments/designations/managers. */
export function validateEmployeeRows(
  rows: Record<string, any>[],
  ctx: { deptByName: Map<string, string>; desigByName: Map<string, string>; empIdByEmail: Map<string, string> },
): ImportRow[] {
  const seenEmails = new Set<string>();
  return rows.map((r, i) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const firstName = str(r.firstName), lastName = str(r.lastName), email = str(r.email);
    const name = `${firstName} ${lastName}`.trim() || email || `Row ${i + 1}`;

    if (!firstName) errors.push("First Name is required");
    if (!lastName) errors.push("Last Name is required");
    if (!email) errors.push("Email is required");
    else if (!EMAIL_RE.test(email)) errors.push(`Invalid email "${email}"`);
    else if (seenEmails.has(email.toLowerCase())) errors.push(`Duplicate email "${email}" in this file`);
    seenEmails.add(email.toLowerCase());

    const joinDate = asDate(r.joinDate);
    if (!str(r.joinDate)) errors.push("Join Date is required");
    else if (!joinDate) errors.push(`Invalid Join Date "${str(r.joinDate)}" (use YYYY-MM-DD)`);

    const payload: Record<string, any> = { firstName, lastName, email };
    if (joinDate) payload.joinDate = joinDate;
    if (str(r.phone)) payload.phone = str(r.phone);
    if (str(r.bloodGroup)) payload.bloodGroup = str(r.bloodGroup);
    for (const f of ["panNumber", "aadhaarMasked", "uan", "bankName", "bankAccountMasked", "ifscCode",
      "currentAddress", "permanentAddress", "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation"]) {
      if (str(r[f])) payload[f] = str(r[f]);
    }

    // dates (optional)
    for (const f of ["dateOfBirth", "confirmationDate"]) {
      if (str(r[f])) { const d = asDate(r[f]); if (d) payload[f] = d; else errors.push(`Invalid ${f} "${str(r[f])}"`); }
    }
    // numbers (optional)
    for (const f of ["noticePeriodDays", "probationDays"]) {
      if (str(r[f])) { const n = Number(str(r[f])); if (Number.isFinite(n)) payload[f] = n; else errors.push(`Invalid ${f} "${str(r[f])}"`); }
    }
    // enums
    const et = str(r.employmentType); if (et) { const v = resolveType(et); v ? (payload.employmentType = v) : errors.push(`Unknown Employment Type "${et}"`); }
    const es = str(r.employmentStatus); if (es) { const v = resolveStatus(es); v ? (payload.employmentStatus = v) : errors.push(`Unknown Employment Status "${es}"`); }
    const g = str(r.gender); if (g) { const v = resolveGender(g); v ? (payload.gender = v) : errors.push(`Unknown Gender "${g}"`); }
    const ms = str(r.maritalStatus); if (ms) { const v = resolveMarital(ms); v ? (payload.maritalStatus = v) : errors.push(`Unknown Marital Status "${ms}"`); }
    const sr = str(r.systemRole); if (sr) { const v = resolveRole(sr); v ? (payload.systemRole = v) : errors.push(`Unknown System Role "${sr}"`); }
    // booleans
    for (const f of ["pfEligible", "esiEligible"]) {
      if (str(r[f])) { const b = asBool(str(r[f])); b === null ? errors.push(`${f} must be Yes/No`) : (payload[f] = b); }
    }
    // name-resolved references — a provided-but-unmatched value is a warning, not a hard failure
    const dept = str(r.department);
    if (dept) { const id = ctx.deptByName.get(dept.toLowerCase()); id ? (payload.departmentId = id) : warnings.push(`Department "${dept}" not found — left blank`); }
    const desig = str(r.designation);
    if (desig) { const id = ctx.desigByName.get(desig.toLowerCase()); id ? (payload.designationId = id) : warnings.push(`Designation "${desig}" not found — left blank`); }
    if (str(r.workLocation)) payload.workLocation = str(r.workLocation);
    const mgr = str(r.managerEmail);
    if (mgr) { const id = ctx.empIdByEmail.get(mgr.toLowerCase()); id ? (payload.managerId = id) : warnings.push(`Manager "${mgr}" not found — left blank`); }

    return { rowNum: i + 1, name, payload: errors.length ? undefined : payload, errors, warnings };
  });
}
