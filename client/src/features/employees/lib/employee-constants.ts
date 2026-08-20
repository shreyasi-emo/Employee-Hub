// Option lists and chip palettes for the employee directory.

export const EMP_TYPES = [
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "intern", label: "Intern" },
  { value: "contract", label: "Contract" },
];

export const EMP_STATUSES = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "on_notice", label: "On Notice" },
  { value: "exited", label: "Exited" },
];

export const GENDERS = [{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }];

export const SYSTEM_ROLES = [
  { value: "employee", label: "Employee" },
  { value: "manager", label: "Manager" },
  { value: "hr_executive", label: "HR Executive" },
  { value: "hr_admin", label: "HR Admin" },
  { value: "hr_ops", label: "HR Ops" },
  { value: "recruiter", label: "Recruiter" },
  { value: "interviewer", label: "Interviewer" },
  { value: "finance", label: "Finance" },
  { value: "ceo_approver", label: "CEO Approver" },
  { value: "super_admin", label: "Super Admin" },
];

export const MARITAL = [{ value: "single", label: "Single" }, { value: "married", label: "Married" }, { value: "divorced", label: "Divorced" }, { value: "widowed", label: "Widowed" }];

export const typeLabel = (v: string) => EMP_TYPES.find((t) => t.value === v)?.label || v;

export const INSIGHT_COLORS = ["#206295", "#4BDCD9", "#425B8D", "#FFA962", "#FF6F62", "#6A7366", "#94A3B8", "#2F80B8"];

// Active state for department tabs & view toggle (requested radial gradient)
export const ACTIVE_TAB_STYLE = {
  background: "radial-gradient(182.45% 121.27% at 94.92% 136.33%, #36C 0%, #031887 57.08%, #000623 100%)",
  border: "1px solid rgba(0, 0, 0, 0.10)",
};

// Brand-color status chips (teal / grey / orange / coral) — no green.
// NOTE: the employee *profile* page uses a different, generic Tailwind palette for
// the same statuses. They are intentionally not shared — see employee-profile-page.tsx.
export const statusColors: Record<string, string> = {
  active: "bg-[#4BDCD9]/25 text-[#206295] dark:text-[#4BDCD9]",
  inactive: "bg-[#6A7366]/15 text-[#6A7366] dark:text-[#9aa39a]",
  on_notice: "bg-[#FFA962]/25 text-[#FFA962]",
  exited: "bg-[#FF6F62]/20 text-[#FF6F62]",
};
