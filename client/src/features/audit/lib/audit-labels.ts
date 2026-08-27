// Audit-log presentation vocabulary: which badge tint an action gets, and the
// human label for each entity type.

export const actionColors: Record<string, string> = {
  create: "bg-[#4BDCD9]/25 text-[#0E7C7B]",
  update: "bg-[#206295]/12 text-[#206295]",
  delete: "bg-[#FF6F62]/20 text-[#C4402F]",
  salary_change: "bg-muted text-muted-foreground",
  payroll_lock: "bg-[#FFA962]/25 text-[#D98324]",
  payroll_unlock: "bg-[#FF6F62]/20 text-[#C4402F]",
  attendance_override: "bg-[#FFA962]/25 text-[#D98324]",
  leave_approved: "bg-[#4BDCD9]/25 text-[#0E7C7B]",
  leave_rejected: "bg-[#FF6F62]/20 text-[#C4402F]",
  login: "bg-muted text-muted-foreground",
  role_change: "bg-muted text-muted-foreground",
};

export const entityTypeLabels: Record<string, string> = {
  employee: "Employee",
  salary: "Salary",
  payroll: "Payroll",
  attendance: "Attendance",
  leave: "Leave",
  user: "User",
  announcement: "Announcement",
  asset: "Asset",
  holiday: "Holiday",
};

/** First action-keyword match wins; falls back to the neutral "update" tint. */
export const actionColorFor = (action?: string) =>
  Object.entries(actionColors).find(([k]) => action?.includes(k))?.[1] || actionColors.update;
