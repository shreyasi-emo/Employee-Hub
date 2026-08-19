// Month labels, payroll-run status chips, and the rupee formatter.
export const months = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

export const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: "Draft", bg: "bg-gray-100 dark:bg-gray-700", text: "text-gray-800 dark:text-gray-300" },
  review: { label: "In Review", bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300" },
  approved: { label: "Approved", bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300" },
  locked: { label: "Locked", bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-800 dark:text-green-300" },
};

export function fmt(val: any) {
  return `₹${Math.round(parseFloat(val || "0")).toLocaleString("en-IN")}`;
}
