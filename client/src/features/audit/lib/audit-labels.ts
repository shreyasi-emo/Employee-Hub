// Audit-log presentation vocabulary: which badge tint an action gets, and the
// human label for each entity type.

export const actionColors: Record<string, string> = {
  create: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  update: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  delete: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  salary_change: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  payroll_lock: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  payroll_unlock: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  attendance_override: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  leave_approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  leave_rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  login: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  role_change: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
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
