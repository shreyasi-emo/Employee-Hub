import { z } from "zod";

export const emptyForm = {
  firstName: "", lastName: "", email: "", phone: "", dateOfBirth: "", gender: "", maritalStatus: "",
  joinDate: new Date().toISOString().split("T")[0], confirmationDate: "", employmentType: "full_time", employmentStatus: "active",
  departmentId: "", designationId: "", managerId: "", workLocation: "", noticePeriodDays: "", probationDays: "", systemRole: "employee",
  panNumber: "", aadhaarMasked: "", uan: "", pfEligible: true, esiEligible: false,
  bankName: "", bankAccountMasked: "", ifscCode: "", currentAddress: "", permanentAddress: "",
  emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelation: "",
};

export const formSchema = z.object({
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

export type EmployeeFormValues = z.infer<typeof formSchema>;

/** Drop empty fields (the API treats absent as "unchanged") and coerce the two numerics. */
export function cleanPayload(data: EmployeeFormValues) {
  const p: any = {};
  Object.entries(data).forEach(([k, v]) => { if (v !== "" && v !== undefined && v !== null) p[k] = v; });
  if (p.noticePeriodDays) p.noticePeriodDays = Number(p.noticePeriodDays);
  if (p.probationDays) p.probationDays = Number(p.probationDays);
  return p;
}

/** Map an existing employee record onto the form's shape. */
export function formValuesFor(employee: any): EmployeeFormValues {
  return {
    ...emptyForm,
    ...Object.fromEntries(Object.keys(emptyForm).map((k) => [k, (employee as any)[k] ?? (emptyForm as any)[k]])),
    noticePeriodDays: employee.noticePeriodDays != null ? String(employee.noticePeriodDays) : "",
    probationDays: employee.probationDays != null ? String(employee.probationDays) : "",
    pfEligible: employee.pfEligible ?? true, esiEligible: employee.esiEligible ?? false,
  } as EmployeeFormValues;
}

/** A unique 4-letter department code derived from the name. */
export function makeDeptCode(name: string, departments: any[]): string {
  const existing = new Set(departments.map((d) => (d.code || "").toUpperCase()));
  const base = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 4) || "DEPT";
  let code = base, i = 1;
  while (existing.has(code)) code = `${base}${i++}`;
  return code;
}

// ---- ad-hoc work locations, kept client-side (there is no locations API) ----

const LOCATIONS_KEY = "emo_custom_locations";

export function loadLocations(): string[] {
  try { const r = localStorage.getItem(LOCATIONS_KEY); return r ? (JSON.parse(r) as string[]) : []; } catch { return []; }
}

export function saveLocations(next: string[]) {
  try { localStorage.setItem(LOCATIONS_KEY, JSON.stringify(next)); } catch { /* quota / private mode */ }
}
